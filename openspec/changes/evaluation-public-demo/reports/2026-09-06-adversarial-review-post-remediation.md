## Adversarial review

**Scope**: OpenSpec change `evaluation-public-demo` (HU #012) — post-remediation independent pass after FAIL in `reports/2026-09-06-adversarial-review.md` and claimed fixes in `reports/2026-09-06-adversarial-remediation.md` / tasks 9.1–9.4. Surfaces: session call-evaluation persistence, `DEMO_PUBLIC_TOKEN` vs operator auth, recompute/lazy write, session list/detail IDOR, web DemoApp passcode path, docs/`.env.example`/`render.yaml`/OpenAPI secret hygiene, inbound trust boundary, evidence integrity. Quality re-verify PASS does not substitute this review. Live public deploy / E2E still BLOCKED (tasks 5.3–5.6, 7.10).

**Sources**: `openspec/changes/evaluation-public-demo/{proposal.md,design.md,tasks.md,specs/**}`; prior adversarial + remediation reports; `lidr-specboot/docs/{base-standards,backend-standards}.md` (Security / tools); implementation in working tree on `feature/evaluation-public-demo` (`src/adapters/http/{demo-orchestrate,create-server,sessions.test}.ts`, `src/application/{ensure-session-evaluation,get-session-report,score-session-call}.ts`, `web/src/pages/DemoApp.tsx`, `web/.env.example`, `docs/{public-demo-deploy,adapters/vapi-web-demo,evaluation-call,persistence}.md`, `openapi/health.yaml`, `render.yaml`, migration `20260906140000_session_call_evaluation.sql`). Diff vs `main` merge-base plus uncommitted remediation edits. No product patches in this pass.

**Assumption**: Gaps remain until evidence refutes them.

### Spec and task alignment

| Acceptance / non-goal | Status after remediation |
| --- | --- |
| Deterministic scorer; no LLM judge; distinct from quality-gate `EvaluationRun`; `POST /evaluations/runs` stays unimplemented | **Met** (unit + unimplemented contract) |
| Persist evaluation on terminal; default GET returns persisted; operator `?recompute=true` may refresh | **Met** (`ensureSessionEvaluation` on `call_ended`; operator recompute path) |
| `DEMO_PUBLIC_TOKEN` read-only: no recompute, no lazy evaluation write | **Met** (`allowWrite: role === "operator"`; public recompute → 403; public attach returns report as-is) |
| Public list requires `externalChannelId` (403 without) | **Met** (`assertPublicListScoped` + contract test) |
| No dual-accept of public token on operator header; public ≠ inbound/operator | **Met** (`authenticateSessionHistory`; `assertDemoPublicTokenDistinct` → 503; dual-accept 401 test) |
| Browser: passcode → `x-demo-public-token`; do not bake write/read tokens into `VITE_*` | **Met** (DemoApp passcode-only; `web/.env.example` + docs forbid bake; Vite env types omit demo secrets) |
| Public UI must not offer Re-evaluar / unfiltered latest list | **Met** (DemoApp omits `onReevaluate`; no `limit=1` identity fetch; tests) |
| Session history GETs rate-limited (inbound-style) | **Partial**: limiter runs **after** successful auth (same pattern as inbound); no session-history 429 contract test |
| Public deploy + E2E DoD | **Not met** (tasks 5.3–5.6 / 7.10 BLOCKED) — residual ops gap, not a local exploit |
| Non-goals: no new tools/agent/RAG/voice media; no multi-tenant IAM; no service-role in browser | **Held** |

**Underspecified / residual by design:** Shared `DEMO_PUBLIC_TOKEN` still authorizes `GET /sessions/{sessionId}` for **any** known UUID (spec allows it). Channel scoping is mandatory on **list** only. Multi-tenant IAM remains a non-goal — residual disclosure if passcode + foreign `externalChannelId` / session UUID leak.

**Prior FAIL findings — remediations checked:**

| Prior | Remediaton evidence | Outcome |
| --- | --- | --- |
| **Blocker** — docs invite `VITE_*` = inbound/operator | `docs/adapters/vapi-web-demo.md`, `docs/public-demo-deploy.md`, `web/.env.example` forbid bake; `assertDemoPublicTokenDistinct` + equal-secret 503 test | **Refuted** |
| **Major** — public token mutates via recompute / lazy write | `assertOperatorRecompute`; `allowWrite` only for operator; public recompute 403 test; DemoApp has no Re-evaluar | **Refuted** |
| **Major** — IDOR unscoped list + baked Vite token | Public unscoped list 403; DemoApp channel filter + passcode unlock tests; no `VITE_DEMO_*` token in example/types | **Refuted** (as stated); see residual Question on UUID/channel sharing |

### Findings

| Severity | Area | Finding | Evidence | Suggested fix |
| --- | --- | --- | --- | --- |
| **Minor** | Auth / rate limit | Session-history rate limiting applies only after successful authentication; failed passcode/token attempts are unlimited. No contract test asserts 429 on `/sessions`. Spec requires inbound-style limiting (inbound also limits post-auth), so this is residual brute-force risk if operators choose a short “passcode.” | `create-server.ts` auth then `sessionHistoryLimiter`; `sessions.test.ts` has no 429 case; UI labels token as passcode | **code** + **tests** + **docs**: rate-limit (or lockout) failed session-history auth; document high-entropy `DEMO_PUBLIC_TOKEN`; add 429 contract coverage |
| **Minor** | Tests / privilege matrix | Public recompute 403 is covered; missing explicit assert that a public GET with `evaluation: null` does **not** call `saveSessionEvaluation` (lazy write). Public token cannot authorize inbound/orchestrate is true by construction but not negatively tested. | `sessions.test.ts` public suite; `ensure-session-evaluation.ts` early return when `!allowWrite` | **tests**: spy/persistence assert no write on public detail; optional 401 matrix for inbound/orchestrate with public header |
| **Minor** | OpenSpec / docs drift | `design.md` Open Questions still frames dual-accept vs distinct header as deferrable polish, while D7 and code already require distinct `x-demo-public-token` and reject dual-accept. `public-demo-deployment` still allows “read-only demo token **or** passcode” in client env wording vs `wom-voice-demo` MUST NOT bake the token. Stale `public-deploy.md` report still mentions `VITE_DEMO_PUBLIC_TOKEN` names. | `design.md` L156–158; `specs/public-demo-deployment/spec.md` L9; `reports/2026-09-06-public-deploy.md` L10 | **OpenSpec** + **docs**/report: close Open Question; align deploy capability with passcode-only interview path; correct stale report wording |
| **Minor** | Deploy DoD | Live Render/Vercel/Vapi Server URL and public E2E remain BLOCKED; hosted secret/RLS posture unverified in this environment. | tasks 5.3–5.6, 7.10; `reports/2026-09-06-public-deploy.md` / `public-e2e` BLOCKED | **ops** + report: complete hosted DoD before claiming HU complete (does not reopen local Blocker/Majors) |
| **Question** | IDOR residual | With a valid public token, `GET /sessions/{uuid}` still returns any session by id; scoped list + hard-to-guess UUIDs mitigate mass scraping. Shared passcode + leaked `externalChannelId` still discloses that call’s report. Explicitly accepted by non-goal multi-tenant IAM and synthetic demo data — confirm residual risk acceptance before production-like hosting. | Spec “Read-only demo token can fetch a report”; `create-server.ts` detail has no channel ownership check | **OpenSpec**/ **docs**: document residual; optional **code** bind public detail to `externalChannelId` query match if risk is rejected |
| **Question** | RLS / hosted | Migration adds `evaluation jsonb` with anon deny-by-default unchanged; no hosted proof anon cannot read `evaluation`. | `20260906140000_session_call_evaluation.sql` | **ops**/test after migrate: one anon SELECT deny check |

**Refuted / not raised as open Blocker or Major:** prior VITE write-secret confused deputy; public mutating recompute/lazy write; unscoped public list + baked Vite read token; evidence fabrication of missing tool ids (scorer unit coverage); distinct public token authorizing inbound (inbound uses `x-voice-inbound-secret` only); service-role/DB URL in `web/.env.example`; tool/prompt/RAG expansion (out of change type).

### Verdict

**PASS WITH GAPS**

Prior **Blocker** and **Majors** are remediated with code, docs, and negative contract/UI evidence. No new Blocker or Major found. Archiving is **advisable from a security perspective** with residual Minors/Questions accepted; product HU remains incomplete until hosted deploy/E2E (5.3–5.6 / 7.10) are closed. Quality-gate PASS ≠ hosted DoD.

### Recommended next steps (before archive)

1. Accept residual shared-token disclosure (Question) in change docs, or optionally bind public detail reads to `externalChannelId`.
2. Close Minor gaps as polish: failed-auth rate limit + session 429 test; lazy-write non-mutation assert; sync `design.md` Open Questions and `public-demo-deployment` bake language; fix stale deploy report wording.
3. Complete hosted deploy + E2E + RLS spot-check before marking HU AC complete (ops), then archive.
4. Do not treat this PASS WITH GAPS as permission to reintroduce `VITE_*` write/read secrets or public recompute.
