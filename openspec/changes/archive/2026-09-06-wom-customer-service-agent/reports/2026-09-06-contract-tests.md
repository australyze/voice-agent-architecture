# Verification Report - Contract Tests

- Date: 2026-09-06
- Change: wom-customer-service-agent
- Agent: ai-engineer
- Change types: code | tools | agent | voice

No new OpenAPI family. Regression on existing HTTP via Fastify `inject` (same envelope as `lidr-specboot/docs/api-spec.yml`).

## Commands executed

- `npx vitest run src/adapters/http/voice-inbound.test.ts src/composition/app.test.ts src/adapters/http/create-server-session-owner.test.ts`

## Results

| Surface | Outcome |
| --- | --- |
| `GET /health/live` | 200 `{ status: "alive" }` |
| `GET /health/ready` | existing readiness tests (Compose up) |
| `GET /health/voice` | existing voice health tests |
| `POST /adapters/voice/inbound` default `runtime-demo` | 200 agent reply, locale `es` |
| `POST /adapters/voice/inbound` `sessionOwner=wom-customer-service-agent` | 200 `VoiceReply` after mocked `wom.get_customer_usage` |
| Unauthenticated inbound | 401 `UNAUTHORIZED` |
| Unconfigured inbound | `VOICE_CONFIG` (existing) |
| Invalid payload | `VOICE_PAYLOAD_INVALID` |

Canonical error envelope: `success: false`, `error.code`, `error.message`. Secrets not echoed.

## Outcome

- Status: PASS
- Blocking issues: none
