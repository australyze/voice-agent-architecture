# Verification Report - Unit Tests and Database

- Date: 2026-09-06
- Change: `vapi-custom-tool-invocation`
- Agent: evaluation-engineer
- Phase: `/verify` (post-adversarial remediation-2)
- Change types: `code` | `api` | `tools` | `voice`

## Commands executed

- `npx vitest run src/application/execute-channel-tool-invocation.test.ts src/adapters/http/voice-tools.test.ts src/application/load-config.test.ts src/application/handle-voice-turn.test.ts src/adapters/persistence/memory-persistence.test.ts eval/vapi-channel-tools/vapi-channel-tools.eval.test.ts eval/wom-customer-service/wom-customer-service.eval.test.ts`
- `npx vitest run src/application/execute-channel-tool-invocation.test.ts src/adapters/persistence/memory-persistence.test.ts src/adapters/persistence/postgres-persistence.test.ts src/adapters/persistence/supabase-persistence.test.ts`

## Results

- Targeted / required suite: **58 passed**, 0 failed, 0 skipped
- Persistence supplemental: **16 passed**, 0 failed, 0 skipped
- Runtime: ~4.2s (combined), ~1.9s (persistence)

## Database state

- Pre: in-memory only
- Post: in-memory only
- Hosted DB: not mutated
- Migration: `20260906220000_tool_call_invocation_source.sql` present
- Restored: N/A

## Remediation coverage

### Round 1

- Persisted ToolCall args validated to `{}` on success
- Attacker fields absent on deny / invalid args (ToolCall arguments)
- Hard-timeout `clearTimeout` in `finally`

### Round 2 (this refresh)

- Channel path always emits `argumentsRedacted: {}` — full session report asserts no attacker keys/values in `toolCalls` **and** `trace`
- Supabase `getSessionReport` hydrates `invocation_source` → `invocationSource` (mocked fetch unit test)

## Outcome

- Status: **PASS**
- Blocking issues: none
