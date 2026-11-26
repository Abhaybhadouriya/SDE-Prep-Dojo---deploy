"""enricher: the stream processor in the middle of ShopStream.

Reads   orders.created  (consumer group "enricher")
Writes  orders.enriched (good orders, with price + total)
        orders.retry    (temporary failure, e.g. price lookup timed out)
        orders.dlq      (poison message: bad JSON, missing fields - retrying will never help)

Exactly-once (EOS) read-process-write, one Kafka transaction per batch:

    begin_transaction()
      produce N output records (enriched / retry / dlq)
      send_offsets_to_transaction(input offsets)   <- the consumer "commit" is INSIDE the txn
    commit_transaction()

Either all outputs AND the input offsets become visible together, or none do.
A crash in the middle => the transaction is aborted, read_committed readers never
see the half-done outputs, and we re-read the same input. No duplicates, no loss
(inside Kafka. Writing to an external DB needs idempotency - see postgres-sink).

From your world: it is like a two-phase commit across "consume pointer" and
"output ring" - the transaction coordinator on the broker is the arbiter.
"""

from __future__ import annotations

import json
import os
import random
import time

from confluent_kafka import (Consumer, KafkaError, KafkaException, Producer,
                             TopicPartition)
from prometheus_client import Counter, Gauge, start_http_server

from shopstream_common import (HOSTNAME, TOPIC_CREATED, TOPIC_DLQ,
                               TOPIC_ENRICHED, TOPIC_RETRY, GracefulExit,
                               consumer_config, headers_to_dict,
                               idempotent_producer_config, now_ms,
                               setup_logging, to_json)

log = setup_logging("enricher")

GROUP_ID = os.getenv("GROUP_ID", "enricher")
BATCH_SIZE = int(os.getenv("BATCH_SIZE", "200"))
MAX_ATTEMPTS = int(os.getenv("MAX_ATTEMPTS", "4"))
BASE_BACKOFF_MS = int(os.getenv("BASE_BACKOFF_MS", "2000"))
# Demo knob: fraction of orders whose price lookup "times out" (goes to retry).
TRANSIENT_FAIL_RATE = float(os.getenv("TRANSIENT_FAIL_RATE", "0.0"))
# Demo knob: slow every message down (ms) so you can watch consumer lag grow.
PROCESSING_DELAY_MS = int(os.getenv("PROCESSING_DELAY_MS", "0"))
CATALOG_SOURCE = os.getenv("CATALOG_SOURCE", "static")  # static | postgres
# Circuit breaker: after the catalog DB fails, fail fast for this long instead of
# reconnecting (connect_timeout=3 s) for every single record of the batch.
DB_COOLDOWN_S = float(os.getenv("DB_COOLDOWN_S", "5"))
# Time budget per batch/transaction. Must stay well below transaction.timeout.ms
# (60 s) and max.poll.interval.ms (300 s), or the coordinator aborts the txn /
# the group kicks us out. Records not reached in time are re-read next loop.
BATCH_BUDGET_S = float(os.getenv("BATCH_BUDGET_S", "20"))

PROCESSED = Counter("shopstream_enricher_records_total", "Records handled", ["outcome"])
TXN_ABORTS = Counter("shopstream_enricher_txn_aborts_total", "Aborted transactions")
ASSIGNED = Gauge("shopstream_enricher_assigned_partitions", "Partitions owned by this instance")

# A tiny static catalog: product_id -> (name, unit price in paise/cents)
STATIC_CATALOG = {
    "P-100": ("Coffee mug", 29900), "P-101": ("Notebook", 9900),
    "P-102": ("Headphones", 249900), "P-103": ("Keyboard", 179900),
    "P-104": ("Water bottle", 49900), "P-105": ("Backpack", 129900),
    "P-106": ("Desk lamp", 89900), "P-107": ("USB-C cable", 39900),
}


class PoisonMessage(Exception):
    """Retrying cannot fix this record. Send it to the DLQ."""


class TransientError(Exception):
    """Might work later (dependency down / timeout). Send to retry topic."""


class Catalog:
    def __init__(self):
        self._cache: dict[str, tuple[str, int]] = dict(STATIC_CATALOG)
        self._conn = None
        self._down_until = 0.0  # monotonic time until which we treat the DB as down
        if CATALOG_SOURCE == "postgres":
            import psycopg  # imported lazily so static mode needs no DB
            self._psycopg = psycopg
            self._dsn = os.environ.get("DATABASE_URL", "")

    def price(self, product_id: str) -> tuple[str, int]:
        if TRANSIENT_FAIL_RATE and random.random() < TRANSIENT_FAIL_RATE:
            raise TransientError("price service timeout (simulated)")
        if CATALOG_SOURCE == "postgres":
            if time.monotonic() < self._down_until:
                # Breaker open: do not spend 3 s reconnecting per record.
                raise TransientError("catalog db marked down (circuit breaker open)")
            try:
                if self._conn is None or self._conn.closed:
                    self._conn = self._psycopg.connect(self._dsn, autocommit=True, connect_timeout=3)
                row = self._conn.execute(
                    "SELECT name, price_cents FROM products WHERE product_id = %s", (product_id,)
                ).fetchone()
            except self._psycopg.OperationalError as exc:
                self._conn = None
                self._down_until = time.monotonic() + DB_COOLDOWN_S
                raise TransientError(f"catalog db unavailable: {exc}") from exc
            if row:
                return row[0], int(row[1])
        if product_id in self._cache:
            return self._cache[product_id]
        raise PoisonMessage(f"unknown product {product_id}")


def enrich(raw: bytes | None, catalog: Catalog) -> dict:
    """Pure-ish business logic: validate + add prices. Raises Poison/Transient."""
    try:
        order = json.loads(raw or b"")
    except (ValueError, UnicodeDecodeError) as exc:
        raise PoisonMessage(f"not valid JSON: {exc}") from exc
    if not isinstance(order, dict):
        raise PoisonMessage("event is not a JSON object")
    for field in ("order_id", "customer_id", "items"):
        if field not in order:
            raise PoisonMessage(f"missing field {field}")
    if not isinstance(order["items"], list) or not order["items"]:
        raise PoisonMessage("items must be a non-empty list")

    lines, total = [], 0
    for item in order["items"]:
        qty = item.get("quantity") if isinstance(item, dict) else None
        if not isinstance(qty, int) or qty <= 0:
            raise PoisonMessage(f"bad quantity in {item}")
        name, unit = catalog.price(item.get("product_id", ""))
        lines.append({**item, "name": name, "unit_price_cents": unit, "line_total_cents": unit * qty})
        total += unit * qty
    return {**order, "type": "OrderEnriched", "items": lines,
            "total_cents": total, "currency": "INR", "enriched_at_ms": now_ms()}


def backoff_ms(attempt: int) -> int:
    """Exponential backoff with full jitter: 2s, 4s, 8s ... capped at 60s."""
    return random.randint(0, min(60000, BASE_BACKOFF_MS * (2 ** (attempt - 1))))


def rewind(consumer: Consumer):
    """After an abort, go back to the last committed offsets so we re-read the batch."""
    assignment = consumer.assignment()
    if not assignment:
        return
    for tp in consumer.committed(assignment, timeout=10):
        # OFFSET_INVALID (-1001) means "nothing committed yet": restart from the beginning.
        tp.offset = tp.offset if tp.offset >= 0 else 0
        consumer.seek(tp)


def main():
    start_http_server(int(os.getenv("METRICS_PORT", "8000")))
    catalog = Catalog()

    producer = Producer({
        **idempotent_producer_config(),
        # Stable id per instance. A restarted instance with the same id "fences"
        # its zombie predecessor (broker bumps the producer epoch).
        "transactional.id": os.getenv("TRANSACTIONAL_ID", f"enricher-{HOSTNAME}"),
        "transaction.timeout.ms": 60000,
    })
    producer.init_transactions(30)

    consumer = Consumer(consumer_config(GROUP_ID))

    def on_assign(c, parts):
        log.info("assigned %s", [f"{p.topic}[{p.partition}]" for p in parts])
        ASSIGNED.set(len(c.assignment()))

    def on_revoke(c, parts):
        log.info("revoked %s", [f"{p.topic}[{p.partition}]" for p in parts])
        ASSIGNED.set(max(0, len(c.assignment()) - len(parts)))

    consumer.subscribe([TOPIC_CREATED], on_assign=on_assign, on_revoke=on_revoke)
    stop = GracefulExit(log)
    log.info("enricher up: group=%s catalog=%s fail_rate=%s", GROUP_ID, CATALOG_SOURCE, TRANSIENT_FAIL_RATE)

    while stop.running:
        msgs = consumer.consume(num_messages=BATCH_SIZE, timeout=1.0)
        if not msgs:
            continue
        producer.begin_transaction()
        started = time.monotonic()
        # next offset to commit per partition, and where to resume if we stop early
        done_upto: dict[tuple[str, int], int] = {}
        resume_at: dict[tuple[str, int], int] = {}
        try:
            for m in msgs:
                tp_key = (m.topic(), m.partition())
                if tp_key in resume_at:
                    continue  # this partition already stopped early; keep order
                if time.monotonic() - started > BATCH_BUDGET_S and not m.error():
                    # Out of time: stop this partition here, commit what is done.
                    resume_at[tp_key] = m.offset()
                    continue
                if m.error():
                    if m.error().code() != KafkaError._PARTITION_EOF:
                        log.warning("consume error: %s", m.error())
                    continue
                if PROCESSING_DELAY_MS:
                    time.sleep(PROCESSING_DELAY_MS / 1000)
                hdrs = headers_to_dict(m.headers())
                attempt = int(hdrs.get("attempt", "0"))
                try:
                    out = enrich(m.value(), catalog)
                    producer.produce(TOPIC_ENRICHED, key=m.key(), value=to_json(out),
                                     headers={"event-type": "OrderEnriched"})
                    PROCESSED.labels("enriched").inc()
                except TransientError as exc:
                    nxt = attempt + 1
                    if nxt > MAX_ATTEMPTS:
                        route, reason = TOPIC_DLQ, f"gave up after {attempt} attempts: {exc}"
                    else:
                        route, reason = TOPIC_RETRY, str(exc)
                    producer.produce(route, key=m.key(), value=m.value(), headers={
                        "attempt": str(nxt),
                        "retry-at-ms": str(now_ms() + backoff_ms(nxt)),
                        "error": reason[:500],
                        "origin": f"{m.topic()}/{m.partition()}/{m.offset()}",
                    })
                    PROCESSED.labels("retry" if route == TOPIC_RETRY else "dlq").inc()
                except PoisonMessage as exc:
                    producer.produce(TOPIC_DLQ, key=m.key(), value=m.value(), headers={
                        "error": str(exc)[:500],
                        "origin": f"{m.topic()}/{m.partition()}/{m.offset()}",
                        "failed-at-ms": str(now_ms()),
                    })
                    PROCESSED.labels("dlq").inc()
                    log.warning("poison -> DLQ: %s (%s/%s/%s)", exc, m.topic(), m.partition(), m.offset())
                done_upto[tp_key] = m.offset() + 1
            # Commit the INPUT offsets as part of the same transaction.
            if resume_at:
                offsets = [TopicPartition(t, p, o) for (t, p), o in done_upto.items()]
                log.warning("batch over %.0fs budget, %d partition(s) stop early",
                            BATCH_BUDGET_S, len(resume_at))
            else:
                offsets = consumer.position(consumer.assignment())
            if offsets:
                producer.send_offsets_to_transaction(
                    offsets, consumer.consumer_group_metadata(), 30)
            producer.commit_transaction(30)
            for (t, p), o in resume_at.items():
                consumer.seek(TopicPartition(t, p, o))  # re-read the skipped tail
        except KafkaException as exc:
            err = exc.args[0]
            TXN_ABORTS.inc()
            if err.txn_requires_abort():
                log.warning("aborting transaction: %s", err)
                producer.abort_transaction(30)
                rewind(consumer)
            elif err.retriable():
                log.warning("retriable txn error, aborting and re-reading: %s", err)
                producer.abort_transaction(30)
                rewind(consumer)
            else:
                # Fatal (e.g. we were fenced by a newer instance). Exit; k8s restarts us.
                log.error("fatal producer error, exiting: %s", err)
                raise

    log.info("closing consumer (leaves group -> fast rebalance)")
    consumer.close()
    producer.flush(10)


if __name__ == "__main__":
    main()
