#!/usr/bin/env bash
# Hermes harness 启动脚本:hermes serve 暴露 OpenAI-compatible API(默认 127.0.0.1:9119)
# 用法:bash scripts/hermes-harness.sh [start|stop|status]
set -euo pipefail

PORT="${HERMES_PORT:-9119}"

status() {
  if curl -sf -m 2 "http://127.0.0.1:${PORT}/health" >/dev/null 2>&1; then
    echo "✅ Hermes harness 运行中 (http://127.0.0.1:${PORT})"
    return 0
  fi
  echo "❌ Hermes harness 未运行 (port ${PORT})"
  return 1
}

case "${1:-status}" in
  start)
    if status >/dev/null 2>&1; then
      exit 0
    fi
    echo "启动 hermes serve --port ${PORT} ..."
    nohup hermes serve --port "${PORT}" >/tmp/hermes-harness.log 2>&1 &
    for _ in $(seq 1 15); do
      sleep 1
      if curl -sf -m 2 "http://127.0.0.1:${PORT}/health" >/dev/null 2>&1; then
        echo "✅ 已就绪"
        exit 0
      fi
    done
    echo "❌ 启动超时,日志:/tmp/hermes-harness.log"
    exit 1
    ;;
  stop)
    pkill -f "hermes serve --port ${PORT}" 2>/dev/null && echo "已停止" || echo "未在运行"
    ;;
  status)
    status
    ;;
  *)
    echo "用法:bash scripts/hermes-harness.sh [start|stop|status]"
    exit 1
    ;;
esac
