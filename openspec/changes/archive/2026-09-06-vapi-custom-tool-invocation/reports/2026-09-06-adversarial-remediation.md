# Adversarial remediation

- Date: 2026-09-06
- Change: `vapi-custom-tool-invocation`
- Source review: `reports/2026-09-06-adversarial-review.md` (FAIL — Major on ToolCall args)

## Fixes applied

| Finding | Action | Evidence |
| --- | --- | --- |
| **Major** — raw inbound ToolCall arguments | Persist only validated empty object via `persistedToolArguments()`; never store deny/invalid attacker fields | `execute-channel-tool-invocation.ts`; tests `should_not_persist_attacker_fields_on_deny_or_invalid_args`, `should_persist_empty_validated_arguments_on_success` |
| Minor — missing wrong-secret / oversized tests | Added `should_reject_wrong_secret_without_leaking_secret` (401) and `should_reject_oversized_body_without_leaking_secret` (413) | `voice-tools.test.ts` |
| Minor — uncleared hard-timeout timer | `clearTimeout` in `finally` after `Promise.race` | `execute-channel-tool-invocation.ts` |
| Docs | Note validated `{}` args on channel ToolCalls | `docs/adapters/vapi-custom-tools.md` |

## Left as documented residuals

- Shared `VOICE_INBOUND_SECRET` for inbound + tools (design D3)
- Default `VOICE_REASONING_OWNER=runtime` misconfig risk (Render sets `vapi`)
- No `toolCallId` idempotency / freshness on tools route
- Spoken honesty after tool failure remains Vapi-prompt owned

## Verification re-run

```text
npx vitest run src/application/execute-channel-tool-invocation.test.ts \
  src/adapters/http/voice-tools.test.ts eval/vapi-channel-tools
```

Result: **3 files, 21 tests passed** (2026-09-06).

## Archive readiness

Major cleared. Proceed to post-remediation adversarial note; archive only if that note is PASS or PASS WITH GAPS (residuals only).
