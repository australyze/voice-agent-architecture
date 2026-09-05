---
name: enrich-us
description: Use when the user runs /enrich-us, pastes a vague ticket or idea, or asks to refine a story before OpenSpec /ff. Use for AI agent, voice, RAG, or automation ideas that lack users, non-goals, or agent-vs-workflow. Do not use when a change already has OpenSpec artifacts ready to implement.
author: LIDR.co
version: 2.0.0
---

# enrich-us

Turn a vague idea or ticket into an implementation-ready problem **before** `/ff`. Does not replace OpenSpec. Does not design ports or write code.

**Agent:** `product-analyst`

## When not to use

- `/ff`, `/apply`, `/verify` already in progress
- The user asked only for architecture or code
- Use `design-ai-system` once the problem is clear

## Inputs

- `$ARGUMENTS` or chat: ticket text, idea, or Jira key
- Optional Jira MCP if the user gives a key and asks to fetch it

## Steps

1. Resolve source: chat text (default) vs Jira (only if id/key or explicit Jira request). Do not require Jira.
2. Load `docs/base-standards.md`. Cite it; do not fork rules.
3. Judge whether the story is enough to start `/ff`. It must include:
   - Job, users, channel (voice / chat / batch / none)
   - Use cases and **non-goals**
   - Agent vs deterministic workflow vs human (recommendation + why)
   - High-stakes actions (HITL as a **requirement**, not a schema)
   - Success metrics (outcomes, not model scores)
   - Eval and observability as requirements
   - Risks (hallucination, latency, PII, autonomy)
4. If thin, write an Enhanced version. Do not invent vendors or APIs.
5. Output markdown with `## Original` and `## Enhanced` only.
6. Jira write-back only in Jira mode (append original/enhanced). Optional status move if the project uses `To refine`.

## Outputs

- `## Original` / `## Enhanced` in chat (and Jira if applicable)
- Explicit gaps as questions — do not guess users or channel

## Quality gates

- An architect can start `design-ai-system` / `/ff` without inventing the job
- No stack dump unless the user already mandated a constraint
- No OpenSpec files created here

## Documents

- `docs/base-standards.md`
- `docs/frontend-standards.md` only if a UI is part of the problem

## OpenSpec

Phase: `/enrich-us` → then `/new` `/ff`. Do not run `/apply`.

## Combines with

- Next: `design-ai-system`
- Not: `implement-spec`, `adversarial-review`

## Verification

| Check | Pass |
| --- | --- |
| Activates on vague billing-call idea | Enhanced includes agent-vs-workflow and HITL notes |
| Does not activate on “implement tasks.md” | Defers to `implement-spec` |
| Loads | `docs/base-standards.md` |
| Avoids | Inventing Vapi/LangGraph; skipping Original/Enhanced |
