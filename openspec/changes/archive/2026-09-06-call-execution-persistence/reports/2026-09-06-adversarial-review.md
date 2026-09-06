## Adversarial review

**Scope**: OpenSpec change `call-execution-persistence` after section 10 remediations (session-history auth + no latest-global UI fetch). Surfaces: `GET /sessions*`, inbound persist, Supabase/RLS, thin demo fetch.

**Sources**: Current `proposal.md`, `design.md` D8–D10, `session-persistence` / `wom-voice-demo` specs, `tasks.md` §10; `lidr-specboot/docs/base-standards.md` and `backend-standards.md` Security; working tree vs `origin/main` (`eaeeae08`, still uncommitted). `/verify` quality PASS was not treated as security evidence.

**Independence note**: Same conversation as implement/verify. Prior Majors were assumed still open until the current handlers and tests refuted them.

### Spec and task alignment

Acceptance now includes: operator-authenticated session GETs (`x-demo-orchestrate-secret`; 401/503); UI fetch only by known `sessionId` / `externalChannelId`; no `limit=1` identity; RLS with no anon policies; no hosted-admin keys in `web/`; inbound lifecycle still secret-gated and agent-free.

Non-goals unchanged: enterprise IAM, HU #012, new tools/prompts.

Prior FAIL items mapped to spec: D9/D10 and session-persistence “Unauthenticated history read is rejected”; wom-voice-demo “Latest-global list is not used as identity”.

### Findings

| Severity | Area | Finding | Evidence | Suggested fix |
| --- | --- | --- | --- | --- |
| ~~Major~~ (closed) | HTTP authZ | Unauthenticated history read | `authenticateSessionHistory` runs before list/get in `create-server.ts`. `sessions.test.ts` `should_reject_unauthenticated_list_and_detail` asserts 401 and that `hola` is absent. No-secret server is 503, not open. | None. Criterion refuted. |
| ~~Major~~ (closed) | Cross-session UI | Latest-global `limit=1` | `DemoApp.tsx` returns unavailable unless `baseUrl`, `secret`, and `externalChannelId` are all set. `fetchSessionReportByChannelId` queries `externalChannelId=` only. Test `should_not_fetch_latest_global_session_when_channel_id_is_unknown` asserts `fetch` is not called. | None. Criterion refuted. |
| Minor | Secret coupling | Session-read secret **falls back** to `VOICE_INBOUND_SECRET`. Docs tell operators `VITE_DEMO_ORCHESTRATE_SECRET` may be the same value. A bundled Vite secret then authorizes **inbound writes** (inject transcripts) as well as listing every session. | `resolveDemoOrchestrateSecret`; `docs/adapters/vapi-web-demo.md` “same value as … or `VOICE_INBOUND_SECRET`”; D9 fallback. | **Docs + OpenSpec**: require a distinct `DEMO_ORCHESTRATE_SECRET` for browser reads; do not recommend copying the inbound secret into `VITE_*`. Optional **code**: do not resolve session-read from inbound when a Vite client is expected. |
| Minor | Shared-secret blast radius | Anyone who extracts the Vite header can still call unfiltered `GET /sessions` (limit 20) and every detail id. No per-session ACL. Expected for one demo-operator secret; residual if the UI is tunneled. | Authenticated list without `externalChannelId` returns all recent sessions (`sessions.test.ts` happy path). | **Docs**: say a public/tunneled demo + bundled secret is a transcript disclosure channel. Keep `LISTEN_HOST=127.0.0.1` unless a distinct non-inbound secret is set. |
| Minor | Persistence integrity | Hosted adapter still swallows all PostgREST errors into in-memory fallback (misconfig looks successful in-process). | `supabase-persistence.ts` `withFallback` empty `catch`. Unchanged from prior review. | **Code**: do not silent-fallback when hosted is configured. |
| Minor | Schema / public table read | RLS on, no anon policies, inspect-only. No `FORCE ROW LEVEL SECURITY`; no automated anon-key SELECT. | Migration SQL; skip-if-unset adapter test. | **Tests**: opt-in anon SELECT empty. **SQL**: `FORCE RLS` if Compose becomes history. |
| Question | PII / bundled secret | Transcripts stored in clear by design. Browser still downloads full detail JSON even though UI only shows “loaded”. Channel id is not mapped from live Vapi (`create-vapi-client.ts` emits bare `call-start`), so live hang-up stays unavailable — that **reduces** accidental disclosure today. | `fetchSessionReportByChannelId` detail GET; Vapi adapter. | Document; map a stable channel id later without inventing vendor payloads. |
| Question | `SUPABASE_URL` | Any `http`/`https` URL accepted (SSRF shape if env is attacker-influenced). | `load-config.ts`. | Host allowlist later. |

**Considered and not re-opened:** inbound start/end still require `x-voice-inbound-secret` when voice is configured; strict inbound schema; tool persist stays redacted/bounded; no `@supabase` in domain/application/`web/`; no new tools, MCP, or autonomy; `secretsMatch` is timing-safe.

### Verdict

**PASS WITH GAPS**

Prior Blocker/Major items are refuted by code and tests. Remaining issues are Minor or Question. Archiving is **advisable** if the team accepts the documented residual (bundled demo-operator secret, silent hosted fallback, inspect-only RLS). Quality `/verify` PASS still does not replace this verdict.

### Recommended next steps (before archive)

1. Optional but cheap: stop documenting “copy inbound secret into Vite”; prefer a distinct `DEMO_ORCHESTRATE_SECRET`.
2. Archive is allowed on this verdict. Do not treat leftover Minors as a reason to skip `/opsx-archive` unless product wants them in this HU.
3. Do not implement remediations in this review pass.
