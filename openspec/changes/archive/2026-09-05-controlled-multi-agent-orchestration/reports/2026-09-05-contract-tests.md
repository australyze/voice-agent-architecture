# Verification Report - Contract Tests

- Date: 2026-09-05
- Change: controlled-multi-agent-orchestration
- Agent: evaluation-engineer
- Change types: api
- Gate: `/verify`

## Commands executed
- `npx vitest run src/adapters/http/orchestrate.test.ts src/adapters/http/health.test.ts src/adapters/http/health-voice.test.ts src/adapters/http/voice-inbound.test.ts src/adapters/http/evaluations-unimplemented.test.ts src/openapi-health.test.ts`

## Results
- Files: 6 passed
- Tests: **30 passed**, 0 failed (4.54s)

Asserted against the project OpenAPI fragment (`openapi/health.yaml`) and the canonical error envelope from `lidr-specboot/docs/api-spec.yml`. Canonical session CRUD in that spec remains unimplemented (change non-goal).

| Surface | Result |
| --- | --- |
| `POST /demo/orchestrate` success | 200 + DTO (`sessionId`, `intent`, `specialistId`, `replyText`, job field) |
| Missing intent | 400 `unroutable` |
| Missing secret when inbound/demo secret is set | 401 `unauthorized`, no LLM |
| Body over 16 KiB | 413 |
| Empty `userText` | 400 `payload_invalid` |
| Non-UUID `sessionId` | 400 `session_invalid` |
| HTTP LLM, no secret | 503 `orchestration_config` |
| HTTP `consumedInvocations` / `packedContext` | 400 `payload_invalid` |
| `GET /health/live`, `/ready`, `/voice` | regression pass |
| `POST /adapters/voice/inbound` | still `runtime-demo` / `handleAgentTurn` |
| `POST /sessions`, session turns, evaluation HTTP | 404 |

## Outcome
- Status: PASS
- Blocking issues: none
