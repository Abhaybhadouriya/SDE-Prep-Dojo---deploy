"""analytics: revenue per minute, computed live from orders.enriched.

This is a tiny hand-written stream processor that shows the core ideas behind
Kafka Streams / Flink windowing:

- Tumbling window: fixed, non-overlapping 1-minute buckets [12:00, 12:01) ...
- Event time:      we bucket by when the order was CREATED, not when we read it.
- Watermark:       "I have probably seen everything up to time T". We keep a
                   window open until watermark passes window_end + ALLOWED_LATENESS.
- Late events:     arrive after their window closed -> counted in a metric, dropped.

State lives in memory, so a restart loses open windows (a real system keeps it in
a state store backed by a changelog topic - that is what Kafka Streams does).

Endpoints (port 8000):
  /metrics  Prometheus: shopstream_revenue_last_window_cents, ..._late_events_total
  /windows  JSON of the last closed windows
"""

from __future__ import annotations

import json
import os
import threading
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from confluent_kafka import Consumer
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Gauge, generate_latest

from shopstream_common import (TOPIC_ENRICHED, GracefulExit, consumer_config,
                               setup_logging)

log = setup_logging("analytics")
WINDOW_MS = int(os.getenv("WINDOW_SECONDS", "60")) * 1000
ALLOWED_LATENESS_MS = int(os.getenv("ALLOWED_LATENESS_SECONDS", "10")) * 1000

REV_LAST = Gauge("shopstream_revenue_last_window_cents", "Revenue in the last closed window")
ORDERS_LAST = Gauge("shopstream_orders_last_window", "Orders in the last closed window")
LATE = Counter("shopstream_late_events_total", "Events that arrived after their window closed")
REV_TOTAL = Counter("shopstream_revenue_cents_total", "All revenue seen (use rate() in Grafana)")

open_windows: dict[int, dict] = {}  # window_start_ms -> {"revenue": int, "orders": int}
closed: list[dict] = []             # last 60 closed windows, newest last
lock = threading.Lock()
watermark_ms = 0


def event_time_ms(order: dict) -> int:
    return int(datetime.fromisoformat(order["created_at"]).timestamp() * 1000)


def iso(ms: int) -> str:
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).strftime("%H:%M:%S")


def add(order: dict):
    global watermark_ms
    ts = event_time_ms(order)
    start = ts - (ts % WINDOW_MS)
    with lock:
        if start + WINDOW_MS + ALLOWED_LATENESS_MS <= watermark_ms:
            LATE.inc()
            return
        w = open_windows.setdefault(start, {"revenue": 0, "orders": 0})
        w["revenue"] += order["total_cents"]
        w["orders"] += 1
        REV_TOTAL.inc(order["total_cents"])
        watermark_ms = max(watermark_ms, ts)
        # Close every window the watermark has passed (plus lateness).
        for s in sorted(k for k in open_windows if k + WINDOW_MS + ALLOWED_LATENESS_MS <= watermark_ms):
            done = open_windows.pop(s)
            row = {"window": f"{iso(s)}-{iso(s + WINDOW_MS)}", **done}
            closed.append(row)
            del closed[:-60]
            REV_LAST.set(done["revenue"])
            ORDERS_LAST.set(done["orders"])
            log.info("WINDOW %s orders=%d revenue=INR %.2f", row["window"], done["orders"], done["revenue"] / 100)


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):  # noqa: N802 - http.server API
        if self.path.startswith("/metrics"):
            body, ctype = generate_latest(), CONTENT_TYPE_LATEST
        elif self.path.startswith("/windows"):
            with lock:
                body = json.dumps({"closed": closed, "open": open_windows}, indent=2).encode()
            ctype = "application/json"
        else:
            body, ctype = b"ok", "text/plain"
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *_args):  # keep logs quiet
        pass


def main():
    server = ThreadingHTTPServer(("0.0.0.0", int(os.getenv("METRICS_PORT", "8000"))), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    consumer = Consumer(consumer_config(os.getenv("GROUP_ID", "analytics")))
    consumer.subscribe([TOPIC_ENRICHED])
    stop = GracefulExit(log)
    log.info("analytics up: window=%ss lateness=%ss", WINDOW_MS // 1000, ALLOWED_LATENESS_MS // 1000)
    while stop.running:
        msgs = consumer.consume(num_messages=500, timeout=1.0)
        for m in msgs:
            if m.error():
                continue
            try:
                add(json.loads(m.value()))
            except (ValueError, KeyError) as exc:
                log.warning("skip bad record: %s", exc)
        if msgs:
            # In-memory state => committing here means a crash loses open windows.
            # Fine for a demo dashboard; real systems checkpoint state with offsets.
            consumer.commit(asynchronous=True)
    consumer.close()
    server.shutdown()


if __name__ == "__main__":
    main()
