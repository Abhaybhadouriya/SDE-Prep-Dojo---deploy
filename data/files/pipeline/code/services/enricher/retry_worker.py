"""retry-worker: gives temporarily failed orders another chance, later.

Reads orders.retry. Each record carries a header `retry-at-ms` (when it may be
tried again) and `attempt`. If it is not time yet, we PAUSE that partition and
come back later (we never sleep while holding the poll loop for minutes - that
would blow max.poll.interval.ms and trigger a rebalance). When it is time, we
send the record back to orders.created with its attempt header, inside a
transaction together with the offset commit (exactly-once hand-off).

Why a separate retry topic instead of retrying in place?
  Retrying in place blocks the whole partition behind one bad record
  ("head-of-line blocking"). Moving it aside keeps the main flow moving.
Trade-off: a retried order can overtake newer orders of the same customer.
If strict per-key order matters, park the key instead (see README "ordering").

Small head-of-line blocking remains HERE: a partition is paused for its head
record, so a record behind it that is due sooner (attempt 1, under 2 s) waits for
the head (attempt 4, up to 16 s). Fine at low volume. At scale use one topic per
delay tier (orders.retry.5s, .1m, .10m) so every record in a topic shares one
delay - the approach Uber described for its retry queues.
"""

from __future__ import annotations

import os
import time

from confluent_kafka import Consumer, KafkaException, Producer, TopicPartition
from prometheus_client import Counter, Gauge, start_http_server

from shopstream_common import (HOSTNAME, TOPIC_CREATED, TOPIC_RETRY,
                               GracefulExit, consumer_config, headers_to_dict,
                               idempotent_producer_config, now_ms,
                               setup_logging)

log = setup_logging("retry-worker")

RETRIED = Counter("shopstream_retry_worker_retried_total", "Records sent back to orders.created")
TXN_FAILS = Counter("shopstream_retry_worker_txn_failures_total", "Retry transactions that failed")
PAUSED = Gauge("shopstream_retry_worker_paused_partitions", "Partitions paused waiting for retry-at-ms")


def main():
    start_http_server(int(os.getenv("METRICS_PORT", "8000")))
    producer = Producer({**idempotent_producer_config(),
                         "transactional.id": os.getenv("TRANSACTIONAL_ID", f"retry-{HOSTNAME}")})
    producer.init_transactions(30)
    consumer = Consumer(consumer_config(os.getenv("GROUP_ID", "retry-worker")))
    consumer.subscribe([TOPIC_RETRY])
    stop = GracefulExit(log)
    paused: dict[tuple[str, int], int] = {}  # (topic, partition) -> resume at ms

    while stop.running:
        # Resume partitions whose wait is over.
        due = [TopicPartition(t, p) for (t, p), at in paused.items() if at <= now_ms()]
        if due:
            consumer.resume(due)
            for tp in due:
                paused.pop((tp.topic, tp.partition), None)
        PAUSED.set(len(paused))

        msg = consumer.poll(1.0)
        if msg is None or msg.error():
            continue
        hdrs = headers_to_dict(msg.headers())
        retry_at = int(hdrs.get("retry-at-ms", "0"))
        if retry_at > now_ms():
            # Not yet. Rewind to this record and pause the partition until retry_at.
            tp = TopicPartition(msg.topic(), msg.partition(), msg.offset())
            consumer.seek(tp)
            consumer.pause([tp])
            paused[(msg.topic(), msg.partition())] = retry_at
            continue

        producer.begin_transaction()
        try:
            producer.produce(TOPIC_CREATED, key=msg.key(), value=msg.value(),
                             headers={"attempt": hdrs.get("attempt", "1"),
                                      "retried-from": hdrs.get("origin", "")})
            producer.send_offsets_to_transaction(
                [TopicPartition(msg.topic(), msg.partition(), msg.offset() + 1)],
                consumer.consumer_group_metadata(), 30)
            producer.commit_transaction(30)
            RETRIED.inc()
            log.info("retried key=%s attempt=%s", msg.key(), hdrs.get("attempt"))
        except KafkaException as exc:
            TXN_FAILS.inc()
            log.warning("retry txn failed, will re-read: %s", exc)
            producer.abort_transaction(30)
            consumer.seek(TopicPartition(msg.topic(), msg.partition(), msg.offset()))
            time.sleep(1)

    consumer.close()


if __name__ == "__main__":
    main()
