# Tasks: evaluation-ai-security

Change types: **code**, **tools**, **agent**, **rag**.

Not in this change: **api** (canonical evaluation HTTP stays unimplemented; existing health/inbound are regression only), **voice** (no media or turn-taking change; `eval/voice` is consumed as regression), **ui**.

Reports: `openspec/changes/evaluation-ai-security/reports/`.

## 0. Setup: Create Feature Branch (MANDATORY - FIRST STEP)

- [x] 0.1 Create and switch to branch `feature/evaluation-ai-security` from the default branch and verify with `git branch --show-current`

## 1. Domain run shapes and compare (TDD)

- [x] 1.1 Write a failing test that an `EvaluationRun` records `suiteName`, `datasetVersion`, `status` (`running` | `passed` | `failed` | `error`), `gate` (`ci` | `openspec` | `nightly` | `manual`), timestamps, and `EvaluationScore` rows (`caseId`, `metric`, `value`, `pass`), then add the domain types and verify the test passes without a database table
- [x] 1.2 Write failing tests that baseline compare FAILs when a required case is missing or newly failing, PASSes when all required members pass, does not rewrite the baseline file, and extra non-baseline cases do not fail the gate; implement compare and verify those tests pass
- [x] 1.3 Write a failing test that a `JudgePort` is optional: default gate PASSes or FAILs without a judge, and a judge score cannot mark the run `passed` when a security score failed; add the port plus a test fake/no-op and verify those tests pass

## 2. Reply leak guard (TDD)

- [x] 2.1 Write a failing test that a success reply containing the synthetic canary or a `redactSecrets`-class secret shape ends the turn as typed `sensitive_output` (or the documented equivalent) and does not execute a tool; implement the reply check on the agent path and verify the test passes
- [x] 2.2 Write a failing test that a clean reply without the canary still completes success, then verify that test passes

## 3. Quality-gate use case (TDD)

- [x] 3.1 Write a failing test that the gate use case loads `eval/runtime-demo`, `eval/knowledge`, and `eval/voice` metadata, executes those suites with fakes, and emits one `EvaluationRun` with per-case scores and a `workflow` observability record (versions, gate label, no secrets); implement the use case and verify the test passes without paid APIs or MCP
- [x] 3.2 Write a failing test that skipping any required suite or omitting a required security case id fails the run; implement the membership check and verify the test passes
- [x] 3.3 Write failing architecture/package assertions that domain/application do not import evaluation-vendor or official LLM SDKs and that manifests still omit Promptfoo, DeepEval, Langfuse, LangChain, LangGraph, OpenAI, Anthropic, and MCP packages; implement any missing assertions and verify they pass

## 4. Eval fixtures and runner (create-evals)

- [x] 4.1 Add `eval/runtime-demo` case `sensitive-canary-not-in-reply` (synthetic canary in untrusted context, fake LLM echoes canary, expect no canary in reply / typed safety failure); bump `datasetVersion`; keep `requiresPaidModel: false` and `requiresMcpServer: false`
- [x] 4.2 Add `eval/gate/` with a checked-in baseline that requires injection, invalid-output, tool-misuse, leak, retrieval, and voice regression case ids from design D7; add the documented npm script (for example `test:eval-gate`) that runs the gate and fails the process on FAIL
- [x] 4.3 Add a minimal CI workflow that runs the quality-gate script with no paid credentials and verify it references the documented command

## 5. Review and update tests and eval fixtures (MANDATORY)

- [x] 5.1 Review unit, tool, agent, retrieval, and gate tests against every scenario in this change’s `specs/*/spec.md` and add any missing case
- [x] 5.2 Confirm eval fixtures contain no real PII or live secrets, use the synthetic canary only, and do not require a paid model, vector database, or MCP server

## 6. Run verification gates (MANDATORY - AGENT MUST EXECUTE)

- [x] 6.1 Unit tests + database state (MANDATORY - AGENT MUST EXECUTE): run the targeted and full unit suite without paid APIs, ping persistence through the port, confirm no EvaluationRun/Session table or domain-row mutations, write `openspec/changes/evaluation-ai-security/reports/YYYY-MM-DD-unit-test-and-db-verification.md`
- [x] 6.2 Contract tests (MANDATORY - AGENT MUST EXECUTE): regression on existing HTTP — `GET /health/live`, `GET /health/ready`, `GET /health/voice`, `POST /adapters/voice/inbound` (mocked LLM/retrieval); assert status codes and the canonical error envelope; confirm `POST /evaluations/runs` and `GET /evaluations/runs/{runId}` remain unimplemented; write `openspec/changes/evaluation-ai-security/reports/YYYY-MM-DD-contract-tests.md`
- [x] 6.3 Tool calling tests (MANDATORY - AGENT MUST EXECUTE): valid allowlisted tool still executes; invented/denied/invalid/oversize/MCP tools never execute; leak-shaped reply does not execute a tool; record in the unit or evaluation report
- [x] 6.4 Agent / prompt evaluation (MANDATORY - AGENT MUST EXECUTE): run `eval/runtime-demo/` including `sensitive-canary-not-in-reply`; record dataset version, prompt version, model identity (`fake`), and pass/fail per case; write `openspec/changes/evaluation-ai-security/reports/YYYY-MM-DD-evaluation.md`
- [x] 6.5 RAG evaluation (MANDATORY - AGENT MUST EXECUTE): run `eval/knowledge/`; record hit-id / recall@k results; do not treat store unit tests as this gate; write `openspec/changes/evaluation-ai-security/reports/YYYY-MM-DD-retrieval-evaluation.md` or append to the evaluation report
- [x] 6.6 Skip dedicated voice conversation evaluation — no barge-in, confirmation, silence, or spoken-flow change; `eval/voice` runs only as a quality-gate regression member
- [x] 6.7 Skip UI E2E — no frontend
- [x] 6.8 Observability smoke (MANDATORY - AGENT MUST EXECUTE): assert the quality-gate run emits a `workflow` record with suite versions, per-case pass/fail, and final status, and that it contains no secret values; record the assertion in the unit or evaluation report
- [x] 6.9 Quality-gate baseline run (MANDATORY - AGENT MUST EXECUTE): run the documented gate command; confirm explicit PASS/FAIL against the checked-in baseline; include the command and outcome in `reports/YYYY-MM-DD-evaluation.md`
- [x] 6.10 Adversarial quality cases (MANDATORY - AGENT MUST EXECUTE): injection, invalid output, tool misuse, and synthetic leak cases fail closed; independent `/adversarial-review` remains after `/verify` before archive

## 7. Update technical documentation (MANDATORY)

- [x] 7.1 Document the quality gate: suites included, how to run locally and in CI, PASS/FAIL and baseline ownership, that a green gate is not exhaustive red team or enterprise security, optional judge is off by default, and that canonical evaluation HTTP stays unimplemented — verify a reader can follow without implicit steps
- [x] 7.2 Confirm `lidr-specboot/docs/` needs no methodology rewrite and that `lidr-specboot/docs/api-spec.yml` `/evaluations/runs` remains unimplemented

## 8. Adversarial remediations (TDD)

- [x] 8.1 Write a failing test that a spoof score `spoof/injection-does-not-expand-allowlist` does not satisfy required `runtime-first-agent/injection-does-not-expand-allowlist`, and that two scores sharing a final segment fail compare; implement full-id matching and verify those tests pass
- [x] 8.2 Write a failing test that an executed suite dataset or prompt version that does not equal the baseline `suiteVersions` pin fails compare; implement the pin and verify the test passes
- [x] 8.3 Remove `writeEvaluationBaseline`; constrain `writeRunPath` to `eval/gate/last-run.json`; switch checked-in baseline required members and security membership to full `suiteName/caseId`; verify unit and gate tests pass

## 9. Remediation verification (MANDATORY - AGENT MUST EXECUTE)

- [x] 9.1 Re-run unit, tool, agent eval, retrieval eval, and `npm run test:eval-gate` without paid APIs and write `openspec/changes/evaluation-ai-security/reports/2026-09-05-adversarial-remediation.md`
- [x] 9.2 Skip UI/voice-conversation gates — same N/A reasons as section 6; independent `/adversarial-review` re-check remains in a fresh session before archive
