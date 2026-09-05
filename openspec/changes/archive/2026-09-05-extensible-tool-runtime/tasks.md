# Tasks: extensible-tool-runtime

Change types: **code**, **tools**, **agent**.

Not in this change: **api** (no new routes; inbound voice is a regression surface only), **rag**, **voice** (no media or turn-taking change), **ui**.

Reports: `openspec/changes/extensible-tool-runtime/reports/`.

## 0. Setup: Create Feature Branch (MANDATORY - FIRST STEP)

- [x] 0.1 Create and switch to branch `feature/extensible-tool-runtime` from the default branch and verify with `git branch --show-current`

## 1. Error codes and package guards (TDD)

- [x] 1.1 Write a failing test that agent error codes include `tool_invalid_args` with a secret-safe message, and that schema-invalid tool arguments no longer map to `tool_denied`
- [x] 1.2 Add `TOOL_INVALID_ARGS` to the domain error catalog and verify that test passes
- [x] 1.3 Write failing architecture/package tests that domain and application have no MCP SDK imports and that `package.json` / lockfile contain no MCP client package, then implement the assertions and verify they pass

## 2. Registry, schemas, and native executors (TDD)

- [x] 2.1 Write failing registry tests: register/resolve `demo.normalize_text` and `demo.echo_token`; unknown name does not resolve to an executor; `source` `mcp` resolves but authorize returns `tool_denied` without network
- [x] 2.2 Write failing execution tests: valid normalize → `{ normalizedText: "hello world" }` for `"  Hello   World "`; extra/missing/wrong-type fields return `tool_invalid_args` and do not run the body; valid `demo.echo_token` → `{ echoedToken: "abc" }`; timeout → `tool_timeout`; injected throw → `tool_failed` without crashing the next invoke; illegal success payload → `tool_failed`
- [x] 2.3 Implement the in-process registry and `ToolPort` executor per `design.md` D2/D4–D7 (closed input/output schemas, native-only execute, timeout race, try/catch) and verify those tests pass
- [x] 2.4 Verify no `write` / `irreversible` / `external_comm` tool is registered and that default composition still starts with no MCP settings

## 3. Agent allowlist is policy (TDD)

- [x] 3.1 Write a failing test that `handleAgentTurn` with allowlist `["demo.echo_token"]` executes echo through the same hop loop and does not require a hardcoded tool-name branch
- [x] 3.2 Write failing tests that product `runtime-demo` allowlist remains only `demo.normalize_text`, that a `demo.echo_token` proposal is `tool_denied` and does not run the echo body, and that invalid normalize args on the agent path return `tool_invalid_args`
- [x] 3.3 Remove the hardcoded `DEMO_NORMALIZE_TEXT` equality gate, inject the allowlist, wire default product policy, and verify those tests pass
- [x] 3.4 Write a failing test that a successful tool span includes `source` `native` and a validation outcome, then emit those fields through `ObservabilityPort` and verify the test passes without logging raw `normalizedText` or `echoedToken`

## 4. Eval fixtures (create-evals)

- [x] 4.1 Update `eval/runtime-demo/` so `invalid-schema-no-execute` asserts `tool_invalid_args`, and add frozen cases `registered-not-allowlisted-denied` and `mcp-source-denied` (no MCP client start)
- [x] 4.2 Add deterministic case `second-tool-via-registry` (test allowlist + `demo.echo_token`) and record dataset/prompt versions plus pass criteria in `eval/runtime-demo/README.md`

## 5. Review and update tests and eval fixtures (MANDATORY)

- [x] 5.1 Review unit, architecture, tool, and agent tests against every scenario in this change’s `specs/*/spec.md` and add any missing case
- [x] 5.2 Update any remaining assertions that expected `tool_denied` for extra properties or invalid JSON arguments
- [x] 5.3 Confirm eval fixtures do not require a paid model, paid call, or MCP server

## 6. Run verification gates (MANDATORY - AGENT MUST EXECUTE)

- [x] 6.1 Unit tests + database state (MANDATORY - AGENT MUST EXECUTE): start Compose if needed, run the suite without paid APIs or MCP, ping persistence through the port, confirm no new Tool/ToolCall/Session tables or domain-row mutations, write `openspec/changes/extensible-tool-runtime/reports/YYYY-MM-DD-unit-test-and-db-verification.md`
- [x] 6.2 Contract tests (MANDATORY - AGENT MUST EXECUTE): regression on existing HTTP — `GET /health/live`, `GET /health/ready`, `GET /health/voice`, `POST /adapters/voice/inbound` (valid simulator with mocked LLM, invalid-args tool path if covered, unauthenticated); assert status codes and the canonical error envelope; write `openspec/changes/extensible-tool-runtime/reports/YYYY-MM-DD-contract-tests.md`
- [x] 6.3 Tool calling tests (MANDATORY - AGENT MUST EXECUTE): valid execute; extra fields / invalid JSON never execute (`tool_invalid_args`); unknown tool denied; registered-not-allowlisted denied; MCP source denied; timeout mapped; thrown error contained; no HITL path (read-only tools); record evidence in the unit report or a tools section of that report
- [x] 6.4 Agent / prompt evaluation (MANDATORY - AGENT MUST EXECUTE): run `eval/runtime-demo/` with the fake LLM; record dataset version, prompt version, model identity (`fake`), and pass/fail per case including the new ids; write `openspec/changes/extensible-tool-runtime/reports/YYYY-MM-DD-evaluation.md`
- [x] 6.5 Skip RAG evaluation — no retrieval implementation
- [x] 6.6 Skip voice conversation evaluation — no barge-in, confirmation, silence, or spoken-flow change; inbound mapping stays a contract/unit regression
- [x] 6.7 Skip UI E2E — no frontend
- [x] 6.8 Observability smoke (MANDATORY - AGENT MUST EXECUTE): assert happy-path and invalid-args/deny turns emit required tool spans (`source`, validation outcome, redacted args) and record the assertion in the unit or evaluation report
- [x] 6.9 Adversarial quality cases (MANDATORY - AGENT MUST EXECUTE): injection-does-not-expand-allowlist, extra-field `tool_invalid_args`, MCP-source deny; independent `/adversarial-review` remains after `/verify` before archive

## 7. Update technical documentation (MANDATORY)

- [x] 7.1 Document the registry contract, product vs test-only tools, `tool_invalid_args` vs `tool_denied`, MCP source reserved-and-denied, and how to register a new native tool without editing the agent hop loop — verify a reader can follow without implicit steps
- [x] 7.2 Confirm `lidr-specboot/docs/` needs no methodology rewrite and that `lidr-specboot/docs/api-spec.yml` `/tools/{toolName}/invoke` remains unimplemented

## 8. Adversarial remediations (TDD)

- [x] 8.1 Write failing tests: string args over 2048 characters → `tool_invalid_args` and body does not run; oversize success JSON is not packed into the next model call (`tool_failed`)
- [x] 8.2 Write failing tests: registered `write` / `irreversible` / `external_comm` native tools return `tool_denied` and do not execute; `status` `disabled` returns `tool_denied`
- [x] 8.3 Write a failing test that after `tool_timeout` a late success payload is not returned for that attempt
- [x] 8.4 Write failing tests that default product composition does not register `demo.echo_token` and that the product port allowlist denies echo even if a caller skips the agent hop loop
- [x] 8.5 Implement size caps, risk-class deny, abort-on-timeout, product vs test registry, no silent register overwrite, and port allowlist; verify those tests pass
- [x] 8.6 Add eval cases `oversize-tool-args-rejected` and `tool-result-does-not-expand-allowlist` (dataset `2026-09-05.3`) and verify they pass with the fake LLM

## 9. Remediation verification (MANDATORY - AGENT MUST EXECUTE)

- [x] 9.1 Re-run unit + tool + agent eval suites without paid APIs or MCP and write `openspec/changes/extensible-tool-runtime/reports/2026-09-05-adversarial-remediation.md`
- [x] 9.2 Update `docs/agents/runtime-demo.md` with the 2048-character cap, high-risk deny, product vs test catalog, and timeout abort

## 10. Skip inapplicable gates after remediation

- [x] 10.1 Skip RAG, voice conversation, and UI E2E — unchanged reasons from section 6
