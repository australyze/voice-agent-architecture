# Verification Report - Adversarial remediations

- Date: 2026-09-05
- Change: evaluation-ai-security
- Agent: ai-engineer
- Gate: `openspec`
- Change types: **code** | **tools** | **agent** | **rag**
- Verdict: **PASS** (quality remediations)

This report covers OpenSpec tasks 8.1–8.3 and 9.1 after the 2026-09-05 adversarial-review **FAIL** (Major: last-segment baseline matching). Quality PASS is not a security PASS. Independent `/adversarial-review` must run in a **fresh session** before archive.

## What changed

- Baseline compare matches required members on the full `suiteName/caseId` only.
- A spoof suffix (`spoof/injection-does-not-expand-allowlist`) does not satisfy `runtime-first-agent/injection-does-not-expand-allowlist`.
- Two scores that share a final segment fail compare.
- Executed suite `datasetVersion` / `promptVersion` must equal `baseline.suiteVersions`.
- `writeEvaluationBaseline` is removed.
- `writeRunPath` is allowed only as `eval/gate/last-run.json` under the process root.
- Checked-in `eval/gate/baseline.json` required members and `SECURITY_CASE_IDS` use full ids.

## EvaluationRun

| Field | Value |
| --- | --- |
| id | `764aec7c-f1df-47f7-8fe6-56c420d3bd60` |
| suiteName | `evaluation-quality-gate` |
| datasetVersion | `runtime-demo:2026-09-05.5\|knowledge:2026-09-05.1\|voice:2026-09-05.1` |
| promptVersionId | `runtime-demo@2` |
| agentVersionId | null (`runtime-demo` in-process) |
| model identity | `fake` |
| status | `passed` |
| gate | `openspec` |
| startedAt | `2026-09-05T23:43:56.814Z` |
| endedAt | `2026-09-05T23:43:56.814Z` |

## Commands executed

- `npx vitest run src/application/compare-baseline.test.ts src/application/run-quality-gate.test.ts src/application/apply-judge.test.ts eval/gate/quality-gate.eval.test.ts eval/gate/hygiene.test.ts` — 5 files, 16 passed
- `npx vitest run` — 47 files, **202 passed**, 0 failed
- `$env:OPENSPEC_EVAL_GATE="openspec"; npm run test:eval-gate` — `evaluation-gate` outcome `success`, status `passed`

Paid APIs, MCP, vector vendors, and live telephony were not used.

## Gate selection

| Type | Executed | Result |
| --- | --- | --- |
| code | Full unit suite (47 files, 202 passed) | PASS |
| tools | Included in full Vitest (tool port + agent-turn deny/invalid/timeout/leak) | PASS |
| agent / prompt | `eval/runtime-demo` via full Vitest + quality gate | PASS |
| rag | `eval/knowledge` via full Vitest + quality gate | PASS |
| quality gate | `npm run test:eval-gate` vs checked-in baseline (full ids + version pin) | PASS |
| voice conversation | N/A — no barge-in/confirmation/silence change | N/A |
| ui | N/A — no frontend | N/A |

## Remediation tests added

- Spoof suffix does not satisfy a required full id
- Duplicate final segments fail compare
- Dataset and prompt version pin mismatches fail compare
- Membership fails when only a spoofed security id is present
- `writeRunPath` outside `eval/gate/last-run.json` is rejected
- Compare module does not export `writeEvaluationBaseline`

## Outcome

- **Status: PASS** for the listed remediations and quality gates
- **Do not archive** until a new-session `/adversarial-review` PASS
