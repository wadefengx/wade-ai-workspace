#!/usr/bin/env bash
# Starts a Hermes harness: hermes serve exposes an OpenAI-compatible API (default: 127.0.0.1:9119).
# Usage: bash scripts/hermes-harness.sh [start|stop|status]
set -euo pipefail

PORT="${HERMES_PORT:-9119}"

status() {
  if curl -sf -m 2 "http://127.0.0.1:${PORT}/health" >/dev/null 2>&1; then
    echo "✅ Hermes harness is running (http://127.0.0.1:${PORT})"
    return 0
  fi
  echo "❌ Hermes harness is not running (port ${PORT})"
  return 1
}

case "${1:-status}" in
  start)
    if status >/dev/null 2>&1; then
      exit 0
    fi
    echo "Starting hermes serve --port ${PORT} ..."
    nohup hermes serve --port "${PORT}" >/tmp/hermes-harness.log 2>&1 &
    for _ in $(seq 1 15); do
      sleep 1
      if curl -sf -m 2 "http://127.0.0.1:${PORT}/health" >/dev/null 2>&1; then
        echo "✅ Ready"
        exit 0
      fi
    done
    echo "❌ Startup timed out. Log: /tmp/hermes-harness.log"
    exit 1
    ;;
  stop)
    pkill -f "hermes serve --port ${PORT}" 2>/dev/null && echo "Stopped" || echo "Not running"
    ;;
  status)
    status
    ;;
  *)
    echo "Usage: bash scripts/hermes-harness.sh [start|stop|status]"
    exit 1
    ;;
esac
