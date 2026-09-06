# wom-customer-service-agent

Simulated WOM Chile customer-service environment for AI Engineering demonstration. This agent is **not** integrated with WOM systems.

It is a second runtime-owned session owner on the same `handleAgentTurn` loop as `runtime-demo`. Vapi remains an interaction adapter.

## Identity and policy

- **Agent id:** `wom-customer-service-agent`
- **Prompt:** `prompts/wom-customer-service-agent/v1.md` (`wom-customer-service-agent@1`, content hash at load)
- **Language:** Spanish replies; technical artifacts stay English
- **Tone:** clear, concise, friendly, professional
- **Honesty:** identify as a demonstration assistant; never claim live WOM access
- **Allowlist:** `wom.get_customer_usage`, `wom.get_bill_status`, `wom.check_service_status`
- **Budgets:** `maxToolHops = 1`, tool timeout ≤ 500 ms, turn timeout `VOICE_TIMEOUT_MS`

User text, tool results, and retrieved blocks are packed as `UNTRUSTED_*`. They cannot overwrite policy or expand the allowlist.

Tool failure (`tool_failed` / `tool_timeout`) **fail-closes** the turn. The runtime does not call the model again for a spoken fallback and does not present a successful usage, bill, or incident payload. Numeric claims in a no-tool `reply` are prompt- and eval-enforced this increment.

## Tools and mock directory

Tools resolve through `ToolRegistry` / `ToolPort`. Executors call an in-process `WomDirectory` (`src/adapters/wom/canned-wom-directory.ts`). No network I/O.

| Tool | Input | Output (canned) |
| --- | --- | --- |
| `wom.get_customer_usage` | `{}` | plan / used / remaining GB, cycle end, reserved test `phoneNumber` `56900000000` (not a real subscriber, not an identity input) |
| `wom.get_bill_status` | `{}` | amount CLP, due date, `pending` |
| `wom.check_service_status` | `{}` | `mobile-data` / `operational` / `incident: null` |

There is **no** customer login, RUT, or ANI identity. Extra fields such as `phoneNumber` on input are `tool_invalid_args`. A later production adapter would implement the same directory interface; do not add that here.

`runtime-demo` still allowlists only `demo.normalize_text`. Cross-allowlist names are `tool_denied`.

Default inbound composition binds `NativeToolPort` to the selected owner allowlist (`createSessionOwnerToolPort`). `handleAgentTurn` repeats that allowlist. An unbound product port is not the production inbound `ToolPort`.

## Voice inbound

Default `VOICE_SESSION_OWNER` is `runtime-demo` so existing HU #002 fixtures stay green.

```bash
VOICE_SESSION_OWNER=wom-customer-service-agent
```

Then `POST /adapters/voice/inbound` uses this prompt and allowlist. HTTP contracts are unchanged. The inbound mapper does not own WOM policy.

WOM composition uses an empty retrieval store. Facts come from mock tools, not the example knowledge document.

## LLM configuration

Same as `runtime-demo`: omit `LLM_BASE_URL` / `LLM_API_KEY` for the fake adapter; set both for the HTTP adapter. Never commit secrets. See [runtime-demo.md](./runtime-demo.md).

## Local run and tests

```bash
npx vitest run src/adapters/tools/wom-tools.test.ts src/application/handle-agent-turn.test.ts
npx vitest run eval/wom-customer-service/wom-customer-service.eval.test.ts
npm run test:eval-gate
```

Smoke: `handleAgentTurn` with a scripted fake LLM (usage → reply), or inbound inject with `sessionOwner: "wom-customer-service-agent"`.

## Web demo (HU #010)

Interviewers start a browser call from `web/` using the Vapi Web SDK. The runtime and tools stay here. See [adapters/vapi-web-demo.md](../adapters/vapi-web-demo.md).

## Deferred

- HU #012 — evaluation UI, scores, visual trace explorer, public deployment
