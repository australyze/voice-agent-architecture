# Adversarial remediation

- Date: 2026-09-06
- Change: wom-voice-demo-ui
- Agent: ai-engineer
- Change types: ui | voice | code
- Source review: `reports/2026-09-06-adversarial-review.md` (PASS WITH GAPS, Minors)

## Commands executed

- `npm --prefix web test` — **20 passed**, 0 failed
- `npx vitest run src/demo-web-isolation.test.ts src/secrets-hygiene.test.ts` — **7 passed**, 0 failed

## Fixes

| Review item | Change |
| --- | --- |
| Consent overclaim | UI uses `MICROPHONE_CONSENT`: microphone audio is sent to the voice provider to transcribe; this app does not persist audio |
| Public key / origin | `docs/adapters/vapi-web-demo.md` documents origin allowlisting, unpublished interview keys, and HU #012 reopening public-key risk |
| AgentCard honesty | Status is **Listo para iniciar** plus copy that it does not verify the runtime or `VOICE_SESSION_OWNER` |
| Connecting hang | After 8s without `call-start`, UI enters `error` with `SAFE_CALL_ERROR`, calls `stop()`, ignores late `call-start`, start is enabled again |
| Unbounded transcript | Final utterance text truncated to 2048 characters; hook keeps at most 50 messages |
| Loose tool events | `normalizeToolActivity` accepts only exact types `function-call` or `tool-calls` |
| Storage test gap | `web/src/secret-hygiene.test.ts` and `src/demo-web-isolation.test.ts` forbid `localStorage` / `sessionStorage` in non-test `web/src` |
| Google Fonts CDN | Removed `@import` of Inter; Tailwind uses the system sans stack |

## Spec review (8.4)

Updated `wom-voice-demo` scenarios mapped to tests:

- Idle status does not claim a verified backend — `DemoApp.test.tsx` (`Listo para iniciar`, runtime disclaimer)
- Honest microphone consent — `DemoApp.test.tsx` (`MICROPHONE_CONSENT`; old HU-only copy absent)
- Connecting timeout 8s → error + retry — `use-voice-agent.test.tsx`, `DemoApp.test.tsx`
- Transcript bounded 2048 / 50 and no web storage — `normalize.test.ts`, `use-voice-agent.test.tsx`, secret-hygiene + isolation
- Tool activity only for exact `function-call` / `tool-calls` — `normalize.test.ts`

Unchanged scenarios (idle chrome, suggestions, lifecycle, safe errors, inbound isolation) remain covered by the existing suite.

## Live Vapi browser smoke (8.6)

- Status: **SKIP**
- Reason: no gitignored `web/.env` with `VITE_VAPI_PUBLIC_KEY` and `VITE_VAPI_ASSISTANT_ID`
- Not a CI failure. Still required for human Definition of Done — follow `docs/adapters/vapi-web-demo.md`

## Outcome

- Status: PASS (automated remediations). Live smoke SKIP pending operator credentials.
- Residual: public-key cost risk remains for a **local interview** only; public host is HU #012.
