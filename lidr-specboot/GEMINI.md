# Specboot coding agent load path

This folder is the AI Engineering methodology (`docs/` + `ai-specs/`). Canonical rules are in `docs/base-standards.md`, not in this file.

Before planning or implementing, read:

1. `docs/base-standards.md` (single source of truth)
2. Domain docs linked from it, as relevant to the task
3. The current OpenSpec change, if this methodology is used from an implementing repo
4. The agent in `ai-specs/agents/` for the current phase
5. Matching skills in `ai-specs/skills/`

If this folder is nested (for example `lidr-specboot/` inside an implementing repo), OpenSpec and application code live at the parent root. Resolve `docs/` from this folder, and keep OpenSpec paths at the implementing repo root.

## Hierarchy

`docs/` → OpenSpec change → agent → skills → code.

Do not invent a parallel rulebook. Do not treat Vapi as the application core.

## Phase → agent

| Phase | Agent |
| --- | --- |
| `/enrich-us` | `product-analyst` |
| `/ff` `/new` `/propose` (design) | `ai-architect` (+ `voice-ai-engineer` / `rag-engineer` when those change types apply) |
| `/apply` | `ai-engineer` (+ voice/RAG specialists for their surfaces) |
| `/verify` | `evaluation-engineer` |
| `/adversarial-review` | `security-reviewer` |

Skills compose with OpenSpec. They do not replace `/ff`, `/apply`, or `/verify`.

## Always-on constraints

- English for all technical artifacts
- Small tasks, one at a time; TDD for deterministic code; eval cases for probabilistic paths
- Hexagonal ports: core must not import Vapi, a specific LLM SDK, or observability vendors
- Evaluation before production for agent, prompt, tool, or retrieval changes
- Follow `docs/openspec-tasks-mandatory-steps.md` when writing `tasks.md`
