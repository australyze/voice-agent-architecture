---
name: implement-spec
description: Use when running OpenSpec /apply or implementing tasks.md for an AI system: domain, ports, tools, adapters, tests, traces, and fixtures. Do not use to invent architecture, run /verify, or perform adversarial review.
author: LIDR.co
version: 1.0.0
---

# implement-spec

Execute **approved** OpenSpec tasks. Baby steps. TDD for deterministic code; eval case first for probabilistic paths.

**Agent:** `ai-engineer` (+ voice/RAG on their surfaces)

## When not to use

- Missing design → `design-ai-system` / `/continue` first
- `/verify` → `verify-ai-implementation`
- `/adversarial-review` on your own work as a substitute for `security-reviewer`

## Inputs

- `tasks.md`, specs, `docs/`
- Change types

## Steps

1. Load `docs/base-standards.md`, `docs/backend-standards.md`, `docs/openspec-tasks-mandatory-steps.md`, current specs.
2. One task at a time. Feature branch if Step 0 requires it.
3. Deterministic: failing test → code. LLM/voice: fake ports in unit tests (no paid APIs).
4. Validate tool args before execute; structured errors; idempotent retries only.
5. Invoke `instrument-ai-system` on every new model/tool/retrieval path.
6. Do not import vendor SDKs into domain. Voice/RAG adapters: defer to those skills/agents if the task is theirs.
7. Update fixtures if behavior was specified to change (`create-evals`).
8. `update-docs` when contracts moved. Mark `[x]` only after **you** ran the listed unit/contract/tool gates.

## Outputs

- Code + tests + reports under the change `reports/` as tasks require
- No parallel `.claude/doc` canon

## Quality gates

- Production path you touched is traced
- Invalid tools never execute
- Applicable `tasks.md` reports exist before complete

## Documents

- Step 1 plus `docs/api-spec.yml` / `docs/data-model.md` when those change

## OpenSpec

**During** `/apply`, not a second workflow.

## Combines with

- `using-git-worktrees` (optional isolation)
- `instrument-ai-system`, `update-docs`
- Specialists: `design-voice-agent` / `design-rag-pipeline` if spec gaps appear — **stop and spec**, don’t improvise

## Verification

| Check | Pass |
| --- | --- |
| `/apply` with tools change | Schema tests + fakes, not live LLM unit tests |
| Avoids | Shipping untraced complete(); implementing unspecified tools |
