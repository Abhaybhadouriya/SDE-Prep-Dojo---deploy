"""postgres-sink: stores enriched orders in Postgres, safely.

Reads orders.enriched (group "postgres-sink", read_committed) in batches and
UPSERTs them on order_id. Offsets are committed only AFTER the DB transaction
commits. That gives:

    at-least-once delivery  +  idempotent write  =  effectively exactly-once

If we crash after the DB commit but before the offset commit, we will read the
same records again - the upsert simply rewrites the same row. No duplicates.

From your world: like a NIC driver that only advances the RX ring head after the
packet was copied into the socket buffer - and the copy is safe to repeat.
"""

from __future__ import annotations

import json
import os
import time

import psycopg
from confluent_kafka import Consumer
from prometheus_client import Counter, start_http_server

from shopstream_common import (TOPIC_ENRICHED, GracefulExit, consumer_config,
                               setup_logging)

log = setup_logging("postgres-sink")
DSN = os.environ.get("DATABASE_URL", "postgresql://shopstream:shopstream@postgres:5432/shopstream")
BATCH_SIZE = int(os.getenv("BATCH_SIZE", "500"))

WRITTEN = Counter("shopstream_sink_rows_total", "Rows upserted into Postgres")
DB_ERRORS = Counter("shopstream_sink_db_errors_total", "DB write failures (batch retried)")

UPSERT = """
INSERT INTO orders (order_id, customer_id, total_cents, currency, items, created_at,
                    kafka_partition, kafka_offset)
VALUES (%(order_id)s, %(customer_id)s, %(total_cents)s, %(currency)s, %(items)s,
        %(created_at)s, %(kafka_partition)s, %(kafka_offset)s)
ON CONFLICT (order_id) DO UPDATE SET
    total_cents = EXCLUDED.total_cents,
    items       = EXCLUDED.items,
    kafka_partition = EXCLUDED.kafka_partition,
    kafka_offset    = EXCLUDED.kafka_offset,
    updated_at  = now()
-- Only move forward: an older copy never overwrites a newer one. (Same order_id
-- always has the same key => same partition, so offsets are comparable.)
WHERE orders.kafka_offset <= EXCLUDED.kafka_offset
"""


def connect() -> psycopg.Connection:
    while True:
        try:
            return psycopg.connect(DSN, connect_timeout=5)
        except psycopg.OperationalError as exc:
            log.warning("postgres not ready (%s), retrying in 2s", exc)
            time.sleep(2)


def main():
    start_http_server(int(os.getenv("METRICS_PORT", "8000")))
    conn = connect()
    consumer = Consumer(consumer_config(os.getenv("GROUP_ID", "postgres-sink")))
    consumer.subscribe([TOPIC_ENRICHED])
    stop = GracefulExit(log)
    log.info("sink up, writing to postgres")

    while stop.running:
        msgs = [m for m in consumer.consume(num_messages=BATCH_SIZE, timeout=1.0) if not m.error()]
        if not msgs:
            continue
        rows = []
        for m in msgs:
            try:
                o = json.loads(m.value())
                rows.append({
                    "order_id": o["order_id"], "customer_id": o["customer_id"],
                    "total_cents": o["total_cents"], "currency": o.get("currency", "INR"),
                    "items": json.dumps(o["items"]), "created_at": o["created_at"],
                    "kafka_partition": m.partition(), "kafka_offset": m.offset(),
                })
            except (ValueError, KeyError) as exc:
                # Enricher already validated; this should not happen. Log and skip.
                log.error("skipping malformed enriched record %s/%s: %s", m.partition(), m.offset(), exc)
        while stop.running:
            try:
                with conn.transaction():
                    with conn.cursor() as cur:
                        cur.executemany(UPSERT, rows)
                break
            except psycopg.OperationalError as exc:
                # DB down: keep the batch, reconnect, try again. Lag grows meanwhile
                # (that is backpressure - Kafka buffers for us).
                DB_ERRORS.inc()
                log.warning("db write failed (%s); reconnecting", exc)
                time.sleep(2)
                conn = connect()
        else:
            break  # shutting down without writing: do NOT commit offsets
        WRITTEN.inc(len(rows))
        consumer.commit(asynchronous=False)  # commit AFTER the DB commit
        log.info("upserted %d rows (last p%s@%s)", len(rows), msgs[-1].partition(), msgs[-1].offset())

    consumer.close()
    conn.close()


if __name__ == "__main__":
    main()
