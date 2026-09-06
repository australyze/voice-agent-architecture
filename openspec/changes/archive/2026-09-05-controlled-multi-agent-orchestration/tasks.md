# Tasks: controlled-multi-agent-orchestration

Change types: **code**, **api**, **agent**.

Not in this change: **tools** (no schema or executor change; specialists have empty allowlists), **rag** (specialists do not retrieve; `eval/knowledge` is regression only), **voice** (no media or turn-taking change; inbound stays on `runtime-demo`; `eval/voice` is regression only), **ui**.

Reports: `openspec/changes/controlled-multi-agent-orchestration/reports/`.

## 0. Setup: Create Feature Branch (MANDATORY - FIRST STEP)

- [x] 0.1 Create and switch to branch `feature/controlled-multi-agent-orchestration` from the default branch and verify with `git branch --show-current`

## 1. Domain contract (TDD)

- [x] 1.1 Write a failing test that closed intents are only `normalize` and `classify`, that catalog identities are `runtime-orchestrator`, `demo-normalize`, and `demo-classify`, and that specialists declare empty allowlists and `maxToolHops` of `0`; add the types/policy and verify the test passes
- [x] 1.2 Write a failing test that orchestration errors include `unroutable`, `budget_exceeded`, and `specialist_failed` plus shared `invalid_output` / `llm_timeout` / `llm_provider` with safe messages and no secrets; implement the error set (separate from `AgentTurnResult`) and verify the test passes
- [x] 1.3 Write a failing test that a typed handoff event carries `fromAgentId` `runtime-orchestrator`, `toAgentId` of one specialist, `reason` `routed_intent`, intent, untrusted payload fields, and correlation ids; add the event shape and verify the test passes

## 2. Deterministic routing and limits (TDD)

- [x] 2.1 Write failing table tests that `normalize` selects only `demo-normalize`, `classify` selects only `demo-classify`, and missing or unknown intent is `unroutable` with zero model calls; implement the router and verify those tests pass
- [x] 2.2 Write a failing test that a second specialist invocation on the same request is `budget_exceeded` and does not call the additional specialist; implement `maxSpecialistInvocations = 1` / `maxSteps = 4` and verify the test passes

## 3. Orchestrated-turn use case (TDD)

- [x] 3.1 Write failing tests that a valid normalize request records states `receiving` → `routing` → `awaiting_specialist` → `completed` with actor `runtime`, owner `runtime-orchestrator`, and schema-valid `replyText` plus `normalizedText`; implement the use case with a fake `LlmPort` and verify the tests pass without `ToolPort` or `RetrievalPort`
- [x] 3.2 Write the equivalent failing classify happy-path test (`replyText` plus `label`, only `demo-classify` invoked) and verify it passes
- [x] 3.3 Write a failing test that the specialist model messages include the orchestrator packet outside the system role and that system content equals the versioned prompt bytes; implement packing and verify the test passes
- [x] 3.4 Write failing tests that invalid specialist output after one retry is `invalid_output`, timeout is `llm_timeout`, provider failure is `llm_provider`, and none fabricate success fields; implement fail-closed mapping and verify the tests pass
- [x] 3.5 Write a failing test that jailbreak-shaped user text or packet does not execute a tool, does not invoke a second specialist, and does not change the route; verify `ToolPort` is unused and the test passes
- [x] 3.6 Write a failing test that `handleAgentTurn` / voice inbound still owns `runtime-demo` only and does not call the orchestrated-turn use case; verify existing agent-turn tests still pass

## 4. Versioned specialist prompts (TDD)

- [x] 4.1 Add `prompts/demo-normalize/v1.md` and `prompts/demo-classify/v1.md` with loaders that record `promptId`, version `1`, and content hash; write failing loader tests and verify they pass
- [x] 4.2 Write a failing test that a completed or failed specialist call records `promptId` and version on the trace/log; implement the record and verify the test passes

## 5. Demo HTTP and OpenAPI (TDD)

- [x] 5.1 Write failing HTTP tests that `POST /demo/orchestrate` with valid `normalize` / `classify` bodies returns the success DTO (`sessionId`, `intent`, `specialistId`, `replyText`, job field) and that the adapter does not import `LlmPort`; wire the route to the use case and verify the tests pass
- [x] 5.2 Write failing tests that missing/unknown intent returns the canonical error envelope with `unroutable`, and that `POST /sessions` and `POST /sessions/{sessionId}/turns` remain unimplemented; verify those tests pass
- [x] 5.3 Document `POST /demo/orchestrate` in the project OpenAPI (adjacent to health) using the canonical error schema and verify `src/openapi-health.test.ts` (or the equivalent contract snapshot test) is updated and passes

## 6. Observability (TDD)

- [x] 6.1 Write a failing test that a successful orchestrate run emits one `traceId` across `http`, orchestration `workflow`, `orchestration.route`, `orchestration.handoff`, and specialist `llm`; implement spans and verify the test passes
- [x] 6.2 Write a failing test that `unroutable` still shares `traceId` on HTTP, orchestration, and route records and does not require a specialist `llm` span; verify the test passes
- [x] 6.3 Write a failing test that default emit still omits raw user text and secrets on the new spans; verify redaction tests pass

## 7. Eval suite and quality gate (create-evals)

- [x] 7.1 Add `eval/runtime-multi-agent/` (`cases.json`, README) with suite name `runtime-multi-agent`, `requiresPaidModel: false`, and cases `normalize-happy-path`, `classify-happy-path`, `context-packet-reaches-specialist`, `unroutable-missing-intent`, `unroutable-unknown-intent`, `specialist-invalid-output-fail-closed`, `specialist-timeout-fail-closed`, `specialist-injection-does-not-add-tools`, `second-invocation-denied`; verify a suite runner test executes them with fakes
- [x] 7.2 Extend `REQUIRED_SUITE_KEYS` and default suite execution to include `runtime-multi-agent`; write a failing gate test that skipping the suite fails the run; verify the test passes
- [x] 7.3 Update `eval/gate/baseline.json` with an explicit human-reviewed `suiteVersions` entry and required `runtime-multi-agent/<caseId>` members while keeping existing `runtime-first-agent/*`, retrieval, and voice required members; verify compare tests still fail on a spoof suffix

## 8. Vendor independence (TDD)

- [x] 8.1 Extend architecture/package assertions so domain and application still omit LangGraph, LangChain, official LLM SDKs, and observability vendors; verify `architecture.test.ts` and `package-vendors.test.ts` pass
- [x] 8.2 If any test asserted a single catalog agent identity, scope it to the `runtime-demo` path and verify it still passes alongside the new catalog identities

## 9. Review and update tests and eval fixtures (MANDATORY)

- [x] 9.1 Review unit, HTTP, and eval tests against every scenario in this change’s `specs/*/spec.md` and add any missing routing, packet, limit, failure, or observability case
- [x] 9.2 Confirm eval fixtures contain no real PII or live secrets and do not require a paid model, vector database, or MCP server

## 10. Run verification gates (MANDATORY - AGENT MUST EXECUTE)

- [x] 10.1 Unit tests + database state (MANDATORY - AGENT MUST EXECUTE): run the targeted orchestration/agent/HTTP/eval suite and the required unit suite without paid APIs; ping persistence through the existing port; confirm no new Session/ConversationTurn/Trace tables or domain-row mutations; write `openspec/changes/controlled-multi-agent-orchestration/reports/YYYY-MM-DD-unit-test-and-db-verification.md`
- [x] 10.2 Contract tests (MANDATORY - AGENT MUST EXECUTE): exercise `POST /demo/orchestrate` (success and `unroutable`) plus regression `GET /health/live`, `GET /health/ready`, `GET /health/voice`, and `POST /adapters/voice/inbound` with fakes; assert status codes and the canonical error envelope; confirm session CRUD and evaluation HTTP remain unimplemented; write `openspec/changes/controlled-multi-agent-orchestration/reports/YYYY-MM-DD-contract-tests.md`
- [x] 10.3 Skip tool calling tests as a change-type gate — no tool schema or executor change; injection “no tool executed” is covered in unit and `runtime-multi-agent` eval
- [x] 10.4 Agent / prompt evaluation (MANDATORY - AGENT MUST EXECUTE): run `eval/runtime-multi-agent/` and `eval/runtime-demo/` (regression); record dataset versions, prompt versions (`demo-normalize@1`, `demo-classify@1`, `runtime-demo@2`), model identity (`fake`), and per-case pass/fail; write `openspec/changes/controlled-multi-agent-orchestration/reports/YYYY-MM-DD-evaluation.md`
- [x] 10.5 Skip dedicated RAG evaluation — no retrieval quality or corpus change; `eval/knowledge` runs only as a quality-gate regression member
- [x] 10.6 Skip dedicated voice conversation evaluation — no barge-in, confirmation, silence, or spoken-flow change; `eval/voice` runs only as a quality-gate regression member
- [x] 10.7 Skip UI E2E — no frontend
- [x] 10.8 Observability smoke (MANDATORY - AGENT MUST EXECUTE): assert one orchestrate execution emits reconstructable `http` + orchestration `workflow` + `orchestration.route` + `orchestration.handoff` + specialist `llm` sharing `traceId`, with latency and status, and no secret values or raw utterances; record the assertion in the unit-test or evaluation report
- [x] 10.9 Independent `/adversarial-review` remains after `/verify` before archive (prompt injection, autonomy, packet leakage). Not a substitute for 10.1, 10.2, 10.4, or 10.8

## 11. Update technical documentation (MANDATORY)

- [x] 11.1 Document the orchestrator catalog, closed intent, demo route, limits, error codes, and that voice inbound still uses `runtime-demo`; verify a reader can send one request and interpret the result without implicit steps
- [x] 11.2 Confirm `lidr-specboot/docs/` needs no methodology rewrite and that canonical session HTTP was not implemented

## 12. Adversarial remediations (TDD)

- [x] 12.1 Write a failing test that `maxSteps` already consumed is `budget_exceeded` with zero model calls; implement the step budget and verify the test passes
- [x] 12.2 Write failing tests that oversize specialist fields are `invalid_output`, canary/secret-shaped fields are `sensitive_output`, and an unexpected specialist exception is `specialist_failed`; implement bounds and mapping and verify the tests pass
- [x] 12.3 Write a failing test that packed `input` is the untrusted packet only (system policy stays on the system message); verify the test passes
- [x] 12.4 Write failing HTTP tests: 401 `unauthorized` without `x-demo-orchestrate-secret` when a secret is configured; 413 on a body over 16 KiB; `payload_invalid` for empty `userText`; `session_invalid` for a non-UUID `sessionId`; 503 `orchestration_config` when LLM mode is HTTP and no secret is set; HTTP does not map `consumedInvocations` or `packedContext`. Implement auth, body limit, rate limit, and validation and verify the tests pass
- [x] 12.5 Add eval cases `specialist-oversize-output-fail-closed` and `specialist-canary-output-fail-closed`; bump the suite dataset version and required baseline members; verify the suite runner and gate membership tests pass

## 13. Review and update tests and eval fixtures (MANDATORY)

- [x] 13.1 Review unit, HTTP, and eval tests against the remediated scenarios and add any missing auth, bound, or fail-closed case
- [x] 13.2 Confirm new fixtures contain no real PII or live secrets and do not require a paid model

## 14. Run verification gates (MANDATORY - AGENT MUST EXECUTE)

- [x] 14.1 Unit tests + database state (MANDATORY - AGENT MUST EXECUTE): run the targeted orchestration/HTTP/eval suite and the required unit suite without paid APIs; confirm no new Session/ConversationTurn/Trace tables; write `openspec/changes/controlled-multi-agent-orchestration/reports/YYYY-MM-DD-unit-test-and-db-verification.md`
- [x] 14.2 Contract tests (MANDATORY - AGENT MUST EXECUTE): exercise `POST /demo/orchestrate` success, `unroutable`, 401, 413, and empty `userText`, plus health/voice regression; write `openspec/changes/controlled-multi-agent-orchestration/reports/YYYY-MM-DD-contract-tests.md`
- [x] 14.3 Skip tool calling tests as a change-type gate — no tool schema change
- [x] 14.4 Agent / prompt evaluation (MANDATORY - AGENT MUST EXECUTE): run `eval/runtime-multi-agent/` and `eval/runtime-demo/` (regression); write `openspec/changes/controlled-multi-agent-orchestration/reports/YYYY-MM-DD-evaluation.md`
- [x] 14.5 Skip dedicated RAG evaluation — no retrieval change
- [x] 14.6 Skip dedicated voice conversation evaluation — no voice-flow change
- [x] 14.7 Skip UI E2E — no frontend
- [x] 14.8 Observability smoke (MANDATORY - AGENT MUST EXECUTE): assert one authenticated orchestrate run still shares `traceId` across http + orchestration + specialist llm; record in the unit-test or evaluation report
- [x] 14.9 Independent `/adversarial-review` remains after `/verify` before archive. Not a substitute for 14.1, 14.2, 14.4, or 14.8

## 15. Update technical documentation (MANDATORY)

- [x] 15.1 Document demo secret header, body/`userText` limits, output bounds, and new error codes; verify a reader can authenticate one request without implicit steps
- [x] 15.2 Confirm `lidr-specboot/docs/` needs no methodology rewrite
