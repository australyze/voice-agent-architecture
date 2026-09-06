# Verification Report - Evaluation (`/verify`)

- Date: 2026-09-06
- Change: `evaluation-public-demo`
- Agent: evaluation-engineer ([verify gates](508397aa-7df8-4b08-83bb-be5126955c8c))
- Branch: `feature/evaluation-public-demo`
- Change types: **code**, **api**, **ui**
- Not in change: tools, agent/prompt, rag, voice media
- Context: **re-verify after adversarial remediations** (see `2026-09-06-adversarial-remediation.md`)

## Gate selection

| Gate | Required? | Result |
| --- | --- | --- |
| Unit tests + DB state | Yes (code + persistence) | PASS |
| Contract tests (HTTP / OpenAPI) | Yes (api) | PASS |
| Tool calling | No — no schema/executor change | N/A |
| Agent / prompt behavior suite | No — no generative path change | N/A (regression only) |
| RAG retrieval | No — no retrieval change | N/A |
| Voice conversation fixtures | No — no barge-in/confirmation/STT change | N/A |
| UI component tests | Yes (ui); Playwright not wired | PASS (Vitest) |
| Offline quality-gate regression | Yes as non-regression | PASS |
| Observability / attributability | Yes (evaluation evidence + scorerVersion) | PASS (unit/contract) |
| Public deployed E2E | Operational DoD (AC-06), not a code-quality gate | BLOCKED (hosts) — does not fail `/verify` quality |

## Commands executed

```text
npx vitest run src/application/score-session-call.test.ts src/adapters/persistence/memory-persistence.test.ts src/adapters/http/sessions.test.ts src/adapters/http/evaluations-unimplemented.test.ts src/openapi-health.test.ts src/architecture.test.ts src/secrets-hygiene.test.ts src/demo-web-isolation.test.ts
npx vitest run
npm run web:test
npm run test:eval-gate
npm run web:typecheck
```

## Unit + persistence

- Targeted: 8 files, **32 passed** (includes post-remediation auth/scope cases)
- Full backend suite: 61 files, **308 passed**, 0 failed
- DB: MemoryPersistence evaluation round-trip; migration `20260906140000_session_call_evaluation.sql` present; hosted Supabase not required for default suite
- Deterministic session-call scorer: happy path, no tools (no fabricated evidence), failed tool, failed session, idempotence, grounding/policy cases

## Contract (incl. remediations)

- Terminal `GET /sessions/:id` returns four-dimension `evaluation` with evidence
- Operator `?recompute=true` attributable refresh
- Public token: `x-demo-public-token` only (no dual-accept on operator header)
- Public list requires `externalChannelId` (403 unscoped)
- Public `recompute` → 403; equal public/inbound secret → 503
- `POST/GET /evaluations/runs` remains unimplemented
- OpenAPI documents evaluation, operator-only recompute, public token scope

## UI

- Web Vitest: 6 files, **23 passed**
- Passcode unlock / reject; no Re-evaluar on public path; unavailable without inventing scores
- Playwright: N/A (not wired)
- `web:typecheck`: PASS (exit 0)

## Quality-gate regression (`EvaluationRun` shape)

| Field | Value |
| --- | --- |
| suiteName | `evaluation-quality-gate` |
| datasetVersion (composite) | `runtime-demo:2026-09-05.5\|knowledge:2026-09-05.1\|voice:2026-09-05.1\|runtime-multi-agent:2026-09-05.2\|wom-customer-service:2026-09-06.2` |
| promptVersionId | `runtime-demo@2` |
| model | fake / fixtures (no paid LLM) |
| gate | `manual` |
| status | **passed** |
| scores | 46 passed / 0 failed |
| run id | `2ca99ba1-9557-46c6-8ac7-f155087eecbd` |

Threshold: required cases in `eval/gate/baseline.json` must pass — observed `status: "passed"` from `npm run test:eval-gate`.

Session call evaluation remains **separate** from this suite (deterministic per-call scorer); proven by unit/contract tests.

## Public deploy / live E2E

Still blocked without Render/Vercel/Vapi credentials (`2026-09-06-public-deploy.md`, `2026-09-06-public-e2e.md`). Does **not** fail quality `/verify`. Tasks 5.3–5.6 / 7.10 remain open for HU AC-06.

## Adversarial / security

Quality PASS ≠ security PASS. Remediations applied and covered by contract/UI tests; **independent** `/adversarial-review` in a new session is still required before archive.

## Verdict

**PASS** for `/verify` on change types `code` | `api` | `ui`.

Blocking issues for quality: **none**.

Follow-ups before archive / HU complete: live public deploy (if claiming AC-06) + independent `/adversarial-review`.
