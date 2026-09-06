# Adversarial review (post-remediation)

**Scope**: OpenSpec change `wom-customer-service-agent` after bound-port remediations. Branch `feature/wom-customer-service-agent` plus working tree. Independence is weaker than specified: this conversation also applied the remediations. `/verify` PASS was not used as a security argument.

**Sources**: proposal, design, tasks, `specs/**`; `lidr-specboot/docs` Security / tools / MCP; `create-server.ts`, `native-tool-port.ts`, `register-wom-tools.ts`, `canned-wom-directory.ts`, `handle-agent-turn.ts`, `load-config.ts`, WOM prompt, eval fixtures. Diff vs `main` merge-base plus untracked WOM modules.

## Spec and task alignment

- In scope still held: second session owner; three native `read` mocks; hop cap 1; no new HTTP; no MCP; no write/HITL; inbound contract unchanged; default owner `runtime-demo`.
- Prior contradiction (Spanish spoken fallback vs fail-closed) is reconciled in OpenSpec. Runtime fail-closes; capability MUST matches D1.
- Prior unmet wording (allowlist only on `handleAgentTurn`) is now a MUST: production `NativeToolPort` constructor bind + second loop check. Tests exist that call the port without `handleAgentTurn`.

## Findings

| Severity | Area | Finding | Evidence | Suggested fix |
| --- | --- | --- | --- | --- |
| Minor | Prompt vs runtime | WOM prompt still tells the model to speak a “could not retrieve” fallback after tool failure. The loop never re-enters the model on `tool_failed` / `tool_timeout`. Safer than the old MUST; the prompt line is dead policy. | `prompts/wom-customer-service-agent/v1.md` line 10 vs `handle-agent-turn.ts` `agentFailure` on tool error. | **docs** / prompt: state that the runtime fail-closes and the model will not see a failed hop. Do not add a post-failure hop. |
| Minor | Footgun | `new NativeToolPort()` / `new NativeToolPort({ registry })` still ships an unbound product catalog (demo + `wom.*`). Default inbound uses `createSessionOwnerToolPort`. Tests and `dependencies.tools` can still construct or inject an open port. | `native-tool-port.ts` constructor; `wom-tools.test.ts` open-registry execute; `create-server.ts` `dependencies.tools ?? createSessionOwnerToolPort(...)`. | **code** later: require `allowedTools` unless an explicit test flag; keep the inbound default bound. |
| Question | Ungrounded `reply` | A schema-valid `reply` with no tool hop can invent amounts. Specified as prompt/eval-only. Fake-LLM fixtures do not prove a live model. | WOM spec grounding paragraph; `containsSensitiveOutput` is canary/`sk-` only. | Accept for this demo increment; do not claim runtime grounding. |
| Question | Inbound authenticity | Shared-secret inbound is unchanged (no vendor-signed webhooks). WOM owner still speaks billing-shaped canned facts on that door. | `authenticateInbound`; prior residual. | Later adapter increment. |

**Prior Major (confused deputy) — refuted:** `createServer` binds `createSessionOwnerToolPort(allowedTools)`. Port tests deny `wom.get_customer_usage` on the demo allowlist and `demo.normalize_text` on the WOM allowlist without `handleAgentTurn`. Default inbound proposing `wom.*` and WOM inbound proposing normalize / echo after a seeded jailbreak document fail closed (`VOICE_RUNTIME`, no successful foreign-tool span). `/demo/orchestrate` does not receive that `ToolPort`.

**Still refuted:** no `write` / `irreversible` / `external_comm`; no Runtime MCP; directory has no HTTP; closed `{}` schemas; extra `phoneNumber` input does not run the body; hop cap 1; invalid `VOICE_SESSION_OWNER` fail-closes without echoing the value; canned MSISDN is reserved `56900000000`; no live keys in fixtures.

## Recommended next steps

1. Archive is allowed on this verdict. Prefer a later session if a reviewer wants stronger independence.
2. Optional: align the prompt fail-closed line; tighten `NativeToolPort` so unbound construction is explicit.
3. Do not treat this review as production webhook authenticity or live-model jailbreak resistance.
