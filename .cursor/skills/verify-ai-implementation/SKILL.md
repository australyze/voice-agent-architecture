---
name: verify-ai-implementation
description: Use when running OpenSpec /verify or when a change needs executed evaluation gates (unit/contract plus agent, prompt, RAG, voice, regression). Do not use to write product code, to design datasets from scratch, or as a security red-team.
author: LIDR.co
version: 1.0.0
---

# verify-ai-implementation

**Run** the gates for this change type and write the report. Datasets come from `create-evals`.

**Agent:** `evaluation-engineer`

## When not to use

- Fixtures missing → `create-evals` / spec gap
- `/adversarial-review`
- Live demo for the user → `show-spec-working` after scores if asked

## Inputs

- `tasks.md` change types
- Fixture paths and thresholds

## Steps

1. Load `docs/openspec-tasks-mandatory-steps.md` and `docs/backend-standards.md` (Evaluation).
2. Select gates:

| Type | Execute |
| --- | --- |
| code / persistence | Unit tests + DB state report |
| api | Contract tests vs `api-spec.yml` |
| tools | Schema/deny/timeout tests |
| agent / prompt | Behavior/prompt suite |
| rag | Retrieval metrics on frozen set |
| voice | Conversation fixtures (no live paid calls unless configured) |
| ui | E2E only if frontend exists |

3. Record dataset, prompt, model, agent versions and scores (`EvaluationRun` shape).
4. Assert thresholds — not vibes. Do not drop cases to go green.
5. Write `reports/YYYY-MM-DD-evaluation.md` (and unit report if required).
6. Verdict: PASS / FAIL for `/verify`. Agent executes commands; do not delegate to the user.

## Outputs

- Reports in the OpenSpec change folder
- Explicit PASS/FAIL

## Quality gates

- Applicable rows from the table covered or explicitly N/A with reason
- Quality PASS ≠ security PASS

## Documents

- `docs/openspec-tasks-mandatory-steps.md`, `docs/backend-standards.md`, `docs/data-model.md`, `docs/api-spec.yml`

## OpenSpec

**During** `/verify`. Blocks `/archive` if FAIL.

## Combines with

- Before: `create-evals`, `implement-spec`
- After: `adversarial-review`
- Optional: `show-spec-working`

## Verification

| Check | Pass |
| --- | --- |
| Voice+tools change | Voice fixtures + tool tests run, reports saved |
| Avoids | “Unit tests passed so skip eval”; asking the user to run the suite |
