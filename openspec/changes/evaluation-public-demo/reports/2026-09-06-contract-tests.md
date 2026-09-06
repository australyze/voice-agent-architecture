# Verification Report - Contract Tests

- Date: 2026-09-06
- Change: evaluation-public-demo
- Agent: evaluation-engineer (`/verify`, post-remediation)

## Commands executed

- `npx vitest run src/adapters/http/sessions.test.ts src/adapters/http/evaluations-unimplemented.test.ts src/openapi-health.test.ts`
- Covered within full `npx vitest run` (308 passed)

## Exercised

- Terminal session detail returns non-null `evaluation` (four dimensions + evidence)
- Operator recompute refreshes attributable result
- Public token auth (`x-demo-public-token`); missing → 401
- Public unscoped list → 403; scoped `externalChannelId` → 200
- Public recompute → 403; dual-accept of public token on operator header → 401
- Public token equal to inbound → 503 `orchestration_config`
- `POST/GET /evaluations/runs` unimplemented
- OpenAPI fragment includes evaluation, recompute (operator-only), public token notes

## Outcome

- Status: PASS
- Blocking issues: none
