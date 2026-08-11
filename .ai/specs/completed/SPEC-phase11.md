---
status: done
phase: Phase 11
owner: PM
updated: 2026-08-01
---
# SPEC-Phase 11 — Chat Experience Refactor + AI Organization Dashboard + Feedback Dashboard

Version: 1.0 (2026-08-01 late-night sprint)

## 1. Goals

1. **Scroll isolation + auto-scroll to bottom**: chat/memory page content areas scroll independently (sidebar/header remain fixed); opening a chat scrolls to the bottom; automatically follow arriving messages.
2. **Remove the right-side AI Context / Workspace Members panel** (the right-side complementary panel in workspace-shell).
3. **ChatGPT-style new conversation**: clicking "New Chat" directly creates and opens a new channel (no selection modal); a conversation is a channel, with zero friction.
4. **Enhance AI responses**: show thinking progress (thinking animation/process during streaming); response hover action buttons at bottom right: like / dislike / regenerate / copy.
5. **Input state**: while waiting for an AI response, show input loading + state marquee; refactor using existing @ant-design/x components (Bubble / Thinking / Sender loading).
6. **AI Organization Dashboard**: Agents state, Running Lanes progress, Pipeline Stage, knowledge-asset counts (Skills/Specs/Memory/ADR/Harness), Today's Improvements; feedback statistics (Feedback Dashboard).
7. After everything is complete, run lint/typecheck/test/build + full browser acceptance.

## 2. Scroll Isolation (item 1, root-cause fix)

- Root cause: the content area lacks an independent scroll container, so the whole page scrolls.
- Solution: change the shell in `(workspace)/layout.tsx` to `height: 100vh; overflow: hidden`; give sidebar/header/content areas their own `overflow-y: auto` (content area: `flex:1; min-height:0`).
- Chat message area: create `ChatMessageList` using ref + `scrollTo({top: scrollHeight})`; auto-scroll to bottom when opening/new messages; do not force-follow when the user scrolls up to view history (only auto-follow when within <100px from bottom).
- Memory page: reuse the same scroll-container pattern (content-area overflow auto).
- Verification: while scrolling the content area, the sidebar/header do not move at all (browser-measured identical `getBoundingClientRect` before and after).

## 3. Remove Right Panel (item 2)

- `workspace-shell.tsx`: remove the right-side complementary panel (AI Context / Workspace Members); content area fills remaining width.

## 4. ChatGPT-Style New Conversation (item 3)

- workspace-navigation: change the "New Chat" button in CHATS to directly call `createChannel(workspaceId, {name: auto-generated})` → enter the new conversation; do not open a Modal.
- New conversation naming: `Conversation <N>` (use the current largest sequence number); empty conversation channels show a "Start a new conversation" placeholder.
- Keep existing channel list (conversation history); grouping logic remains unchanged.

## 5. AI Response Enhancements (item 4)

- **Thinking display**: if the streaming interface returns reasoning content, display it as a collapsible "Thinking Process" section (above the bubble content, with a light-colored block); otherwise show a Thinking animation (antdx `<Thinking />` or Bubble loading state: three-dot pulse).
- **Action buttons**: show an action bar at the lower right on AI-message hover (like / dislike / regenerate / copy):
  - like/dislike: `PATCH /api/messages/:messageId/feedback {type: "like"|"dislike"}` (idempotent; click again to cancel); highlight button state.
  - regenerate: frontend resends the same user prompt (find the user message corresponding to this AI message) and streams an additional new AI response (do not delete the old one; the new response is a subsequent message).
  - copy: copy AI text to the clipboard + Tooltip "Copied".
- User-message hover only shows copy.

## 6. Input State and antdx Components (item 5)

- Use the antdx `<Sender>` `loading` prop (`loading=true` after send and false when streaming ends; while loading, Sender is disabled and shows animated dots).
- State marquee: when streaming starts, show a state bar above the input (`<Bubble loading>` or custom marquee: "Thinking…" with Thinking animation); show agent name + model.
- Retain existing @ mention / emoji / quick-send behavior.

## 7. AI Organization Dashboard (item 6)

### Data API (backend)
```
GET /api/stats/organization → {
  assets: { specs, skills, memory, adr, harness, knowledge },   // recursively count the .ai/ directory
  lanes: [{id, title, status, confidence}],                      // read .ai/registry/lanes.yaml (if absent, infer recent lanes from recent git-log commits)
  pipeline: [{stage, status}],                                   // derive from lane state
  improvements: { skills: +n, adr: +n, memory: +n, harness: +n, specs: +n } // approximate count from git log --stat in the last 24h
}
GET /api/stats/feedback → {
  total, like, dislike, ratio,
  byChannel: [{channelId, channelName, total, like}],
  byDay: [{date, total, like}]                                  // last 7 days
}
```
- `GET /api/stats/feedback` aggregates the `Message.feedback` field; return zero values when no feedback data exists (page shows an empty state).
- Unit tests: stats-service counting logic (inject mock fs/directory structure) + feedback aggregation.

### Page (Dashboard)
- Route: `app/(workspace)/dashboard/page.tsx` + `components/dashboard-page.tsx`; add "Dashboard" to navigation (icon: `DashboardOutlined`, above Knowledge).
- Layout (based on GPT blueprint + modern SaaS dashboard):
  - Top: title + updated time + refresh button.
  - Agents State card: six roles—PM/FE/BE/QA/UX/Architect—with online-status dots (🟢/🟡/🔵) + current lane.
  - Running Lanes card: each lane name + progress bar (State→percentage: Ready 10 / Running 60 / Review 80 / QA 90 / Done 100) + confidence label.
  - Pipeline card: Planner → Spec → Implement → Review → Harness → Memory stage list, ✔/⏳/○ state indicators.
  - Asset statistics card: large counts for Skills/Specs/Memory/ADR/Harness/Knowledge + icon (framer-motion number-roll animation).
  - Today's Improvements card: +n list (with icons).
  - Feedback Dashboard card: like/dislike ratio donut (antd `Progress type=circle`) + last-seven-days bars (pure CSS/div bars; no chart library) + top-by-channel list.
- Effects: framer-motion card entrance stagger, number roll, and progress-bar animation; Apple style (frosted-glass cards/rounded corners/gradients).

## 8. Task Breakdown (parallel lanes)

- **Lane A (backend)**: `Message.feedback` schema + PATCH feedback API (idempotent toggle) + stats APIs (organization/feedback) + unit tests. Files: `apps/api/src/{chat,stats(new),prisma}`.
- **Lane B (frontend—chat)**: scroll isolation (shared scroll-container CSS) + remove right panel + auto-scroll to bottom + ChatGPT-style creation + Bubble/Thinking/Sender loading + message action buttons (like/dislike/regenerate/copy) + add Dashboard navigation item. Files: `(workspace)/layout.tsx`, `workspace-shell.tsx`, `workspace-shell.module.css`, `workspace-navigation.tsx`, `workspace-context.tsx` (`createChannel` already exists and may need direct-entry logic), `memory-page.tsx`.
- **Lane C (frontend—Dashboard)**: dashboard route + page component (all new files) + framer-motion effects + stats-API integration. Files: `app/(workspace)/dashboard/page.tsx`, new `components/dashboard-page.tsx`, new `components/dashboard-page.module.css`.
- Dependency: B adds the menu item first (route string, no import of C); C calls stats API according to the spec contract; A's stats API contract is governed by this spec.

## 9. Acceptance

1. lint/typecheck/test/build (api, web) all pass.
2. Browser:
   - Chat automatically scrolls to bottom when opened; when scrolling content, sidebar/header remain fixed (coordinate measurement); same for Memory page.
   - Right-side panel disappears; content area becomes wider.
   - New Chat creates and enters a conversation in one click, with no modal.
   - Ask @AI a question: input loading + state marquee; response shows thinking; hovering the lower right of a response enables like/dislike/regenerate/copy (`regenerate` creates a new response; `copy` uses clipboard).
   - Dashboard: nonzero asset counts, lane progress bars, pipeline state indicators, feedback ratio chart (empty state even with zero data).
   - Full dark-mode compatibility.
3. Append to the AGENTS.md Change Log + update memory.

## 10. Exclusions (Later)

- Message editing/deletion; multi-model comparison; persistent display of streaming reasoning (this time animation + text fallback only); real-time Dashboard WebSocket (manual refresh is sufficient); chart-library addition (pure CSS implementation).
