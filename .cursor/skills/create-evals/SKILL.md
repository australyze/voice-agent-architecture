---
name: create-evals
description: Use when an OpenSpec change needs evaluation datasets or fixtures for agents, prompts, RAG retrieval, voice conversations, regression, or quality-adversarial cases. Do not use to run the release gate or to implement product features.
author: LIDR.co
version: 1.0.0
---

# create-evals

**Design and write** frozen eval evidence. Running it is `verify-ai-implementation`. Evaluation is part of development, not an afterthought.

**Agent:** `evaluation-engineer` (RAG/Voice supply domain fixtures)

## When not to use

- Executing CI/`/verify` → `verify-ai-implementation`
- Red-team of the diff → `adversarial-review` (you may add abuse *cases* here)
- No probabilistic/retrieval/voice surface (deterministic-only change)

## Inputs

- Change types from `design-ai-system` / `tasks.md`
- Prompt/agent/corpus versions

## Steps

1. Load `docs/backend-standards.md` (Evaluation) and `docs/openspec-tasks-mandatory-steps.md`.
2. Select surfaces: agent behavior, prompt A/B, retrieval, voice scripts, regression, quality-adversarial (over-refusal, jailbreak-as-quality — not exploit writeups).
3. Freeze dataset version; redact PII.
4. Assert schemas, tool sequences, groundedness, scores — not exact prose unless deterministic.
5. Record what `/verify` must run: suite name, threshold, runner **if the project already has one** (do not mandate a vendor).
6. Place fixtures in the repo path the project uses (`eval/` or change folder). Point `tasks.md` at them.

## Outputs

- Dataset + case ids + metrics + thresholds
- `tasks.md` bullets the evaluation-engineer will execute

## Quality gates

- Voice/RAG/agent changes without fixtures = incomplete `/ff`
- No production transcripts without redaction policy
- Do not lower thresholds to make a suite exist

## Documents

- `docs/backend-standards.md`, `docs/data-model.md` (EvaluationRun)
- `docs/openspec-tasks-mandatory-steps.md`

## OpenSpec

During `/ff` (required evidence) and `/apply` (fixture updates when behavior was specified to change).

## Combines with

- `design-rag-pipeline` / `design-voice-agent` / `design-prompt`
- Next: `verify-ai-implementation`

## Verification

| Check | Pass |
| --- | --- |
| Prompt change in `/ff` | Frozen cases + metric named in tasks |
| Avoids | “We’ll eval after merge”; live paid voice in default fixtures |
