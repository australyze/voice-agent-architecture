## Why

HU #011 needs an interviewer to reconstruct a completed WOM demo voice call from durable backend data. Today persistence is ping-only, observability is ephemeral stdout JSON (HU #007), and the demo UI only shows a client-side summary plus a “Ver trazabilidad” placeholder. Without a replaceable history store, HU #012 cannot attach evaluation to real execution evidence.

## What Changes

- Treat persistence as a **deterministic persist-and-query workflow**, not a new product agent. The live voice path stays the existing inbound + agent loop.
- Expand the existing **persistence port** beyond `ping` so application code can record and read **Session** (voice call), **ConversationTurn**, **ToolCall**, and execution-trace records using `lidr-specboot/docs/data-model.md` names. Domain MUST NOT import Supabase or SQL types.
- Implement a **Supabase PostgreSQL adapter** as the replaceable persistence provider (stakeholder mandate). Keep **one PostgreSQL technology**: hosted/demo history uses Supabase; local Compose Postgres remains the loopback engine for readiness and the same SQL migrations when not using hosted Supabase. Do not add Redis, a second product database, or a second tracing product.
- Make voice inbound **persistence-aware** for already-normalized events. Keep HU #002 auth (`x-voice-inbound-secret`). Persist **call start/end** via new **provider-independent** `VoiceTurn.eventType` values (`call_started`, `call_ended`) in addition to `transcript`. Map only real Vapi server fields inside the adapter; do not invent vendor payloads or store raw Vapi objects as the application model.
- Persist **user and assistant turns**, **allowlisted tool executions** (status, latency, bounded args/results, existing error classes), and **LLM/tool/workflow spans already emitted** on `ObservabilityPort`. **Do not replace** `JsonLogger` / `LoggingObservability`.
- Keep **one correlation identity**: reuse `traceId`, `sessionId`, `requestId`, `interactionId`, `externalChannelId`. One Vapi call id maps to one Session when present.
- Ingest **idempotently** and tolerate **out-of-order** lifecycle events without crashing.
- Expose a **read-only session report API** aligned with `lidr-specboot/docs/api-spec.yml` (`GET /sessions`, `GET /sessions/{sessionId}`), not `/api/calls` and not a `/api` prefix (this repo has none). Responses are a frontend-friendly report (metadata, transcript, tool calls, chronological trace, deterministic metrics) with an **empty evaluation slot** for HU #012.
- Wire HU #010 **only enough** to prove retrieve after hang-up (replace the placeholder with loaded / unavailable / empty report). Fetch only by known `sessionId` or `externalChannelId`, never latest-global. Authenticate session-history GETs with the existing demo-operator secret. No full observability UI.
- Document **demo retention** (synthetic data, demo-lifetime keep, no elaborate engine), **RLS** so anonymous Supabase keys cannot read history, and **backend-only** `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`.
- Tests use an **in-memory persistence** implementation. Real Supabase adapter tests are **opt-in** and MUST NOT fail the default suite when credentials are absent.

Recorded assumptions (from `/enrich-us`; not reopened here):

1. Users: interviewer and demo operator. Channel: live voice unchanged; this HU is historical read.
2. Compose Postgres vs Supabase: same PostgreSQL technology; Supabase is the hosted adapter; Compose stays local/loopback; tables are not dual-written to two engines in one process.
3. Call start/end: extend the **normalized** inbound contract; adapter mapping inspects real Vapi events and MUST NOT invent payload shapes.
4. Retention: demo-lifetime, documented, synthetic-only; no retention sweeper.
5. Placeholder: thin completed-call fetch is in scope; list UI, visual trace, and evaluation are HU #012.
6. “Call” in the ticket is the data-model **Session** (`channel = voice`).

## Non-goals

- HU #012 evaluation scoring, LLM-as-judge, datasets, or the interview-facing report UI.
- New agent, prompt, tool schema, RAG corpus, or spoken UX (barge-in, confirmation, STT/TTS).
- Replacing HU #007 JSON logging or adding OpenTelemetry / Langfuse as a second system of record.
- Live transcript sourced from the database; audio file storage.
- Real WOM systems or real customer PII.
- Supabase Auth, Realtime, or Edge Functions.
- Kubernetes, Redis, Kafka, warehouses, BI, enterprise IAM.
- Browser access to service-role or database credentials.
- Default CI depending on a live Supabase project.

## Change types

`code`, `api`, `voice`, `ui`

Not in this change: `tools` (no schema/executor/allowlist change; persist existing executions), `agent` (no prompt or policy change), `rag`.

## Capabilities

### New Capabilities

- `session-persistence`: Durable, correlatable session (call) history: relational records for sessions, conversation turns, tool calls, and execution events; idempotent ingest; deterministic metrics; read-only session list and session report contracts; evaluation association reserved but empty.

### Modified Capabilities

- `persistence-port`: Persistence is no longer ping-only. Application writes and reads session history through the port. Supabase is an adapter. Domain stays engine-independent.
- `runtime-observability`: Existing span/log emission remains. Production spans that already carry correlation MUST also become durable queryable records for the same `traceId` / `sessionId`. No second span vocabulary.
- `voice-interaction`: Transcript and lifecycle events persist onto the session; out-of-order and duplicate events are safe; live media is not sourced from persistence.
- `voice-channel-adapter`: Inbound accepts provider-independent `call_started` and `call_ended` in addition to `transcript`, with the same auth and without vendor types in domain.
- `application-runtime`: Agent-turn LLM and tool steps persist through the persistence port without importing Supabase.
- `wom-voice-demo`: Completed-call placeholder MAY be replaced by a thin backend report fetch; live transcript remains the media client; no service-role in the browser.

## Impact

- **Code:** Widen `PersistencePort`; in-memory test adapter; Supabase adapter; SQL migrations; persist from voice-turn and agent-turn use cases; Fastify `GET /sessions` and `GET /sessions/:sessionId`; optional web fetch via `VITE_PUBLIC_API_BASE_URL`.
- **APIs:** New read routes following canonical session resources and the existing error envelope. Inbound voice gains two lifecycle event types (additive, not a break of `transcript`).
- **Dependencies:** Official Supabase client allowed **only** in `src/adapters/persistence`. No Supabase package in `web/`. No Vapi types in domain.
- **Data:** Materialize Session, ConversationTurn, ToolCall, and Trace/Span-equivalent execution events. Evaluation tables are out of scope; report MAY include `evaluation: null`.
- **Eval / security:** Deterministic unit, contract, and persistence tests. No new agent/RAG eval datasets. Independent `/adversarial-review` before archive (PII in transcripts, secret leakage, public table read).
