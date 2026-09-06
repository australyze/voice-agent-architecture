# Tasks: call-execution-persistence

Change types: **code**, **api**, **voice**, **ui**.

Not in this change: **tools** (no schema/executor/allowlist change), **agent** (no prompt or policy change), **rag**. Omit those eval gates (see section 10).

Reports: `openspec/changes/call-execution-persistence/reports/`.

## 0. Setup: Create Feature Branch (MANDATORY - FIRST STEP)

- [x] 0.1 Create and switch to branch `feature/call-execution-persistence` from the default branch and verify with `git branch --show-current`

## 1. Persistence port and in-memory adapter (TDD)

- [x] 1.1 Write failing tests that `PersistencePort` records a session, turn, tool call, and execution event, retrieves a report, and lists recent sessions, and verify they fail against the current ping-only port
- [x] 1.2 Implement the widened port types (vendor-free) plus an in-memory adapter and verify those tests pass
- [x] 1.3 Write failing idempotency and out-of-order tests (duplicate start/end, end before start, duplicate event key) and verify they pass after the in-memory adapter enforces deterministic keys
- [x] 1.4 Write failing metric tests (duration, turn count, tool-call count, error count) and verify they pass
- [x] 1.5 Add an architecture test that domain and application do not import `@supabase` or SQL vendor types and verify it passes

## 2. Schema and hosted adapter

- [x] 2.1 Add reproducible SQL migrations for sessions, conversation_turns, tool_calls, and execution_events with FKs, unique `external_channel_id` when present, idempotency uniqueness, justified indexes, and RLS that denies anonymous reads, and verify the files live in the repository
- [x] 2.2 Implement the Supabase adapter behind the same port (SDK only under `src/adapters/persistence`) and verify unit tests still use in-memory
- [x] 2.3 Add opt-in hosted adapter tests that skip when `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` is absent, and verify the default suite stays green without those variables
- [x] 2.4 Extend config and `.env.example` with backend-only `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` placeholders and verify frontend `.env.example` does not list them
- [x] 2.5 Wire composition so one process uses one history adapter (in-memory in tests; hosted when configured) and verify default start still becomes live without hosted credentials

## 3. Voice ingest (TDD)

- [x] 3.1 Write failing inbound tests that authenticated `call_started` and `call_ended` are accepted, do not invoke the agent-turn use case, and persist session lifecycle, and verify they fail on the transcript-only mapper
- [x] 3.2 Extend the inbound mapper for provider-independent lifecycle kinds with existing auth/skew/size rules and verify those tests pass without inventing Vapi payload types in domain
- [x] 3.3 Write failing tests that a `transcript` turn upserts the session, stores user and assistant turns, and shares `traceId` / `sessionId` / `externalChannelId`, and verify they pass after `handleVoiceTurn` persists
- [x] 3.4 Write a failing test that persist failure after a successful reply logs `PERSISTENCE_UNAVAILABLE` (or equivalent) and still returns the spoken reply, and verify it passes
- [x] 3.5 Document inspected Vapi server-event mapping (or the explicit “unmapped” gap) in `docs/adapters/vapi-inbound.md` and verify domain still has no vendor field names

## 4. Agent-turn persistence (TDD)

- [x] 4.1 Write failing tests that LLM and tool spans already emitted on the observability port also produce execution events (and ToolCall rows for tools) through the persistence port with the same `traceId`, and verify `JsonLogger` still emits
- [x] 4.2 Persist from the agent-turn path without importing Supabase and verify secret-safe bounded args/results and existing error classes are stored
- [x] 4.3 Confirm `LoggingObservability` remains the default emit adapter and verify no new observability vendor package is added

## 5. Session report HTTP (TDD)

- [x] 5.1 Write failing contract tests for `GET /sessions` (lightweight list with counts) and `GET /sessions/:sessionId` (report with transcript, toolCalls, trace, metrics, `evaluation: null`) using the canonical error envelope, and verify they fail
- [x] 5.2 Implement the read-only routes (no `/api` prefix) and verify 200, 400 malformed id, and 404 unknown id
- [x] 5.3 Add or update the project OpenAPI fragment for these routes referencing `lidr-specboot/docs/api-spec.yml` session resources and verify it matches the implemented paths
- [x] 5.4 Write a failing test that responses omit credentials and raw vendor payloads and verify it passes

## 6. Thin demo UI (TDD)

- [x] 6.1 Write failing frontend tests that completed state fetches a session report when `VITE_PUBLIC_API_BASE_URL` is set and shows unavailable when missing or failed, and verify they fail against the HU #011 placeholder
- [x] 6.2 Implement a backend HTTP client (no Supabase) and replace the placeholder with loaded vs unavailable copy, and verify live transcript still comes from the media-client double
- [x] 6.3 Add or extend a hygiene test that `web/` has no `@supabase` dependency and no service-role identifier in frontend env examples, and verify it passes

## 7. Review and update tests and eval fixtures (MANDATORY)

- [x] 7.1 Review unit, architecture, inbound, and contract tests against every scenario in `specs/*/spec.md` and add any missing case; verify coverage includes persist, idempotency, correlation, metrics, list/detail, security, and fail-open voice
- [x] 7.2 Skip new eval fixture authoring — no agent, prompt, tool, or RAG behavior change; existing WOM eval fixtures remain regression-only (`create-evals` does not apply)

## 8. Run verification gates (MANDATORY - AGENT MUST EXECUTE)

- [x] 8.1 Unit tests + database state (MANDATORY - AGENT MUST EXECUTE): run the default suite without hosted credentials; if a local SQL store is used, capture pre/post indicators and restore; write `openspec/changes/call-execution-persistence/reports/YYYY-MM-DD-unit-test-and-db-verification.md`
- [x] 8.2 Contract tests (MANDATORY - AGENT MUST EXECUTE): exercise `GET /sessions` and `GET /sessions/:sessionId` (happy, 400, 404) plus inbound lifecycle vs transcript; assert the error envelope; record commands and responses in the reports folder
- [x] 8.3 Skip tool-calling tests — no tool schema or executor change
- [x] 8.4 Skip agent/prompt evaluation — no generative path change; run existing `test:eval-gate` only as regression if the default suite does not already include it
- [x] 8.5 Skip RAG evaluation — no retrieval change
- [x] 8.6 Skip voice conversation evaluation — no barge-in, confirmation, or spoken-UX change; inbound persist is covered by deterministic tests in 8.1–8.2
- [x] 8.7 UI component tests (MANDATORY - AGENT MUST EXECUTE): run the existing web Vitest suite for completed-report loaded/unavailable; skip Playwright unless the repo already has an E2E runner wired — record results in the reports folder
- [x] 8.8 Observability smoke (MANDATORY - AGENT MUST EXECUTE): assert a persisted session still has matching `traceId` on log spans and stored events
- [x] 8.9 Typecheck (MANDATORY - AGENT MUST EXECUTE): run the project typecheck for runtime and web and record the result
- [x] 8.10 Skip adversarial tool-expansion tests in this apply pass — no new tool trust boundary; schedule independent `/adversarial-review` before archive (transcript PII, public table read, secret leakage)

## 9. Update technical documentation (MANDATORY)

- [x] 9.1 Document Supabase project setup, how to apply migrations, backend env vars, Compose vs hosted, RLS/security model, demo retention, and “live transcript ≠ database” in implementing-repo docs (not a fork of `lidr-specboot/docs/`)
- [x] 9.2 Update `.env.example` files and README start/test steps and verify no real credentials are committed
- [x] 9.3 Explicitly document work deferred to HU #012 (evaluation UI, scores, visual trace, call-history page) and verify the session report `evaluation` field is described as reserved/null
- [x] 9.4 Confirm `lidr-specboot/docs/` methodology is unchanged and note that confirmation in the implementing docs or change report

## 10. Adversarial remediations (read auth + session identity)

Folded from `/adversarial-review` recommended next steps. Change types remain `code`, `api`, `ui` (no new tools/agent/RAG/voice-conversation).

- [x] 10.1 Update OpenSpec (design D8–D10, session-persistence, wom-voice-demo, proposal) so history GETs require the demo-operator secret and the UI must not use `GET /sessions?limit=1` as identity
- [x] 10.2 Write failing contract tests that unauthenticated `GET /sessions` and `GET /sessions/{sessionId}` return 401 with the error envelope and no transcript, authenticated happy/400/404 still work, and list can filter by `externalChannelId`
- [x] 10.3 Implement route authentication (reuse `x-demo-orchestrate-secret` / `DEMO_ORCHESTRATE_SECRET` else `VOICE_INBOUND_SECRET`; missing server secret is 503) plus `externalChannelId` list filter, and verify those tests pass
- [x] 10.4 Write failing frontend tests that completed fetch is skipped without a known `sessionId` or `externalChannelId`, does not call `limit=1`, sends the demo-operator header when configured, and shows unavailable on 401; then implement and verify
- [x] 10.5 Update project OpenAPI for 401/503 on session reads and document `VITE_DEMO_ORCHESTRATE_SECRET` as a demo-operator read secret (never service-role)
- [x] 10.6 Review tests against the updated scenarios; skip new eval fixtures (no agent/prompt/tool/RAG change)
- [x] 10.7 Run unit + contract + UI Vitest gates (MANDATORY - AGENT MUST EXECUTE); skip Playwright, tool, agent, RAG, and voice-conversation eval with the same reasons as section 8; write `openspec/changes/call-execution-persistence/reports/2026-09-06-session-read-auth.md`
- [x] 10.8 Update implementing docs (`docs/architecture.md`, `docs/persistence.md`, `docs/adapters/vapi-web-demo.md`) so loopback/RLS are not described as substitutes for route authZ
