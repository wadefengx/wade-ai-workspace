# SPEC-Phase 11 — Chat Experience Refactor + AI Organization Dashboard + Feedback Dashboard

Version: 1.0 (2026-08-01 late-night sprint)

## 1. Goals

1. **Scroll isolation + auto-scroll to bottom:** chat/memory content scrolls independently while the sidebar/header stay fixed; opening chat scrolls to the bottom automatically; new messages follow automatically.
2. **Remove the right-side AI Context / Workspace Members panel** (the `complementary` area in `workspace-shell`).
3. **ChatGPT-style new chat:** clicking “New Chat” directly creates and enters a new channel without a selection dialog; a conversation is a channel, with zero friction.
4. **Enhanced AI answers:** show thinking progress (thinking animation/process during streaming); show like / dislike / regenerate / copy controls at the bottom right on answer hover.
5. **Input state:** show loading and a status marquee while waiting for AI; rebuild with existing `@ant-design/x` components (`Bubble` / `Thinking` / Sender loading).
6. **AI Organization Dashboard:** Agent status, Running Lanes progress, pipeline stages, knowledge-asset counts (Skills/Specs/Memory/ADR/Harness), Today’s Improvements, and feedback statistics (Feedback Dashboard).
7. After all work, run lint/typecheck/tests/build and full browser acceptance.

## 2. Scroll Isolation (item 1, root-cause fix)

- Root cause: the content area has no independent scroll container, so the whole page scrolls.
- Solution: change the shell in `(workspace)/layout.tsx` to `height: 100vh; overflow: hidden`; give the sidebar/header/content area their own `overflow-y: auto` (content area: `flex:1; min-height:0`).
- Chat message area: add `ChatMessageList` with a ref and `scrollTo({top: scrollHeight})`; auto-scroll to the bottom when opening or receiving messages; do not force-follow when users scroll up for history (only auto-follow if within 100px of the bottom).
- Memory page: reuse the same scroll-container pattern (`overflow: auto` in the content area).
- Verification: when scrolling content, the sidebar/header must not move (verify identical before/after `getBoundingClientRect` values in the browser).

## 3. Remove the Right Panel (item 2)

- `workspace-shell.tsx`: remove the right-side `complementary` section (AI Context / Workspace Members); let the content area fill remaining width.

## 4. ChatGPT-style New Chat (item 3)

- `workspace-navigation`: change the CHATS-area “New Chat” button to directly call `createChannel(workspaceId, {name: auto-generated})` and enter the new chat; do not show a Modal.
- New-chat naming: `Chat <N>` (use the current maximum sequence number); show the placeholder “Start a new conversation” for empty channels.
- Preserve the existing channel list (conversation history) and grouping behavior.

## 5. Enhanced AI Answers (item 4)

- **Thinking display:** when the streaming API returns reasoning content, display it as a collapsible “Thinking process” above the bubble in a light-colored block; otherwise show a Thinking animation (antdx `<Thinking />` or Bubble loading state with three-dot pulse).
- **Controls:** on AI-message hover, show a bottom-right control bar (like / dislike / regenerate / copy):
  - like/dislike: `PATCH /api/messages/:messageId/feedback {type: "like"|"dislike"}` (idempotent; clicking again clears it); highlight active state.
  - regenerate: resend the corresponding user prompt from the frontend (find the user message for the AI message); stream and append a new AI answer without deleting the old one.
  - copy: copy AI text to the clipboard and show Tooltip “Copied”.
- On user-message hover, show copy only.

## 6. Input State and antdx Components (item 5)

- Use the `loading` prop of antdx `<Sender>` (`loading=true` after sending and `false` at stream completion); disable sending and animate dots while it is active.
- Status marquee: show a status strip above the input at stream start (`<Bubble loading>` or custom marquee: “Thinking…” with Thinking animation); display Agent name + model.
- Retain existing @mention / emoji / quick-send behavior.

## 7. AI Organization Dashboard (item 6)

### Data API (backend)
```
GET /api/stats/organization → {
  assets: { specs, skills, memory, adr, harness, knowledge },   // recursively count the .ai/ directory
  lanes: [{id, title, status, confidence}],                      // read .ai/registry/lanes.yaml (if absent, infer recent lanes from git-log commits)
  pipeline: [{stage, status}],                                   // derive from lane status
  improvements: { skills: +n, adr: +n, memory: +n, harness: +n, specs: +n } // approximate count from git log --stat in the last 24h
}
GET /api/stats/feedback → {
  total, like, dislike, ratio,
  byChannel: [{channelId, channelName, total, like}],
  byDay: [{date, total, like}]                                  // last 7 days
}
```
- `GET /api/stats/feedback` aggregates `Message.feedback`; when no feedback exists, return zero values and show an empty state.
- Unit tests: Stats-service count logic (inject mock fs/directory structures) and feedback aggregation.

### Page (Dashboard)
- Route: `app/(workspace)/dashboard/page.tsx` + `components/dashboard-page.tsx`; add “Dashboard” above Knowledge in navigation (`DashboardOutlined`).
- Layout (inspired by a GPT blueprint + modern SaaS dashboards):
  - Header: title + updated time + refresh button.
  - Agent status cards: six roles — PM/FE/BE/QA/UX/Architect — with online dots (🟢/🟡/🔵) + current lane.
  - Running Lanes card: each lane name + progress bar (status → percent: Ready 10 / Running 60 / Review 80 / QA 90 / Done 100) + confidence tag.
  - Pipeline card: Planner → Spec → Implement → Review → Harness → Memory stage list with ✔/⏳/○ status lights.
  - Asset-stat cards: large count + icon for Skills/Specs/Memory/ADR/Harness/Knowledge (Framer Motion count animation).
  - Today’s Improvements card: `+n` list with icons.
  - Feedback Dashboard card: like/dislike ratio ring (`antd` `Progress type=circle`) + recent seven-day bars (plain CSS/div bars; no chart library) + top channels.
- Motion: Framer Motion staggered card entry, count animation, and progress-bar animation; Apple-style glass cards, rounded corners, and gradients.

## 8. Task Breakdown (parallel lanes)

- **Lane A (backend):** `Message.feedback` schema + PATCH feedback API (idempotent toggle) + stats APIs (organization/feedback) + unit tests. Files: `apps/api/src/{chat,stats(new),prisma}`.
- **Lane B (frontend — chat):** scroll isolation (shared scroll-container CSS) + remove right panel + auto-scroll-to-bottom + ChatGPT-style creation + Bubble/Thinking/Sender loading + message controls (like/dislike/regenerate/copy) + Dashboard nav item. Files: `(workspace)/layout.tsx`, `workspace-shell.tsx`, `workspace-shell.module.css`, `workspace-navigation.tsx`, `workspace-context.tsx` (existing `createChannel`, possibly needs direct-entry logic), `memory-page.tsx`.
- **Lane C (frontend — Dashboard):** Dashboard route + page components (all new) + Framer Motion + stats API integration. Files: `app/(workspace)/dashboard/page.tsx`, new `components/dashboard-page.tsx`, new `components/dashboard-page.module.css`.
- Dependency: B adds the menu item first (route string only; do not import C); C calls the stats API per this spec contract; A’s stats API contract is authoritative.

## 9. Acceptance

1. Lint/typecheck/tests/build (API and web) all pass.
2. Browser:
   - Opening chat auto-scrolls to the bottom; when scrolling content, the sidebar/header remain fixed (coordinate verification); same for Memory.
   - The right panel is gone and the content area is wider.
   - New Chat creates and enters a chat in one click, without a dialog.
   - Ask `@AI`: input shows loading + status marquee; answer shows thinking state; on answer hover, like/dislike/regenerate/copy work (regenerate creates a new answer; copy reaches clipboard).
   - Dashboard: nonzero asset count, lane progress bars, pipeline status lights, and a feedback ratio chart (with an empty state even when data is zero).
   - Dark mode is fully supported.
3. Update the `AGENTS.md` Change Log and memory.

## 10. Out of Scope (later)

- Message editing/deletion; multi-model comparison; persistent display of streaming reasoning (this iteration only has animation + text fallback); real-time Dashboard WebSocket (manual refresh is sufficient); adding a chart library (use pure CSS).
