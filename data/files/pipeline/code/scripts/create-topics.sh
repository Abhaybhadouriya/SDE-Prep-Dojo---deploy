#!/bin/bash
# Creates ShopStream topics. Runs inside the one-shot "topics-init" container
# (apache/kafka image), so kafka-topics.sh is at /opt/kafka/bin.
# Usage: create-topics.sh <bootstrap> <replication-factor> <min-insync-replicas>
set -euo pipefail
BOOTSTRAP="${1:-kafka-1:19092}"
RF="${2:-3}"
MIN_ISR="${3:-2}"
BIN=/opt/kafka/bin

echo "waiting for Kafka at $BOOTSTRAP ..."
until $BIN/kafka-broker-api-versions.sh --bootstrap-server "$BOOTSTRAP" >/dev/null 2>&1; do sleep 2; done

create() { # name partitions extra-configs...
  local name=$1 parts=$2; shift 2
  $BIN/kafka-topics.sh --bootstrap-server "$BOOTSTRAP" --create --if-not-exists \
    --topic "$name" --partitions "$parts" --replication-factor "$RF" \
    --config min.insync.replicas="$MIN_ISR" "$@"
}
# 6 partitions = up to 6 consumers in a group can work in parallel.
create orders.created  6 --config retention.ms=604800000      # 7 days: replay window
create orders.enriched 6 --config retention.ms=604800000
create orders.retry    3 --config retention.ms=86400000       # 1 day
create orders.dlq      3 --config retention.ms=1209600000     # 14 days: time to investigate
$BIN/kafka-topics.sh --bootstrap-server "$BOOTSTRAP" --describe --topic orders.created
echo "topics ready"
