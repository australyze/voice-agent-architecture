# Verification Report - Contract Tests

- Date: 2026-09-05
- Change: extensible-tool-runtime
- Agent: evaluation-engineer
- Gate: `/verify` (`openspec`) — post-adversarial remediation
- Change types: code | tools | agent

**api** is not a change type. HTTP **regression** only. `lidr-specboot/docs/api-spec.yml` `/tools/{toolName}/invoke` remains unimplemented.

## Commands executed

- `npx vitest run src/adapters/http/voice-inbound.test.ts src/adapters/http/health.test.ts src/adapters/http/health-voice.test.ts src/openapi-health.test.ts`

In-process Fastify `inject`. Fake LLM. No MCP server.

## Results

- 22 passed, 0 failed, 0 skipped (4 files)
- Runtime: ~3.8s

| Surface | Status |
| --- | --- |
| `GET /health/live` | 200 |
| `GET /health/ready` | 200 |
| `GET /health/voice` | 200 |
| `POST /adapters/voice/inbound` valid + secret | 200 |
| unauthenticated | 401 |
| invalid payload | 400 |

Canonical envelope unchanged. Default composition starts without MCP.

## Outcome

- Status: PASS
- Blocking issues: none
