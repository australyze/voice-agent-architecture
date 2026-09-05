# Verification Report - Contract Tests

- Date: 2026-09-05
- Change: vapi-voice-interaction-adapter
- Agent: evaluation-engineer
- Change types: code, api, voice
- Session: `/verify` after adversarial remediations
- Contract source: `openapi/health.yaml` (project OpenAPI; `lidr-specboot/docs/api-spec.yml` remains the methodology template)

## Commands executed

- `npx vitest run src/adapters/http/voice-inbound.test.ts src/adapters/http/health.test.ts src/adapters/http/health-voice.test.ts src/openapi-health.test.ts`
- Included in `npm test` (73 passed)

In-process Fastify `inject` (no paid APIs, no live Vapi). Persistence fake for readiness ping.

## Results

| Request | Result |
| --- | --- |
| `GET /health/live` | 200 live envelope unchanged |
| `GET /health/ready` | 200 when persistence pings; voice env omitted does not fail ready |
| `GET /health/voice` | `not_configured` / `configured` / `error` as specified |
| `POST /adapters/voice/inbound` valid simulator (secret + transcript) | 200 `{ message, locale, status: "ok" }` |
| Missing or wrong secret | 401 canonical envelope `UNAUTHORIZED` |
| Invalid / unsupported event | 400 `VOICE_PAYLOAD_INVALID` or `VOICE_EVENT_UNSUPPORTED` |
| Voice unconfigured | typed `VOICE_CONFIG` (not ready failure) |
| Oversized inbound body (>16 KiB) | 413 or 400 envelope `VOICE_PAYLOAD_INVALID`, secret not leaked |
| Overlong `inputText` / correlation ids | 400 `VOICE_PAYLOAD_INVALID` |
| Non-UUID `sessionId` | `VOICE_SESSION_INVALID`; raw id not logged |

Error bodies use the canonical `{ success: false, error: { message, code } }` envelope.

## Database

No HTTP contract case mutates domain rows. Post-suite public tables remain `0`.

## Outcome

- Status: PASS
- Blocking issues: none
