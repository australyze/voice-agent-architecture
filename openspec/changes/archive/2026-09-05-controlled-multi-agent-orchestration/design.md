## Context

See `proposal.md` for motivation (HU #008). The live product path is `POST /adapters/voice/inbound` → `handleVoiceTurn` → `handleAgentTurn` for `runtime-demo` (structured `reply` | `tool`, retrieval before generation, one allowlisted tool). Observability already correlates `http` / `workflow` / `llm` / `tool` / `retrieval` on one `traceId`. Domain `AGENT_ERROR_CODES` covers the single-agent path. Quality gate required suites are `runtime-demo`, `knowledge`, and `voice`.

Constraints from `lidr-specboot/docs/base-standards.md` and `backend-standards.md`: deterministic control flow; one session owner; typed specialist messages; no vendor types in domain; eval and traces on every generative path; no LangGraph/LangChain in core.

## Goals / Non-Goals

**Goals:**

- Application-layer orchestrator as a typed use case (not a new port, not a graph library).
- Shared specialist I/O and a closed intent table that tests can assert.
- Reuse `LlmPort` and `ObservabilityPort` without `ToolPort` or `RetrievalPort` on this path.
- Keep `runtime-demo` and voice inbound behavior unchanged.

**Non-Goals:**

- Durable `Session` / `ConversationTurn` tables or canonical session HTTP.
- Optional second specialist hop “to prove context” (the packet is the proof).
- New HITL, tools, RAG, or voice media design.

## Decisions

### 1. Topology: deterministic owner + two generative specialists

**Choice:** Session owner `runtime-orchestrator` (no LLM). Specialists `demo-normalize` and `demo-classify` (LLM structured output only). One request → one specialist.

**Why:** `backend-standards.md` requires one owner, typed handoffs, and no unbounded recursion. An LLM router would hide topology in prose and fail the ticket’s “explicit routing” DoD.

**Alternative considered:** Reuse `runtime-demo` as one specialist. Rejected: that path owns tools + retrieval and is the voice session owner; mixing it into orchestration would blur HITL/tool risk and change `first-agent` more than needed.

**Alternative considered:** Second orchestrator-driven hop. Rejected: `maxSpecialistInvocations = 1` is the control demonstration; context passing is the packet.

### 2. Routing is a closed intent field

**Choice:** Request `intent`: `normalize` | `classify`. Unknown or missing → `unroutable`, no LLM.

**Why:** Inspectable, table-testable, no invented customer domain.

**Alternative considered:** Keyword classifier over `userText`. Rejected: ambiguous misses look like “smart routing” and invite prompt-shaped rules.

**Alternative considered:** Caller passes `specialistId`. Rejected: skips the orchestrator’s job and makes every client a router.

### 3. Application use case, no new ports

**Choice:** `handleOrchestratedTurn` (name may vary) in application. HTTP maps body → use case → DTO or canonical error envelope. Domain holds intent, handoff event, orchestration states, and error codes.

**Why:** Hexagonal rules already put orchestration in application. A new `OrchestrationPort` would imply a vendor or process boundary that does not exist.

**Alternative considered:** LangGraph adapter. Rejected: `base-standards` optional catalog; a four-step state machine does not justify it.

### 4. Separate orchestration result type

**Choice:** Orchestration success/failure is not `AgentTurnResult`. Shared string codes where they mean the same thing (`invalid_output`, `llm_timeout`, `llm_provider`). New codes `unroutable`, `budget_exceeded`, `specialist_failed` live on the orchestration error set and MUST NOT describe `runtime-demo` tool/retrieval failures.

**Why:** `AgentTurnResult` includes `sources` and tool-centric codes. Overloading it would force empty sources and fake tool semantics onto specialists.

### 5. Common specialist contract

**Choice:** Closed specialist output: `{ replyText, normalizedText }` XOR `{ replyText, label }`. No `tool` variant. Prompts `demo-normalize@1` and `demo-classify@1` with untrusted packing of user text + packet (same isolation pattern as `runtime-demo`).

**Why:** Structured outputs for anything the runtime parses (`base-standards`). Job fields make the two specialists observably different without new tools.

**HITL / risk:** Generation only. No `write` | `irreversible` | `external_comm`. Empty allowlist. Injection MUST NOT add tools or change the route.

### 6. Budgets

| Budget | Value |
| --- | --- |
| `maxSpecialistInvocations` | 1 |
| `maxSteps` | 4 (`receiving`, `routing`, `awaiting_specialist`, `completed` / `failed`) |
| Specialist / owner `maxToolHops` | 0 |
| LLM timeout | Existing configured LLM timeout |
| Invalid-output retry | At most one, same call |

States and actor `runtime` are recorded in memory on the request, same persistence stance as `first-agent`.

### 7. Ingress: `POST /demo/orchestrate`

**Choice:** Demo route only. Success DTO: `sessionId`, `intent`, `specialistId`, `replyText`, job field. Errors: `lidr-specboot/docs/api-spec.yml` `ErrorResponse`. Document the operation in the project OpenAPI next to health. Do not implement `/sessions` CRUD.

**Why:** Engineers need a request surface; implementing the full canonical session API is a different change.

**Alternative considered:** In-process tests only. Rejected: change type `api` and DoD “a request can be directed” are weaker without an HTTP contract.

### 7b. Demo ingress auth, budgets, and output bounds (adversarial remediation)

**Choice:** Reuse `VOICE_INBOUND_SECRET` unless `DEMO_ORCHESTRATE_SECRET` is set. Header `x-demo-orchestrate-secret`. When a secret is configured, missing or wrong secret is `unauthorized` (401). When no secret is configured and LLM mode is `http`, fail closed as `orchestration_config` (503). Fake-LLM local demo may omit the secret. Apply the same 16 KiB `bodyLimit` and inbound-style rate limiter as voice. Reject empty or oversize `userText` (`payload_invalid`) before any model call. Caller `sessionId` on HTTP MUST be a UUID or omitted (server-generated). `consumedInvocations` and `packedContext` stay use-case/test hooks and MUST NOT be HTTP fields.

Specialist `replyText` and job fields MUST be bounded (`2048` chars, same as `runtime-demo`) and fail closed on `containsSensitiveOutput` as `sensitive_output`. Unexpected specialist exceptions (not timeout/provider) MUST be `specialist_failed`. `maxSteps` is enforced with an invocation-style step budget (pre-consumed steps fail `budget_exceeded`). Packed `input` fallback is the untrusted packet only; system policy stays in the `system` message.

**Why:** `backend-standards.md` requires authorization and budgets on every generative HTTP route. The first apply left `/demo/orchestrate` open.

**Alternative considered:** Always require a secret even for fake LLM. Rejected for local fixture DX; HTTP LLM without a secret still fails closed.

**Alternative considered:** Drop `specialist_failed`. Rejected: the code is specified; unexpected invoke errors must emit it.

### 8. Observability reuse

**Choice:** Same `ObservabilityPort`. Parent `http` + `workflow` (orchestration). Children `workflow` named `orchestration.route` and `orchestration.handoff`. Specialist completions stay `llm` with `promptId` / version. No vendor SDK.

### 9. Evaluation

**Choice:** Frozen suite `eval/runtime-multi-agent` (`suiteName` `runtime-multi-agent`), fakes only. Add suite key to the quality gate. Baseline gains `runtime-multi-agent/<caseId>` members; existing `runtime-first-agent/*` stay required. No paid model. No voice-eval change.

Case ids: `normalize-happy-path`, `classify-happy-path`, `context-packet-reaches-specialist`, `unroutable-missing-intent`, `unroutable-unknown-intent`, `specialist-invalid-output-fail-closed`, `specialist-timeout-fail-closed`, `specialist-injection-does-not-add-tools`, `second-invocation-denied`, `specialist-oversize-output-fail-closed`, `specialist-canary-output-fail-closed`.

### 10. Change types

`code` | `api` | `agent`. Not `tools`, `rag`, `voice`, `ui`.

## Risks / Trade-offs

- **[Swarm drift]** Engineers copy the slice and add peer chat. → Spec and tests forbid specialist→specialist and cap invocations at 1.
- **[False production-ready]** Green demo mistaken for a live multi-agent product. → Demo HTTP prefix and non-goals stay explicit in docs.
- **[Packet leakage]** Untrusted text merged into system policy. → Packing tests assert system role is prompt bytes only.
- **[Error-code collision]** Orchestration codes leak into `runtime-demo`. → Separate result type; spec forbids reuse for tool/retrieval.
- **[Architecture tests]** Any “single agent identity” assertion must be scoped to the `runtime-demo` path, not catalog size.
- **[Latency/cost]** Two specialists are unused on one request by design. → Default one invocation; no fan-out.

## Migration Plan

- Additive catalog and route. No schema migration.
- Voice inbound wiring unchanged.
- Quality-gate baseline update is an explicit human-reviewed file edit in this change (new required members plus suite version).
- Rollback: remove the demo route and orchestrated use case; `runtime-demo` remains the product path.

## Open Questions

None that change specs, approach, or tasks. Specialist names, invocation cap, and ingress were locked in architecture.
