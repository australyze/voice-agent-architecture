# Vapi inbound adapter notes

Vapi is an interaction adapter. Domain and application code use `VoiceTurn` / `VoiceReply` only.

The provider-facing URL is `POST /adapters/voice/inbound`. It is **not** `POST /ingress/interaction` from `lidr-specboot/docs/api-spec.yml`. That generic ingress is 202-oriented and vendor-neutral. This adapter answers synchronously so the channel can speak the runtime agent reply.

## Authentication

Header: `x-voice-inbound-secret`

Compared to `VOICE_INBOUND_SECRET` using SHA-256 + `timingSafeEqual`.

When the secret is unset, inbound requests return `VOICE_CONFIG` and are not processed.

After authentication, `occurredAt` must be within `VOICE_INBOUND_MAX_SKEW_MS` of the process clock (default 60s) or the adapter returns `VOICE_STALE`. Authenticated turns are limited to `VOICE_INBOUND_RATE_LIMIT` (default 30) per `VOICE_INBOUND_RATE_WINDOW_MS` (default 60s) per inbound-secret hash (`VOICE_RATE_LIMITED`, HTTP 429). Neither outcome invokes the agent.

## Simulator body (also the mapped Vapi subset)

The adapter accepts a **strict** JSON object. Extra vendor fields are rejected (`VOICE_PAYLOAD_INVALID`). Map Vapi-native payloads to these fields in the adapter only if you extend mapping later; this change documents the simulator contract:

| Field | Required | Max | Internal mapping |
| --- | --- | --- | --- |
| `eventType` | yes | 64 | `VoiceTurn.eventType`. Only `transcript` is supported. |
| `occurredAt` | yes | — | `VoiceTurn.occurredAt`. Must be fresh (see authentication). |
| `inputText` | yes for `transcript` | 4096 | `VoiceTurn.inputText` |
| `sessionId` | no | UUID (36) | Internal session UUID; minted when omitted. Non-UUID is `VOICE_SESSION_INVALID`. |
| `externalChannelId` | no | 128 | Opaque provider call/conversation id |
| `interactionId` | no | 128 | Correlation |
| `requestId` | no | 128 | Correlation |

Request body limit: **16 KiB**. Larger bodies are rejected (`VOICE_PAYLOAD_INVALID`) without invoking the runtime.

Vendor-native names (assistant object, call object, tool call payloads) must not appear in `src/domain` or `src/application`.

## Success response

```json
{
  "message": "<runtime agent replyText>",
  "locale": "es",
  "status": "ok"
}
```

If a live Vapi assistant expects a different wrapper, keep that wrapper in this adapter. Do not change the runtime contract.

## Optional live smoke

1. Set `VOICE_INBOUND_SECRET` in a gitignored `.env`.
2. Expose loopback with a tunnel only if you accept the risk (`LISTEN_HOST` stays `127.0.0.1` unless you opt in).
3. Point the Vapi server URL at `https://<host>/adapters/voice/inbound` and send the same secret header (or add a mapping layer).
4. Live smoke is **not** required for tests or `/verify`.

Default inbound session owner is `runtime-demo`. Set `VOICE_SESSION_OWNER=wom-customer-service-agent` to route the same HTTP contract to the simulated WOM customer-service agent. The mapper still does not own prompts or tools. See [agents/wom-customer-service-agent.md](../agents/wom-customer-service-agent.md).

The browser demo (`web/`) uses the Vapi Web SDK for live media only. It MUST NOT receive Server URL webhooks. Those POST requests stay on this inbound route. See [vapi-web-demo.md](./vapi-web-demo.md).

`lidr-specboot/docs/` methodology was not rewritten for this change.
