#!/usr/bin/env bash
# Shared helpers for the chaos drills. Run drills from pipeline/code:  bash scripts/chaos/<drill>.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
BS="kafka-1:19092,kafka-2:19092,kafka-3:19092"
# Run a Kafka CLI tool inside a broker container that is up (prefers kafka-1).
kbin() {
  local tool=$1; shift
  local box
  for box in kafka-1 kafka-2 kafka-3; do
    if [ "$(docker compose ps -q --status running "$box" 2>/dev/null)" ]; then
      docker compose exec -T "$box" "/opt/kafka/bin/$tool" --bootstrap-server "$BS" "$@"
      return
    fi
  done
  echo "no broker running" >&2; return 1
}
step() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
