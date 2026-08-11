---
name: SPEC-phase13-ux-perf
status: approved
version: 1.0
created: 2026-08-05
owner: wadefengx
---

# Phase 13: UX Layout Refactor + Initial-Load/Page-Transition Performance Optimization

## Goal

The user reported two issues:
1. **Slow page transitions:** the first switch feels heavy, as though many things load (diagnosis: 1.8MB / 74 resources of post-login workspace JS; no route-level dynamic imports; Ant Design, `plantuml-encoder`, and Framer Motion are all statically bundled into the shared chunk).
2. **Cramped layout:** not a formal UX diagnosis, but pages feel crowded (diagnosis: shell/page spacing starts at 8px/16px everywhere, padding is too small, and no `max-width` lets content stretch full width).

Goal: reduce production initial-load JS by ≥40%, eliminate page-transition stutter, and increase whitespace/visual breathing room while retaining the existing Apple dark style (the user’s established preference).

## Constraints

- Next.js 16 app router; all pages use `"use client"` (SPA workspace).
- Keep existing functionality and API contracts unchanged; change only frontend presentation and loading strategy.
- `styled-components` adoption is in progress, but this phase **does not require migrating** the existing five CSS modules (avoid widening the blast radius); new styles may use `styled-components` or continue using `module.css`, as long as they are consistent.
- Browser acceptance is authoritative: login → Workspace → switch through every page; no console errors; comfortable layout at 1280px/1440px.

## Tasks

### Task 1: Page-Transition Performance (primary)

1. **Make `plantuml-encoder` dynamic:** in `markdown-content.tsx`, change `import { encode } from "plantuml-encoder"` to `const { encode } = await import("plantuml-encoder")` inside the PlantUML-rendering branch. Mermaid is already dynamic; retain it.
2. **Reduce Framer Motion cost:**
   - Keep the `animate/useInView` number counter in `dashboard-page.tsx` (that page is inherently heavy), but ensure its import is not part of initial load.
   - Keep the `motion.div` route-transition animation in root `(workspace)/layout.tsx`, because it is shared for every page switch, but change `transition duration` from 0.25s to 0.18s and remove `y: 8` movement to reduce perceived layout jitter.
   - Keep `motion` in `auth-page.tsx` for login-page entry animation; login is a separate chunk.
3. **Confirm route-level splitting:** verify all 11 `page.tsx` files are automatically split by Next; wrap heavy-page components (`dashboard/specs/skills/knowledge`) with `next/dynamic` in `page.tsx` (`ssr: false` is unnecessary; dynamic works in the app router) so those components do not enter the initial shared chunk.
4. **Slim the initial shared chunk:**
   - Check whether `workspace-navigation.tsx` (sidebar, shared by all pages) imports heavy dependencies; icons should be imported on demand from `@ant-design/icons` (the library already tree-shakes; confirm only).
   - If Ant Design is imported from the root (for example, `import { Layout } from "antd"` with multiple components), retain it — Ant Design v6 supports tree shaking; do not add `babel-plugin-import`.
5. **Quantitative verification:** after `npm run build`, read sizes of `.next/static/chunks`, compare total bytes of initial-load-related chunks before and after optimization, and report the reduction.

### Task 2: Looser Layout (secondary but strongly perceived)

1. **Increase the spacing system consistently** (`workspace-shell.module.css` + `workspace-pages.module.css`):
   - Sidebar padding: `24px 16px` → `28px 20px`; collapsed state: 8px → 12px.
   - Content: increase topbar padding; `--space-lg` 24px → 32px, `--space-md` 16px → 20px, `--space-sm` 8px → 12px (global tokens only; do not alter each use individually).
   - Chat message list/input: retain the centered 780px maximum width; increase message spacing 12px → 16px; increase Sender-card padding.
2. **Page-frame whitespace:**
   - Increase `pageStack` padding in `workspace-page-frame.tsx` (start at approximately `40px 48px`) and header-to-content spacing from 24px to 32px.
   - Center non-chat-page content with a recommended `max-width: 1100px` in `pageScrollBody` to avoid full-width stretching on a 1440px display.
3. **Chat-page details:** tune message-area horizontal padding, AI/user-message spacing, and avatar spacing to better match DeepSeek web’s visual breathing room.
4. **Acceptance screenshots:** take before/after page screenshots at 1440px.

## Acceptance

- [ ] `npm run lint && npm run typecheck && npm run build` all pass.
- [ ] Production initial-load JS total bytes decrease by ≥40% compared with before optimization.
- [ ] Browser transitions through each page show no white-screen flash and no console errors.
- [ ] Layout screenshots show visibly looser spacing with no overflow or crowding.
- [ ] Functional regression: login/chat/AI streaming/document-page Mermaid rendering work normally.

## Non-goals

- Do not change backend APIs or the data model.
- Do not migrate existing CSS modules to `styled-components` (defer to a later phase).
- Do not refactor dark/light themes.
