# Adversarial review — evaluation-public-demo

- Date: 2026-09-06
- Agent: security-reviewer (independent pass; no fixes in this session)
- Branch: `feature/evaluation-public-demo`
- Quality `/verify`: PASS (does not substitute for this review)

## Adversarial review

**Scope**: OpenSpec change `evaluation-public-demo` (HU #012) — session call evaluation, `DEMO_PUBLIC_TOKEN` / session GET auth, evaluation evidence integrity, secret hygiene in web/deploy configs, IDOR on session reports, recompute abuse, Vapi inbound trust boundary, RLS, passcode UX. Working tree on the feature branch; live public deploy still blocked.

**Sources**: `openspec/changes/evaluation-public-demo/{proposal,design,tasks,specs/*}`; `lidr-specboot/docs/{base-standards,backend-standards}.md`; implementation under `src/`, `web/`, `supabase/`, `docs/`, `.env.example`, `render.yaml`, `openapi/health.yaml`; deploy reports (`public-deploy` / `public-e2e` = BLOCKED).

**Assumption**: Gaps remain until evidence refutes them. No patches applied in this pass.

### Spec and task alignment

| Claim | Evidence |
| --- | --- |
| Deterministic scorer, no LLM judge, distinct from quality-gate `EvaluationRun` | Met: `score-session-call.ts` + unit tests; `POST /evaluations/runs` remains unimplemented |
| Persist evaluation on terminal + optional recompute | Met: `ensureSessionEvaluation` on `call_ended`; `?recompute=true` |
| `DEMO_PUBLIC_TOKEN` is **read-only** (design D7; OpenAPI “Read-only”) | **Not met**: same auth authorizes GET that **writes** evaluation on recompute and lazy null backfill |
| Session GETs require operator secret **or** public token; missing/wrong → 401 | Met: contract tests |
| Browser must not get inbound / service-role / DB secrets | Partial: hygiene tests OK for service-role/DB; **docs still invite inbound/operator collapse into `VITE_`** |
| Passcode UX when public demo requires read token | Partial: UI path exists; preferred `VITE_DEMO_PUBLIC_TOKEN` skips passcode; **no DemoApp passcode tests** |
| Vapi inbound trust boundary unchanged | Met for header routing: still `x-voice-inbound-secret` only; public token does not authorize inbound **unless its value equals the inbound secret via misconfiguration** |
| Public deploy + E2E DoD | **Not met**: tasks 5.3–5.6 / 7.10 open; reports BLOCKED |

### Findings

| Severity | Area | Finding | Evidence | Suggested fix |
| --- | --- | --- | --- | --- |
| **Blocker** | Secret hygiene / confused deputy | Deploy/adapter docs still tell operators that `VITE_DEMO_ORCHESTRATE_SECRET` may be the same value as `DEMO_ORCHESTRATE_SECRET` or **`VOICE_INBOUND_SECRET`**. Combined with `resolveDemoOrchestrateSecret = demoOrchestrateSecret ?? inboundSecret`, baking that value into the Vite bundle collapses **voice write auth** into a public client env. Spec forbids inbound secret in the browser. | `docs/adapters/vapi-web-demo.md` L34; `docs/public-demo-deploy.md` L18; `web/.env.example`; `demo-orchestrate.ts` L28–29 | **docs** (+ optionally **code**): only `VITE_DEMO_PUBLIC_TOKEN` for browser reads; forbid documenting write secrets as `VITE_*`; reject/warn if public token equals inbound/operator; contract test for recommended config separation |
| **Major** | Auth scope / recompute abuse | `DEMO_PUBLIC_TOKEN` is labeled read-only but authorizes **mutating** `sessions.evaluation` via `?recompute=true` (and first-read lazy score when evaluation is null). No rate limit on session GET/recompute. UI “Re-evaluar” uses the public-token path. | Design D7; OpenAPI “Read-only”; `create-server.ts` L164–173; `ensure-session-evaluation.ts`; `DemoApp.tsx` | **code** + **tests** + **OpenSpec**: restrict recompute (and ideally first-write backfill) to operator secret; public token = GET persisted only; rate limits; negative contract tests |
| **Major** | IDOR / session reports | Any holder of `DEMO_PUBLIC_TOKEN` can call unfiltered `GET /sessions` then `GET /sessions/{id}` for **any** session — transcript, tools, evaluation. Preferred public path embeds that token as `VITE_DEMO_PUBLIC_TOKEN` → extractable from the JS bundle; passcode gate never runs. Spec non-goal of multi-tenant IAM does not make world-readable history acceptable on a public host without an explicit residual-risk acceptance. | `authenticateSessionHistory` identical for list+detail; `DemoApp.resolveConfiguredReadSecret` | **code** + **OpenSpec**/ **docs**: bind public reads to known `externalChannelId` only (no global list for public token); prefer passcode-only (no bake) for interviews |
| **Minor** | Passcode UX vs AC | With `VITE_DEMO_PUBLIC_TOKEN` set, UI never enters `needs_passcode`. Task 4.3 claims passcode tests; `DemoApp.test.tsx` has no passcode / forged-evaluation cases. | `wom-voice-demo` passcode requirement; `DemoApp.tsx` | **tests** + **docs**/UI: default deploy = empty Vite token + passcode entry |
| **Minor** | Deploy config gap | `render.yaml` / deploy docs omit `LISTEN_HOST` (defaults `127.0.0.1`). Live deploy/E2E BLOCKED — hosted secret hygiene unverified. | `load-config.ts`; `render.yaml`; public-deploy/e2e reports | **docs** + finish 5.3–5.6 / 7.10 before archive |
| **Minor** | Test gaps on privilege split | Contract tests prove public token can GET; none prove it **cannot** recompute, orchestrate, or inbound. | `sessions.test.ts` | **tests**: negative auth matrix |
| **Question** | RLS after evaluation column | Migration keeps RLS with no anon policies. No hosted proof anon cannot read `evaluation`. | `20260906140000_session_call_evaluation.sql` | **ops**/test: one hosted RLS deny check after migrate |
| **Question** | Dual-accept on same header | Public token accepted via `x-demo-orchestrate-secret` when values match. Footgun if secrets collide. | `demo-orchestrate.ts` L50–54 | **docs** + optional **code**: require distinct header for public token only |

**Refuted / not raised:** evidence fabrication of missing tool ids (unit coverage); Vapi inbound accepting a *distinct* public token (does not); service-role/DB URL in `web/.env.example`; tool allowlist / prompt expansion (out of change type).

### Verdict

**FAIL**

Archiving is **not** advisable. One Blocker and two Majors remain; public deploy/E2E are still blocked.

### Recommended next steps (before archive)

1. Remediate **Blocker** (docs + config guidance): never set `VITE_*` to inbound/operator write secrets; browser read path = `DEMO_PUBLIC_TOKEN` / passcode only.
2. Remediate **Major** (read-only token): operator-only `recompute` (+ decide lazy backfill); rate limits; negative contract tests.
3. Remediate **Major** (IDOR): no global list for public token; channel-scoped reads; avoid shipping token in the Vite bundle for interviews.
4. Close passcode AC with tests; finish hosted deploy DoD; spot-check RLS.
5. Re-run **independent** `/adversarial-review` after remediation `/apply` in a **new** session. Quality-gate PASS ≠ security PASS.
