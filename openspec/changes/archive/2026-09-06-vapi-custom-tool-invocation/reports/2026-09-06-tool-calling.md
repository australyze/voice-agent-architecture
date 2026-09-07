# Verification Report - Tool Calling

- Date: 2026-09-06
- Change: `vapi-custom-tool-invocation`
- Agent: evaluation-engineer
- Phase: `/verify` (post-adversarial remediation-2)

## Commands executed

```text
npx vitest run src/application/execute-channel-tool-invocation.test.ts
npx vitest run src/adapters/http/voice-tools.test.ts
npx vitest run eval/vapi-channel-tools/vapi-channel-tools.eval.test.ts
```

## Results

| File | Passed | Failed |
| --- | --- | --- |
| `execute-channel-tool-invocation.test.ts` | 7 | 0 |
| `voice-tools.test.ts` (deny / success path) | 7 | 0 |
| `vapi-channel-tools.eval.test.ts` | 7 | 0 |

## Coverage matrix

| Case | Evidence | Result |
| --- | --- | --- |
| Allowlisted WOM success (usage / bill / service) | unit + eval fixtures | PASS |
| Deny outside allowlist (`demo.normalize_text` → `tool_denied`) | unit + HTTP + eval | PASS |
| Invalid args (extra properties → `tool_invalid_args`) | unit + eval | PASS |
| Hard timeout ~fail-closed (`tool_timeout`) | hanging ToolPort + `hardTimeoutMs: 30` | PASS |
| No `handleAgentTurn` / reject `runAgent` | unit + eval dual-brain guard | PASS |
| Persist only validated args `{}` on success | `should_persist_empty_validated_arguments_on_success` | PASS (remediation-1) |
| Never persist raw attacker args on deny/invalid | `should_not_persist_attacker_fields_on_deny_or_invalid_args` | PASS (remediation-1) |
| Empty `argumentsRedacted: {}` on session `trace` (no attacker keys) | same test asserts `toolCalls` + `trace` serialization + empty keys | PASS (remediation-2) |
| Timeout timer cleared | `clearTimeout` in `finally` (code + timeout test still green) | PASS (remediation-1) |

## Outcome

- Status: **PASS**
- Blocking issues: none
- Threshold: every allowlist / invalid / timeout / deny / empty-args / no-attacker-fields assertion must pass — no cases dropped
