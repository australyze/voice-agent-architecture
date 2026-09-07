# Vapi Custom Tools adapter

Vapi Custom Tools call this runtime for **tool authorization and execution only**. Conversational reasoning on the Vapi-native interview path stays in Vapi’s LLM (`VOICE_REASONING_OWNER=vapi`).

## HTTP

| Item | Value |
| --- | --- |
| Path | `POST /adapters/voice/tools` |
| Auth | `x-voice-inbound-secret` (same shared secret as inbound; `VOICE_INBOUND_SECRET`) |
| Body limit | 16 KiB |
| Allowlist | `wom.get_customer_usage`, `wom.get_bill_status`, `wom.check_service_status` |

Request shape (Vapi `tool-calls` subset):

```json
{
  "message": {
    "type": "tool-calls",
    "toolCallList": [{ "id": "…", "name": "wom.get_customer_usage", "parameters": {} }],
    "call": { "id": "<vapi-call-id>" }
  }
}
```

Response:

```json
{ "results": [{ "toolCallId": "…", "result": "<stringified payload or error>" }] }
```

This path **must not** invoke `handleAgentTurn`.

## Dual-brain guard

| `VOICE_REASONING_OWNER` | Inbound transcript | Custom Tools |
| --- | --- | --- |
| `runtime` (default) | Runs agent turn | Still available; do not dual-use on one call |
| `vapi` | Persists lifecycle/transcript only; empty spoken reply from runtime | Authoritative tool path |

Interview deploy should set `VOICE_REASONING_OWNER=vapi` and point each WOM Custom Tool Server URL at `/adapters/voice/tools`.

## Observability and history

Tool attempts persist as `ToolCall` records with `invocationSource: vapi_custom_tool` and emit `kind: tool` spans sharing the request `traceId`. Persisted `arguments` and span `argumentsRedacted` are schema-validated only (WOM tools: `{}`); deny/invalid inbound keys and values are never stored on ToolCalls or session-report `trace` metadata. Hosted Supabase session reports round-trip `invocation_source`. Session reports and call evaluation use the same model as inbound tool hops.

Hard timeout ≈ 2000 ms (fail-closed; no fabricated business payloads).
