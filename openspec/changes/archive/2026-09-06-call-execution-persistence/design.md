## Context

See `proposal.md` for motivation. Constraints that shape this design:

- Hexagonal runtime under `src/`. `PersistencePort` is `{ ping() }` only (`src/domain/ports/persistence-port.ts`). Compose PostgreSQL on `127.0.0.1:5433` is used for readiness.
- Observability is `ObservabilityPort.emit(TraceSpan)` → `LoggingObservability` + `JsonLogger`. HU #007 explicitly did not persist Trace/Span tables.
- Voice inbound is `POST /adapters/voice/inbound` with `x-voice-inbound-secret`. Supported `eventType` today is only `transcript`. Correlation fields already exist: `traceId`, `sessionId`, `requestId`, `interactionId`, `externalChannelId`.
- Canonical model (`lidr-specboot/docs/data-model.md`) uses **Session**, not “Call”. Canonical HTTP (`lidr-specboot/docs/api-spec.yml`) uses `/sessions`. This repo has no `/api` prefix.
- Web demo talks to Vapi media only. `VITE_PUBLIC_API_BASE_URL` is declared and unused. Completed UI shows `TRACEABILITY_PLACEHOLDER`.
- Stakeholder mandate: Supabase PostgreSQL as hosted persistence provider. Core MUST stay vendor-independent (`lidr-specboot/docs/base-standards.md`).

## Goals / Non-Goals

**Goals:**

- Smallest persistence port that can write/read session history.
- One PostgreSQL technology; Supabase as hosted adapter; Compose remains local loopback.
- Persist the **same** spans the runtime already emits; keep stdout logging.
- Additive inbound lifecycle kinds; no invented Vapi JSON in domain.
- Read API aligned with canonical `/sessions`.
- Thin UI proof of retrieve; persist never owns live STT.

**Non-Goals:**

- New agent topology, tool schemas, RAG, or spoken confirmation/barge-in.
- Evaluation scoring or a visual trace explorer (HU #012).
- Dual-writing the same rows to Compose and Supabase in one process.
- OpenTelemetry or Langfuse.

## Decisions

### D1 — Deterministic workflow, not a new agent

**Decision:** Persist-and-query is a typed application use case. No LLM summarizes traces.

**Why:** The enriched story and `design-ai-system` require workflow when the path is fully specified.

**Alternative:** Generate a narrative report — rejected (hallucinated history).

### D2 — Topology and ports

**Decision:** Keep one session owner (`wom-customer-service-agent` or `runtime-demo`). No multi-agent change.

Ports:

| Port | This change |
| --- | --- |
| `PersistencePort` | Widen: `ping` + session upsert, turn/tool/event record, list, get report |
| `ObservabilityPort` | Unchanged contract; application **also** persists after emit |
| LLM / Tool / Retrieval / Speech | Unchanged |

Domain types stay vendor-free. Map ticket “Call” → Session (`channel = voice`).

**Alternative:** New `CallRepository` port beside ping — rejected as a second persistence idea unless the widened port becomes unreadable; implementers MAY group methods on one port object.

### D3 — Supabase is an adapter; Compose stays local PostgreSQL

**Decision:** SQL migrations in-repo (Supabase-compatible PostgreSQL). Hosted path: `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (backend `.env` only) implemented in `src/adapters/persistence`. Local path: apply the same SQL to Compose Postgres **or** use Supabase CLI; `DATABASE_URL` ping remains for `/health/ready` when hosted vars are absent. One process uses **one** history adapter (in-memory in tests, Supabase when hosted vars set, otherwise optional SQL adapter against `DATABASE_URL` if migrations were applied — default tests still use in-memory).

**Why:** Ticket forbids a second database **technology** and forbids leaking service-role to React. Existing Compose contract (`persistence-port`) must not be silently deleted.

**Alternative:** Replace Compose with Supabase-only — rejected; breaks documented local ping. Dual-write both engines — rejected.

### D4 — Relational mapping (logical, not vendor)

Align names with the data model; physical table names may be snake_case:

| Ticket concept | Data-model / API |
| --- | --- |
| calls | `sessions` |
| conversation_turns | `conversation_turns` (`session_id`, `index`, `role`, `text`, `created_at`) |
| tool_calls | `tool_calls` |
| execution_events | span-equivalent rows (`kind`, `name`, `trace_id`, `session_id`, timestamps, status, `latency_ms`, bounded metadata) |

Constraints: unique `external_channel_id` when not null; FKs from children to `sessions`; indexes on `external_channel_id`, `trace_id`, `sessions.created_at` / `started_at`, and child `session_id` (+ `execution_events` timestamp). Evaluation: no table; report field `evaluation: null`.

Roles stored for this HU: `user` | `assistant` (data-model also allows `system` | `tool`; do not persist those unless already produced).

Session status: map to `businessStatus` / `mediaStatus` independently. Suggested media: `idle` | `connecting` | `active` | `ended`. Business: `initiated` | `active` | `completed` | `failed` (ticket “ended” folds into media `ended` + business `completed`/`failed`).

### D5 — Idempotency without invented event ids

**Decision:** Deterministic idempotency key from **stable inbound metadata**: `eventType` + `externalChannelId` or `sessionId` + `occurredAt` (ISO) + `inputText` (transcript) or empty for lifecycle + optional inbound `requestId` when present. Unique constraint on that key. Tool/LLM events key on `traceId` + `spanId` (mint `spanId` if missing before persist, once per emit). Duplicates are no-ops.

**Why:** Vapi inbound contract today has no documented stable vendor event id. Ticket forbids a random id that changes every process.

**Alternative:** Always mint UUID event ids — rejected.

### D6 — Inbound lifecycle is additive and agent-free

**Decision:** Extend allowed `eventType` to `transcript` | `call_started` | `call_ended`. Same auth, skew, rate limit, 16 KiB cap. Lifecycle events upsert Session and an execution event; they **do not** call `handleAgentTurn`. Adapter maps **only** fields already on the simulator contract plus any **inspected** real Vapi server fields documented in `docs/adapters/vapi-inbound.md`. If a live Vapi event cannot be mapped without guessing, leave it unsupported and document the gap — do not invent a payload.

Out-of-order: upsert Session on first seen identity; `call_ended` may create then complete.

**Voice budgets:** persist MUST NOT extend `VOICE_TIMEOUT_MS`. Write after the spoken result is ready, or fail-open on persist (log `PERSISTENCE_UNAVAILABLE`). Live `mediaStatus` ≠ `businessStatus`.

**Alternative:** Infer end only from the browser — rejected (browser is not ingress). Change barge-in/STT — out of scope.

### D7 — Dual-write observability, do not replace logs

**Decision:** After `observability.emit(span)`, the application persistence use case records an execution event (and ToolCall rows for `kind === "tool"`). `LoggingObservability` stays default. No new span kinds. Reuse names already emitted (`http.voice.inbound`, `agent.turn`, `llm.completeStructured`, tool names, `retrieval.retrieve`).

HITL / tool risk: WOM tools remain `read`. Persistence does not raise autonomy.

### D8 — HTTP follows canonical sessions

**Decision:**

- `GET /sessions` — recent list (query `limit` default 20, max 100; optional `channel=voice`; optional `externalChannelId`). Requires demo-operator secret.
- `GET /sessions/{sessionId}` — full report. Requires the same secret.

Error envelope unchanged. No `/api/calls`. Project OpenAPI fragment updated to match; do not fork `lidr-specboot/docs/api-spec.yml` except by referencing it.

Report shape (provider-independent):

```text
sessionId, traceId, agentId, status, startedAt, endedAt?, durationMs?,
metrics { turnCount, toolCallCount, errorCount, ...optional },
transcript[], toolCalls[], trace[], evaluation: null
```

### D9 — Security model

**Decision:** Migrations enable RLS on history tables with **no** anonymous SELECT/INSERT policies. Service role (backend) bypasses RLS. Frontend never receives `SUPABASE_*`. Architecture tests: `web/` has no `@supabase` dependency; domain/application have no Supabase imports.

`GET /sessions` and `GET /sessions/{sessionId}` are **operator-authenticated**. Reuse the existing demo-orchestrate shared secret (`DEMO_ORCHESTRATE_SECRET`, falling back to `VOICE_INBOUND_SECRET`) via `x-demo-orchestrate-secret`. Missing server secret is CONFIG (503), not an open read. Wrong or absent header is 401. Loopback bind and RLS are complementary, not a substitute for route authZ. This is a demo-operator secret, not end-user IAM (still a non-goal).

Retention: document demo-lifetime synthetic transcripts; no sweeper. Treat a reachable session-history GET as a transcript disclosure channel.

### D10 — Thin UI proof

**Decision:** On `completed`, the UI may fetch a session report only when `VITE_PUBLIC_API_BASE_URL` is set **and** a provider-independent `sessionId` or `externalChannelId` is known from the media-client abstraction. Lookup is `GET /sessions?externalChannelId=` (authenticated) or `GET /sessions/{sessionId}`. **`GET /sessions?limit=1` MUST NOT be used as identity** — overlapping demos would disclose another session. If the channel id is unknown, show unavailable and do not call list-latest. Optional `VITE_DEMO_ORCHESTRATE_SECRET` is the browser copy of the demo-operator read secret (not service-role, not inbound-only if a distinct orchestrate secret is set). No call-history page.

### D11 — Testing and evaluation

**Decision:** In-memory `PersistencePort` for default tests. Opt-in integration when hosted env is present. Contract tests for GET routes. Architecture/secrets tests.

`create-evals`: **no new agent/prompt/tool/RAG/voice-conversation datasets**. Spoken UX is unchanged; persist of voice events is deterministic contract coverage. Existing WOM eval gate remains regression-only (must stay green).

Change types: `code`, `api`, `voice` (inbound kinds + persist), `ui` (thin fetch). Gates: unit+DB, HTTP contract, UI component tests (project Vitest, not a new Playwright stack unless already present). Skip tool-calling / agent eval / RAG eval / voice conversation eval with reasons. `/adversarial-review` before archive.

### D12 — HITL and budgets (product requirements)

- Recording awareness: keep existing microphone consent; docs state transcripts are stored synthetically for the demo lifetime.
- No new irreversible tools.
- Token/hop budgets unchanged (`maxToolHops` 1, existing voice timeout).
- Persist latency budget: fail-open; do not add more than incidental I/O after the reply is computed.

## Risks / Trade-offs

| Risk | Mitigation |
| --- | --- |
| Persist blocks speech | Fail-open after reply; do not include persist in the voice timeout budget |
| Duplicate webhooks | Deterministic unique keys |
| Inbound still transcript-only from live Vapi | Lifecycle kinds exist; mapping documented; upsert-on-first-transcript still creates a Session |
| Latest-session UI fetch is wrong if two demos overlap | Do not use `limit=1` as identity; require `sessionId` or `externalChannelId` |
| Transcript PII | Synthetic-only docs; no public table read; no raw vendor dump |
| Service-role leak | Backend env only; frontend architecture test |
| Compose vs Supabase confusion | One adapter per process; docs for apply-migrations |

## Migration Plan

1. Add SQL migrations; apply to Supabase project and/or local Postgres.
2. Ship port + in-memory + adapter behind config.
3. Enable persist on inbound/agent paths; ship GET routes.
4. Optional web fetch.
5. Rollback: unset hosted vars (writes become no-op or in-memory); UI shows unavailable; inbound `transcript` unchanged. Additive event kinds remain harmless if unused.

## Open Questions

None that change specs. Adapter authors inspect live Vapi server event names at apply time and record mappings only in `docs/adapters/vapi-inbound.md`.
