# Verification Report - Unit Tests and Database (/verify)

- Date: 2026-09-06
- Change: `vapi-custom-tool-invocation`
- Agent: evaluation-engineer
- Phase: `/verify` (post-adversarial remediation-2)
- Change types: `code` | `api` | `tools` | `voice`

## Commands executed

```text
npx vitest run \
  src/application/execute-channel-tool-invocation.test.ts \
  src/adapters/http/voice-tools.test.ts \
  src/application/load-config.test.ts \
  src/application/handle-voice-turn.test.ts \
  src/adapters/persistence/memory-persistence.test.ts \
  eval/vapi-channel-tools/vapi-channel-tools.eval.test.ts \
  eval/wom-customer-service/wom-customer-service.eval.test.ts
```

Persistence adapters (supplemental):

```text
npx vitest run \
  src/application/execute-channel-tool-invocation.test.ts \
  src/adapters/persistence/memory-persistence.test.ts \
  src/adapters/persistence/postgres-persistence.test.ts \
  src/adapters/persistence/supabase-persistence.test.ts
```

## Results

| Suite | Passed | Failed | Skipped |
| --- | --- | --- | --- |
| Combined verify gate (7 files) | **58** | 0 | 0 |
| Persistence supplemental (4 files) | **16** | 0 | 0 |
| Runtime (combined) | ~4.2s | — | — |
| Runtime (persistence) | ~1.9s | — | — |

### Targeted unit highlights (remediation-2)

| Test | Result |
| --- | --- |
| `should_not_persist_attacker_fields_on_deny_or_invalid_args` | PASS — no attacker keys/values in `toolCalls` **or** `trace`; `argumentsRedacted: {}` on every tool span |
| `should_persist_empty_validated_arguments_on_success` | PASS — persisted args `{}` |
| `should_fail_closed_on_hard_timeout` | PASS — `tool_timeout` + timeout handle cleared in `finally` |
| `should_round_trip_invocation_source_on_getSessionReport` (Supabase, mocked fetch) | PASS — `invocation_source` → `invocationSource` |
| MemoryPersistence session report / ToolCall round-trip | PASS |

## Database state

- Pre: in-memory only (no hosted mutation)
- Post: in-memory only
- Hosted Supabase/Postgres: not mutated in this gate
- Migration present: `supabase/migrations/20260906220000_tool_call_invocation_source.sql`
- Postgres adapter: unavailable-without-credentials + optional ping when compose available (PASS)
- Supabase adapter: skip hosted checks when credentials absent; hydrate round-trip via mocked `fetch` (PASS)
- Restored: N/A (no durable writes)

## Outcome

- Status: **PASS**
- Blocking issues: none
