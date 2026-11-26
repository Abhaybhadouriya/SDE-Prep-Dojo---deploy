#!/usr/bin/env bash
# DRILL 1: a broker dies. Expect: leaders move, ISR shrinks to 2, writes keep working
# (acks=all + min.insync.replicas=2), nothing is lost. Then the broker comes back and catches up.
source "$(dirname "$0")/_lib.sh"
BROKER=${1:-kafka-2}
step "Before: leaders and ISR of orders.created"
kbin kafka-topics.sh --describe --topic orders.created
step "Killing $BROKER (SIGKILL, like pulling the power cord)"
docker compose kill "$BROKER"
# The controller fences a broker that stops heartbeating only after
# broker.session.timeout.ms = 9 s; ISR shrink and leader moves happen then.
echo "waiting 15s for the controller to notice (broker.session.timeout.ms = 9 s)..."
sleep 15
step "Under-replicated partitions now (ISR < replicas)"
kbin kafka-topics.sh --describe --under-replicated-partitions
step "Writes still work? Sending 5 orders"
for i in 1 2 3 4 5; do
  curl -s -X POST localhost:8000/orders -H 'Content-Type: application/json' \
    -d '{"customer_id":"C-CHAOS","items":[{"product_id":"P-100","quantity":1}]}'; echo
done
step "Bringing $BROKER back"
docker compose start "$BROKER"
echo "waiting 30s for it to catch up..."; sleep 30
kbin kafka-topics.sh --describe --under-replicated-partitions
echo "(empty output above = fully replicated again)"
step "Optional: move leadership back to preferred leaders"
kbin kafka-leader-election.sh --election-type PREFERRED --all-topic-partitions || true
