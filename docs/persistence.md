# Session persistence and observability

HU #011 stores reconstructable voice-session history behind the persistence port. The AI runtime does not import Supabase.

```text
Application / inbound / agent turn
        ↓
PersistencePort
        ↓
Memory (tests / local process)  or  Supabase adapter
        ↓
PostgreSQL
```

## Live versus historical

During a call the interviewer hears and sees media from the Vapi Web SDK. After inbound processing, the backend upserts a Session (`channel = voice`), conversation turns, tool calls, and execution events. The database is **not** the live transcript source.

## Setup

1. Create a Supabase project (or apply the same SQL to local Compose Postgres).
2. Run `supabase/migrations/20260906120000_session_history.sql`.
3. Set backend-only `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env` (see `.env.example`). Never put these in `web/.env`.
4. Keep `DATABASE_URL` for `/health/ready` ping (Compose on `127.0.0.1:5433`).
5. One process uses one history adapter: hosted Supabase when both variables are set, otherwise in-process memory plus Postgres ping.

## Security

- Tables enable row-level security with **no** anonymous policies. The service role (backend) bypasses RLS. RLS and `LISTEN_HOST=127.0.0.1` do **not** authorize HTTP reads.
- Session-history GETs require `x-demo-orchestrate-secret`. Missing server secret is 503; wrong or missing header is 401. A reachable history GET is a transcript disclosure channel.
- The browser may call those routes only with `VITE_DEMO_ORCHESTRATE_SECRET` (demo-operator secret, never `SUPABASE_SERVICE_ROLE_KEY`).
- Transcripts may contain spoken content. This demo stores **synthetic** data for the **demo lifetime**. There is no retention sweeper.

## API

- `GET /sessions` — recent lightweight list; optional `externalChannelId` filter; requires demo-operator secret
- `GET /sessions/{sessionId}` — report with transcript, tool calls, chronological trace, metrics, and `evaluation: null`; same secret

See `openapi/health.yaml` and `lidr-specboot/docs/api-spec.yml` session resources.

## Deferred to HU #012

Evaluation scores, LLM-as-judge, visual execution explorer, and a dedicated call-history page. The report reserves `evaluation: null` for that work.

`lidr-specboot/docs/` methodology was not changed.
