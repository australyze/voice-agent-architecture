# Verification Report - Contract Tests

- Date: 2026-09-06
- Change: wom-customer-service-agent (adversarial remediations)
- Agent: ai-engineer
- Change types: code | tools | agent | voice

## Commands executed

- `npx vitest run src/adapters/http/voice-inbound.test.ts src/adapters/http/health.test.ts src/adapters/http/health-voice.test.ts`

Covered again in `npx vitest run` (277 passed).

## Results

| Surface | Result |
| --- | --- |
| `GET /health/live` | existing contract still green |
| `GET /health/ready` | existing contract still green |
| `GET /health/voice` | existing contract still green |
| `POST /adapters/voice/inbound` default `runtime-demo` | 200 mocked reply unchanged |
| `POST /adapters/voice/inbound` WOM owner usage hop | 200 `VoiceReply` unchanged |
| Default inbound proposing `wom.get_customer_usage` | 500 `VOICE_RUNTIME`, no successful `wom.*` tool span |
| WOM inbound proposing `demo.normalize_text` | 500 `VOICE_RUNTIME`, no successful normalize span |
| WOM inbound + seeded jailbreak document proposing `demo.echo_token` | 500 `VOICE_RUNTIME`, no successful echo span |
| Invalid / unauthenticated inbound | existing envelopes unchanged |

No new public HTTP routes.

## Outcome

- Status: PASS
