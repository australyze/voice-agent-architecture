# Verification Report - Unit Tests and Database

- Date: 2026-09-06
- Change: wom-customer-service-agent (adversarial remediations)
- Agent: ai-engineer
- Change types: code | tools | agent | voice

## Commands executed

- Targeted: `npx vitest run src/adapters/tools/wom-tools.test.ts src/application/handle-agent-turn.test.ts src/adapters/http/create-server-session-owner.test.ts src/adapters/http/voice-inbound.test.ts eval/wom-customer-service/wom-customer-service.eval.test.ts`
- Required suite: `npx vitest run`
- `docker compose exec -T postgres psql -U voice_agent -d voice_agent -c "SELECT count(*) AS public_tables FROM pg_tables WHERE schemaname='public';"`

## Results

- Targeted: **66 passed**, 0 failed (5 files)
- Required suite: **277 passed**, 0 failed, 0 skipped (56 files)
- Paid APIs: none

## Database state

- Pre/Post: `public_tables = 0`
- Restored: Yes — no Session, ConversationTurn, ToolCall, or EvaluationRun tables
- Persistence ping: covered by `postgres-persistence.test.ts` in the full suite

## Tool calling (bound port)

- `createSessionOwnerToolPort(RUNTIME_DEMO_ALLOWLIST)` denies `wom.get_customer_usage` without `handleAgentTurn`
- `createSessionOwnerToolPort(WOM_CUSTOMER_SERVICE_ALLOWLIST)` denies `demo.normalize_text` without `handleAgentTurn`
- Extra identity fields still `tool_invalid_args` with directory body not run (`toolBodyRan` honored in WOM eval)

## Outcome

- Status: PASS
- Blocking issues: none
