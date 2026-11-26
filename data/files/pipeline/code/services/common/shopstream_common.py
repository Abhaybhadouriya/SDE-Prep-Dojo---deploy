"""Shared helpers for every ShopStream service.

Everything a service needs to talk to Kafka lives here, so each service file
can focus on its own job. Settings come from environment variables (12-factor
style), with defaults that work inside docker compose.

From your world: think of this as the "driver config" header that every
module includes - one place that says which bus (Kafka) to use and how.
"""

from __future__ import annotations

import json
import logging
import os
import signal
import socket
import sys
import time
from typing import Any, Callable

# ---------------------------------------------------------------------------
# Topic names (one place, so a typo cannot create a surprise topic)
# ---------------------------------------------------------------------------
TOPIC_CREATED = os.getenv("TOPIC_CREATED", "orders.created")
TOPIC_ENRICHED = os.getenv("TOPIC_ENRICHED", "orders.enriched")
TOPIC_RETRY = os.getenv("TOPIC_RETRY", "orders.retry")
TOPIC_DLQ = os.getenv("TOPIC_DLQ", "orders.dlq")

BOOTSTRAP = os.getenv("KAFKA_BOOTSTRAP", "kafka-1:19092,kafka-2:19092,kafka-3:19092")
HOSTNAME = os.getenv("HOSTNAME", socket.gethostname())


def setup_logging(service: str) -> logging.Logger:
    """One-line, grep-friendly logs: time level service message."""
    logging.basicConfig(
        level=os.getenv("LOG_LEVEL", "INFO"),
        format=f"%(asctime)s %(levelname)-5s {service} %(message)s",
        stream=sys.stdout,
    )
    return logging.getLogger(service)


def base_config() -> dict[str, Any]:
    """Settings shared by producers and consumers."""
    return {
        "bootstrap.servers": BOOTSTRAP,
        "client.id": HOSTNAME,
        # Optional security settings. Left empty locally; set from a k8s Secret
        # in a real cluster (never hard-code credentials in code or images).
        **({"security.protocol": os.environ["KAFKA_SECURITY_PROTOCOL"]}
           if os.getenv("KAFKA_SECURITY_PROTOCOL") else {}),
        **({"sasl.mechanism": os.environ["KAFKA_SASL_MECHANISM"],
            "sasl.username": os.environ.get("KAFKA_SASL_USERNAME", ""),
            "sasl.password": os.environ.get("KAFKA_SASL_PASSWORD", "")}
           if os.getenv("KAFKA_SASL_MECHANISM") else {}),
    }


def idempotent_producer_config() -> dict[str, Any]:
    """A safe producer: no duplicates from retries, no loss on leader failover.

    - enable.idempotence: broker de-duplicates retries using (producer id, sequence).
    - acks=all: leader waits until every in-sync replica has the record.
      With min.insync.replicas=2 on the topic, one broker can die with no data loss.
    - linger.ms + compression: small batching window = far fewer requests.
    """
    return {
        **base_config(),
        "enable.idempotence": True,
        "acks": "all",
        "max.in.flight.requests.per.connection": 5,  # max allowed with idempotence, ordering kept
        "retries": 2147483647,
        "delivery.timeout.ms": 120000,
        "linger.ms": int(os.getenv("PRODUCER_LINGER_MS", "5")),
        "batch.size": 64 * 1024,
        "compression.type": os.getenv("PRODUCER_COMPRESSION", "zstd"),
    }


def consumer_config(group_id: str, *, read_committed: bool = True) -> dict[str, Any]:
    """Consumer settings we use everywhere.

    - enable.auto.commit=False: we commit offsets ourselves AFTER the work is done
      (at-least-once). Auto-commit can commit before you finished = data loss.
    - isolation.level=read_committed: skip records from aborted transactions.
    - partition.assignment.strategy=cooperative-sticky: rebalances move only the
      partitions that must move, instead of stopping the whole group.
    """
    return {
        **base_config(),
        "group.id": group_id,
        "enable.auto.commit": False,
        "auto.offset.reset": os.getenv("AUTO_OFFSET_RESET", "earliest"),
        "isolation.level": "read_committed" if read_committed else "read_uncommitted",
        "partition.assignment.strategy": "cooperative-sticky",
        "session.timeout.ms": 45000,
        "max.poll.interval.ms": int(os.getenv("MAX_POLL_INTERVAL_MS", "300000")),
        # Static membership: a quick restart of the same pod does not trigger a
        # rebalance. Set GROUP_INSTANCE_ID to the pod name in k8s (StatefulSet).
        **({"group.instance.id": os.environ["GROUP_INSTANCE_ID"]}
           if os.getenv("GROUP_INSTANCE_ID") else {}),
    }


def to_json(obj: Any) -> bytes:
    return json.dumps(obj, separators=(",", ":"), sort_keys=True).encode()


def headers_to_dict(headers: list[tuple[str, bytes]] | None) -> dict[str, str]:
    out: dict[str, str] = {}
    for k, v in headers or []:
        out[k] = v.decode() if isinstance(v, (bytes, bytearray)) else str(v)
    return out


class GracefulExit:
    """SIGTERM/SIGINT flip a flag so loops can finish the current batch,
    commit, and close cleanly (leave the group fast => quick rebalance).
    Kubernetes sends SIGTERM, waits terminationGracePeriodSeconds, then SIGKILL."""

    def __init__(self, log: logging.Logger, on_exit: Callable[[], None] | None = None):
        self.running = True
        self._log = log
        self._on_exit = on_exit
        signal.signal(signal.SIGTERM, self._stop)
        signal.signal(signal.SIGINT, self._stop)

    def _stop(self, signum, _frame):
        self._log.info("signal %s received, finishing current batch then exiting", signum)
        self.running = False
        if self._on_exit:
            self._on_exit()


def now_ms() -> int:
    return int(time.time() * 1000)
