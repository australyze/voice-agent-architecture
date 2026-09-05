## Adversarial review

**Scope**: OpenSpec change `extensible-tool-runtime` (HU #004). Tool registry, closed schemas, `tool_invalid_args`, product allowlist vs `demo.echo_token`, reserved MCP `source`. Working tree on `feature/extensible-tool-runtime` vs `origin/feature/runtime-first-agent` (change is uncommitted).

**Sources**: `proposal.md`, `design.md`, `specs/{tool-execution,first-agent,provider-ports,application-runtime}/spec.md`, `tasks.md`; `lidr-specboot/docs/base-standards.md`, `backend-standards.md` (Security, tools, MCP), `data-model.md` (Tool, Approval); implementation of `ToolRegistry`, `NativeToolPort`, `handleAgentTurn`, `create-default-registry`, `create-server`; eval `runtime-demo` dataset `2026-09-05.2`. `/verify` quality PASS was **not** treated as a security PASS.

**Independence**: This review ran in the same conversation that implemented the change. Treat residual risk as higher until a fresh session re-checks remediations.

### Spec and task alignment

**Accepted this increment:** in-process register/resolve; one product tool `demo.normalize_text` (`read`/`native`); test-only `demo.echo_token` not on `runtime-demo` allowlist; invalid args → `tool_invalid_args` and no body; deny unknown/disabled/non-allowlisted/non-native; timeout/throw contained; MCP source reserved, no client, no package; no HITL catalog; no HTTP `invokeTool`; no ToolCall table.

**Non-goals:** business catalog, irreversible/external_comm tools, Runtime MCP client, Session tables.

**Underspecified:** max argument/result bytes before re-entry to the model; whether `ToolPort.authorizeAndExecute` must enforce allowlist and `riskClass` or only the agent use case; abort of in-flight work after `tool_timeout`; `disabled` catalog status (required, untested).

### Findings

| Severity | Area | Finding | Evidence | Suggested fix |
| --- | --- | --- | --- | --- |
| Major | Tool I/O / injection | Tool arguments and success payloads are unbounded. After a hop, `JSON.stringify(payload)` is packed into the next model call. `demo.echo_token` is a faithful reflector (`echoedToken` = input). `z.string()` has no `maxLength`. `backend-standards.md` requires bounding results before they return to the model; the spec says a “bounded” payload but does not define a cap. An inbound caller (or the model) can stuff a large or instruction-shaped `text`/`token` and have it replayed as `UNTRUSTED_TOOL_RESULT`. Eval `injection-does-not-expand-allowlist` only covers invented **names**, not tool-result policy override or size. | `create-default-registry.ts` schemas; `handle-agent-turn.ts` ~232–234; no `maxLength` in `src/`; eval cases | **OpenSpec + code + tests:** document a max arg/result size; reject oversize as `tool_invalid_args` or `tool_failed`; add a fixture that a huge or jailbreak-shaped echo/normalize result does not become policy and does not exceed the cap |
| Major | Autonomy / HITL | `riskClass` is stored and never consulted on execute. `authorizeAndExecute` runs any `active` + `source: native` executor. This change’s job is “add a tool without editing the agent.” A later (or mistaken) `register({ riskClass: "irreversible", source: "native", execute })` would run with no confirmation. `data-model.md` Approval and `backend-standards.md` high-risk confirmation are unused. Default catalog is `read`-only (tests prove that), which does **not** enforce the class. | `tool-registry.ts`; `native-tool-port.ts` 30–57 (no `riskClass` branch); `listRegisteredRiskClasses` is inspect-only | **OpenSpec + code + tests:** deny `write` / `irreversible` / `external_comm` (or return `awaiting_approval` and do not run) until a HITL change; assert a registered high-risk native tool never executes |
| Minor | Spec vs tests | Catalog `status: disabled` must deny (`tool-execution`). The port checks `status !== "active"`. No unit/eval case registers a disabled tool. | spec “Unknown or denied”; `native-tool-port.ts` 32; no `disabled` in tests | **Tests:** disabled name → `tool_denied`, body not run |
| Minor | Timeout / side effects | `Promise.race` does not abort `runExecutor`. After `tool_timeout` the body can still finish (test hang still sleeps). Spec: no further tool work on that attempt. Safe today only because tools are in-process and side-effect-free. | `native-tool-port.ts` 61–74, 99–109 | **OpenSpec + code:** abort/ignore late success; do not treat a late payload as a later turn’s result |
| Minor | Confused deputy / registry | `ToolPort` has no allowlist. Default **production** registry includes `demo.echo_token`. Any future caller of `authorizeAndExecute` (or a swapped `allowedTools`) executes echo without agent policy. Product HTTP path is saved by `RUNTIME_DEMO_ALLOWLIST` in `create-server.ts`. `networkAttempts` is a constant `0`, not a network probe—MCP deny tests only prove the executor was not entered. | `create-default-registry.ts`; `native-tool-port.ts` 16, 30; `create-server.ts` allowedTools | **Code + tests:** keep test-only tools out of default product composition, or pass allowlist into the port; freeze/overwrite-protect default names; do not treat `networkAttempts` as proof |
| Minor | Tool-result injection fixtures | Prompt isolates untrusted tool results. No frozen case where `normalizedText` / `echoedToken` says “enable demo.echo_token” or invents a second hop. | `prompts/runtime-demo/v1.md`; eval `cases.json` | **Tests / eval:** tool-result jailbreak still allowlist-only, hop limit 1 |
| Question | Same-session review | Implementer and reviewer share context. Residual risk of under-finding. | This conversation | Re-run `/adversarial-review` in a new session after remediations |

**Refuted (not findings):** Dev MCP is not a product tool source (no MCP package; `source !== "native"` deny; CI/start without MCP). Default catalog has no `write` / `irreversible` / `external_comm`. Extra properties do not execute (`tool_invalid_args`). Unknown and non-allowlisted names do not run on `handleAgentTurn`. `maxToolHops = 1`. Default logging observability does not persist args/results. No new HTTP invoke API. No secrets in fixtures.

### Verdict

**FAIL** — two Major findings (unbounded tool I/O re-entering the model; `riskClass` unused on the new execute path).

Archiving advisable? **No.** Quality `/verify` PASS does not clear this.

### Recommended next steps (before archive)

1. Update OpenSpec (size bound; high-risk deny/HITL on the registry execute path; timeout abort). Do not patch code-only in the apply window.
2. Implement and add abuse tests in a **new** `/opsx-apply` pass (not this review).
3. Re-run `/verify`, then a **fresh-session** `/adversarial-review`.
4. Archive only on PASS or PASS WITH GAPS with no Major remaining.
