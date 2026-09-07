# Verification Report - Public Deploy

- Date: 2026-09-06
- Change: evaluation-public-demo

## Prepared in repo

- `render.yaml` (Render Web Service blueprint; secrets via dashboard)
- `web/vercel.json` (SPA rewrites)
- `docs/public-demo-deploy.md` (procedure)
- `.env.example` / `web/.env.example` updated with `DEMO_PUBLIC_TOKEN` / `VITE_DEMO_PUBLIC_TOKEN` names only

## Live deploy

- Render HTTPS backend: **not executed** — no Render account credentials / project linkage in this agent environment
- Vercel frontend: **not executed** — no Vercel token / project linkage
- Vapi Server URL update: **not executed** — requires candidate dashboard credentials (manual DoD)

## Outcome

- Status: BLOCKED for live hosts
- Do not mark HU AC-06 complete until a human deploys with dashboard access and records public URLs here (non-secret) plus a successful SessionReport round-trip
