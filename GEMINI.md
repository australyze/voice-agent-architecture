# Voice Agent Architecture — coding agent load path

This repository is an implementing project. OpenSpec lives at the repo root. The AI Engineering methodology lives in `lidr-specboot/`.

Before planning or implementing, read:

1. `lidr-specboot/docs/base-standards.md` (single source of truth)
2. Domain docs linked from it, as relevant to the task
3. `openspec/config.yaml` and the current OpenSpec change, if any
4. The agent in `lidr-specboot/ai-specs/agents/` for the current phase
5. Matching skills in `lidr-specboot/ai-specs/skills/`

When an agent or skill says `docs/` or `ai-specs/`, resolve them as `lidr-specboot/docs/` and `lidr-specboot/ai-specs/`.

## Hierarchy

`lidr-specboot/docs/` → OpenSpec change → agent → skills → code.

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

Project skills for the Cursor `/` picker live in `.cursor/skills/<name>/SKILL.md` as real folders (not junctions). Canonical copies stay in `lidr-specboot/ai-specs/skills/`. After adding a skill, copy it into `.cursor/skills/` and reload the window.

OpenSpec SDD in Cursor uses hyphen commands (not Crush `opsx:`): `/opsx-propose`, `/opsx-explore`, `/opsx-apply`, `/opsx-update`, `/opsx-sync`, `/opsx-archive`. Files live in `.cursor/commands/`. Matching skills are `/openspec-propose`, `/openspec-apply-change`, and the rest.

## Always-on constraints

- English for all technical artifacts
- Small tasks, one at a time; TDD for deterministic code; eval cases for probabilistic paths
- Hexagonal ports: core must not import Vapi, a specific LLM SDK, or observability vendors
- Evaluation before production for agent, prompt, tool, or retrieval changes
- Follow `lidr-specboot/docs/openspec-tasks-mandatory-steps.md` when writing `tasks.md`
