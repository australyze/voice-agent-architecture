# Tasks: runtime-observability

Change types: **code**.

Not in this change: **api** (no new or changed public HTTP; health and inbound stay regression-only), **tools** (no schema or executor change), **agent** (no prompt or policy change), **rag** (no retrieval quality change), **voice** (no media or turn-taking change), **ui**.

Reports: `openspec/changes/runtime-observability/reports/`.

## 0. Setup: Create Feature Branch (MANDATORY - FIRST STEP)

- [x] 0.1 Create and switch to branch `feature/runtime-observability` from the default branch and verify with `git branch --show-current`

## 1. Port and logger contract (TDD)

- [x] 1.1 Write a failing type/unit test that an observability span may carry `traceId`, `spanId`, `parentSpanId`, session/request/interaction ids, `latencyMs`, `tokenInput`, `tokenOutput`, `cost`, and `retryCount`; widen `TraceSpan` (and `LogEvent` metadata fields the default adapter will write) and verify the test compiles and passes
- [x] 1.2 Write a failing test that optional structured-completion usage (`tokenInput`, `tokenOutput`, optional `cost`) can be returned by the LLM port and is omitted when absent; add the optional usage shape without inventing numbers and verify those tests pass
- [x] 1.3 Write failing tests that `JsonLogger` writes the new metadata fields as structured JSON and redacts secret shapes in string fields; implement the logger fields and verify `src/adapters/logging/json-logger.test.ts` and `src/domain/redact.test.ts` still pass

## 2. Default adapter emit (TDD)

- [x] 2.1 Write a failing test that `LoggingObservability` emits reconstructable metadata (`traceId`, kind, name, status, latency, error class when present, correlation ids, usage when present) and does not write `argumentsRedacted`, `resultBounded`, raw user text, or secrets; implement the adapter and verify the test passes
- [x] 2.2 Write a failing test that the default adapter still has no in-process span list and does not retain `normalizedText`; verify `logging-observability` tests pass
- [x] 2.3 Keep `MemoryObservability` as the test collector of full redacted spans and verify existing `handle-agent-turn` collector tests still compile against the widened span

## 3. Correlate voice and agent path (TDD)

- [x] 3.1 Write failing tests that `handleVoiceTurn` assigns a UUID `traceId` on success and failure (including session-invalid without logging the raw invalid session id), writes that `traceId` on the `voice.turn` log, and emits an `http` span with the same id plus available request/interaction/session ids; wire an observability port into the voice-turn options and verify `handle-voice-turn` tests pass
- [x] 3.2 Write failing tests that `handleAgentTurn` emits a `workflow` parent span and that `retrieval`, `llm`, and `tool` children share `traceId` and set `parentSpanId` to the turn span; copy inbound correlation ids onto those spans; verify `handle-agent-turn` tests pass without paid APIs
- [x] 3.3 Write a failing test that when the model path reports usage, the `llm` span includes those token/cost fields, and when it does not, those fields are omitted; implement the copy and verify the test passes
- [x] 3.4 Wire inbound HTTP so `create-server` passes observability into `handleVoiceTurn` and a successful tool-hop inbound run produces distinguishable `http`, `workflow`, `retrieval`, `llm`, and `tool` records with one `traceId`; verify with a unit test using fakes (no live vendor)

## 4. Vendor independence (TDD)

- [x] 4.1 Write or extend failing architecture/package assertions that domain and application do not import an observability vendor SDK and that manifests still omit Langfuse and equivalent packages; verify `architecture.test.ts` and `package-vendors.test.ts` pass

## 5. Review and update tests and eval fixtures (MANDATORY)

- [x] 5.1 Review unit tests against every scenario in this change’s `specs/*/spec.md` and add any missing correlation, distinguishability, latency/status, usage-omit, or redaction case
- [x] 5.2 Confirm no new eval datasets are required (deterministic-only change) and that existing fixtures were not given real PII or live secrets

## 6. Run verification gates (MANDATORY - AGENT MUST EXECUTE)

- [x] 6.1 Unit tests + database state (MANDATORY - AGENT MUST EXECUTE): run the targeted observability/agent/voice/logger suite and the required unit suite without paid APIs; ping persistence through the existing port; confirm no new Trace/Span tables or domain-row mutations; write `openspec/changes/runtime-observability/reports/YYYY-MM-DD-unit-test-and-db-verification.md`
- [x] 6.2 Skip dedicated HTTP contract tests — no public OpenAPI change; existing health and inbound routes are covered only as regression inside the unit suite if already present
- [x] 6.3 Skip tool calling tests as a change-type gate — no tool schema or executor change
- [x] 6.4 Skip agent / prompt evaluation — no prompt, policy, or model-routing change; do not add `reports/YYYY-MM-DD-evaluation.md` for a new suite
- [x] 6.5 Skip RAG evaluation — no retrieval quality or corpus change
- [x] 6.6 Skip voice conversation evaluation — no barge-in, confirmation, silence, or spoken-flow change
- [x] 6.7 Skip UI E2E — no frontend
- [x] 6.8 Observability smoke (MANDATORY - AGENT MUST EXECUTE): assert one inbound or agent-turn execution emits reconstructable `http` + `workflow` + child kinds sharing `traceId`, with latency and status, and that default emit / collected records contain no secret values or raw utterances; record the assertion in the unit-test report
- [x] 6.9 Independent `/adversarial-review` remains after `/verify` before archive (log exfiltration / secret leakage). Not a substitute for 6.1 or 6.8

## 7. Update technical documentation (MANDATORY)

- [x] 7.1 Document reconstructable log fields (`traceId`, kinds, latency, status, optional usage), that the default adapter omits payloads, that no observability vendor is required, and how an engineer joins a run — verify a reader can follow without implicit steps (README and/or project logging notes)
- [x] 7.2 Confirm `lidr-specboot/docs/` needs no methodology rewrite and that no new trace-query HTTP was implemented

## 8. Adversarial remediations (TDD)

- [x] 8.1 Write a failing test that a successful retrieval span does not contain the caller utterance and uses a bounded `queryHash` instead of `query` text; implement the hash on emit and verify handle-agent-turn tests pass
- [x] 8.2 Write a failing test that composed `JsonLogger` + `LoggingObservability` redacts a secret-shaped `requestId` (`sk-…`) from the JSON line; verify the test passes
- [x] 8.3 Write a failing test that `voice.turn` success and failure logs include ISO `occurredAt` from the turn and still omit raw invalid session ids; implement the field and verify handle-voice-turn tests pass
- [x] 8.4 Document in README that engineers join runs by `traceId` (caller `requestId` is untrusted) and that a collecting vendor adapter needs its own review

## 9. Remediation verification (MANDATORY - AGENT MUST EXECUTE)

- [x] 9.1 Re-run targeted observability/agent/voice/logger tests and the required unit suite without paid APIs; confirm public schema still has no Trace tables; write `openspec/changes/runtime-observability/reports/2026-09-05-adversarial-remediation.md`
- [x] 9.2 Skip UI/voice-conversation/agent-eval gates — same N/A reasons as section 6; independent `/adversarial-review` in a fresh session remains before archive
