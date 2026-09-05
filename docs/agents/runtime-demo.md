# runtime-demo agent

Single-turn demonstration agent owned by the application runtime. The voice adapter maps inbound events to `VoiceTurn` and does not call the LLM or tool ports.

## Turn loop

1. Pack versioned prompt `runtime-demo@1` from `prompts/runtime-demo/v1.md` (content hash at load).
2. Call the LLM port with a closed structured decision (`reply` | `tool`).
3. Optionally execute `demo.normalize_text` once (`riskClass: read`, `source: native`).
4. Return typed success (`replyText`, locale) or a normalized agent error.

User text and tool results are packed as `UNTRUSTED_*` blocks and sent on untrusted message roles. They are not system policy. Request-scoped states: `receiving` → `reasoning` → `awaiting_tool` (runtime) → `completed` | `failed`. There is no durable conversation memory.

## LLM adapters

| Mode | When | Identity |
| --- | --- | --- |
| Fake (default) | `LLM_BASE_URL` and `LLM_API_KEY` omitted | `fake` |
| HTTP | both URL and key present and valid | `LLM_MODEL_ID` (default `fake`) |

HTTP uses platform `fetch` against `{LLM_BASE_URL}/v1/chat/completions`. No OpenAI/Anthropic SDK. Default local start and CI never require a live model. When the application supplies `messages`, the adapter posts that list (system policy vs untrusted user/tool). It aborts the request at `LLM_TIMEOUT_MS` and rejects provider bodies larger than 64 KiB. `replyText` longer than 2048 characters is `invalid_output`.

| Env | Role |
| --- | --- |
| `LLM_BASE_URL` | Optional `http(s)` endpoint. Empty = fake adapter. |
| `LLM_API_KEY` | Required if URL is set. Placeholder-only in `.env.example`. |
| `LLM_MODEL_ID` | Optional. Default `fake`. |
| `LLM_TIMEOUT_MS` | Optional model budget. Default `1500`. |
| `VOICE_INBOUND_MAX_SKEW_MS` | Max `|now - occurredAt|`. Default `60000`. |
| `VOICE_INBOUND_RATE_LIMIT` | Authenticated inbound cap per secret hash. Default `30`. |
| `VOICE_INBOUND_RATE_WINDOW_MS` | Rate-limit window. Default `60000`. |

Invalid *present* LLM settings fail closed at process start.

## Tool

`demo.normalize_text`

```json
{ "type": "object", "additionalProperties": false, "required": ["text"], "properties": { "text": { "type": "string" } } }
```

Result: `{ "normalizedText": "<trim, collapse whitespace, lowercase>" }`. Timeout ≤ 500 ms. Unknown tools return `tool_denied`. Extra fields never execute.

## Agent error codes

| Code | Meaning |
| --- | --- |
| `invalid_output` | Structured output failed after one retry |
| `tool_denied` | Unknown, invalid args, or second hop |
| `tool_failed` | Tool returned failure |
| `tool_timeout` | Tool exceeded budget |
| `llm_timeout` | Model exceeded budget |
| `llm_provider` | HTTP/network provider failure |

Voice mapping: `llm_timeout` and `tool_timeout` → `VOICE_TIMEOUT`. All other agent failures → `VOICE_RUNTIME`. Adapter-facing messages never include raw model JSON or secrets.

## Tests and eval

```bash
npm test
npx vitest run eval/runtime-demo/runtime-demo.eval.test.ts
```

Suite `runtime-first-agent`, dataset `2026-09-05.1`, prompt `runtime-demo@1`. Assertions are codes and tool names, not live prose.
