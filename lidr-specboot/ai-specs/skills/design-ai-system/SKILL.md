---
name: design-ai-system
description: Use when running OpenSpec /ff or /new for an AI system, or when deciding agent vs workflow, ports, HITL, multi-agent topology, or change-type gates. Do not use to write production code or to enrich a vague idea that still lacks users.
author: LIDR.co
version: 1.0.0
---

# design-ai-system

Shape the system inside **OpenSpec design/spec/tasks**. Does not replace `/ff`. Does not implement.

**Agent:** `ai-architect`

## When not to use

- `/enrich-us` still needed → `enrich-us`
- `/apply` → `implement-spec`
- Single tool schema only → `design-tool`
- Voice media details only → `design-voice-agent`

## Inputs

- Enriched story or ticket
- Existing `docs/` and current OpenSpec change folder

## Steps

1. Load `docs/base-standards.md`, `docs/backend-standards.md`, `docs/data-model.md`, `docs/api-spec.yml`.
2. Decide **agent vs deterministic workflow** (n8n/workers if fully specified).
3. Draw ports: LLM, voice/speech, tools, retrieval, observability, persistence. No vendor types in domain.
4. Topology: one session owner; multi-agent only with typed handoffs.
5. Risk class + HITL; budgets (tokens, latency, hops, cost).
6. Name change types for `tasks.md`: `code | api | tools | agent | rag | voice | ui`.
7. Point to eval gates (`create-evals`) — do not write datasets here unless tiny.
8. Compose: invoke `design-agent`, `design-tool`, `design-voice-agent`, `design-rag-pipeline`, `design-prompt` when those surfaces exist. Do not paste their full checklists into this skill’s output.

## Outputs

- OpenSpec design + specs + `tasks.md` gate list
- Explicit decisions: topology, ports, HITL, budgets, change types

## Quality gates

- Generative paths have a named eval gate
- Side-effecting tools have risk class
- Domain stays vendor-independent

## Documents

- Listed in step 1 plus `docs/openspec-tasks-mandatory-steps.md`

## OpenSpec

Runs **during** `/ff` / `/continue`, not instead of them.

## Combines with

- After: `create-evals` (evidence in tasks)
- Specialists: voice / RAG / tool / prompt design skills

## Verification

| Check | Pass |
| --- | --- |
| Activates on `/ff` voice+tools | Ports + HITL + change types in artifacts |
| Avoids | Implementing adapters; inventing Vapi JSON |
| Human | New core vendor or unsupervised irreversible tools |
