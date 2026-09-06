# Tasks: wom-customer-service-agent

Change types: **code**, **tools**, **agent**, **voice**.

Not in this change: **api** (no new routes; inbound voice is a regression surface), **rag** (WOM uses empty-hit retrieval only; `eval/knowledge` is regression), **ui**.

Reports: `openspec/changes/wom-customer-service-agent/reports/`.

## 0. Setup: Create Feature Branch (MANDATORY - FIRST STEP)

- [x] 0.1 Create and switch to branch `feature/wom-customer-service-agent` from the default branch and verify with `git branch --show-current`

## 1. Mock directory and WOM tools (TDD)

- [x] 1.1 Write failing tests that `wom.get_customer_usage`, `wom.get_bill_status`, and `wom.check_service_status` accept `{}`, reject extra properties (`tool_invalid_args`, body not run), return the canned deterministic payloads, and never perform network I/O
- [x] 1.2 Implement the in-process simulated WOM directory and register the three native `read` tools on the product catalog (`source` `native`, timeout ≤ 500 ms, closed schemas) and verify those tests pass
- [x] 1.3 Write a failing test that an injected failing directory maps to `tool_failed` without a success payload, then implement the injection seam and verify it
- [x] 1.4 Verify `runtime-demo` still allowlists only `demo.normalize_text`, that WOM tools are denied on that allowlist, and that no `write` / `irreversible` / `external_comm` tool is registered

## 2. WOM prompt and agent-turn path (TDD)

- [x] 2.1 Add versioned prompt `prompts/wom-customer-service-agent/v1.md` with `promptId` `wom-customer-service-agent`, `version` `1`, and a content-hash loader test that fails if the hash does not match the file bytes
- [x] 2.2 Write failing `handleAgentTurn` tests for WOM: Spanish locale `es`; each of the three tools then reply; reply without tool; `tool_failed` / `tool_timeout` does not expose a successful bill/usage/incident payload; unsupported request executes no `wom.*` tool; second hop `tool_denied`; invented tool `tool_denied`; `demo.normalize_text` denied on the WOM allowlist; injection does not expand the allowlist
- [x] 2.3 Wire WOM prompt + allowlist + empty-hit retrieval through existing `handleAgentTurn` (no second loop) and verify those tests pass without network calls
- [x] 2.4 Write a failing test that WOM application/domain modules do not import Vapi or an LLM SDK and that `handleAgentTurn` still has no hardcoded `wom.*` branch, then verify architecture tests pass

## 3. Session-owner configuration and voice inbound (TDD)

- [x] 3.1 Write failing config tests: omitted `VOICE_SESSION_OWNER` defaults to `runtime-demo`; `wom-customer-service-agent` is accepted; an invalid present value fails closed without echoing secrets
- [x] 3.2 Implement `VOICE_SESSION_OWNER` in `loadConfig` and `.env.example` (placeholder only) and verify those tests pass
- [x] 3.3 Write failing tests that default inbound composition still uses `runtime-demo` prompt/allowlist/example corpus, and that WOM composition uses the WOM prompt/allowlist/empty retrieval and does not invoke the orchestrated-turn path
- [x] 3.4 Select the session-owner bundle in `createServer` / `runAgent` (per-call allowlist or separate tool ports — do not bake only `RUNTIME_DEMO_ALLOWLIST` on a shared port) and verify inbound simulator tests still pass for the default owner
- [x] 3.5 Write a failing inbound test that `VOICE_SESSION_OWNER=wom-customer-service-agent` maps a mocked usage-tool-then-reply to `VoiceReply` under the existing HTTP contract, and verify it without a live vendor or live LLM
- [x] 3.6 Verify the voice inbound mapper still does not import WOM prompts, tools, or mock data

## 4. Eval fixtures (create-evals)

- [x] 4.1 Add frozen cases under `eval/wom-customer-service/` with ids `usage-tool-then-reply`, `bill-tool-then-reply`, `service-tool-then-reply`, `wom-reply-without-tool`, `bill-tool-failed-no-fabricate`, `unsupported-request-reply`, `second-hop-denied`, `wom-invented-tool-denied`, `invalid-args-no-execute`, `wom-injection-does-not-expand-allowlist`, `cross-allowlist-normalize-denied`
- [x] 4.2 Record suite name `wom-customer-service`, dataset version, prompt version `wom-customer-service-agent@1`, and pass criteria (tool names, error codes, locale — not live prose) in `eval/wom-customer-service/README.md`
- [x] 4.3 Add the suite key to `REQUIRED_SUITE_KEYS` / default suite execution and update `eval/gate/baseline.json` so skipping WOM fails the gate while existing required case ids remain

## 5. Review and update tests and eval fixtures (MANDATORY)

- [x] 5.1 Review unit, architecture, tool, agent, voice, inbound, and gate tests against every scenario in `specs/*/spec.md` and add any missing case
- [x] 5.2 Confirm WOM fixtures cover the listed case ids and do not require a paid model or paid call

## 6. Run verification gates (MANDATORY - AGENT MUST EXECUTE)

- [x] 6.1 Unit tests + database state (MANDATORY - AGENT MUST EXECUTE): start Compose if needed, run typecheck and the suite without paid APIs, ping persistence through the port, confirm no new Session/Conversation/ToolCall tables or domain-row mutations, write `openspec/changes/wom-customer-service-agent/reports/YYYY-MM-DD-unit-test-and-db-verification.md`
- [x] 6.2 Contract tests (MANDATORY - AGENT MUST EXECUTE): regression on existing HTTP — `GET /health/live`, `GET /health/ready`, `GET /health/voice`, `POST /adapters/voice/inbound` (default `runtime-demo` mocked LLM, plus one WOM-owner mocked turn, invalid, unauthenticated, unconfigured); assert status codes and the canonical error envelope; write `openspec/changes/wom-customer-service-agent/reports/YYYY-MM-DD-contract-tests.md`
- [x] 6.3 Tool calling tests (MANDATORY - AGENT MUST EXECUTE): valid empty-object execute for each `wom.*` tool; extra fields never execute; unknown/cross-allowlist denied; injected failure mapped; no HITL path; record evidence in the unit report
- [x] 6.4 Agent / prompt evaluation (MANDATORY - AGENT MUST EXECUTE): run `eval/wom-customer-service/` and regression `eval/runtime-demo/`; record dataset versions, prompt versions, model identity (`fake`), and pass/fail per case; write `openspec/changes/wom-customer-service-agent/reports/YYYY-MM-DD-evaluation.md`
- [x] 6.5 Skip RAG evaluation as a new suite — no WOM corpus; run `eval/knowledge/` only as required-gate regression and note that in the evaluation report
- [x] 6.6 Voice conversation evaluation (MANDATORY - AGENT MUST EXECUTE): run `eval/voice/` regression plus the WOM inbound mapping fixture; do not require live telephony; skip barge-in / confirmation / silence — out of scope; include results in the evaluation report
- [x] 6.7 Skip UI E2E — no frontend
- [x] 6.8 Observability smoke (MANDATORY - AGENT MUST EXECUTE): assert a WOM tool-hop turn emits workflow/llm/tool spans with `traceId`, agent/prompt identity `wom-customer-service-agent`, tool name, latency, and status; record the assertion in the unit or evaluation report
- [x] 6.9 Adversarial quality cases (MANDATORY - AGENT MUST EXECUTE): injection, cross-allowlist deny, no-fabrication on tool failure; independent `/adversarial-review` remains after `/verify` before archive

## 7. Update technical documentation (MANDATORY)

- [x] 7.1 Add `docs/agents/wom-customer-service-agent.md` covering identity, Spanish/demo-honest policy, the three tools, canned subscriber, mock directory vs future adapter, `VOICE_SESSION_OWNER`, LLM env vars, and how to run unit + eval suites — verify a reader can follow without implicit steps
- [x] 7.2 Update architecture / adapter notes so Vapi remains an interaction adapter, inbound default stays `runtime-demo`, WOM is a simulated customer-service environment, and HU #010 / #011 / #012 remain deferred
- [x] 7.3 Confirm `lidr-specboot/docs/` needs no methodology rewrite and that session/tool HTTP in `lidr-specboot/docs/api-spec.yml` remains unimplemented

## 8. Adversarial remediations (TDD)

- [x] 8.1 Reconcile OpenSpec: tool failure is fail-closed (no Spanish spoken fallback hop); production `NativeToolPort` MUST bind the selected owner allowlist; numeric grounding without a tool hop is prompt/eval-only this increment
- [x] 8.2 Write failing tests that `createSessionOwnerToolPort` / default inbound composition denies `wom.*` on the demo allowlist and `demo.normalize_text` on the WOM allowlist without `handleAgentTurn`
- [x] 8.3 Bind the production inbound port to the selected owner allowlist and verify those port tests pass
- [x] 8.4 Write failing `handleAgentTurn` + inbound tests: default `runtime-demo` proposing `wom.*` is denied on the product catalog; WOM inbound proposing `demo.normalize_text` is denied; WOM inbound with a seeded jailbreak document does not expand the allowlist
- [x] 8.5 Honor `toolBodyRan` in the WOM eval executor, run WOM eval against the product catalog (plus optional failing directory), pin hop-limit / unsupported / invented / invalid-args in `eval/gate/baseline.json`, and add the document-injection eval case

## 9. Review and update tests and eval fixtures (MANDATORY)

- [x] 9.1 Review new port, loop, inbound, and eval cases against the updated specs
- [x] 9.2 Confirm WOM fixtures still require no paid model or paid call

## 10. Run verification gates (MANDATORY - AGENT MUST EXECUTE)

- [x] 10.1 Unit tests + database state: run the suite without paid APIs, ping persistence, confirm no new tables, write `openspec/changes/wom-customer-service-agent/reports/2026-09-06-adversarial-remediation-unit-and-db.md`
- [x] 10.2 Contract tests: existing HTTP regression plus WOM-owner mocked deny cases; write `openspec/changes/wom-customer-service-agent/reports/2026-09-06-adversarial-remediation-contract.md`
- [x] 10.3 Tool calling tests: record bound-port deny evidence in the unit report
- [x] 10.4 Agent / prompt / voice evaluation: run WOM + runtime-demo + knowledge + voice suites; write `openspec/changes/wom-customer-service-agent/reports/2026-09-06-adversarial-remediation-evaluation.md`
- [x] 10.5 Skip UI E2E — no frontend
- [x] 10.6 Observability smoke: WOM deny and success turns still emit `traceId` / agent identity

## 11. Update technical documentation (MANDATORY)

- [x] 11.1 Document bound session-owner tool ports, fail-closed tool errors, reserved test MSISDN, and eval dataset bump in `docs/agents/wom-customer-service-agent.md` (and architecture notes if needed)
