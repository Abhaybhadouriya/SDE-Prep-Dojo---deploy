# ShopStream - an end-to-end Kafka pipeline you can run on your laptop

ShopStream is a tiny e-commerce backend. A customer places an order; the order flows through Kafka,
gets checked and priced, lands in Postgres, and shows up on a live revenue dashboard.
It is the reference project for the **End-to-End Kafka Pipeline** track of SDE Prep Dojo.

```
 loadgen / curl
      |
      v  POST /orders
 +-----------+   orders.created (6 partitions, RF 3, key = customer_id)
 | order-api |----------------------------+
 +-----------+  idempotent, acks=all      |
                                          v
                               +---------------------+   orders.retry  +--------------+
                               | enricher (group)    |---------------->| retry-worker |--+
                               | validate + price    |<----------------+--------------+  |
                               | EOS transactions    |    (after backoff, back to orders.created)
                               +---------------------+
                                  |              \ poison / too many attempts
                orders.enriched   |               +--------> orders.dlq
                    +-------------+-------------+
                    v                           v
            +---------------+           +-------------+
            | postgres-sink |           |  analytics  |  1-minute revenue windows
            | upsert        |           |  /metrics   |
            +---------------+           +-------------+
                    v
                Postgres                 kafka-exporter -> Prometheus -> Grafana (lag dashboard)
                                         kafka-ui (browse topics, messages, groups)
```

## What each piece teaches

| Piece | Kafka idea it shows |
|---|---|
| `services/order-api/app.py` | Idempotent producer, `acks=all`, keys and partitions, backpressure (`BufferError` -> HTTP 503) |
| `services/enricher/enricher.py` | Consumer groups, transactional read-process-write (exactly-once inside Kafka), poison vs transient errors |
| `services/enricher/retry_worker.py` | Retry topic with exponential backoff, pause/resume partitions, no head-of-line blocking |
| `services/postgres-sink/sink.py` | At-least-once + idempotent upsert = effectively-once into a database; commit offsets after the DB |
| `services/analytics/analytics.py` | Stream processing: tumbling windows, event time, watermark, late events |
| `scripts/create-topics.sh` | Partitions, replication factor 3, `min.insync.replicas=2`, retention |
| `docker-compose.yml` | 3-broker KRaft cluster (no ZooKeeper), healthchecks, init containers |
| `k8s/` | Strimzi operator, KafkaNodePools, KafkaTopic CRs, HPA vs KEDA, PDB, NetworkPolicy |
| `scripts/chaos/` | Broker failure, stalled consumer, poison messages, rebalance, replay |

## Requirements

- Docker Desktop 4.30+ (Docker Engine 27+, Compose v2) with **at least 6 GB RAM** for the 3-broker stack
  (about 4 GB for the single-broker file).
- Python 3.9+ on your machine for the load generator (standard library only, no pip install).
- For `k8s/`: kubectl and kind. See `k8s/README.md`.

Images used (pinned, checked November 2026): `apache/kafka:4.3.2`, `postgres:17-alpine`, `python:3.12-slim`,
`provectuslabs/kafka-ui:v0.7.2`, `danielqsj/kafka-exporter:v1.11.0`, `prom/prometheus:v3.15.1`,
`grafana/grafana:13.2.6`. Python client: `confluent-kafka==2.16.2` (librdkafka).

Why Kafka 4.3.2 and not the newest 4.4.x? The Kubernetes half uses Strimzi 1.3.1, whose newest
supported Kafka is 4.3.2, so Compose and Kubernetes run the same version. The pages link the
matching 4.3 docs (`kafka.apache.org/43/...`).

## Run it (step by step)

All commands run from this folder (`pipeline/code`). PowerShell and bash both work for the
`docker compose` lines.

### 1. Start everything

```bash
cp .env.example .env          # optional; defaults are built in   (PowerShell: Copy-Item .env.example .env)
docker compose up -d --build
docker compose ps
```

Expected after 1-2 minutes: `kafka-1/2/3` are `healthy`, `topics-init` shows `Exited (0)`, the rest are `Up`.

```bash
docker compose logs topics-init
```

Expected (last lines): a `Topic: orders.created ... PartitionCount: 6 ReplicationFactor: 3 Configs: min.insync.replicas=2,...`
block with 6 partition rows (leaders spread over brokers 1, 2, 3), then `topics ready`.

### 2. Send one order

```bash
curl -X POST localhost:8000/orders -H "Content-Type: application/json" \
  -d '{"customer_id":"C-42","items":[{"product_id":"P-102","quantity":1},{"product_id":"P-100","quantity":2}]}'
```

PowerShell:

```powershell
$body = '{"customer_id":"C-42","items":[{"product_id":"P-102","quantity":1},{"product_id":"P-100","quantity":2}]}'
Invoke-RestMethod -Method Post -Uri http://localhost:8000/orders -ContentType 'application/json' -Body $body
```

Expected: `{"order_id":"<uuid>","status":"ACCEPTED","partition":<0-5>,"offset":<n>}`.
Send it again with the same `customer_id`: the partition is the same (same key -> same partition).

### 3. Follow it through the pipeline

```bash
docker compose logs -f enricher postgres-sink analytics
docker compose exec postgres psql -U shopstream -c "SELECT order_id, customer_id, total_cents/100.0 AS inr, kafka_partition, kafka_offset FROM orders ORDER BY inserted_at DESC LIMIT 5;"
```

Expected: the sink logs `upserted 1 rows`, Postgres shows the order with total `INR 3097.00`
(2499 + 2 x 299).

### 4. Put load on it

```bash
python loadgen/loadgen.py --rps 20 --seconds 120
python loadgen/loadgen.py --rps 20 --seconds 60 --bad 0.05          # 5 % unknown products -> DLQ
python loadgen/loadgen.py --rps 20 --seconds 60 --hot-customer 0.5  # hot key: one partition gets half the traffic
```

### 5. Look at it

| URL | What you see |
|---|---|
| http://localhost:8080 | kafka-ui: topics, partitions, messages (with headers), consumer groups and lag |
| http://localhost:3000 | Grafana (anonymous viewer): "ShopStream - Kafka lag & pipeline health" |
| http://localhost:9090 | Prometheus: try `sum by (consumergroup) (kafka_consumergroup_lag)` |
| http://localhost:8001/windows | analytics: closed 1-minute revenue windows as JSON |
| http://localhost:8000/docs | order-api Swagger UI |

Command-line view of the same thing:

```bash
docker compose exec kafka-1 /opt/kafka/bin/kafka-consumer-groups.sh --bootstrap-server kafka-1:19092 --describe --all-groups
docker compose exec kafka-1 /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server kafka-1:19092 \
  --topic orders.enriched --from-beginning --max-messages 3 --property print.key=true --isolation-level read_committed
```

### 6. Stop

```bash
docker compose down        # keep data
docker compose down -v     # delete Kafka + Postgres data too
```

### Low-RAM option: one broker

```bash
docker compose -f compose.single-broker.yml up -d --build
docker compose -f compose.single-broker.yml down -v
```

Same services, replication factor 1. The broker-failure drill does not apply (one broker = no failover).
Prometheus/Grafana are not included in this file to save memory.

## Demo knobs (in `.env`, then `docker compose up -d enricher`)

| Variable | Effect |
|---|---|
| `TRANSIENT_FAIL_RATE=0.2` | 20 % of price lookups "time out" -> orders.retry -> retried with backoff -> DLQ after 4 retries (5 tries; caps 2/4/8/16 s, so at most ~30 s of retrying) |
| `PROCESSING_DELAY_MS=50` | enricher slows to about 20 msg/s per instance -> watch lag climb in Grafana, then scale it |
| `CATALOG_SOURCE=static` | price from the built-in table instead of Postgres |

Scale the consumer group (max useful = 6, the partition count):

```bash
docker compose up -d --scale enricher=3
```

## Failure drills

Each drill exists as bash (`.sh`) and PowerShell (`.ps1`) in `scripts/chaos/`.

| Drill | bash | PowerShell | What you should see |
|---|---|---|---|
| Kill a broker | `bash scripts/chaos/01-kill-broker.sh kafka-2` | `.\scripts\chaos\01-kill-broker.ps1 -Broker kafka-2` | ISR shrinks to 2 replicas, leaders move, orders still accepted, then ISR returns to 3 |
| Stall a consumer | `bash scripts/chaos/02-pause-consumer.sh 30` | `.\scripts\chaos\02-pause-consumer.ps1 -Seconds 30` | LAG of `postgres-sink` grows, API unaffected, lag drains after unpause |
| Poison message | `bash scripts/chaos/03-poison-message.sh` | `.\scripts\chaos\03-poison-message.ps1` | 3 bad records in `orders.dlq` with `error` and `origin` headers, good order still processed |
| Rebalance | `bash scripts/chaos/04-rebalance.sh` | `.\scripts\chaos\04-rebalance.ps1` | 6 partitions split 2/2/2 across 3 members, hard kill = 45 s pause for that member's partitions |
| Replay | `bash scripts/chaos/05-replay.sh` | `.\scripts\chaos\05-replay.ps1` | analytics re-reads orders.enriched from offset 0 and rebuilds windows |
| On Kubernetes | `bash scripts/chaos/k8s-drills.sh broker` | `.\scripts\chaos\k8s-drills.ps1 -Drill broker` | Strimzi recreates the deleted broker pod |

If PowerShell blocks scripts: `powershell -ExecutionPolicy Bypass -File scripts\chaos\01-kill-broker.ps1`.

Kafka needs a majority of controllers (2 of 3) to work. Kill **two** brokers in this compose setup and
writes stop: ISR would drop below `min.insync.replicas=2` (producers get `NOT_ENOUGH_REPLICAS`) and
the KRaft quorum is lost. That is the system choosing consistency over availability.

## Delivery guarantees, in one table

| Hop | Guarantee | Why |
|---|---|---|
| client -> order-api | at-least-once if the client retries | resend with the same `order_id` is safe: sink upserts |
| order-api -> Kafka | no loss, no duplicates from producer retries | idempotent producer + `acks=all` + `min.insync.replicas=2` |
| orders.created -> enricher -> orders.enriched/retry/dlq | exactly-once | Kafka transactions: outputs + input offsets commit atomically |
| orders.enriched -> Postgres | effectively-once | at-least-once delivery + upsert on `order_id` primary key |
| orders.enriched -> analytics | at-most-once for open windows; duplicates from upstream re-drives are counted twice | offsets are committed while window state lives only in memory, so a crash loses open windows; a real system checkpoints state with offsets (Kafka Streams / Flink) and dedupes by `order_id` |

**Ordering note:** orders of one customer stay in order on the happy path (same key, same partition).
A retried order goes through orders.retry and can overtake newer orders of that customer. If you need
strict per-key order, stop processing that key until its retry succeeds ("park the key") instead.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `kafka-1` keeps restarting, log says `Invalid cluster.id` | old volume from a different `KAFKA_CLUSTER_ID`. Run `docker compose down -v`. |
| `topics-init` exits 1 | a broker was not ready. `docker compose up -d topics-init` runs it again (`--if-not-exists` makes it safe). |
| Services log `Failed to resolve 'kafka-1:19092'` | they started before the brokers; they retry by themselves. If it continues, `docker compose ps` and check broker health. |
| A host tool cannot connect to `localhost:9092` | use `localhost:9092,localhost:9192,localhost:9292`. Inside containers use `kafka-1:19092` - that is why there are two listeners (INTERNAL / EXTERNAL). |
| order-api returns 503 `producer queue full` | brokers are down or slow; this is backpressure working. Check `docker compose ps`. |
| order-api returns 504 | no broker ack within `ACK_TIMEOUT_S` (10 s). Usually fewer than 2 brokers alive. |
| Lag never goes down | consumer crashing in a loop: `docker compose logs enricher`. A fatal `ProducerFenced` means two instances had the same `transactional.id`. |
| Grafana panels empty | wait 30 s for scrapes; open http://localhost:9090/targets - all targets should be `UP`. |
| `Ports are not available` | something else uses 8000/8080/3000/5432/9092. Stop it or change the left side of `ports:` in the compose file. |
| Docker Desktop is slow or containers get OOM-killed | raise memory in Docker Desktop settings, or use `compose.single-broker.yml`. |
| `.sh` scripts fail with `$'\r': command not found` | Windows line endings. `.gitattributes` forces LF; or run `dos2unix scripts/*.sh scripts/chaos/*.sh`. |

## Credits and references

Patterns re-implemented in our own code after reading: Apache Kafka docs (KRaft, Docker image,
transactions), Confluent `confluent-kafka-python` examples (EOS read-process-write), Strimzi docs and
`packaging/examples` (KafkaNodePool, Kafka v1 API), KEDA Kafka scaler docs, kafka_exporter README.
