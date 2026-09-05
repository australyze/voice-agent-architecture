---
name: instrument-ai-system
description: Use when adding or changing a production model, tool, or retrieval path that must emit traces (prompt/model versions, tokens, latency, tool args/results, retrieval hits, errors, retries, cost). Do not use to debug a live incident without adding instrumentation, or to configure a specific observability vendor as domain code.
author: LIDR.co
version: 1.0.0
---

# instrument-ai-system

Observability **by default**. Domain publishes a Trace port; vendor SDKs stay in adapters.

**Agent:** `ai-engineer`

## When not to use

- Post-mortem of an existing failure → `analyze-agent-failure` (then come back if fields are missing)
- Eval scores as a substitute for traces
- Importing an observability vendor into domain

## Inputs

- Code paths that call complete/embed/tool/retrieve
- OpenSpec change

## Steps

1. Load `docs/backend-standards.md` (Observability) and `docs/data-model.md` (Trace, Span, CostRecord).
2. Ensure each turn can reconstruct: trace/session/turn ids; prompt id+version; model id+version; tokens; cost; latency breakdown; tool name/args/result/error/retry; retrieval query/hits/scores/corpus version; fallback used.
3. Redact PII/secrets in payloads (store locators if needed).
4. Wire adapter (Langfuse or equivalent **optional**). No-op logger is allowed locally; production path must still emit the port.
5. Test: fake tracer receives a span on the happy path and on tool error.

## Outputs

- Trace/span emission on touched paths
- Spec note if new required fields

## Quality gates

- No untraced model/tool/retrieval on the production path you touched
- Args/results bounded

## Documents

- `docs/backend-standards.md`, `docs/data-model.md`, `docs/base-standards.md`

## OpenSpec

Part of `/apply` for agent/tool/RAG/voice model paths. `tasks.md` may require a trace smoke assertion.

## Combines with

- `implement-spec` (required companion)
- `analyze-agent-failure` (consumer)
- `verify-ai-implementation` may assert fields exist, not vendor UI

## Verification

| Check | Pass |
| --- | --- |
| New tool executor | Span with name, args, result/error, latency |
| Avoids | Domain import of vendor trace SDK |
