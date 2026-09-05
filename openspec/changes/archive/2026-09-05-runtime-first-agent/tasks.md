# Tasks: runtime-first-agent

Change types: **code**, **tools**, **agent**, **voice**.

Not in this change: **api** (no new routes; inbound voice is a regression surface), **rag**, **ui**.

Reports: `openspec/changes/runtime-first-agent/reports/`.

## 0. Setup: Create Feature Branch (MANDATORY - FIRST STEP)

- [x] 0.1 Create and switch to branch `feature/runtime-first-agent` from the default branch and verify with `git branch --show-current`

## 1. Ports, errors, and prompt artifact (TDD)

- [x] 1.1 Write failing tests that agent error codes include `invalid_output`, `tool_denied`, `tool_failed`, `tool_timeout`, `llm_timeout`, and `llm_provider`, and that adapter-facing messages omit secrets and raw model payloads
- [x] 1.2 Extend domain/application error types and LLM/tool/observability contracts as required by `design.md` D3/D7/D8 and verify those tests pass
- [x] 1.3 Add versioned prompt artifact `prompts/runtime-demo/v1` with `promptId` `runtime-demo`, `version` `1`, and a content hash loader, and verify a unit test fails if the hash does not match the file bytes

## 2. Tool execution (TDD)

- [x] 2.1 Write failing tool tests: valid `demo.normalize_text` → `{ normalizedText: "hello world" }` for input `"  Hello   World "`; extra properties never execute; missing/wrong-type `text` never execute; unknown tool name returns `tool_denied`; timeout maps to `tool_timeout`
- [x] 2.2 Implement the in-process catalog and `ToolPort` executor (`riskClass` `read`, `source` `native`, closed JSON Schema, timeout ≤ 500 ms) and verify those tests pass
- [x] 2.3 Verify no `write` / `irreversible` / `external_comm` tool is registered and that architecture tests still forbid vendor SDKs in domain and application

## 3. Fake LLM and agent-turn use case (TDD)

- [x] 3.1 Write failing tests for `handleAgentTurn`: schema-valid `reply` → structured success with locale; `tool` then `reply` executes `demo.normalize_text` once; invented tool does not execute; invalid structured output does not execute a tool and returns `invalid_output` after at most one retry; LLM delay past budget returns `llm_timeout`; second tool hop is not executed
- [x] 3.2 Implement the in-process fake LLM (scriptable: reply, tool, garbage, delay) and `handleAgentTurn` (prompt packing, hop limit 1, untrusted user/tool blocks) and verify those tests pass without network calls
- [x] 3.3 Write a failing test that two sequential turns with the same session id do not receive prior-turn user text or tool results as memory, and verify it passes

## 4. Observability spans (TDD)

- [x] 4.1 Write failing tests that a successful tool hop emits `llm` and `tool` spans with `promptId`, prompt version, model id, latency, tool name, redacted args, bounded result, and status `ok`
- [x] 4.2 Write a failing test that failed structured-output validation emits an `llm` span with status `error` and a validation-failure outcome
- [x] 4.3 Implement span emission through `ObservabilityPort` (logging or in-memory test collector; no vendor SDK) and verify those tests pass

## 5. Optional LLM configuration and HTTP adapter (TDD)

- [x] 5.1 Write failing tests that the process still starts when LLM settings are omitted (fake adapter) and that present-but-invalid LLM settings fail closed without echoing secrets
- [x] 5.2 Implement optional LLM config and compose the fake by default; add an HTTP `fetch` adapter behind `LlmPort` that is wired only when valid settings exist; verify those tests pass and `package.json` / lockfile still contain no `openai` or `@anthropic-ai/sdk`
- [x] 5.3 Add placeholder-only LLM keys to `.env.example` and verify no real credentials are present

## 6. Voice path uses the agent (TDD)

- [x] 6.1 Write failing tests that `handleVoiceTurn` success text is the agent `replyText` (mocked LLM), not locale placeholder copy, and that the voice adapter still does not import `LlmPort`
- [x] 6.2 Wire `handleVoiceTurn` `work` to `handleAgentTurn`, map `llm_timeout` / `tool_timeout` / turn budget to `VOICE_TIMEOUT` and other agent failures to `VOICE_RUNTIME` without raw model output, and verify those tests pass
- [x] 6.3 Update inbound HTTP simulator tests so a valid authenticated turn maps the agent reply (or typed error) and verify they pass without a live voice vendor or live LLM
- [x] 6.4 Remove or stop using placeholder success helpers on the product path and verify no success test still asserts `placeholderReplyForLocale`

## 7. Eval fixtures (create-evals)

- [x] 7.1 Add frozen cases under `eval/runtime-demo/` with ids `reply-without-tool`, `allowlisted-tool-then-reply`, `invented-tool-denied`, `invalid-schema-no-execute`, `llm-timeout`, `injection-does-not-expand-allowlist`
- [x] 7.2 Record suite name `runtime-first-agent`, dataset version, prompt version `runtime-demo@1`, and pass criteria (decision type, tool name, error codes — not live prose) in `eval/runtime-demo/README.md`

## 8. Review and update tests and eval fixtures (MANDATORY)

- [x] 8.1 Review unit, architecture, tool, agent, voice, and inbound tests against every scenario in `specs/*/spec.md` and add any missing case
- [x] 8.2 Confirm eval fixtures cover the six case ids and do not require a paid model or paid call

## 9. Run verification gates (MANDATORY - AGENT MUST EXECUTE)

- [x] 9.1 Unit tests + database state (MANDATORY - AGENT MUST EXECUTE): start Compose if needed, run the suite without paid APIs, ping persistence through the port, confirm no new Session/Conversation/ToolCall tables or domain-row mutations, write `openspec/changes/runtime-first-agent/reports/YYYY-MM-DD-unit-test-and-db-verification.md`
- [x] 9.2 Contract tests (MANDATORY - AGENT MUST EXECUTE): regression on existing HTTP — `GET /health/live`, `GET /health/ready`, `GET /health/voice`, `POST /adapters/voice/inbound` (valid simulator with mocked LLM, invalid, unauthenticated, unconfigured); assert status codes and the canonical error envelope; write `openspec/changes/runtime-first-agent/reports/YYYY-MM-DD-contract-tests.md`
- [x] 9.3 Tool calling tests (MANDATORY - AGENT MUST EXECUTE): valid execute; extra fields / invalid JSON never execute; unknown tool denied; timeout mapped; no HITL path (read-only tool); record evidence in the unit or a dedicated tools section of the unit report
- [x] 9.4 Agent / prompt evaluation (MANDATORY - AGENT MUST EXECUTE): run `eval/runtime-demo/` with the fake LLM; record dataset version, prompt version, model identity (`fake`), and pass/fail per case; write `openspec/changes/runtime-first-agent/reports/YYYY-MM-DD-evaluation.md`
- [x] 9.5 Skip RAG evaluation — no retrieval implementation
- [x] 9.6 Voice conversation evaluation (MANDATORY - AGENT MUST EXECUTE): scripted fixtures for agent reply mapping, timeout, and invalid-output → voice-safe error; do not require live telephony; skip barge-in / confirmation / silence — out of scope; include results in the evaluation report
- [x] 9.7 Skip UI E2E — no frontend
- [x] 9.8 Observability smoke (MANDATORY - AGENT MUST EXECUTE): assert happy-path and tool-error turns emit the required spans and record the assertion in the unit or evaluation report
- [x] 9.9 Adversarial quality cases (MANDATORY - AGENT MUST EXECUTE): injection-does-not-expand-allowlist plus extra-field tool deny; independent `/adversarial-review` remains after `/verify` before archive

## 10. Update technical documentation (MANDATORY)

- [x] 10.1 Document agent-turn behavior, prompt location/versioning, fake vs optional HTTP LLM env vars, tool name/schema, error codes, and how to run unit + eval suites — verify a reader can follow without implicit steps
- [x] 10.2 Update project architecture notes so the demo agent lives in the runtime, Vapi remains an interaction adapter, and placeholder success is no longer the voice happy path
- [x] 10.3 Confirm `lidr-specboot/docs/` needs no methodology rewrite and that `lidr-specboot/docs/api-spec.yml` session/tool HTTP remains unimplemented

## 11. Adversarial remediations (TDD)

- [x] 11.1 Write failing tests that `HttpLlm` posts split `messages` (policy not on `user`, user text not on `system`), aborts on timeout, and rejects oversize bodies
- [x] 11.2 Implement HTTP adapter role forwarding, abort signal, and 64 KiB body cap and verify those tests pass
- [x] 11.3 Write failing tests that overlong `replyText` is `invalid_output`, default observability does not retain `normalizedText`, and turn state includes `awaiting_tool` with actor `runtime`
- [x] 11.4 Bound reply text, emit redacted tool results only, record request-scoped states, and default `createServer` to logging observability; verify those tests pass
- [x] 11.5 Write failing tests that stale `occurredAt` returns `VOICE_STALE` and excess authenticated turns return `VOICE_RATE_LIMITED` without invoking the agent
- [x] 11.6 Implement inbound freshness and per-secret rate limit (defaults 60s / 30 per 60s) and verify those tests pass
- [x] 11.7 Update docs and `.env.example` for the new voice/LLM bounds and verify secrets-hygiene still passes
- [x] 11.8 Re-run unit, contract, tool, agent, and voice gates and write updated reports under `openspec/changes/runtime-first-agent/reports/`
