## Adversarial review

**Scope**: `extensible-tool-runtime` after D11 remediations. Re-check of prior FAIL (unbounded tool I/O; unused `riskClass`) plus residual abuse.

**Sources**: Updated `specs/tool-execution/spec.md`, `design.md` D11, `tasks.md` §8; `NativeToolPort`, `create-default-registry.ts`, `handle-agent-turn.ts`, `create-server.ts`, `ToolRegistry`; tests and eval `2026-09-05.3`. Prior FAIL: `2026-09-05-adversarial-review.md`. `/verify` quality PASS is not a security PASS.

**Independence**: Same conversation as implementer. Residual reviewer bias remains (Question). Prefer a later session if archive policy requires a clean split.

### Spec and task alignment

Accepted: product catalog = `demo.normalize_text` only; echo on test registry; 2048-char string/JSON caps; high-risk and disabled deny; timeout abort or ignore late success; port allowlist on product composition; no MCP client; no HITL / `awaiting_approval`.

Prior Majors are specified and implemented. Leftover: cap is schema-dependent for custom registrations; `execute()` is not given the abort signal.

### Findings

| Severity | Area | Finding | Evidence | Suggested fix |
| --- | --- | --- | --- | --- |
| Minor | Tool I/O | The 2048 cap is on **default Zod schemas** plus output JSON length. A later `register()` with uncapped `z.string()` can still execute oversized **arguments**. Spec text is runtime-wide. Shipped tools have `.max(2048)`. | `create-default-registry.ts` 10–13; `native-tool-port.ts` 48–55 (trusts `inputSchema` only) | **Code (later):** enforce `MAX_TOOL_STRING_CHARS` on all string args in the port, not only catalog schemas |
| Minor | Timeout | Abort cancels the test `hangMs` sleep and ignores a late **result**. `execute()` does not receive `AbortSignal`. A future hanging native body can still run side effects after `tool_timeout`. Current shipped bodies are sync and side-effect-free. | `native-tool-port.ts` 118–133 | **Code (later change with side-effect tools):** pass signal into executors; cancel I/O |
| Minor | Composition | `allowedTools` on `NativeToolPort` is optional. `new NativeToolPort({ registry: createDemoToolRegistry() })` executes echo. Product `createServer` does set allowlist + product registry. | `native-tool-port.ts` 23–31; `create-server.ts` 90–95 | Keep product wiring as-is; do not default-compose the demo registry |
| Question | Process | Reviewer and implementer share this session. | chat | Optional third-party re-review |

**Prior FAIL — refuted**

| Prior Major | Evidence it no longer holds |
| --- | --- |
| Unbounded tool I/O re-entering the model | `.max(2048)` on shipped schemas; JSON cap; oversize args → `tool_invalid_args`; oversize success → `tool_failed` and not packed; eval `oversize-tool-args-rejected`; hop-2 jailbreak `tool-result-does-not-expand-allowlist` |
| `riskClass` unused | `HIGH_RISK` deny before parse/execute; test registers `irreversible` and `disabled`; body flags stay false |

**Still refuted:** extra properties do not execute; product allowlist and product catalog exclude echo; MCP source denied without a client; hop limit 1; default logger drops payloads; no invoke HTTP; no register overwrite; no high-risk class in the product catalog.

### Verdict

**PASS WITH GAPS** — no Blocker or Major on the shipped path. Remaining items are residual for custom registrations and future side-effect tools.

Archiving advisable? **Yes**, if the project accepts PASS WITH GAPS.

### Recommended next steps (before archive)

1. Archive with this report attached, or keep the two Minors as follow-up OpenSpec (independent arg-length check; abortable executors).
2. Optional: a third-party `/adversarial-review` if process requires a session split.
3. Do not treat `/verify` PASS as clearance for Runtime MCP or high-risk tools.
