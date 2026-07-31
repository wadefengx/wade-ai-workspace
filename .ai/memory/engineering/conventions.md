# Conventions Memory

## Current conventions

| Topic | Convention |
|---|---|
| Response shape | Lists may be bare arrays; paginated messages use `{items, nextCursor}` |
| Error shape | `{statusCode, message}` |
| Roles | OWNER > ADMIN > MEMBER inside a workspace |
| Theme color | Primary brand color stays `#024AD8` |
| Documentation | Specs and skills remain readable from both new and legacy paths during migration |
| Workspace shell scrolling | Workspace shell stays `100vh` with `overflow: hidden`; sidebar and content own their scroll containers so header/sidebar stay fixed while chat and memory content scroll |
| Default chat naming | Sidebar "新建 Chat" creates channels directly as `对话 N` using the current max sequence instead of opening a modal |

## Pending entries

- TODO: capture naming rules for new memory and knowledge artifacts.
- TODO: capture doc title rules for browsable markdown.
- TODO: capture commit and changelog formatting conventions beyond AGENTS.
- TODO: capture when `.ai/` becomes the only supported runtime path.

## Maintenance rule

- Record only conventions that future contributors should actively preserve.
