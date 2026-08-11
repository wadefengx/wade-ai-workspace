---
name: SPEC-phase17-harness
status: approved
version: 1.0
created: 2026-08-06
owner: wadefengx
---

# Phase 17: Harness Integration (Hermes/OpenClaw via OpenAI-compatible API)

## Goal

Users select an Agent harness in Workspace/chat (built-in / Hermes / OpenClaw), and chat uses the corresponding backend.

## Research Conclusions (2026-08-06)

- **Hermes:** `hermes serve` (default `127.0.0.1:9119`) exposes an **OpenAI-compatible API** (`/v1/chat/completions` + `/v1/models` + `/health`). The existing `OpenAICompatibleProvider` can call it directly.
- **OpenClaw:** `openclaw gateway` (default `ws://127.0.0.1:18789`, WebSocket) + `openclaw acp`. The gateway has an OpenAI-compatible endpoint but is WebSocket-first.
- **Key insight:** harness = an OpenAI-compatible endpoint. Agents already have `OPENAI_COMPATIBLE` type + `baseUrl`/`apiKey`/`model`; the engine’s `resolveProvider` already routes every non-ANTHROPIC type through `OpenAICompatibleProvider` — **the code path already works; only correct presets, explicit routing, and error guidance are missing**.

## Tasks

### Task 1: Correct Preset `baseUrl` Values + Harness Marker

`agents-page.tsx` presets:
- `openclaw`: `baseUrl` `http://localhost:18789/v1`, model `openclaw-7b`, harness `OPENCLAW`
- `hermes`: `baseUrl` `http://localhost:9119/v1`, model `hermes-3-llama-3.1-8b`, harness `HERMES`
- Retain Ollama/OpenAI/Claude presets (harness fields: `OLLAMA`/`OPENAI`/`ANTHROPIC`)

### Task 2: Explicit Engine Harness Routing + Not-running Guidance

`default-chat.engine.ts`:
- Make `resolveProvider` explicitly handle HERMES/OPENCLAW types (still use `OpenAICompatibleProvider`, but mark the harness).
- When provider invocation fails due to connection refusal, return an SSE `error` event with: “Harness is not running. Start `hermes serve` / `openclaw gateway` first.”
- Include harness name + port in the error message to aid diagnosis.

### Task 3: Show Harness Identity on Chat Messages

- `workspace-shell.tsx`: show a small `harness: HERMES` / `harness: OPENCLAW` / `harness: OLLAMA` label on Agent-sender messages (reuse the existing `Tag`).
- Keep the existing harness display in the Agents-page list (Phase 14).

### Task 4 (optional, if time permits): `hermes serve` Startup Script

- `scripts/hermes-harness.sh`: startup script with `hermes serve --port 9119 &` plus a health probe.
- Do not add it to `docker-compose` (the harness is a local user process, not a container).

## Acceptance

- [ ] Hermes preset uses `baseUrl=9119`, OpenClaw uses `18789`; both are usable immediately after creation.
- [ ] A target harness that is not running produces an SSE error event with “harness not running + startup command” guidance.
- [ ] A running harness supports normal streaming chat (user manually starts `hermes serve` to verify).
- [ ] Message bubbles display harness identity.
- [ ] Typecheck/lint/build are all green; unit tests pass.

## Non-goals

- ACP (JSON-RPC over stdio) integration — that is for IDE scenarios, not this product’s core.
- Direct OpenClaw WebSocket connection — use its OpenAI-compatible endpoint first.
- Harness process lifecycle management (systemd/launchd) — users start it manually.
