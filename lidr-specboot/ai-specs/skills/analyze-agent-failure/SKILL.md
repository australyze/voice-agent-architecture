---
name: analyze-agent-failure
description: Use when a production or staging agent failed (wrong tool, hallucination, timeout, bad retrieval, voice drop, cost spike) and traces or logs exist to reconstruct the turn. Do not use to add greenfield instrumentation or to run the full eval suite as the first step.
author: LIDR.co
version: 1.0.0
---

# analyze-agent-failure

Reconstruct **one** failing turn (or a small cluster) from traces. Then propose a spec/code/eval fix — do not silently patch.

**Agents:** `evaluation-engineer` or `ai-engineer`

## When not to use

- No traces yet → `instrument-ai-system` first
- Full `/verify` regression as the investigation → run `verify-ai-implementation` **after** a hypothesis
- Security exploit hunt on a change → `adversarial-review`

## Inputs

- Session/trace/turn ids, time window, symptom
- Trace backend or exported spans

## Steps

1. Load `docs/backend-standards.md` (Observability) and the Trace/Span model.
2. Timeline: model → tools → retrieval → voice events. Note retries and fallbacks.
3. Classify: hallucination / tool-misuse / schema / timeout / retrieval-miss / stale-doc / barge-in / budget / auth.
4. Check versions: prompt, model, agent, corpus, tool schema.
5. Hypothesis + smallest countermeasure (prompt version, threshold, HITL, timeout, fixture).
6. If the defect should have been caught: add a case via `create-evals`.
7. Human approval before irreversible production hotfixes or threshold drops.

## Outputs

```markdown
## Failure analysis
**Ids**: session/trace/turn
**Timeline**: ...
**Class**: ...
**Versions**: ...
**Hypothesis**: ...
**Fix belongs in**: spec | code | eval | ops
**Next skill**: implement-spec | design-prompt | design-rag-pipeline | ...
```

## Quality gates

- Evidence from traces, not guesswork
- No vendor-specific field names required in the report (map in the adapter if needed)

## Documents

- `docs/backend-standards.md`, `docs/data-model.md`

## OpenSpec

If the fix is a product change: new or continued OpenSpec change — do not hotfix unspec’d behavior.

## Combines with

- Requires: `instrument-ai-system` data
- Next: `create-evals` + `implement-spec` as appropriate

## Verification

| Check | Pass |
| --- | --- |
| “Call hung after tool” | Timeline + class + next skill |
| Avoids | Redesigning the whole agent; ignoring missing spans |
