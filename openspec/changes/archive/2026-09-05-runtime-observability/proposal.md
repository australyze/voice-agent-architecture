## Why

HU #007 needs an AI Engineer to reconstruct a full runtime execution (request → agent turn → LLM / tool / retrieval) from structured, secret-safe records. Today the observability port already receives `llm`, `tool`, `retrieval`, and `workflow` spans, but the default logging adapter drops names, latencies, and correlation fields, so a run cannot be rebuilt from logs. `lidr-specboot/docs/base-standards.md` requires observability by default and vendor-independent ports; this change closes that gap before more production paths ship.

## What Changes

- Treat observability as a **deterministic platform capability**: correlate, emit, redact. Not a new product agent.
- Require a **correlation identity** (trace id plus existing session / request / interaction ids when present) on every production span for a turn so one execution is reconstructable.
- Emit **parent spans** for the inbound request and the agent turn, with distinguishable child kinds (`llm`, `tool`, `retrieval`).
- Persist **latency** and **ok/error** on every emitted span; record **token counts and estimated cost** on LLM spans when the model path reports them (omit when unknown).
- Make the **default structured logger** write reconstructable **metadata** (ids, kind, name, latency, status, error class, consumption when present). It MUST NOT write secrets, raw utterances, tool argument values, or full retrieved chunk bodies. Retrieval spans carry a bounded query hash only. Voice-turn logs include ISO `occurredAt`.
- Keep emission behind the existing **observability port** so a later platform adapter can implement the same contract. Do **not** add a vendor SDK or a query UI.

Recorded assumptions (from `/enrich-us`; not reopened here):

1. Consumers this increment: AI Engineers (local, CI, staging/prod logs). No SRE console or support operator UI.
2. Default emit is structured JSON logs on every live process path; a memory collector remains tests-only.
3. “Consumption” means `tokenInput` / `tokenOutput` and optional estimated cost when the LLM adapter supplies them.
4. Voice inbound is the product request surface: join `sessionId` + `requestId` / `interactionId` with the generated `traceId`. Health routes stay untraced except existing error logs.
5. No new HTTP API to query traces. No PostgreSQL `Trace` / `Span` tables.

## Non-goals

- Product dashboard, operator trace UI, or complex visualization.
- Business analytics (containment, conversion, revenue).
- Enterprise 24/7 monitoring, paging, or SLO burn-down.
- Adding Langfuse or any observability vendor SDK as a core or default dependency.
- Implementing canonical trace-query HTTP from `lidr-specboot/docs/api-spec.yml`.
- Persisting traces in PostgreSQL.
- Changing agent policy, prompts, tools, retrieval quality, or voice media (barge-in, STT/TTS).
- Logging full user text, unredacted tool arguments, or retrieved chunk bodies on the default adapter.

## Change types

`code`

Not in this change: `api` (no new or changed public HTTP contracts), `tools` (no schema/executor change), `agent` (no prompt or policy change), `rag` (no retrieval quality change), `voice` (no media or turn-taking change), `ui`.

## Capabilities

### New Capabilities

- `runtime-observability`: Reconstructable, secret-safe execution records: correlation ids, structured default emit, distinguishable request / turn / LLM / tool / retrieval steps, latency and status, optional consumption fields, and a vendor-ready port with no vendor SDK.

### Modified Capabilities

- `provider-ports`: The observability port’s span contract MUST carry correlation identifiers and the reconstructable metadata fields this change requires.
- `application-runtime`: Agent-path emission MUST include parent request and turn spans; child spans MUST share the same correlation identity; the default adapter MUST emit reconstructable metadata without retaining payloads in process memory.
- `voice-interaction`: Voice-turn structured logs MUST include the same `traceId` used on child spans so a voice execution can be joined with agent-path records.

## Impact

- **Code:** Widen `TraceSpan` / `LogEvent` with correlation and optional consumption fields; pass ids from `handleVoiceTurn` / inbound HTTP into `handleAgentTurn`; emit `http` and `workflow` (agent turn) parent spans; teach `LoggingObservability` and `JsonLogger` to write reconstructable metadata after redaction. Tests assert structure, distinguishability, and redaction.
- **APIs:** No new routes. Inbound voice and health remain regression-only.
- **Dependencies:** No new packages. No Langfuse, OpenTelemetry vendor SDK, or official LLM SDK.
- **Data:** In-process / log-line shapes aligned with `lidr-specboot/docs/data-model.md` Trace and Span. No new tables.
- **Eval / security:** Deterministic unit tests are the quality gate. No new agent/RAG/voice eval datasets. Independent `/adversarial-review` before archive because the log surface expands (secret and PII leakage).
