# Adversarial review

**Scope**: OpenSpec change `wom-customer-service-agent` (HU #009). Working tree on `feature/wom-customer-service-agent`. Independence is weaker than specified: this conversation also implemented the change. Gaps assumed until evidence refutes them.

**Sources**: `openspec/changes/wom-customer-service-agent/{proposal,design,tasks}.md` and `specs/**`; `lidr-specboot/docs/base-standards.md` and `backend-standards.md` (Security, tools, MCP, HITL); `create-server.ts`, `native-tool-port.ts`, `create-default-registry.ts`, `register-wom-tools.ts`, `canned-wom-directory.ts`, `handle-agent-turn.ts`, `load-config.ts`, `prompts/wom-customer-service-agent/v1.md`, eval fixtures. `/verify` scores were not used as a security argument.

## Spec and task alignment

- In scope: second session owner; three native `read` mocks; `maxToolHops = 1`; no new HTTP; inbound contract unchanged; no RAG corpus; no write/HITL tools; `VOICE_SESSION_OWNER` fail-closed; default `runtime-demo`.
- Non-goals held: no Runtime MCP; inbound does not call orchestrate; no identity inputs; directory has no network I/O.
- Contradiction: capability spec requires a Spanish “could not retrieve” fallback on tool failure; design D1 and `handleAgentTurn` fail-close the turn.
- Unmet wording: tool-execution requires composition to supply the session-owner allowlist to the **port or the authorize call**. Production supplies it only to `handleAgentTurn`. `ToolExecuteRequest` has no allowlist field.

## Findings

| Severity | Area | Finding | Evidence | Suggested fix |
| --- | --- | --- | --- | --- |
| Major | Tool abuse / confused deputy | After `wom.*` joined the product catalog, default `NativeToolPort` no longer carries a session-owner allowlist. `authorizeAndExecute` runs any active native `read` catalog tool unless a constructor allowlist is set. Inbound is protected only by a separate check in `handleAgentTurn`. A second caller of the same port (injected `dependencies.tools`, future route) can execute WOM mocks from the demo owner or `demo.normalize_text` from the WOM owner. | `createProductToolRegistry()` registers normalize + three `wom.*`. `create-server.ts` uses `new NativeToolPort({ registry })` with no `allowedTools`. `native-tool-port.ts` enforces allowlist only when `this.allowedTools !== undefined`. `wom-tools.test.ts` executes all three `wom.*` on that open port. | **code**: bind the production port (or two ports) to the selected owner allowlist. **tests**: prove the default production port cannot run `wom.*` for the demo owner and cannot run `demo.normalize_text` for the WOM owner without `handleAgentTurn`. **OpenSpec**: if an open execute path is intentional, drop the “port or authorize call” MUST. |
| Minor | Spec vs code | Tool failure does not produce a Spanish spoken fallback; the turn errors (`VOICE_RUNTIME` / `VOICE_TIMEOUT`). Safer against fabrication; the capability MUST is still false. Eval `bill-tool-failed-no-fabricate` asserts `ok: false`. | `handle-agent-turn.ts` `agentFailure` on tool error; no second model call. | **OpenSpec**: rewrite to fail-closed + no fabricated payload. Do not add a post-failure model hop without grounding. |
| Minor | Tests | Spec “runtime-demo proposes `wom.*` → deny” is not proven on the agent loop. Port deny uses an explicit constructor allowlist that production does not set. WOM eval registry is `registerWomTools` only. | Domain allowlist test; no `handleAgentTurn` default-demo + `wom.get_*`; no inbound WOM + `demo.normalize_text`. | **tests**: add those cases; run WOM eval against `createProductToolRegistry()`. |
| Minor | Eval gate | `invalid-args-no-execute` sets `toolBodyRan: false` but the executor ignores it. Baseline `required` omits hop-limit, unsupported-request, invented-tool, and invalid-args. | `execute-wom-customer-service-eval.ts`; `eval/gate/baseline.json`. | **tests** / **eval**: honor `toolBodyRan`; pin those ids in baseline. |
| Minor | Ungrounded replies | Runtime does not check that numeric claims in `replyText` came from a successful tool. A `reply` without a tool can invent amounts. Prompt-only. | `containsSensitiveOutput` only. | **OpenSpec**: state grounding is prompt/eval-only this increment; later fail-closed if no successful `wom.*` hop. |
| Minor | Retrieval | WOM default skips example ingest; not asserted on inbound. No WOM document-injection fixture. | `create-server.ts` ingest when `!womOwner`. | **tests**: WOM inbound with a seeded jailbreak doc must not expand the allowlist. |
| Question | Identity | Output `phoneNumber` `56912345678` looks like a real Chilean MSISDN. Empty input schema (no lookup). | `CANNED_WOM_USAGE`. | **docs** / **code**: obviously reserved test MSISDN. |
| Question | Inbound auth | Shared-secret inbound unchanged (no vendor-signed webhooks). Same door now can speak billing-shaped demo facts when owner is WOM. | `authenticateInbound`; prior increment residual. | Later adapter change; do not claim this HU closed webhook authenticity. |

**Refuted:** no `write` / `irreversible` / `external_comm`; no Runtime MCP; directory has no `fetch`/HTTP; closed empty-object schemas; extra `phoneNumber` input does not run the body (unit); WOM loop denies invented tools, `demo.normalize_text`, and injection-proposed `demo.echo_token`; hop cap 1; invalid `VOICE_SESSION_OWNER` fail-closes without echoing the value; no live keys in fixtures.

## Recommended next steps (before archive)

1. Close the Major: bind production `NativeToolPort` to the selected owner allowlist; add tests that do not treat `handleAgentTurn` as the only gate.
2. Reconcile the Spanish-fallback MUST with fail-closed D1 in OpenSpec.
3. Add demo↔WOM cross-allowlist proofs on the product catalog and inbound path.
4. Fix the dead `toolBodyRan` check and pin missing cases in the gate baseline.
5. Update OpenSpec first, then `/apply` and re-run `/adversarial-review` in a **new** session. Do not archive on this FAIL.
