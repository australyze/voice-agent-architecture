# runtime-demo agent

Single-turn demonstration agent owned by the application runtime. The voice adapter maps inbound events to `VoiceTurn` and does not call the LLM or tool ports.

## Turn loop

1. Pack versioned prompt `runtime-demo@2` from `prompts/runtime-demo/v2.md` (content hash at load). Keep `v1.md` on disk for history.
2. Retrieve against the current user text (runtime step, not a tool). Pack above-threshold hits as fenced `UNTRUSTED_RETRIEVED_CONTEXT:` (2048-character assemble cap). Embed/retrieve throws become `retrieval_failed`.
3. Call the LLM port with a closed structured decision (`reply` | `tool`).
4. Authorize the name against the `runtime-demo` allowlist (policy list, not a hardcoded hop-loop branch), then execute through the tool registry once.
5. Return typed success (`replyText`, locale, `sources`) or a normalized agent error.

User text, retrieved chunks, and tool results are packed as `UNTRUSTED_*` blocks and sent on untrusted message roles. They are not system policy. Request-scoped states: `receiving` → `retrieving` → `reasoning` → `awaiting_tool` (runtime) → `completed` | `failed`. There is no durable conversation memory. See [knowledge.md](../knowledge.md).

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

Invalid *present* LLM settings fail closed at process start. MCP settings are not required and do not enable a tool source.

## Tool registry

Tools are registered and resolved in process. `ToolPort.authorizeAndExecute` is the only execute API. Catalog fields: name, `riskClass`, closed input/output schemas, `timeoutMs`, `source` (`native` | `mcp` | `http` | `workflow`), `status`.

Default local start wires the native registry only. No MCP client package, process, or credential is required.

### Product example

`demo.normalize_text` — the only name on the `runtime-demo` allowlist.

```json
{ "type": "object", "additionalProperties": false, "required": ["text"], "properties": { "text": { "type": "string" } } }
```

Result: `{ "normalizedText": "<trim, collapse whitespace, lowercase>" }`. `riskClass: read`, `source: native`. Timeout ≤ 500 ms. String arguments, string result fields, and the JSON packed into the next model call are capped at **2048** characters. Oversize arguments are `tool_invalid_args`. Oversize or illegal success payloads are `tool_failed` and are not sent to the model.

Default **product** composition registers only this tool and passes the product allowlist into the tool port. High-risk classes (`write`, `irreversible`, `external_comm`) are denied and do not execute. A timeout aborts or ignores in-flight work; a late success is discarded.

### Test-only native tool

`demo.echo_token` is registered on the **test/demo** registry (not the product catalog) so a new native tool can be invoked by changing the allowlist only (no agent hop-loop edit). Input `{ "token": string }` (max 2048). Result `{ "echoedToken": "<same token>" }`. It is **not** on the product allowlist.

### Adding a native tool

1. Register name, closed schemas, `riskClass`, `source: native`, timeout, and executor on the registry.
2. Add the name to the agent allowlist for agents that may call it.
3. Do not edit `handleAgentTurn` to special-case the name.

### Authorization

| Outcome | Code |
| --- | --- |
| Unknown, disabled, not allowlisted, or `source` other than `native` | `tool_denied` |
| Extra properties, missing fields, wrong types | `tool_invalid_args` (body does not run) |
| Timeout | `tool_timeout` |
| Thrown error or illegal success payload | `tool_failed` |

`source: mcp` is reserved. The runtime denies it and does not start an MCP client. Development MCP is not a catalog source.

## Agent error codes

| Code | Meaning |
| --- | --- |
| `invalid_output` | Structured output failed after one retry |
| `tool_denied` | Unknown, disabled, not allowlisted, non-native source, or second hop |
| `tool_invalid_args` | Schema-invalid arguments |
| `tool_failed` | Tool threw or returned an illegal payload |
| `tool_timeout` | Tool exceeded budget |
| `llm_timeout` | Model exceeded budget |
| `llm_provider` | HTTP/network provider failure |
| `retrieval_failed` | Embed or retrieve threw |

Voice mapping: `llm_timeout` and `tool_timeout` → `VOICE_TIMEOUT`. All other agent failures → `VOICE_RUNTIME`. Adapter-facing messages never include raw model JSON or secrets.

Tool spans include `source`, argument validation outcome, and redacted args. They must not retain `normalizedText` or `echoedToken`.

## Tests and eval

```bash
npm test
npx vitest run eval/runtime-demo/runtime-demo.eval.test.ts
```

Suite `runtime-first-agent`, dataset `2026-09-05.4`, prompt `runtime-demo@2`. Assertions are codes, tool names, packing, and source counts, not live prose.

Retrieval suite: `npx vitest run eval/knowledge/knowledge.eval.test.ts` (`rag-foundation-retrieval`, dataset `2026-09-05.1`).
