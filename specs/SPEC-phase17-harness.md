---
name: SPEC-phase17-harness
status: approved
version: 1.0
created: 2026-08-06
owner: wadefengx
---

# Phase 17:Harness 接入(Hermes/OpenClaw via OpenAI-compatible API)

## Goal

用户在 workspace/chat 里选择 agent harness(内置 / Hermes / OpenClaw),对话走对应后端。

## 调研结论(2026-08-06)

- **Hermes**:`hermes serve`(默认 127.0.0.1:9119)暴露 **OpenAI-compatible API**(/v1/chat/completions + /v1/models + /health)。已有 OpenAICompatibleProvider 可直接调用。
- **OpenClaw**:`openclaw gateway`(默认 ws://127.0.0.1:18789,WebSocket)+ `openclaw acp`。gateway 有 OpenAI-compatible 端点,但以 WebSocket 为主。
- **关键洞察**:harness = OpenAI-compatible 端点。Agent 已有 OPENAI_COMPATIBLE type + baseUrl/apiKey/model,engine 的 resolveProvider 已把非 ANTHROPIC 全走 OpenAICompatibleProvider——**代码路径已通,缺的是正确预设 + 显式路由 + 错误提示**。

## Task

### Task 1:预设 baseUrl 修正 + harness 标记

agents-page.tsx 预设:
- `openclaw`:baseUrl `http://localhost:18789/v1`,model `openclaw-7b`,harness `OPENCLAW`
- `hermes`:baseUrl `http://localhost:9119/v1`,model `hermes-3-llama-3.1-8b`,harness `HERMES`
- 保留 ollama/OpenAI/Claude 预设(harness 字段:OLLAMA/OPENAI/ANTHROPIC)

### Task 2:engine 显式 harness 路由 + 未运行提示

default-chat.engine.ts:
- resolveProvider 显式处理 HERMES/OPENCLAW type(仍走 OpenAICompatibleProvider,但标注 harness)。
- provider 调用失败(连接拒绝)时,SSE 返回 `error` 事件,消息文案:"harness 未运行,请先启动 hermes serve / openclaw gateway"。
- 错误信息里带 harness 名 + 端口,便于排查。

### Task 3:chat 消息显示 harness 标识

- workspace-shell.tsx:agent 回复消息(AGENT sender)显示 `harness: HERMES` / `harness: OPENCLAW` / `harness: OLLAMA` 小标签(复用现有 Tag)。
- agents-page 列表已有 harness 显示(Phase 14),保持。

### Task 4(可选,若时间允许):hermes serve 启动脚本

- `scripts/hermes-harness.sh`:`hermes serve --port 9119 &` 启动脚本 + health 探测。
- 不加入 docker-compose(harness 是用户本地进程,非容器)。

## Acceptance

- [ ] 预设 Hermes baseUrl=9119、OpenClaw=18789,创建即用
- [ ] 指向未运行的 harness → SSE error 事件,文案提示"harness 未运行 + 启动命令"
- [ ] 指向运行中的 harness → 正常流式对话(用户手动起 hermes serve 验证)
- [ ] 消息气泡显示 harness 标识
- [ ] typecheck/lint/build 全绿,单测通过

## Non-goals

- ACP(JSON-RPC over stdio)集成——IDE 场景,非本产品核心。
- OpenClaw WebSocket 直连——先用其 OpenAI-compatible 端点。
- harness 进程生命周期管理(systemd/launchd)——用户手动起。
