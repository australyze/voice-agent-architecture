---
name: design-agent
description: Use when specifying a product agent's state machine, allowlisted tools, handoffs, retries, fallbacks, or multi-agent messages for an OpenSpec change. Do not use for system-wide ports, voice media, RAG ingestion, or a single tool schema in isolation.
author: LIDR.co
version: 1.0.0
---

# design-agent

Specify **one** product agent (or the session owner + specialists) as typed behavior. Provider-agnostic. LLMs are probabilistic: state and tools are explicit.

**Agents:** `ai-architect` (policy) then `ai-engineer` (detail)

## When not to use

- System topology / vendor ports → `design-ai-system`
- JSON Schema for one capability → `design-tool`
- STT/TTS/barge-in → `design-voice-agent`
- Prompt text versioning only → `design-prompt`

## Inputs

- OpenSpec change + agent job from the spec
- Tool names and risk classes if known

## Steps

1. Load `docs/backend-standards.md` (agent engineering) and `docs/data-model.md` (`AgentVersion`, `Session`).
2. Named **business** states (not only media). Transitions with actor (`model` | `runtime` | `human`).
3. Allowlisted tools, max hops, token/latency/cost budgets on `AgentVersion`.
4. Structured intents from the model; runtime validates then executes.
5. Retry only idempotent work; fallback ladder (model → rules → human).
6. Multi-agent: typed messages; one user-facing owner; no unbounded recursion.
7. Handoff event: reason + payload. Guardrails: refuse when ungrounded if the spec requires facts.
8. List eval cases for `create-evals` (golden paths, fallback, handoff).

## Outputs

- Spec sections: states, tools, handoffs, budgets, fallback
- No SDK-specific graph JSON as the source of truth (optional libraries stay adapters)

## Quality gates

- Model cannot execute side effects without runtime
- High-risk tools still HITL per `design-ai-system`
- Observability: every turn records prompt/model version (see `instrument-ai-system`)

## Documents

- `docs/base-standards.md`, `docs/backend-standards.md`, `docs/data-model.md`

## OpenSpec

During `/ff` or when `/apply` finds missing agent spec (then **stop** and update artifacts first).

## Combines with

- Parent: `design-ai-system`
- Tools: `design-tool`
- Prompts: `design-prompt`

## Verification

| Check | Pass |
| --- | --- |
| “Add supervisor + billing specialist” | Owner + typed handoff, not shared mutable prompt |
| Avoids | Hiding control flow only in prose; LangGraph as domain |
