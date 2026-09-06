# Verification Report — Session read auth

- Date: 2026-09-06
- Change: call-execution-persistence
- Agent: ai-engineer
- Change types: code, api, ui
- Scope: adversarial remediations (section 10)

## Commands executed

- `npx vitest run src/adapters/http/sessions.test.ts src/openapi-health.test.ts src/demo-web-isolation.test.ts`
- `npm test`
- `npm run web:test`
- `npm run web:typecheck`

## Results

- Backend: 296 passed, 0 failed (60 files)
- Web: 23 passed, 0 failed (6 files)
- Web typecheck: pass
- Paid APIs: none

## Contract coverage

- `GET /sessions` / `GET /sessions/{id}` without secret → 401 `unauthorized`, no transcript
- Missing server secret → 503 `orchestration_config`
- Authenticated list/detail → 200; malformed id → 400; unknown id → 404
- List `externalChannelId` filter returns only the matching session
- UI does not call `limit=1` when channel id is unknown; sends `x-demo-orchestrate-secret` when fetching; 401 → unavailable

## Database state

- Default suite used in-memory history
- Compose Postgres not mutated
- Restored: Yes

## Skipped (same reasons as section 8)

- Playwright — not wired
- Tool / agent / RAG / voice-conversation eval — no those change types
- Independent `/adversarial-review` — required again in a **fresh** session before archive

## Outcome

- Status: PASS
- Blocking issues: none
