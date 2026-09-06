# Tasks: evaluation-public-demo

Change types: **code**, **api**, **ui**.

Not in this change: **tools** (no schema/executor/allowlist change), **agent** (no prompt or policy change), **rag**, **voice** as media/turn-taking (Server URL + inbound already exist; no barge-in/STT change). Omit those generative eval gates (see section 8).

Reports: `openspec/changes/evaluation-public-demo/reports/`.

## 0. Setup: Create Feature Branch (MANDATORY - FIRST STEP)

- [x] 0.1 Create and switch to branch `feature/evaluation-public-demo` from the default branch and verify with `git branch --show-current`

## 1. Session call-evaluation model and scorer (TDD)

- [x] 1.1 Write failing unit tests for the session call-evaluation value object (four dimension ids, verdicts `met`|`partial`|`unmet`, overall status, evidence refs, scorer version, evaluatedAt) and verify they fail against `SessionReport.evaluation: null`
- [x] 1.2 Implement the domain/application types (vendor-free; distinct from suite `EvaluationRun`) and verify those tests pass
- [x] 1.3 Write failing scorer tests for: successful tool + grounded reply → dimensions met; no tool calls → no fabricated evidence; failed/denied/timed_out tool → not met; `failed` session status scored without throw; idempotent same-input result; and verify they pass after implementing the pure scorer
- [x] 1.4 Write failing grounding/policy tests (token overlap with tool result; lax Spanish/policy; secret-shaped substring flagged) and verify they pass without network or LLM calls
- [x] 1.5 Add an architecture assertion that the scorer/application path does not import Vapi, Supabase SDK, or evaluation-vendor packages and verify it passes

## 2. Persist evaluation on terminal session (TDD)

- [x] 2.1 Add a SQL migration that adds nullable `evaluation` jsonb (and nested or companion evaluated-at / scorer-version as designed) on `sessions`, keep RLS unchanged for anonymous deny, and verify the migration file is in `supabase/migrations/`
- [x] 2.2 Write failing persistence tests that save/load evaluation through `PersistencePort` on memory adapter and verify they fail, then implement and verify they pass
- [x] 2.3 Wire score-and-persist on transition to terminal `businessStatus` (`completed`|`failed`) without inventing transcript/tool rows, and verify unit tests cover idempotent re-persist
- [x] 2.4 Extend postgres/supabase adapters for the evaluation field; keep hosted tests opt-in (skip without credentials) and verify the default suite stays green without hosted env

## 3. Session read API: evaluation + recompute + demo token (TDD)

- [x] 3.1 Write failing contract tests that terminal `GET /sessions/:sessionId` returns non-null `evaluation` with four dimensions and evidence refs, and that `?recompute=true` returns a recomputed attributable result, and verify they fail
- [x] 3.2 Implement default persisted read + optional recompute (update store) and verify those tests pass
- [x] 3.3 Write failing auth tests that `DEMO_PUBLIC_TOKEN` (documented header) authorizes report GET, wrong/missing credentials still 401, and operator secret still works; implement and verify
- [x] 3.4 Update project OpenAPI fragment / health OpenAPI notes for evaluation shape, recompute query, and demo token auth; verify paths stay without `/api` prefix
- [x] 3.5 Confirm `POST /evaluations/runs` remains unimplemented (existing test) and verify it still passes

## 4. Evaluation view in web demo (TDD)

- [x] 4.1 Write failing frontend tests that completed state renders evaluation dimensions (English ids + Spanish subtitles/verdicts) when the report includes `evaluation`, and shows unavailable without inventing scores on fetch failure
- [x] 4.2 Implement i18n-lite labels + CallSummary/report UI within existing `web/` + shadcn/ui / WOM identity, and verify tests pass
- [x] 4.3 Add passcode entry wired to `VITE_` demo read token (or documented equivalent), send it on report fetch, and verify tests cover missing passcode → no forged evaluation
- [x] 4.4 Optional “Re-evaluar” requests `recompute=true` when authenticated and verify a component test asserts the query is used
- [x] 4.5 Extend secret-hygiene tests so `web/.env.example` lists only public client vars (including demo token placeholder) and never service-role / DB URL / private Vapi key

## 5. Public deployment configuration

- [x] 5.1 Document and add minimal deploy config as needed (Vercel for `web/`, Render Web Service for Node backend; optional `render.yaml`) and verify README points to the hosts without embedding secrets
- [x] 5.2 Update root and `web/` `.env.example` with `DEMO_PUBLIC_TOKEN` and any deploy-related **names** only; verify no secret values are committed
- [ ] 5.3 Deploy backend to Render with Supabase Cloud env, apply migrations, and verify `GET /health/live` (and ready when configured) over HTTPS
- [ ] 5.4 Deploy frontend to Vercel with public env pointing at Render and verify the public URL loads the demo shell
- [ ] 5.5 Manually update the Vapi assistant Server URL to the Render inbound HTTPS URL (document steps; optional scoped script only — never CI) and verify a new call creates a hosted SessionReport
- [ ] 5.6 Record deployed URLs (non-secret) and verification outcome in `openspec/changes/evaluation-public-demo/reports/YYYY-MM-DD-public-deploy.md`

## 6. Review and update tests and eval fixtures (MANDATORY)

- [x] 6.1 Review unit, contract, persistence, and UI tests against every scenario in `specs/*/spec.md` and add any missing case; verify coverage includes no-tools, failed tools, error session, evidence non-fabrication, recompute, demo token, and Spanish labels
- [x] 6.2 Skip new agent/prompt/tool/RAG eval fixture authoring — no generative path change; existing `eval/wom-customer-service` and quality gate remain regression-only (`create-evals` does not apply for new suites)

## 7. Run verification gates (MANDATORY - AGENT MUST EXECUTE)

- [x] 7.1 Unit tests + database state (MANDATORY - AGENT MUST EXECUTE): run targeted scorer/persistence tests then the full default suite without paid APIs; verify evaluation column round-trip on memory (and SQL if used); write `openspec/changes/evaluation-public-demo/reports/YYYY-MM-DD-unit-test-and-db-verification.md`
- [x] 7.2 Contract tests (MANDATORY - AGENT MUST EXECUTE): exercise session detail with evaluation, recompute, demo token vs 401, and confirm evaluations-runs still unimplemented; record in `reports/YYYY-MM-DD-contract-tests.md`
- [x] 7.3 Skip tool-calling tests — no tool schema or executor change
- [x] 7.4 Skip agent/prompt evaluation — no generative path change; run `npm run test:eval-gate` only as regression and note PASS/FAIL in the unit or evaluation regression note
- [x] 7.5 Skip RAG evaluation — no retrieval change
- [x] 7.6 Skip voice conversation evaluation — no barge-in, confirmation, or spoken-UX change
- [x] 7.7 UI component tests (MANDATORY - AGENT MUST EXECUTE): run `web` Vitest for evaluation rendering, passcode, unavailable states; skip Playwright unless already wired — record in `reports/YYYY-MM-DD-ui-and-typecheck.md`
- [x] 7.8 Observability / attributability smoke (MANDATORY - AGENT MUST EXECUTE): assert persisted evaluation includes scorer version + evaluatedAt and evidence ids resolve to persisted tool/turn rows on a fixture session
- [x] 7.9 Typecheck (MANDATORY - AGENT MUST EXECUTE): run runtime and web typecheck and record results in the UI/typecheck report
- [ ] 7.10 Deployed end-to-end verification (MANDATORY - AGENT MUST EXECUTE when credentials/hosts available): public URL → voice scenario → hang-up → SessionReport with evaluation visible; write `reports/YYYY-MM-DD-public-e2e.md` (if hosts unavailable, document blocker and do not mark HU complete)
- [x] 7.11 Secret hygiene (MANDATORY - AGENT MUST EXECUTE): confirm no secrets in git, logs samples, or frontend bundle patterns via existing hygiene tests; record outcome
- [x] 7.12 Schedule independent `/adversarial-review` before archive (public token scope, deploy leakage, evaluation evidence integrity) — do not self-approve as security review in the same apply pass

## 8. Update technical documentation (MANDATORY)

- [x] 8.1 Document evaluation design (dimensions, evidence mapping, persist vs recompute, distinction from quality gate) in implementing-repo docs (e.g. `docs/evaluation-call.md` or extend `docs/persistence.md`) — English technical prose
- [x] 8.2 Document public deployment (Vercel, Render, Supabase Cloud, env var names, Vapi Server URL manual step, cold-start warm-up) and interview demo procedure step-by-step
- [x] 8.3 Update README and adapter docs that previously deferred HU #012; remove “evaluation: null forever” language
- [x] 8.4 Confirm `lidr-specboot/docs/` methodology is unchanged and note that confirmation in the implementing docs or change report
- [x] 8.5 Produce the HU expected final report sections (implementation summary, evaluation design, deployment without secrets, files changed, tests, limitations, interview procedure) in `reports/YYYY-MM-DD-final-summary.md` after gates pass

## 9. Adversarial remediations (post `/adversarial-review` FAIL)

- [x] 9.1 Blocker: remove docs/`VITE_*` guidance that collapses inbound/operator write secrets into the browser; passcode-only public interview path; reject config when `DEMO_PUBLIC_TOKEN` equals inbound/operator
- [x] 9.2 Major: make recompute and evaluation writes operator-only; public token read-only (no lazy backfill); rate-limit session GETs; negative contract tests
- [x] 9.3 Major: require `externalChannelId` for public-token list; stop baking public token into Vite; DemoApp passcode unlock tests
- [x] 9.4 Sync delta specs/design/OpenAPI/docs/README with the privilege split; write `reports/YYYY-MM-DD-adversarial-remediation.md`
