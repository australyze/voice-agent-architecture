# Tasks: vapi-voice-interaction-adapter

Change types: **code**, **api**, **voice**.

Not in this change: tools, agent, RAG, UI. Omit those gates (see section 10).

Reports: `openspec/changes/vapi-voice-interaction-adapter/reports/`.

## 0. Setup: Create Feature Branch (MANDATORY - FIRST STEP)

- [x] 0.1 Create and switch to branch `feature/vapi-voice-interaction-adapter` from the default branch and verify with `git branch --show-current`

## 1. Optional voice configuration (TDD)

- [x] 1.1 Write failing tests that the process still loads when voice settings are omitted and that present-but-invalid voice settings fail closed without echoing secrets
- [x] 1.2 Implement optional voice config (shared secret, optional provider credential and base URL, handling timeout with documented default, default locale `es`) and verify those tests pass
- [x] 1.3 Add placeholder-only voice keys to `.env.example` and verify no real credentials are present

## 2. Internal voice contract and runtime use case (TDD)

- [x] 2.1 Write failing tests for `VoiceTurn` / `VoiceReply` / `VoiceError` (valid turn, deterministic placeholder for locale `es`, no LLM port call, no Session table write)
- [x] 2.2 Implement domain contracts and `handleVoiceTurn` with bounded timeout and stable error codes and verify those tests pass
- [x] 2.3 Write a failing test that the use case is invocable in-process without a voice-vendor import or network call and verify it passes

## 3. Correlation logging (TDD)

- [x] 3.1 Write failing tests that a handled turn logs available `sessionId`, `requestId`, `interactionId`, `eventType`, `processingTimeMs`, and status, and that secrets and raw bodies are omitted
- [x] 3.2 Extend the logger event shape and verify success and failure voice operations emit correlatable secret-safe logs

## 4. Voice channel adapter (TDD)

- [x] 4.1 Write failing tests for inbound mapping: valid simulated payload → `VoiceTurn`; invalid payload; missing auth; unsupported event; unconfigured integration
- [x] 4.2 Implement `src/adapters/voice/` (authenticate with constant-time secret compare, validate, map in/out, no business rules) and verify those tests pass
- [x] 4.3 Write a failing HTTP integration test of simulated request → adapter → runtime → mapped placeholder reply without a live vendor and verify it passes
- [x] 4.4 Confirm `package.json` still has no Vapi SDK as a core dependency (HTTP adapter only) and verify `src/domain` and `src/application` stay free of vendor imports via the architecture test

## 5. Health diagnostic (TDD)

- [x] 5.1 Write failing tests for `GET /health/voice` statuses `not_configured`, `configured`, and `error`, and that omitted voice settings do not fail `/health/ready`
- [x] 5.2 Implement the diagnostic use case and route and verify live/ready remain unchanged in behavior

## 6. HTTP wiring and project OpenAPI

- [x] 6.1 Wire `POST /adapters/voice/inbound` and `GET /health/voice` in the HTTP adapter with canonical error envelope on failures and verify contract tests for 401/400/config/success paths
- [x] 6.2 Update the project OpenAPI fragment with the new paths and verify it matches implemented routes
- [x] 6.3 Verify default listen host remains loopback and inbound auth is required when voice is configured

## 7. Voice fixtures (create-evals)

- [x] 7.1 Add deterministic voice fixtures under `eval/voice/` (or the change `eval/` folder): supported turn → placeholder; invalid payload; unsupported event; unauthenticated request
- [x] 7.2 Record suite name `vapi-voice-interaction-adapter-voice` and pass criteria (schema/status/error code, not live audio) in a fixture README

## 8. Review and update tests and eval fixtures (MANDATORY)

- [x] 8.1 Review unit, architecture, contract, and integration tests against every scenario in `specs/*/spec.md` and add any missing case
- [x] 8.2 Confirm voice fixtures cover the inbound path and do not require a paid call; skip agent/prompt/RAG datasets — those surfaces are not in this change

## 9. Run verification gates (MANDATORY - AGENT MUST EXECUTE)

- [x] 9.1 Unit tests + database state (MANDATORY - AGENT MUST EXECUTE): start Compose, run the suite without paid APIs, ping persistence through the port, confirm no new domain-row mutations, write `openspec/changes/vapi-voice-interaction-adapter/reports/YYYY-MM-DD-unit-test-and-db-verification.md`
- [x] 9.2 Contract tests (MANDATORY - AGENT MUST EXECUTE): exercise `GET /health/live`, `GET /health/ready`, `GET /health/voice`, and `POST /adapters/voice/inbound` (valid simulator, invalid, unauthenticated, unconfigured), assert status codes and the error envelope, write `openspec/changes/vapi-voice-interaction-adapter/reports/YYYY-MM-DD-contract-tests.md`
- [x] 9.3 Skip tool-calling tests — no product tools in this change
- [x] 9.4 Skip agent/prompt evaluation — no generative path
- [x] 9.5 Skip RAG evaluation — no retrieval implementation
- [x] 9.6 Voice conversation evaluation (MANDATORY - AGENT MUST EXECUTE): run deterministic fixtures from section 7 (supported turn, invalid, unsupported, unauthenticated); do not require live telephony; skip barge-in/confirmation/silence cases — those policies are out of scope; write `openspec/changes/vapi-voice-interaction-adapter/reports/YYYY-MM-DD-evaluation.md`
- [x] 9.7 Skip UI E2E — no frontend
- [x] 9.8 Observability smoke (MANDATORY - AGENT MUST EXECUTE): assert a successful simulator turn emits correlatable secret-safe log fields and record the assertion in the evaluation or unit report
- [x] 9.9 Inbound abuse cases (MANDATORY - AGENT MUST EXECUTE): extra fields rejected or ignored per schema, missing auth, oversized/malformed JSON; skip tool-expansion adversarial suite — no new tools; independent `/adversarial-review` remains after `/verify` before archive

## 10. Update technical documentation (MANDATORY)

- [x] 10.1 Document required vs optional env vars, how to start the app, how to expose the inbound endpoint locally if needed, how to point an optional Vapi smoke at it, how to run the simulator test, how to read logs, and common errors — verify a reader can follow without implicit steps
- [x] 10.2 Update `docs/architecture.md` to state `Vapi = interaction adapter`, `Agent Runtime = execution layer`, `Domain = provider independent`, media vs business identity, and that `/ingress/interaction` is not the Vapi URL
- [x] 10.3 Add a project adapter note for vendor-native inbound fields (not in domain specs) and confirm `lidr-specboot/docs/` needs no methodology rewrite

## 11. Adversarial-review remediations

- [x] 11.1 Write a failing test that a successful `handleVoiceTurn` does not emit `unhandledRejection` after the timeout budget and verify it fails against an uncleared `Promise.race` timer
- [x] 11.2 Cancel the handling timeout when the turn completes or fails and verify that test passes
- [x] 11.3 Write failing tests that overlong `inputText` / correlation fields and a non-UUID `sessionId` are rejected before the runtime, and that an invalid session id is not logged
- [x] 11.4 Enforce documented max lengths and inbound body limit (16 KiB) and verify those tests pass
- [x] 11.5 Write a failing contract test for an oversized inbound body and verify it returns a typed rejection without leaking the secret

## 12. Review remediations and re-run gates (MANDATORY)

- [x] 12.1 Review unit and contract tests against the new timeout-cancel and bounds scenarios
- [x] 12.2 Unit tests + database state (MANDATORY - AGENT MUST EXECUTE): run the suite, confirm persistence ping and no new tables, write `openspec/changes/vapi-voice-interaction-adapter/reports/YYYY-MM-DD-unit-test-and-db-verification.md`
- [x] 12.3 Contract tests (MANDATORY - AGENT MUST EXECUTE): include oversized inbound and record `openspec/changes/vapi-voice-interaction-adapter/reports/YYYY-MM-DD-contract-tests.md`
- [x] 12.4 Skip tool, agent, RAG, and UI gates — unchanged non-goals
- [x] 12.5 Voice fixtures still pass without live telephony; note bounds cases in the evaluation report
- [x] 12.6 Update adapter note with field maxima and body limit
