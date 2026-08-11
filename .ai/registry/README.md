# Registry

## Rule

- AI **checks the Registry first; it does not scan directories**.
- The Registry maps `workflow / skill / role / model / tool / memory` to stable paths.
- By default, `path` is written relative to the `.ai/` root, for example `skills/common/ponytail.md`.

## YAML convention

| Key | Required | Meaning |
|---|---|---|
| `path` | Yes | Path relative to `.ai/` |
| `description` | Optional | Brief purpose |
| `tags` | Optional | Search tags |
| `owner` | Optional | Default responsible role |
| `depends` | Optional | List of registry keys it depends on |
| `reference` | Optional | Upstream rule or runtime document |

## Files

| File | Purpose |
|---|---|
| `skills.yaml` | Skill index and Categories placeholders |
| `workflows.yaml` | Workflow and pipeline entry points |
| `models.yaml` | Default model chain and fallback order |
| `tools.yaml` | Project tool index |
| `roles.yaml` | Role document index |
| `prompts.yaml` | Prompt-asset placeholder skeleton |
| `memory.yaml` | Memory hotspot index placeholder skeleton |
