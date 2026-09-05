# Adversarial remediation

- Date: 2026-09-05
- Change: extensible-tool-runtime
- Agent: ai-engineer
- Follows: `reports/2026-09-05-adversarial-review.md` FAIL

## Commands executed

- `npx vitest run src/adapters/tools/native-tool-port.test.ts src/application/handle-agent-turn.test.ts src/domain/demo-tool.test.ts eval/runtime-demo/runtime-demo.eval.test.ts src/composition/app.test.ts src/adapters/http/voice-inbound.test.ts`
- `npx vitest run` → 145 passed (30 files)
- `openspec validate extensible-tool-runtime --type change --strict`

Paid LLM, live voice, and MCP servers were not used.

## Remediations

| Review item | Change |
| --- | --- |
| Major: unbounded tool I/O | `MAX_TOOL_STRING_CHARS` 2048 on schemas and packed JSON; oversize args → `tool_invalid_args`; oversize success → `tool_failed` (not packed) |
| Major: unused `riskClass` | `write` / `irreversible` / `external_comm` → `tool_denied`, body not run |
| Minor: disabled untested | Disabled tool test added |
| Minor: timeout race | AbortSignal; hang wait cancelled; late success discarded |
| Minor: echo in product catalog | Product registry is normalize-only; test/demo registry has echo; product port allowlist in `createServer` |
| Minor: register overwrite | `ToolRegistry.register` throws if the name exists |
| Minor: tool-result jailbreak | Eval `tool-result-does-not-expand-allowlist`; unit hop-limit case |

## Eval

Dataset **`2026-09-05.3`**. New cases: `oversize-tool-args-rejected`, `tool-result-does-not-expand-allowlist`.

## Outcome

- Status: PASS (implementation + regression)
- Independent `/adversarial-review` in a **fresh session** still required before archive
