# Adversarial remediation — evaluation-public-demo

- Date: 2026-09-06
- Change: `evaluation-public-demo`
- Prior review: `reports/2026-09-06-adversarial-review.md` (**FAIL**)
- This pass: implement recommended next steps (not a substitute for a new independent `/adversarial-review`)

## Mapping

| Finding | Remediation |
| --- | --- |
| **Blocker** — docs invite `VITE_*` = inbound/operator write secret | Docs + `web/.env.example` passcode-only; no baked read/write tokens; `assertDemoPublicTokenDistinct`; OpenAPI dual-accept language removed |
| **Major** — public token mutates via recompute / lazy write | Operator-only `recompute` + `allowWrite`; public 403 on recompute; negative tests in `sessions.test.ts` |
| **Major** — IDOR via unscoped list + baked Vite token | Public list requires `externalChannelId` (403 otherwise); DemoApp uses passcode + channel filter only |
| **Minor** — passcode AC / tests | `DemoApp` passcode unlock + reject tests; Re-evaluar not shown on public path |
| **Minor** — `LISTEN_HOST` | `render.yaml` sets `0.0.0.0`; deploy docs mention bind |
| **Minor** — negative auth matrix | Public cannot dual-accept on operator header; cannot recompute; equal-secret → 503 |
| **Question** — RLS / hosted | Still deferred with live deploy tasks 5.3–5.6 / 7.10 |

## Evidence (automated)

- Backend: `npx vitest run src/adapters/http/sessions.test.ts` — PASS (incl. scoped list, recompute 403, dual-accept 401, equal-secret 503)
- Web: `npx vitest run src/pages/DemoApp.test.tsx src/secret-hygiene.test.ts` — PASS

## Residual / still blocked

- Live Render / Vercel / Vapi Server URL update and public E2E (tasks 5.3–5.6, 7.10) — need host credentials
- Hosted RLS anon deny on `evaluation` column — ops spot-check after migrate
- **Archive gate:** re-run independent `/adversarial-review` in a **new** session after this remediation

## Verdict of this remediation apply

Code/docs remediations for Blocker + Majors (local) are implemented. Change remains incomplete for public DoD until hosted deploy; security archive still requires a fresh adversarial PASS.
