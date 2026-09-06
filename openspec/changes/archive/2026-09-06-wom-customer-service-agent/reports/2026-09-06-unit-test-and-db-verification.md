# Verification Report - Unit Tests and Database

- Date: 2026-09-06
- Change: wom-customer-service-agent
- Agent: evaluation-engineer
- Change types: code | tools | agent | voice
- Note: Re-run during `/verify` after adversarial remediations

## Commands executed

- Targeted (12 files): `npx vitest run` on WOM tools, domain policy, `handle-agent-turn`, voice inbound, health, persistence, WOM/runtime-demo/knowledge/voice evals, quality-gate eval
- Required suite: `npx vitest run`
- `docker compose exec -T postgres psql -U voice_agent -d voice_agent -c "SELECT count(*) AS public_tables FROM pg_tables WHERE schemaname='public';"`

## Results

- Targeted: **107 passed**, 0 failed (12 files, 4.45s)
- Required suite: **277 passed**, 0 failed, 0 skipped (56 files, 16.46s)
- Paid APIs: none

## Database state

- Pre/Post: `public_tables = 0`
- Restored: Yes — no Session, ConversationTurn, ToolCall, or EvaluationRun tables
- Persistence ping: PASS (`postgres-persistence.test.ts`)

## Outcome

- Status: PASS
- Blocking issues: none
