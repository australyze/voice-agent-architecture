# Verification Report - Unit Tests and Database

- Date: 2026-09-06
- Change: wom-voice-demo-ui
- Agent: evaluation-engineer
- Change types: ui | voice | code
- Context: `/verify` re-run after adversarial remediations

## Commands executed

- `npm test`
- `npm --prefix web test`
- `npm --prefix web run typecheck`
- `npm run typecheck` (root; not the quality threshold)
- `docker compose exec -T postgres psql -U voice_agent -d voice_agent -c "SELECT count(*) AS public_tables FROM pg_tables WHERE schemaname='public';"` (before and after)

## Results

- Root: 282 passed, 0 failed, 0 skipped (57 files, 36.75s)
- Web: 20 passed, 0 failed (6 files, 28.89s)
- Web typecheck: PASS
- Root typecheck: FAIL — pre-existing `exactOptionalPropertyTypes` errors in eval/LLM/tool/knowledge files, not introduced as the UI gate
- Paid APIs: none
- Tool calling as a new gate: N/A — no schema or executor change

## Database state

- Pre: `public_tables = 0`
- Post: `public_tables = 0`
- Restored: Yes — no mutations; no Session, ConversationTurn, or ToolCall tables

## Outcome

- Status: PASS
- Blocking issues: none
