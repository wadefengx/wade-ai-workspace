# SPEC-Phase 10 — UX/UI Refactor: Sidebar / Motion / State Management / Documentation Diagrams / Apple-style Visuals

Version: 1.0 (2026-08-01)

## 1. Goals

1. The collapsed sidebar must have a clear expand button; redesign collapsed-state icon layout, sizing, and interaction.
2. Add the mature animation library `framer-motion` for foundational page-transition, list, and overlay motion.
3. Standardize frontend data state on Zustand (migrate workspace context while preserving exported API compatibility).
4. Update the overall visual treatment without changing layout: enlarge type and icons and make spacing more Apple-like.
5. Support Mermaid / PlantUML / C4 diagrams in document rendering.
6. Standardize time handling on Day.js.
7. Support preset Workspace icons from the Ant Design icon library; make them selectable at creation and display them in the sidebar.
8. Refactor login/register-page UX.

## 2. Technical Decisions

- **Motion:** `framer-motion` (already installed by the orchestrator). Use it for workspace content fade/slide transitions, sidebar-width transitions (retain the existing CSS transition and add list-item entry motion), Chats-group expansion, and login-card entry.
- **Zustand:** migrate the internal implementation of `workspace-context.tsx` from React Context to a Zustand store (`workspaceId` / `members` / `channels` / `selectedChannel`), while keeping the public exports (`useWorkspacePageContext` / `useWorkspaceContext` / `fetchWorkspaces` / `workspaceKeys`) unchanged so consumer files remain untouched.
- **Day.js:** add `lib/datetime.ts` (`formatDateTime` / `formatRelativeTime` / `groupByTimeBucket`, etc.) and replace hand-written date formatting throughout pages.
- **Mermaid:** use the `mermaid` package to render ```mermaid blocks locally in Specs/Skills Markdown (dynamic import + initialization, following the dark theme). For PlantUML/C4, render ```plantuml blocks as an encoded “Open in PlantUML Server” link via `plantuml-encoder`, and document that a self-hosted server is needed (no local rendering in the MVP).
- **Workspace icon:** add `Workspace.icon String?` (an Ant Design icon name) to the schema, backfill the seed with `TeamOutlined`, and accept `icon` in `createWorkspace`. Provide about 16 preset Ant Design icons in the frontend; allow choosing one when creating/editing a Workspace, and show it in the collapsed sidebar.

## 3. Sidebar Collapse Redesign (items 1/2)

- Collapsed state (64px): always show an **expand button** at the top (`MenuUnfoldOutlined`; it must not be hidden when collapsed); show a compact logo in the brand area; show the current Workspace icon with a name Tooltip in the Workspace area; show channel icons with channel-name Tooltips in CHATS; center menu icons at 18px with 40px click targets.
- Expanded state (280px): show `MenuFoldOutlined` to the right of the brand area; make minor adjustments to the current layout.
- Persist collapsed state (reuse the existing key).
- Button sizing: 32×32 icon buttons, 8px radius, `var(--hover)` hover background, and Tooltips with explanatory text.

## 4. Apple-style Visual Treatment (items 4/9)

- Add typography/spacing variables in `globals.css`: `--font-size-sm: 13px; --font-size-base: 14px; --font-size-lg: 16px; --font-size-title: 20px; --radius-md: 10px; --radius-lg: 16px; --space-sm: 8px; --space-md: 16px; --space-lg: 24px;` (identical across light and dark modes).
- Increase component typography: 14px sidebar text, 16–18px menu icons, clear content-title hierarchy, and `--muted` for secondary text.
- Interaction: button hover/focus states; standardize card corners on `--radius-lg`; use `--space` variables for whitespace.
- Refactor login/register pages (`auth-page.tsx` + `auth-page.module.css`) in an Apple style: full-screen gradient background + centered glass card (`backdrop-filter`), brand icon + large Wade AI title, larger inputs (44px high), 12px radius, primary gradient button (`primary` → `#6a8dff`), copyright footer, and `framer-motion` fade-up entry.

## 5. Document Diagram Rendering (item 6)

- Add `components/markdown-content.tsx`: wrap `react-markdown` and customize `code` rendering: ```mermaid → `<MermaidBlock>` (dynamic Mermaid import, `startOnLoad:false` + `mermaid.initialize`); ```plantuml → encoded link card (`plantuml-encoder` generates `https://www.plantuml.com/plantuml/svg/<encoded>`, opened in a new window).
- Update `specs-page` and `skills-page` to use this component.

## 6. Workspace Icons (item 8)

- Preset-list constant (`lib/workspace-icons.ts`): `TeamOutlined` / `RocketOutlined` / `HomeOutlined` / `BulbOutlined` / `CloudOutlined` / `DatabaseOutlined` / `CodeOutlined` / `ExperimentOutlined` / `FireOutlined` / `GlobalOutlined` / `HeartOutlined` / `StarOutlined` / `TrophyOutlined` / `AppstoreOutlined` / `CrownOutlined` / `CompassOutlined`.
- Add icon selection (single-select grid) to the create-Workspace modal (`workspace-navigation`) and to the Edit Workspace UI on Settings.
- Show the selected icon in the Workspace area and in collapsed-sidebar state.

## 7. Task Breakdown (parallel lanes)

- **Lane A (backend):** `Workspace.icon` schema + DB push + accept `icon` in create/update Workspace + unit tests. Files: `apps/api/src/{workspace,prisma}`.
- **Lane B (frontend — foundation/state):** Zustand migration (internal `workspace-context` implementation), `lib/datetime.ts` (Day.js), foundational `framer-motion` motion (workspace content / login entry), global type variables, and auth-page refactor. Files: `workspace-context.tsx`, new `lib/datetime.ts`, `app/(workspace)/layout.tsx`, `app/providers.tsx`, `auth-page.tsx`, `auth-page.module.css`, `styles/globals.css`.
- **Lane C (frontend — interaction/features):** sidebar-collapse redesign (expand button / icon sizing / interaction), typography application, Workspace-icon selector (create modal/edit + sidebar display), and Markdown diagram rendering (Mermaid/PlantUML). Files: `workspace-navigation.tsx`, `workspace-shell.module.css`, `workspace-pages.module.css`, new `components/markdown-content.tsx`, new `lib/workspace-icons.ts`, `specs-page.tsx`, `skills-page.tsx`, `settings-page.tsx`, `workspace-page-frame.tsx`.
- Dependency: B defines global variables and compatible context exports first; C uses the new variables and `icon` field in navigation (contract: add `icon?: string` to the `Workspace` type).

## 8. Acceptance

1. Lint/typecheck/tests (API and web) all pass.
2. Browser:
   - After collapse, the expand button is always visible and clickable; collapsed icons have appropriate size/spacing and working Tooltips.
   - Page changes have a fade-in animation; the login page’s new glass-card visual works.
   - Mermaid blocks on the Specs page render as diagrams (verify with test spec content containing Mermaid); PlantUML blocks show a link.
   - A Workspace icon can be selected when creating a Workspace and is shown in the sidebar; it can be changed when editing the Workspace.
   - Site-wide typography readability improves on visual comparison; Day.js formatting produces consistent time display.
3. Append to the `AGENTS.md` Change Log.

## 9. Out of Scope (later)

- Local PlantUML rendering (requires a Java service); detailed dark Mermaid-theme switching; a global replacement of Ant Design motion with a unified animation library; custom icon uploads.
