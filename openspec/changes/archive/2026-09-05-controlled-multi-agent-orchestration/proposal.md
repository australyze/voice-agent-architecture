## Why

The runtime already proves one controlled agent path (`runtime-demo` plus tools, retrieval, eval, and observability). It does not yet prove that a second specialist can be added without becoming an unbounded agent network. HU #008 needs a **demonstration slice** so an AI Engineer can send one request through an orchestrator that owns routing, context, structured results, failures, and execution limits.

## What Changes

- Add a **deterministic orchestrator** (`runtime-orchestrator`) as the session owner for a programmatic demo path. The model does not choose topology.
- Add **two named specialists** (`demo-normalize`, `demo-classify`) that share a **common agent contract** and return **structured outputs** only.
- Route with a **closed intent** on the request (`normalize` | `classify`). Missing or unknown intent fails closed as `unroutable` (no fan-out, no LLM).
- Pass an orchestrator-owned **context packet** into the specialist. Specialists do not scrape shared memory or talk to each other.
- Enforce **hard limits**: `maxSpecialistInvocations = 1`, `maxSteps = 4`. Extra invocations fail as `budget_exceeded`.
- Fail closed on specialist invalid output, oversize or sensitive specialist fields, unexpected specialist errors, and LLM timeout. No fabricated success.
- Expose a **thin demo HTTP** ingress that uses the canonical error envelope, shared-secret auth when configured, rate limits, and tight body/`userText` bounds. **Do not** implement `lidr-specboot/docs/api-spec.yml` session CRUD.
- Add frozen eval suite `runtime-multi-agent` and require it on this change’s quality gate. Keep `runtime-demo` / knowledge / voice as regression.
- Emit reconstructable **route and handoff** spans on the existing observability port.

Recorded assumptions (from `/enrich-us` and architecture; not reopened here):

1. Users: AI Engineers. Channel: programmatic demo, not live voice or a customer product.
2. Happy path is **one request → one specialist**. Context passing is the packet, not a second hop.
3. Specialists use `LlmPort` only. **No new tools, no retrieval, no HITL actions.**
4. Voice inbound and `handleAgentTurn` / `runtime-demo` stay the existing product path.

## Non-goals

- Autonomous agents with unlimited steps, tools, or spawning.
- Swarms, voting, or arbitrary agent-to-agent communication.
- A production multi-agent product, SLAs, or customer rollout.
- LLM-owned routing or an “orchestrator agent” that plans a graph.
- New customer voice/chat UX, barge-in, telephony, or treating channel as the value.
- Operator / HITL UI.
- Implementing canonical `POST /sessions` or `POST /sessions/{sessionId}/turns`.
- New tools, RAG, or high-risk / irreversible / externally visible side effects.
- LangGraph, LangChain, runtime MCP expansion, or a new LLM/observability vendor.
- Replacing `runtime-demo` policy, prompts, tools, or retrieval-before-generation.

## Change types

`code` | `api` | `agent`

Not in this change: `tools` (no schema/executor change), `rag` (specialists do not retrieve), `voice` (inbound path unchanged), `ui`.

## Capabilities

### New Capabilities

- `multi-agent-orchestration`: Deterministic owner, common specialist contract, closed-intent routing, typed handoff packet, structured specialist results, fail-closed errors, execution limits, demo HTTP, and traces for route/handoff.

### Modified Capabilities

- `first-agent`: The catalog MAY include the orchestrator and two specialists. The **`runtime-demo` single-turn path remains the session owner for voice inbound** and MUST NOT grow a supervisor or typed handoff on that path.
- `application-runtime`: New orchestrated-turn use case and demo HTTP; voice adapter MUST NOT call it; new typed error codes.
- `runtime-observability`: Same `traceId` across demo HTTP, orchestration workflow, route/handoff workflow children, and specialist LLM spans.
- `evaluation-gate`: Quality gate MUST execute suite `runtime-multi-agent` for this change and keep existing suites as required regression.

## Impact

- **Code:** Application use case for orchestration (states, router, budgets, handoff). Two versioned specialist prompts and structured-output schemas. Domain types for intent, handoff, and orchestration errors. HTTP adapter route. Tests with fakes. Existing `handleAgentTurn` remains for `runtime-demo`.
- **APIs:** `POST /demo/orchestrate` (demo DTO + canonical `ErrorResponse`; header `x-demo-orchestrate-secret` when a demo or inbound secret is configured; 16 KiB body limit). Health and voice inbound stay regression-only. No session persistence tables.
- **Dependencies:** No new packages. No LangGraph, LangChain, Langfuse, or official LLM SDK in core.
- **Data:** In-process request-scoped owner aligned with `lidr-specboot/docs/data-model.md` Agent / AgentVersion / Session / Trace. No new PostgreSQL tables.
- **Eval / security:** New `eval/runtime-multi-agent` fixtures (mocked LLM). Adversarial cases for injection-does-not-add-tools. Independent `/adversarial-review` before archive (prompt trust / autonomy).
