# Verification Report - Contract Tests

- Date: 2026-09-05
- Change: runtime-first-agent
- Agent: evaluation-engineer
- Gate: `/verify` (`openspec`) — post-remediation re-run
- Change types: code | tools | agent | voice

## Commands executed

- `npx vitest run src/adapters/http/voice-inbound.test.ts src/adapters/http/health.test.ts src/adapters/http/health-voice.test.ts src/openapi-health.test.ts src/composition/app.test.ts` → 25 passed (5 files)
- `npx vitest run eval/voice/voice-eval.test.ts` (included in eval bundle; 5 voice cases)

In-process Fastify `inject` (no live vendor). Mocked/fake LLM only.

## Results

| Surface | Status | Notes |
| --- | --- | --- |
| `GET /health/live` | 200 | unchanged |
| `GET /health/ready` | 200 | persistence ping; voice/LLM not required |
| `GET /health/voice` | 200 | `not_configured` / `configured` |
| `POST /adapters/voice/inbound` valid + secret + fresh `occurredAt` | 200 | agent reply text, locale `es`, `status=ok` |
| unauthenticated | 401 | envelope `UNAUTHORIZED` |
| invalid payload | 400 | `VOICE_PAYLOAD_INVALID` |
| unsupported event | 400 | `VOICE_EVENT_UNSUPPORTED` |
| unconfigured | 503 | `VOICE_CONFIG` |
| stale `occurredAt` | 400 | `VOICE_STALE`; agent not invoked |
| authenticated over quota | 429 | `VOICE_RATE_LIMITED`; agent not invoked |

Canonical envelope: `success: false`, `error.message`, `error.code`. No stack traces or secrets.

`openapi/health.yaml` still documents health + inbound only. It does not contain `/sessions`. Canonical `lidr-specboot/docs/api-spec.yml` session/tool HTTP remains unimplemented (**api** N/A).

## Outcome

- Status: PASS
- Blocking issues: none
