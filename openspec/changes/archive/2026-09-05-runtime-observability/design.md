## Context

See `proposal.md` for motivation. Observed today:

- `ObservabilityPort.emit(TraceSpan)` already exists. Kinds include `llm`, `tool`, `retrieval`, `http`, `workflow`, `voice`.
- `handleAgentTurn` emits `llm`, `tool`, and `retrieval` spans with latency and status, but **no** `traceId`, parent, session, or consumption fields (`src/domain/ports/observability-port.ts`).
- `LoggingObservability` writes only `operation=trace.{kind}`, `outcome`, and `status`. It drops name, latency, and identifiers (`src/adapters/observability/logging-observability.ts`).
- `handleVoiceTurn` writes correlatable `voice.turn` logs (`sessionId`, `requestId`, `interactionId`) on `LoggerPort`, not on the observability port, and does not share a `traceId` with child spans.
- `LlmPort.completeStructured` returns the decision object only; no usage fields. Fake LLM is the default path.
- `package-vendors.test.ts` and `architecture.test.ts` forbid observability vendor SDKs in domain/application and manifests.
- Canonical Trace/Span shapes live in `lidr-specboot/docs/data-model.md`. PostgreSQL is not required for traces on day one.

Change types: **`code` only**. Topology stays one session-owner agent (`runtime-demo`). This increment is a **deterministic workflow**, not a new agent. HITL: none. Budgets: emit is in-process and synchronous to the existing logger; do not add network export on the turn path.

## Goals / Non-Goals

**Goals:**

- One generated `traceId` per inbound agent-path execution, joined with existing voice correlation ids.
- Parent `http` + `workflow` spans; distinguishable children; default JSON emit of reconstructable metadata.
- Optional usage on the LLM result copied onto LLM spans when present.
- Tests prove structure, distinguishability, and redaction.

**Non-Goals:**

- Proposal non-goals (dashboard, vendor SDK, trace HTTP, Trace tables, agent/RAG/voice behavior).
- Changing retrieval query packing or logging full utterances (default emit omits query text).
- OpenTelemetry as a required runtime.

## Decisions

### D1 — Deterministic instrumentation, not an agent

**Decision:** Observability is a typed emit path on existing use cases. No LLM judges traces. No new product agent.

**Why:** `/enrich-us` and `design-ai-system`: the job is fully specified (record, redact, correlate). `base-standards.md`: deterministic when possible.

**Alternatives:** Ship Langfuse as the product. Rejected: vendor becomes the kernel.

**Change types:** `code`. Not `api` | `tools` | `agent` | `rag` | `voice` | `ui`.

### D2 — Widen the existing port; do not add a second telemetry API

**Decision:** Extend `TraceSpan` with `traceId`, optional `parentSpanId`, `sessionId`, `requestId`, `interactionId`, `spanId`, `tokenInput`, `tokenOutput`, `cost`, `retryCount`. Keep `ObservabilityPort.emit`. Extend `LogEvent` so the default adapter can write those metadata fields through `JsonLogger` (already redacts string fields).

**Why:** `provider-ports` already promised a later adapter without rewriting domain. `data-model.md` Span fields match this set.

**Alternatives:** New `TracePort` plus logger. Rejected: two sources of truth. Adopt OpenTelemetry API in domain. Rejected: vendor types in the core.

### D3 — Assign `traceId` at the voice/application boundary

**Decision:** `handleVoiceTurn` generates a `traceId` (UUID) for every handled turn, including early session-invalid failures when possible. It passes the id plus inbound correlation into `handleAgentTurn`. It emits (or asks the HTTP adapter to emit) the `http` parent span around inbound handling, writes `traceId` on `voice.turn` logs, and `handleAgentTurn` emits the `workflow` parent plus existing children with `parentSpanId` = turn span id.

```text
POST /adapters/voice/inbound
        │
        ▼
handleVoiceTurn          # traceId, voice.turn log, http span
        │
        ▼
handleAgentTurn          # workflow + retrieval + llm + tool spans
        │
        ▼
ObservabilityPort.emit → LoggingObservability → JsonLogger
```

Health `/health/*` stays without parent spans.

**Why:** Voice inbound is the only product request that runs the agent. Correlation already lives on `VoiceTurn`.

**Alternatives:** HTTP middleware generates ids for every route. Rejected for this increment: health noise, no agent path. Persist traces in PostgreSQL. Rejected: proposal assumption 5.

### D4 — Default adapter emits metadata, never payloads

**Decision:** `LoggingObservability` MUST log reconstructable metadata (`traceId`, kind, name, status, latencyMs, errorCode, session/request/interaction ids, tokens/cost when set). It MUST NOT log `argumentsRedacted`, `resultBounded`, or any user/query text. Retrieval spans MUST carry a bounded `queryHash` only, never raw or secret-redacted caller speech. `MemoryObservability` remains the test collector. Process default still MUST NOT grow an in-process span list.

**Why:** Adversarial review: a future collecting adapter would otherwise export utterances. Hashing on emit closes that without logging speech.

**Alternatives:** Log redacted query text. Rejected. Leave raw query on the port for collectors. Rejected after review.

### D5 — Optional usage on the LLM port; never invent numbers

**Decision:** Allow optional `usage?: { tokenInput, tokenOutput, cost? }` on structured-completion results (or an equivalent sidecar on the existing return). `handleAgentTurn` copies usage onto the LLM span when present. Fake LLM and current HTTP adapter omit usage unless they already have a trustworthy count. Do not estimate tokens in the domain with a heuristic.

**Why:** Proposal assumption 3. Invented cost would fail “outcomes, not guesses.”

**Alternatives:** Always compute tokens with a local tokenizer. Rejected: false precision, extra dependency.

### D6 — No vendor adapter and no new eval datasets

**Decision:** Keep a logging adapter as production default. Do not add Langfuse. Quality gate is unit tests (structure, redaction, correlation join) plus existing architecture/secrets hygiene. Skip agent/RAG/voice eval suites as change-type gates. Name `/adversarial-review` before archive because logs are an exfiltration surface.

**Why:** `create-evals` does not apply to deterministic-only changes. `openspec-tasks-mandatory-steps.md`: select gates by type; observability smoke still applies.

**Alternatives:** Require a live OTLP export in CI. Rejected: paid/networked observability in unit tests is forbidden.

## Risks / Trade-offs

- **[PII / secrets in richer logs]** → Default emit is metadata-only; `JsonLogger` / `redactSecrets` stay on all string log fields; tests fail on secret shapes and raw utterances.
- **[Latency of tracing]** → Synchronous in-process `emit` to stdout JSON only; no network flush on the turn path.
- **[Correlation drift between voice logs and spans]** → Single `traceId` created in `handleVoiceTurn` and passed down; tests assert equality.
- **[False consumption metrics]** → Omit usage when unknown; do not invent.
- **[Breaking log consumers]** → Adding fields is additive; `operation` values stay `trace.{kind}` and `voice.turn`.

## Migration Plan

- Incremental, backward-compatible field additions. Restart the process to pick up the default adapter. No DB migration. Rollback is revert; leftover extra JSON fields are harmless.
- After apply: update README / development logging notes (`lidr-specboot/docs/documentation-standards.md`).

### D7 — Adversarial remediations (post-apply)

**Decision:** (1) Retrieval `argumentsRedacted` is `{ queryHash }` only. (2) Composed `JsonLogger` + `LoggingObservability` MUST redact secret-shaped `requestId`. (3) `voice.turn` includes ISO `occurredAt` from the turn (not omitted). Join documented as `traceId`. Fresh-session `/adversarial-review` remains after this pass.

**Why:** Close PASS WITH GAPS items that are in this increment’s emit path.

## Open Questions

None that change specs or tasks. Retention of log files in hosting environments stays an operations concern outside this change. A collecting vendor adapter still needs its own review.
