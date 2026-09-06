# Public demo deployment (HU #012)

Deploy topology for the interview portfolio demo:

| Layer | Host | Notes |
| --- | --- | --- |
| Frontend | Vercel | Vite build of `web/` |
| Backend | Render Web Service | Long-running Node (`npm start`), HTTPS |
| Database | Supabase Cloud | Same SQL migrations as local; service role backend-only |
| Voice Server URL | Vapi dashboard | Point assistant Server URL at Render inbound |

Alternatives for the backend: Railway or Fly.io. **Do not** use Vercel serverless as the recommended backend host (cold start can drop early voice events).

## Environment variable names

Backend (Render): see root `.env.example` — include `DEMO_PUBLIC_TOKEN`, `DEMO_ORCHESTRATE_SECRET`, `VOICE_INBOUND_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, LLM/voice settings as needed. Never commit values.

Frontend (Vercel): see `web/.env.example` — `VITE_VAPI_PUBLIC_KEY`, `VITE_VAPI_ASSISTANT_ID`, `VITE_PUBLIC_API_BASE_URL` (Render origin). Do **not** bake `DEMO_PUBLIC_TOKEN`, `DEMO_ORCHESTRATE_SECRET`, or `VOICE_INBOUND_SECRET` into Vite env. Interviewers type the passcode in the UI.

## Render

1. Create a Web Service from this GitHub repo.
2. Build: `npm ci && npm run build` (adjust if the root build already covers runtime).
3. Start: `npm start` with `LISTEN_HOST=0.0.0.0` so the process accepts public traffic.
4. Set env vars in the Render dashboard (including distinct `DEMO_PUBLIC_TOKEN` ≠ inbound/operator secrets).
5. Apply Supabase migrations (`supabase db push` or SQL editor) including `20260906140000_session_call_evaluation.sql`.
6. Confirm `GET https://<service>/health/live`.

Optional blueprint: `render.yaml` in the repo root (service name and build/start only; secrets stay in the dashboard).

## Vercel

1. Import the repo; set Root Directory to `web` (or configure monorepo build).
2. Build command: `npm run build` (web package).
3. Output: `dist`.
4. Set Vite public env vars.
5. Confirm the public URL loads the WOM demo shell.

## Vapi Server URL (manual DoD)

1. Open the Vapi assistant used by the demo.
2. Set Server URL to `https://<render-host>/adapters/voice/inbound`.
3. Ensure the inbound secret matches `VOICE_INBOUND_SECRET`.
4. Do **not** mutate the assistant from CI.
5. Optional: a one-off local script with a scoped API key may PATCH the assistant; never commit the key.

## Cold start

Render free tier may sleep. Before an interview, open `/health/live` once to warm the process.

## Interview demo procedure

1. Open the Vercel public URL.
2. If prompted, enter the demo passcode (backend `DEMO_PUBLIC_TOKEN` — never the inbound write secret).
3. Click **Hablar con WOM AI** and allow the microphone.
4. Say a supported scenario, e.g. «¿Cuántos gigas me quedan?», «¿Cuánto tengo que pagar este mes?», or «¿Está funcionando mi servicio?».
5. Confirm a tool-backed spoken answer.
6. End the call.
7. Confirm the completed card shows backend history and the four evaluation dimensions with Spanish verdicts.
8. Optionally click **Re-evaluar**.
