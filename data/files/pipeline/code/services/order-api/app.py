"""order-api: the front door of ShopStream.

POST /orders  -> validates the body, builds an OrderCreated event, publishes it
                 to Kafka topic `orders.created`, keyed by customer_id.
GET  /healthz -> liveness (process is up)
GET  /readyz  -> readiness (we can reach Kafka metadata)
GET  /metrics -> Prometheus metrics

Why key by customer_id? Kafka keeps order only inside one partition. Same key
=> same partition => all events of one customer are processed in order.

Why return 202 and not 201? We accepted the order into the log; downstream
services (enricher, sinks) finish the work asynchronously.
"""

from __future__ import annotations

import os
import threading
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from confluent_kafka import KafkaException, Producer
from fastapi import FastAPI, HTTPException
from prometheus_client import Counter, Histogram, make_asgi_app
from pydantic import BaseModel, Field

from shopstream_common import (TOPIC_CREATED, idempotent_producer_config,
                               setup_logging, to_json)

log = setup_logging("order-api")
# If true, the request waits for the broker ack (acks=all) before answering.
# Safer (client knows it is durable) but slower. Default: wait.
SYNC_ACK = os.getenv("SYNC_ACK", "true").lower() == "true"
ACK_TIMEOUT_S = float(os.getenv("ACK_TIMEOUT_S", "10"))

ORDERS_ACCEPTED = Counter("shopstream_orders_accepted_total", "Orders accepted by the API")
PUBLISH_ERRORS = Counter("shopstream_publish_errors_total", "Orders that failed to publish")
PUBLISH_LATENCY = Histogram("shopstream_publish_seconds", "Time from produce() to broker ack")


class Item(BaseModel):
    product_id: str = Field(min_length=1, examples=["P-100"])
    quantity: int = Field(gt=0, le=100, examples=[2])


class OrderIn(BaseModel):
    customer_id: str = Field(min_length=1, examples=["C-42"])
    items: list[Item] = Field(min_length=1)
    # Optional client-supplied id makes retries from the client safe:
    # the sink upserts on order_id, so a resent order is stored once.
    order_id: str | None = None


producer: Producer | None = None
_stop_poll = threading.Event()


def _poll_loop():
    """librdkafka calls delivery callbacks only from poll(); run it in background."""
    while not _stop_poll.is_set():
        producer.poll(0.1)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    global producer
    producer = Producer(idempotent_producer_config())
    t = threading.Thread(target=_poll_loop, daemon=True)
    t.start()
    log.info("producer started")
    yield
    _stop_poll.set()
    left = producer.flush(15)  # do not lose in-flight orders on shutdown
    log.info("producer flushed, %d messages left undelivered", left)


app = FastAPI(title="ShopStream order-api", lifespan=lifespan)
app.mount("/metrics", make_asgi_app())


@app.get("/healthz")
def healthz():
    return {"status": "ok"}


@app.get("/readyz")
def readyz():
    try:
        md = producer.list_topics(TOPIC_CREATED, timeout=3)
        if md.topics[TOPIC_CREATED].error is not None:
            raise KafkaException(md.topics[TOPIC_CREATED].error)
        return {"status": "ready", "partitions": len(md.topics[TOPIC_CREATED].partitions)}
    except Exception as exc:  # noqa: BLE001 - report any failure as not ready
        raise HTTPException(503, f"kafka not reachable: {exc}") from exc


@app.post("/orders", status_code=202)
def create_order(order: OrderIn):
    event = {
        "type": "OrderCreated",
        "schema_version": 1,
        "order_id": order.order_id or str(uuid.uuid4()),
        "customer_id": order.customer_id,
        "items": [i.model_dump() for i in order.items],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    done = threading.Event()
    result: dict = {}

    def on_delivery(err, msg):
        if err is not None:
            PUBLISH_ERRORS.inc()
            result["error"] = str(err)
        else:
            result["partition"], result["offset"] = msg.partition(), msg.offset()
            PUBLISH_LATENCY.observe((msg.latency() or 0.0))
        done.set()

    try:
        producer.produce(
            TOPIC_CREATED,
            key=order.customer_id.encode(),
            value=to_json(event),
            headers={"event-type": "OrderCreated", "schema-version": "1"},
            on_delivery=on_delivery,
        )
    except BufferError as exc:
        # Local queue is full: Kafka is slow or down. Tell the client to back off.
        # The header must travel on the exception: FastAPI builds a fresh error
        # response from HTTPException, so headers set on an injected Response are lost.
        PUBLISH_ERRORS.inc()
        raise HTTPException(503, "producer queue full, retry later",
                            headers={"Retry-After": "1"}) from exc

    if SYNC_ACK:
        if not done.wait(ACK_TIMEOUT_S):
            # Count it too, so the dashboard does not look green while clients get 504s.
            PUBLISH_ERRORS.inc()
            raise HTTPException(504, "broker ack timed out (order may still be delivered)",
                                headers={"Retry-After": "1"})
        if "error" in result:
            raise HTTPException(503, f"publish failed: {result['error']}",
                                headers={"Retry-After": "1"})
    ORDERS_ACCEPTED.inc()
    log.info("order %s customer=%s -> p%s@%s", event["order_id"], order.customer_id,
             result.get("partition"), result.get("offset"))
    return {"order_id": event["order_id"], "status": "ACCEPTED", **result}
