# Vapi inbound adapter notes

Vapi is an interaction adapter. Domain and application code use `VoiceTurn` / `VoiceReply` only.

The provider-facing URL is `POST /adapters/voice/inbound`. It is **not** `POST /ingress/interaction` from `lidr-specboot/docs/api-spec.yml`. That generic ingress is 202-oriented and vendor-neutral. This adapter answers synchronously so the channel can speak the runtime placeholder.

## Authentication

Header: `x-voice-inbound-secret`

Compared to `VOICE_INBOUND_SECRET` using SHA-256 + `timingSafeEqual`.

When the secret is unset, inbound requests return `VOICE_CONFIG` and are not processed.

## Simulator body (also the mapped Vapi subset)

The adapter accepts a **strict** JSON object. Extra vendor fields are rejected (`VOICE_PAYLOAD_INVALID`). Map Vapi-native payloads to these fields in the adapter only if you extend mapping later; this change documents the simulator contract:

| Field | Required | Max | Internal mapping |
| --- | --- | --- | --- |
| `eventType` | yes | 64 | `VoiceTurn.eventType`. Only `transcript` is supported. |
| `occurredAt` | yes | — | `VoiceTurn.occurredAt` |
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
  "message": "<runtime placeholder text>",
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

`lidr-specboot/docs/` methodology was not rewritten for this change.
