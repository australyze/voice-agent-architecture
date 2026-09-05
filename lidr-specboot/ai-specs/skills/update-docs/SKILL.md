---
name: update-docs
description: Use when implementation or an OpenSpec change altered behavior, contracts, prompts, tools, data model, APIs, eval suites, or setup steps, and living docs may be stale. Do not use to invent new methodology or to write OpenSpec proposal/design from scratch.
author: LIDR.co
version: 2.0.0
---

# update-docs

Keep `docs/` and versioned contracts aligned with what actually changed. Follow `docs/documentation-standards.md`. Do not duplicate global rules here.

**Agent:** `ai-engineer` (typical); any agent that changed a contract.

## When not to use

- No behavior or contract change (typos-only code)
- Creating the first OpenSpec change (`design-ai-system` / `/ff`)
- Rewriting `base-standards.md` without user approval

## Inputs

- Diff / completed `tasks.md` items
- Current `docs/` files listed in documentation-standards

## Steps

1. Read `docs/documentation-standards.md` and the inventory table.
2. Map the change to files:
   - Domain/API → `data-model.md`, `api-spec.yml`
   - Agent/tool/prompt versions → project prompt/tool docs **and** mention in data-model if new aggregates
   - RAG/voice/eval process → `backend-standards.md` only if the **methodology** changed; else project adapter notes
   - Setup → `development_guide.md`
3. Update in English. Do not invent vendor SDK fields.
4. Report which files changed and why.

## Outputs

- Patched docs
- Short changelog in chat: files + reason

## Quality gates

- Specs and docs do not contradict the OpenSpec change
- Prompt/tool/eval versioning treated as contracts
- No secrets in docs

## Documents

- `docs/documentation-standards.md` (required)
- Only the inventory files that the change touches

## OpenSpec

Usually after `/apply`, before `/verify` or `/archive`. Mandatory task in `openspec-tasks-mandatory-steps.md`.

## Combines with

- After: `implement-spec`
- Also: `design-prompt`, `design-tool`, `create-evals` when those artifacts moved

## Verification

| Check | Pass |
| --- | --- |
| Activates after new HTTP path | `api-spec.yml` updated |
| Activates after prompt edit | version + eval note, not only README |
| Avoids | Editing `base-standards.md` as a silent side effect |
