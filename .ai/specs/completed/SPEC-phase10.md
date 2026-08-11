---
status: done
phase: Phase 10
owner: PM
updated: 2026-08-01
---
# SPEC-Phase 10 — UX/UI Refactor: Sidebar / Animation / State Management / Document Diagrams / Apple-Inspired Visuals

Version: 1.0 (2026-08-01)

## 1. Goals

1. The collapsed sidebar must have a clear expand button; redesign icon layout, sizing, and interactions in collapsed state.
2. Introduce a mature animation library (framer-motion) for basic page-transition/list/modal effects.
3. Manage frontend data state consistently with zustand (migrate workspace context while keeping exported APIs compatible).
4. Apple-ify the overall visual appearance without changing layout: larger fonts/icons and better spacing hierarchy.
5. Support rendering mermaid / plantuml / c4 diagrams in documents.
6. Standardize time handling on dayjs.
7. Support preset Workspace icons (antd icon library), selectable at creation and shown in the sidebar.
8. Refactor the login/registration-page UX.

## 2. Technical Decisions

- **Animation**: `framer-motion` (the orchestrator preinstalls the dependency). Uses: workspace content-area fade/slide transitions, sidebar-collapse width transitions (existing CSS transition can remain; add list-item entrance animation), Chats group expansion, and login-card entrance.
- **zustand**: migrate `workspace-context.tsx` internally from React Context to a zustand store (workspaceId/members/channels/selectedChannel), while **keeping the external exported interfaces (`useWorkspacePageContext / useWorkspaceContext / fetchWorkspaces / workspaceKeys`) unchanged** so all consumer files remain unchanged.
- **dayjs**: add `lib/datetime.ts` (`formatDateTime / formatRelativeTime / groupByTimeBucket`, etc.), and replace handwritten date formatting on all pages.
- **mermaid**: use the `mermaid` package to locally render ```mermaid code blocks in markdown on specs/skills pages (dynamic import + initialization; follows dark theme). For plantuml/c4: render ```plantuml blocks as encoded "Open in PlantUML server" links (`plantuml-encoder`), noting that a self-hosted server is required (MVP does not render locally).
- **workspace icon**: schema `Workspace.icon String?` (antd icon name); seed backfills default `TeamOutlined`; API `createWorkspace` accepts icon. Frontend provides a preset icon list (~16 antd icons), selectable when creating/editing a workspace; collapsed sidebar shows the icon.

## 3. Sidebar Collapse Redesign (items 1/2)

- Collapsed state (64px): fixed **expand button** at the top (`MenuUnfoldOutlined`, always visible and not hidden during collapse); compact logo in brand area; current workspace icon in the workspace area (Tooltip name); channel icons in CHATS (Tooltip channel name); centered menu icons at 18px with 40px click targets.
- Expanded state (280px): `MenuFoldOutlined` collapse button appears at the right of the brand area; minor adjustments to existing layout.
- Persist collapse state (reuse existing key).
- Button sizing: icon buttons are 32×32 with 8px radius and `var(--hover)` hover background; Tooltips include text descriptions.

## 4. Apple-Inspired Visuals (items 4/9)

- Add font-size/spacing variables to `globals.css`: `--font-size-sm: 13px; --font-size-base: 14px; --font-size-lg: 16px; --font-size-title: 20px; --radius-md: 10px; --radius-lg: 16px; --space-sm: 8px; --space-md: 16px; --space-lg: 24px;` (consistent in light/dark modes).
- Increase component font sizes: sidebar text 14px, menu icons 16–18px, clear content-heading hierarchy, and `--muted` for secondary text.
- Interactions: button hover/focus states, uniformly use `--radius-lg` for card radius, and use `--space` variables for whitespace.
- Refactor login/registration pages (`auth-page.tsx` + `auth-page.module.css`) in an Apple style—full-screen gradient background + centered frosted-glass card (`backdrop-filter`), brand icon + large Wade AI title, larger inputs (44px tall), 12px radius, primary-button gradient (primary→#6a8dff), footer copyright; entrance animation (framer-motion fade+up).

## 5. Document Diagram Rendering (item 6)

- New `components/markdown-content.tsx`: wraps react-markdown and customizes `code` rendering: ```mermaid → `<MermaidBlock>` (dynamic mermaid import, `startOnLoad:false` + `mermaid.initialize`); ```plantuml → encoded link card (`plantuml-encoder` generates `https://www.plantuml.com/plantuml/svg/<encoded>` link; new window).
- Update specs-page / skills-page to use this component.

## 6. Workspace Icon (item 8)

- Preset list (constant `lib/workspace-icons.ts`): TeamOutlined / RocketOutlined / HomeOutlined / BulbOutlined / CloudOutlined / DatabaseOutlined / CodeOutlined / ExperimentOutlined / FireOutlined / GlobalOutlined / HeartOutlined / StarOutlined / TrophyOutlined / AppstoreOutlined / CrownOutlined / CompassOutlined.
- Add icon selection (single-select grid) to the new-workspace modal (`workspace-navigation`); add icon selection to edit workspace (Settings page).
- Show selected icon in the workspace area of the sidebar and when collapsed.

## 7. Task Breakdown (parallel lanes)

- **Lane A (backend)**: `Workspace.icon` schema + db push + `createWorkspace`/update accept icon + unit tests. Files: `apps/api/src/{workspace,prisma}`.
- **Lane B (frontend—foundation/state)**: zustand migration (internal workspace-context implementation), `lib/datetime.ts` (dayjs), framer-motion basic animations (workspace content-area/login-page entrance), `globals.css` font-size variables, auth-page refactor. Files: `workspace-context.tsx`, new `lib/datetime.ts`, `app/(workspace)/layout.tsx`, `app/providers.tsx`, `auth-page.tsx`, `auth-page.module.css`, `styles/globals.css`.
- **Lane C (frontend—interaction/features)**: sidebar collapse redesign (expand button/icon size/interactions), font-size usage, workspace-icon picker (new modal/edit + sidebar display), markdown diagram rendering (mermaid/plantuml). Files: `workspace-navigation.tsx`, `workspace-shell.module.css`, `workspace-pages.module.css`, new `components/markdown-content.tsx`, new `lib/workspace-icons.ts`, `specs-page.tsx`, `skills-page.tsx`, `settings-page.tsx`, `workspace-page-frame.tsx`.
- Dependency: B defines globals variables and compatible context exports first; C navigation uses the new variables and icon field (contract: Workspace type adds `icon?: string`).

## 8. Acceptance

1. lint/typecheck/test (api, web) all pass.
2. Browser:
   - Expand button remains visible and clickable after collapse; collapsed icon size/spacing is appropriate (Tooltip usable).
   - Page transitions have fade-in animation; new login-page visual (frosted-glass card) works.
   - Mermaid code block on specs page renders as a diagram (verify with test spec content containing mermaid); plantuml block shows a link.
   - New workspaces can select an icon and the sidebar shows it; editing a workspace can change its icon.
   - Readability improves site-wide (visual comparison); dayjs formatting is standardized (time-display formatting consistent).
3. Append to the AGENTS.md Change Log.

## 9. Exclusions (Later)

- Local PlantUML rendering (requires Java service); dark mermaid theme-switching details; globally replacing antd motion with a transition animation library; custom icon upload.
