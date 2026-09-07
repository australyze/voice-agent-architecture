## 0. Setup: Create Feature Branch (MANDATORY - FIRST STEP)

**Change types:** `code` | `api` | `tools` | `voice` (no UI; skip Playwright/UI E2E)

- [x] 0.1 Create and switch to feature branch `feature/vapi-custom-tool-invocation` from the current integration base
- [x] 0.2 Verify `git branch --show-current` prints `feature/vapi-custom-tool-invocation`

## 1. Contracts and configuration

- [x] 1.1 Document the Custom Tool HTTP path, auth header, body limits, and response envelope in `openapi/health.yaml` (or project OpenAPI surface) and verify the route appears in the contract file
- [x] 1.2 Add config for `VOICE_REASONING_OWNER` (`runtime` | `vapi`, default `runtime`) and wire it through `loadConfig` with unit tests for valid/invalid values
- [x] 1.3 Update `.env.example` / `render.yaml` notes for interview deploy (`VOICE_REASONING_OWNER=vapi`, tools Server URL) without committing secrets; verify examples contain keys only

## 2. Application use case (TDD)

- [x] 2.1 Add failing unit tests for `executeChannelToolInvocation` (name per design): allowlisted WOM success, deny `demo.normalize_text`, `tool_invalid_args`, `tool_timeout` / hard ~2000 ms fail-closed, and assert the use case never calls `handleAgentTurn`
- [x] 2.2 Implement the use case against ToolPort + persistence + observability ports; verify the new unit tests pass
- [x] 2.3 Extend ToolCall / observability metadata to record `invocation_source: vapi_custom_tool` (and channel/provider when the model already supports metadata); verify persistence unit or memory-adapter tests assert the field on session report ToolCalls

## 3. Voice Custom Tool adapter (TDD)

- [x] 3.1 Add failing adapter/HTTP tests for auth failure, invalid/oversized body, mapped multi-call `tool-calls` fixture → per-`toolCallId` results, and deny outside WOM allowlist
- [x] 3.2 Implement Vapi payload mapping in `src/adapters/voice/` (vendor types stay out of domain) and register `POST /adapters/voice/tools` (or the path fixed in 1.1); verify adapter tests pass
- [x] 3.3 When `VOICE_REASONING_OWNER=vapi`, ensure inbound transcript events do not invoke `handleAgentTurn` while lifecycle/EOC persistence still works; verify with unit/contract tests
- [x] 3.4 Confirm tools handler composition binds only `WOM_CUSTOMER_SERVICE_ALLOWLIST` on the production ToolPort for this route; verify deny cases for non-WOM tools

## 4. Review and update tests and evaluation fixtures (MANDATORY)

- [x] 4.1 Update or add tool-calling fixtures covering valid/invalid/timeout/deny for the three `wom.*` tools on the channel path; verify targeted vitest files pass
- [x] 4.2 Add voice conversation / channel-tool eval fixtures (scripted: usage, bill, service-status, tool failure fail-closed, no dual agent turn); verify fixtures load in the project eval runner
- [x] 4.3 Extend session-report / call-evaluation cases so Vapi-originated ToolCalls affect the same evaluation model as inbound tool hops; verify deterministic eval assertions pass

## 5. Run verification gates (MANDATORY - AGENT MUST EXECUTE)

Reports directory: `openspec/changes/vapi-custom-tool-invocation/reports/`

- [x] 5.1 Unit tests (+ DB/persistence checks if records touch Supabase/Postgres adapters) — write `reports/YYYY-MM-DD-unit-test-and-db-verification.md` (MANDATORY - AGENT MUST EXECUTE)
- [x] 5.2 Contract tests for the new tools route (auth, validation, success, deny) against the documented OpenAPI/error envelope — write `reports/YYYY-MM-DD-contract-tests.md` (MANDATORY - AGENT MUST EXECUTE)
- [x] 5.3 Tool calling tests (allowlist, invalid args, timeout, deny) — include evidence in the unit or contract report, or `reports/YYYY-MM-DD-tool-calling.md` (MANDATORY - AGENT MUST EXECUTE)
- [x] 5.4 Voice / channel-tool evaluation gate (fixtures; no live paid Vapi in CI) — write `reports/YYYY-MM-DD-evaluation.md` with dataset/prompt/model versions and thresholds (MANDATORY - AGENT MUST EXECUTE)
- [x] 5.5 Observability smoke: assert tool span/records include latency, status, shared `traceId`, and `invocation_source` — evidence in unit or evaluation report (MANDATORY - AGENT MUST EXECUTE)
- [x] 5.6 Skip UI E2E — no frontend change in this change
- [x] 5.7 Skip RAG evaluation — no retrieval corpus change
- [x] 5.8 Adversarial readiness note: expand tool trust boundary requires `/adversarial-review` before archive; file a short `reports/YYYY-MM-DD-adversarial-checklist.md` listing injection/deny/secret-leak cases to run in that review (MANDATORY checklist artifact; full review is a separate session)

## 6. Update technical documentation (MANDATORY)

- [x] 6.1 Update `docs/adapters/vapi-inbound.md` and add or extend `docs/adapters/vapi-custom-tools.md` (path mapping, auth header, dual-brain guard, `VOICE_REASONING_OWNER`)
- [x] 6.2 Update `docs/adapters/vapi-web-demo.md` and `docs/public-demo-deploy.md` for Custom Tools Server URL setup and interview DoD
- [x] 6.3 Update `docs/agents/wom-customer-service-agent.md` to describe Vapi-native reasoning vs runtime tool authority
- [x] 6.4 Update `docs/architecture.md` / `docs/persistence.md` briefly for `invocation_source` and the tools route; verify docs cross-links resolve

## 7. Adversarial remediation (post-FAIL review)

- [x] 7.1 Persist only schema-validated ToolCall arguments (`{}` for WOM tools); never store deny/invalid attacker fields — unit tests assert absence of attacker keys/values
- [x] 7.2 Add tools-route wrong-secret (401, no secret echo) and oversized-body (413) contract tests
- [x] 7.3 Clear hard-timeout `setTimeout` handles in `finally`
- [x] 7.4 Re-run targeted verify suite; write `reports/2026-09-06-adversarial-remediation.md` and post-remediation review note

## 8. Adversarial remediation (second FAIL — trace keys + Supabase hydrate)

- [x] 8.1 Channel path always emits `argumentsRedacted: {}`; full session report tests cover `toolCalls` + `trace` (no attacker keys/values)
- [x] 8.2 Supabase `getSessionReport` hydrates `invocation_source` → `invocationSource`; adapter unit test with mocked fetch
- [x] 8.3 Re-run targeted tests; write `reports/2026-09-06-adversarial-remediation-2.md`
