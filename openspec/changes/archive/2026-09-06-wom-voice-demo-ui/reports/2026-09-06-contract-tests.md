# Verification Report - Contract Tests

- Date: 2026-09-06
- Change: wom-voice-demo-ui
- Agent: evaluation-engineer
- Change types: ui | voice | code
- Context: `/verify` re-run after adversarial remediations; inbound is regression only (no new HTTP family)

## Commands executed

- `npx vitest run src/adapters/http/health.test.ts src/adapters/http/health-voice.test.ts src/adapters/http/voice-inbound.test.ts src/adapters/http/create-server-session-owner.test.ts src/openapi-health.test.ts src/adapters/observability/logging-observability.test.ts eval/voice/voice-eval.test.ts eval/wom-customer-service/wom-customer-service.eval.test.ts src/demo-web-isolation.test.ts src/secrets-hygiene.test.ts`

## Results

- **48 passed**, 0 failed (10 files)
- Covered: `GET /health/live`, `GET /health/ready`, `GET /health/voice`, `POST /adapters/voice/inbound` (default `runtime-demo` and WOM-owner mocked turns, unauthenticated/invalid paths), OpenAPI fragment still lists inbound and does not list a frontend webhook
- Canonical error envelope unchanged
- Isolation: domain/application stay free of React and `@vapi-ai/web`; `web/src` has no WOM executors/prompts and no `localStorage` / `sessionStorage`

## Observability smoke

Inbound mocked turns still emit reconstructable spans with shared `traceId` and agent/prompt identity (`wom-customer-service-agent` when that owner is selected). No new UI trace pipeline.

## Outcome

- Status: PASS
- Blocking issues: none
