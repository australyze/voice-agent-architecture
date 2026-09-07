# Adversarial remediation (round 2)

- Date: 2026-09-06
- Change: `vapi-custom-tool-invocation`
- Source review: `reports/2026-09-06-adversarial-review.md` (FAIL — 2 Majors after first remediation)

## Fixes applied

| Finding | Action | Evidence |
| --- | --- | --- |
| **Major** — attacker argument **key names** in session `trace` via `argumentsRedacted` | Channel path always emits `argumentsRedacted: {}` (removed key-preserving `redactArgs` on failure). Tests use `PersistingObservability` and assert empty `argumentsRedacted` on trace + no attacker tokens in `toolCalls`/`trace`. | `execute-channel-tool-invocation.ts`; `should_not_persist_attacker_fields_on_deny_or_invalid_args` |
| **Major** — Supabase drops `invocation_source` on hydrate | Map `tool.invocation_source` → `invocationSource` in `getSessionReport` tool loop | `supabase-persistence.ts`; `should_round_trip_invocation_source_on_getSessionReport` |
| Docs | Note empty `argumentsRedacted` on channel path + Supabase round-trip | `docs/adapters/vapi-custom-tools.md` |

## Left as documented residuals

- Shared `VOICE_INBOUND_SECRET`
- Default `VOICE_REASONING_OWNER=runtime` misconfig risk
- No toolCallId idempotency / AbortSignal on hanging executors
- Spoken honesty after tool failure (Vapi prompt)

## Verification re-run

```text
npx vitest run src/application/execute-channel-tool-invocation.test.ts \
  src/adapters/http/voice-tools.test.ts \
  src/adapters/persistence/supabase-persistence.test.ts \
  eval/vapi-channel-tools
```

Result: **4 files, 23 tests passed** (2026-09-06).

## Archive readiness

Both Majors from the independent re-review addressed in code + tests. Re-run `/adversarial-review` (or dated confirmation) before `/opsx-archive`.
