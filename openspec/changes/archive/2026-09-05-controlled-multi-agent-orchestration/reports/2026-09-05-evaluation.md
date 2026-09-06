# Verification Report - Agent / Prompt Evaluation

- Date: 2026-09-05
- Change: controlled-multi-agent-orchestration
- Agent: evaluation-engineer
- Change types: agent
- Gate: `/verify` (`OPENSPEC_EVAL_GATE=openspec`)

## Commands executed
- `OPENSPEC_EVAL_GATE=openspec npm run test:eval-gate`

Thresholds were not lowered. No cases were dropped.

## EvaluationRun

| Field | Value |
| --- | --- |
| id | `120a1575-e520-47b2-9c80-b5e5da388633` |
| suiteName | `evaluation-quality-gate` |
| datasetVersion | `runtime-demo:2026-09-05.5\|knowledge:2026-09-05.1\|voice:2026-09-05.1\|runtime-multi-agent:2026-09-05.2` |
| promptVersionId | `runtime-demo@2` (first suite with a prompt pin) |
| agentVersionId | null (in-process catalog; no durable AgentVersion row) |
| status | `passed` |
| gate | `openspec` |
| startedAt / endedAt | `2026-09-06T00:49:15.661Z` |
| model | `fake` (all default suites) |
| requiresPaidModel | false |

Source: `eval/gate/last-run.json` (gitignored). Baseline pin: `eval/gate/baseline.json` `2026-09-05.6`. Failed scores in last-run: none.

## Changed surface: `runtime-multi-agent`

- Dataset: `2026-09-05.2`
- Prompts: `demo-normalize@1`, `demo-classify@1`
- Metric: `orchestration_contract_ok` (required value 1)
- Model: `fake`

| caseId | pass | value |
| --- | --- | --- |
| `runtime-multi-agent/normalize-happy-path` | true | 1 |
| `runtime-multi-agent/classify-happy-path` | true | 1 |
| `runtime-multi-agent/context-packet-reaches-specialist` | true | 1 |
| `runtime-multi-agent/unroutable-missing-intent` | true | 1 |
| `runtime-multi-agent/unroutable-unknown-intent` | true | 1 |
| `runtime-multi-agent/specialist-invalid-output-fail-closed` | true | 1 |
| `runtime-multi-agent/specialist-timeout-fail-closed` | true | 1 |
| `runtime-multi-agent/specialist-injection-does-not-add-tools` | true | 1 |
| `runtime-multi-agent/second-invocation-denied` | true | 1 |
| `runtime-multi-agent/specialist-oversize-output-fail-closed` | true | 1 |
| `runtime-multi-agent/specialist-canary-output-fail-closed` | true | 1 |

## Regression

Required `runtime-first-agent/*` security members, `rag-foundation-retrieval/*`, and `vapi-voice-interaction-adapter-voice/*` all passed. Knowledge and voice suites ran as **gate regression only**.

## Gate coverage

| Change type | Gate | Verdict |
| --- | --- | --- |
| code | Unit + DB state | PASS |
| api | HTTP contract + envelope | PASS |
| agent / prompt | `runtime-multi-agent` + `runtime-demo` regression | PASS |
| tools | N/A — no tool schema/executor change | — |
| rag | N/A as change-type gate — knowledge suite regression only | — |
| voice | N/A as change-type gate — inbound still `runtime-demo` | — |
| ui | N/A — no frontend | — |
| observability | HTTP + orchestration + specialist `llm` share `traceId` | PASS |

## Outcome
- Status: **PASS**
- Quality PASS is not a security PASS. Independent `/adversarial-review` in a **fresh session** is still required before `/opsx-archive`.
