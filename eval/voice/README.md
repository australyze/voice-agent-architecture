# Voice fixtures: vapi-voice-interaction-adapter-voice

Suite: `vapi-voice-interaction-adapter-voice`

These cases prove the inbound voice pipe. They do **not** use live audio, paid telephony, or a Vapi account.

## Pass criteria

A case passes when the HTTP status and error code (or success shape) match `cases.json`.

| Case | Pass |
| --- | --- |
| `supported-turn-placeholder` | `200` and `status=ok` with configured locale `es` |
| `invalid-payload` | `400` / `VOICE_PAYLOAD_INVALID` |
| `unsupported-event` | `400` / `VOICE_EVENT_UNSUPPORTED` |
| `unauthenticated` | `401` / `UNAUTHORIZED` |

Out of scope: barge-in, silence, transfer, spoken confirmation.

Run: `npx vitest run eval/voice/voice-eval.test.ts`
