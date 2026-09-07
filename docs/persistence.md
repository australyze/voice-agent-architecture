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

During a call the interviewer hears and sees media from the Vapi Web SDK. After inbound processing, the backend upserts a Session (`channel = voice`), conversation turns, tool calls, and execution events. Tools invoked through `POST /adapters/voice/tools` persist the same `ToolCall` shape with `invocationSource: vapi_custom_tool`. The database is **not** the live transcript source.

## Setup

1. Create a Supabase project (or apply the same SQL to local Compose Postgres).
2. Run `supabase/migrations/20260906120000_session_history.sql`.
3. Set backend-only `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env` (see `.env.example`). Never put these in `web/.env`.
4. Keep `DATABASE_URL` for `/health/ready` ping (Compose on `127.0.0.1:5433`).
5. One process uses one history adapter: hosted Supabase when both variables are set, otherwise in-process memory plus Postgres ping.

## Security

- Tables enable row-level security with **no** anonymous policies. The service role (backend) bypasses RLS. RLS and `LISTEN_HOST=127.0.0.1` do **not** authorize HTTP reads.
- Session-history GETs require `x-demo-orchestrate-secret` (operator) or `x-demo-public-token` (`DEMO_PUBLIC_TOKEN`). Missing server secret is 503; wrong or missing credentials is 401. Public list requires `externalChannelId`. A reachable history GET is a transcript disclosure channel.
- The browser may call those routes only after the interviewer enters `DEMO_PUBLIC_TOKEN` as a passcode (`x-demo-public-token`). Never put inbound, operator, or service-role secrets in `web/` env.
- `GET /sessions` — recent lightweight list; optional `externalChannelId` filter; public token **requires** `externalChannelId`
- `GET /sessions/{sessionId}` — report; `?recompute=true` is **operator-only**
- Transcripts may contain spoken content. This demo stores **synthetic** data for the **demo lifetime**. There is no retention sweeper.

## API

- `GET /sessions` — recent lightweight list; operator may omit filter; public token **requires** `externalChannelId`
- `GET /sessions/{sessionId}` — report with transcript, tool calls, chronological trace, metrics, and session call `evaluation` (null while non-terminal or when public read before persist); `?recompute=true` is **operator-only**

See `openapi/health.yaml`, [evaluation-call.md](./evaluation-call.md), and [public-demo-deploy.md](./public-demo-deploy.md).

`lidr-specboot/docs/` methodology was not changed.
