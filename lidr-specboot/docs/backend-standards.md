---
description: Backend standards for production AI agent systems, including hexagonal architecture, tool calling, RAG, voice adapters, evaluation, observability, and security.
globs: ["src/**/*.{ts,py}", "backend/**/*.{ts,py}", "apps/**/*.{ts,py}", "packages/**/*.{ts,py}"]
alwaysApply: true
---

# Backend Standards for AI Agent Systems

## Table of Contents

- [Overview](#overview)
- [Technology classification](#technology-classification)
- [Architecture](#architecture)
- [Recommended structure](#recommended-structure)
- [Coding standards](#coding-standards)
- [Domain modeling](#domain-modeling)
- [Agent engineering](#agent-engineering)
- [Prompt and context engineering](#prompt-and-context-engineering)
- [Tool calling](#tool-calling)
- [LLM provider abstraction](#llm-provider-abstraction)
- [RAG](#rag)
- [Voice AI](#voice-ai)
- [MCP](#mcp)
- [Workflow automation](#workflow-automation)
- [API design](#api-design)
- [Persistence](#persistence)
- [Evaluation](#evaluation)
- [Observability](#observability)
- [Security](#security)
- [Testing](#testing)
- [Development workflow](#development-workflow)

## Overview

Backend code is the system of record for agents, tools, retrieval, evaluation, and durable state. Interaction providers (voice, chat, batch) are inbound/outbound adapters.

This document defines implementation standards. Provider-specific SDK fields, webhook payloads, and graph-library APIs belong in project technical notes, not here.

Related contracts: [data-model.md](./data-model.md), [api-spec.yml](./api-spec.yml).

## Technology classification

### Core

- TypeScript, Node.js, REST/OpenAPI
- PostgreSQL, pgvector, Docker
- Strict typing and automated tests

### Optional

- Python (RAG, evaluation, data pipelines)
- LangChain / LangGraph when a typed internal orchestrator is not a better fit
- Runtime MCP for agent tools
- Langfuse or equivalent observability
- Promptfoo, DeepEval, or equivalent evaluation runners
- n8n for deterministic automations outside the model loop

### Use-case dependent

- Vapi (or another voice/telephony provider) as speech and call-control adapter
- Product or operator UI backends that exist only when a frontend exists

Default language split:

- **TypeScript**: HTTP APIs, session lifecycle, tool execution, policy, HITL, adapter wiring
- **Python**: ingestion/parsing jobs, embedding batch, evaluation suites, analytical transforms

Share contracts across languages (OpenAPI, JSON Schema, event payloads). Do not duplicate business rules in both stacks.

## Architecture

### Hexagonal / Clean Architecture

```
Adapters (in)          Application            Domain              Adapters (out)
Voice / chat webhook → session use cases  →  AgentSession      → LLM port
HTTP / MCP client    → tool use cases     →  ToolInvocation    → Tool port / MCP
Ingestion jobs       → knowledge use cases→  KnowledgeCorpus   → Vector store
Eval runners         → evaluation use cases→ EvaluationRun     → Observability
```

Rules:

- Domain has no imports of vendor SDKs, HTTP frameworks, or ORM types in its public model.
- Application orchestrates; it does not embed SQL, prompt strings copied from dashboards, or vendor webhook shapes.
- Adapters translate. Vapi, OpenAI-compatible APIs, Langfuse, n8n, and pgvector drivers live here.
- Replacing a voice provider must not require rewriting domain aggregates or tool policy.

### DDD when appropriate

Use aggregates when there is a consistency boundary:

- `AgentSession` — conversation/call lifecycle and business state
- `ToolInvocation` — one authorized tool attempt
- `KnowledgeCorpus` — documents, chunks, embedding versions
- `EvaluationRun` — suite, dataset, scores, gate result

Do not invent aggregates for every DTO.

### Reasoning vs execution

1. Model produces a structured intent (message, tool request, handoff, terminate).
2. Runtime validates schema, policy, and risk class.
3. Runtime executes or queues HITL.
4. Runtime records trace, cost, and state transition.

The model never receives unconstrained authority to execute side effects.

### Determinism vs autonomy

- Prefer typed state machines for call flow, ticket flow, and post-call actions.
- Use generative steps only where language or ranking is required.
- Bound autonomy: allowed tools, max tool hops, max tokens, max latency, max cost.

## Recommended structure

Adapt names to the repo, keep the dependency direction:

```
src/
  domain/                 # entities, value objects, domain events, ports (interfaces)
  application/            # use cases, agent orchestration, policy, HITL
  adapters/
    voice/                # Vapi or other interaction provider
    llm/                  # model and embedding providers
    tools/                # HTTP, DB, MCP, n8n triggers
    rag/                  # parsing, chunking, vector store
    observability/        # traces, cost, eval export
    persistence/          # PostgreSQL / pgvector
  api/                    # HTTP controllers, OpenAPI handlers
  workers/                # ingestion, eval, automation
```

Python packages, when used, should mirror ports (`domain` / `application` / `adapters`) rather than become a second architecture.

## Coding standards

### Naming

- camelCase functions and variables in TypeScript; snake_case in Python
- PascalCase types, classes, interfaces
- UPPER_SNAKE_CASE constants
- Tool names: stable, verb-oriented, namespaced (`crm.update_contact`, `calendar.create_event`)
- Files: match the primary export

### TypeScript

- `strict` true. Ban `any`. Prefer `unknown` then narrow.
- Explicit return types on exported functions.
- Discriminated unions for agent state and tool results.

### Python

- Type hints on public functions. Run a type checker in CI.
- Pydantic (or equivalent) for external payloads and tool args.
- No untyped `Dict[str, Any]` as a domain model.

### Error handling

- Domain errors for policy and invariant violations
- Adapter errors for provider/timeout/rate-limit failures
- Never leak provider payloads or secrets in client error messages
- Map errors at the API edge to the [api-spec.yml](./api-spec.yml) error contract

### Validation

- Validate at the boundary (HTTP, webhook, MCP, queue)
- Validate again before tool execution
- Prefer schema libraries over ad-hoc checks

### Logging vs tracing

- Logs: operational events for humans and alerts
- Traces: model, prompt version, tools, retrieval, tokens, cost
- No prompt or PII in unstructured logs unless redacted and justified

## Domain modeling

See [data-model.md](./data-model.md) for fields and relationships.

Invariants:

- A session has one explicit state at a time
- A tool call is immutable after completion (retry = new attempt linked to the parent)
- Retrieval results store source ids and scores
- Prompt and model versions used in a turn are recorded, not inferred later

## Agent engineering

### Explicit state

Define a typed session state. Example shape (illustrative, not a vendor schema):

```typescript
type SessionStatus =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking"
  | "awaiting_tool"
  | "awaiting_human"
  | "transferring"
  | "completed"
  | "failed";
```

Persist state changes with timestamp, cause, and actor (`model` | `runtime` | `human` | `system`).

### Controlled autonomy

Each agent version declares:

- allowed tools
- risk class per tool (`read`, `write`, `irreversible`, `external_comm`)
- confirmation policy
- max consecutive tool calls
- timeout and budget

### Multi-agent systems

- One session owner (supervisor or router) holds user-facing state
- Specialist agents communicate through typed messages, not shared mutable prompts
- Handoff is an explicit domain event with reason and payload
- Avoid unbounded agent-to-agent recursion

### Hallucination and uncertainty

- Ground answers in retrieval or tool results when facts are required
- If confidence or evidence is below threshold, ask, defer, or hand off
- Never invent identifiers, prices, medical/legal facts, or "completed" actions
- For voice, do not fill silence with unverified claims

### Retries and fallbacks

- Retry only idempotent or safely replayable operations
- Distinct policies for: model timeout, tool timeout, validation failure, provider 429
- Fallback ladder example: primary model → secondary model → deterministic script → human
- Cap retries. Record every attempt on the trace

## Prompt and context engineering

- Prompts are versioned artifacts (`prompt_id` + `version`), not anonymous strings in code
- System policy, developer instructions, retrieved context, tool results, and user text are separate message roles or labeled blocks
- Enforce token budgets per section (policy, history, retrieval, tools)
- Truncate or summarize history with a defined strategy; do not silently drop the newest user turn
- Never concatenate untrusted user or retrieved text as if it were system policy
- Changing a prompt is a contract change: update evals, then code

## Tool calling

### Schema

- JSON Schema (or equivalent) with `additionalProperties: false` unless explicitly open
- Required vs optional arguments documented
- Side-effect tools include an idempotency key when retries are possible

### Validation and execution

```text
model tool request
  → schema validate
  → policy / allowlist
  → risk gate (execute | confirm | deny)
  → execute with timeout
  → map result to a bounded payload
  → append to trace and agent context
```

- Do not execute on parse failure
- Bound result size before returning to the model
- Tool errors return structured `{ ok: false, code, message }` — not stack traces

### Misuse prevention

- Allowlist tools per agent version
- Deny path traversal, SSRF, and unconstrained URL fetch unless a dedicated tool exists
- Separate credentials per tool with least privilege
- High-risk tools require confirmation before side effects (see Voice confirmation rules)

## LLM provider abstraction

Application ports should look like capabilities, not vendors:

- `complete(request) -> text | structured`
- `stream(request) -> tokens`
- `embed(texts) -> vectors`
- `transcribe` / `synthesize` belong to the voice/speech port, not the LLM port, even if one vendor sells both

Adapters handle auth, base URLs, rate limits, and provider error mapping.

Do not leak provider request ids into domain logic except as opaque adapter metadata on traces.

## RAG

End-to-end retrieval is a pipeline with versions, not an ad-hoc `similaritySearch` call.

### Ingestion

1. **Acquire** documents with source URI, owner, and license/sensitivity tags
2. **Parse** to text/structure; record parser version
3. **Chunk** with an explicit strategy (size, overlap, structure-aware when possible)
4. **Metadata** on every chunk: source id, locator (page/section), timestamps, ACL, language, document version
5. **Embed** with a named embedding model and version
6. **Store** in PostgreSQL/pgvector (or an adapter behind the same port)

Re-ingestion must be attributable: corpus version, embedding model, chunker version.

### Retrieval

- Default: vector search with metadata filters
- Use hybrid search when lexical matching matters (ids, codes, exact titles)
- Apply retrieval thresholds; do not send arbitrarily weak hits to the model
- Rerank when candidate sets are large or precision is required
- Contextual compression / packing must preserve source locators
- Return source attribution to the application layer; the user-facing answer should be able to cite sources

### Freshness and evaluation

- Track `source_updated_at` vs `indexed_at`
- Stale knowledge: skip, recency-boost, or refuse rather than answer from expired chunks
- Evaluate retrieval independently of generation (recall@k, MRR, citation precision)
- A generation eval that ignores retrieval quality is insufficient for RAG changes

## Voice AI

Vapi (or equivalent) handles the call media path. Application code owns business state, tools, and policy.

### Interaction concerns

- **STT / TTS**: treat as adapters with latency budgets; do not bake vendor voice ids into domain
- **Latency**: budget time-to-first-audio and tool round-trips; fail toward a spoken holding/fallback phrase, not a hang
- **Turn-taking**: define who may speak; do not let tool delays collide with user speech without a policy
- **Silence**: distinguish thinking pause, user pause, and dead air; each has a timeout and next action
- **Barge-in / interruption**: cancel or complete the current utterance per policy; persist what was committed
- **Call state vs session state**: media state (`ringing`, `on_call`) is not the same as business state (`collecting_slot`, `awaiting_confirmation`)
- **Transfer / handoff**: explicit tool or workflow with destination, reason, and context packet for the human
- **Termination**: only after required wrap-up (summary, disposition, optional confirmation)

### Tools during a call

- Tool latency is part of the voice UX. Set timeouts tighter than chat
- On tool failure: spoken recovery, retry if safe, or transfer; never pretend success
- Confirm consequential actions (bookings, charges, data changes, outbound messages) before execution
- Prevent hallucination on the call: do not read back unverified tool results or invented confirmation numbers

Provider webhook and assistant JSON details belong in the voice adapter documentation of the implementing project.

## MCP

### Development MCP

Used by coding agents in Cursor and similar environments.

- Scope to the developer's machine and the current repo
- Credentials are developer secrets, not product secrets
- Must not be registered as tools of a production agent
- Browser/ticket MCPs are for implementing and verifying software, not for live callers

### Runtime MCP

Used by product agents to call tools.

- Treat each MCP server as an untrusted tool provider until allowlisted
- Authenticate the agent runtime to the MCP server; authenticate the MCP server to downstream systems
- Validate tool names and arguments against the agent version allowlist, even if MCP already lists them
- Timeouts, rate limits, and audit logs are mandatory
- Prefer wrapping MCP tools in the same `ToolInvocation` aggregate as native tools so policy and traces stay unified

## Workflow automation

- If the step is deterministic (ETL, ticket move, webhook fan-out), prefer n8n or typed workers over an LLM
- Agents may *trigger* workflows; they must not re-implement those workflows in prose
- Workflow inputs/outputs are contracts (JSON Schema)
- Automations that send user-visible communication still go through confirmation policy when risk is high

## API design

Canonical HTTP capabilities live in [api-spec.yml](./api-spec.yml).

- Resource-oriented URLs, JSON in and out
- Idempotency keys on session-creating and side-effect endpoints
- Consistent error envelope
- Webhooks from interaction providers terminate at an adapter, then map to session commands
- Do not expose raw vendor payloads as the public API of the product

## Persistence

- PostgreSQL is the system of record for sessions, tools, evals, and audit
- pgvector stores embeddings; chunk text and metadata remain relational
- Migrations are mandatory and reviewed
- Do not use a vector-only store as the only copy of documents
- ORM/query layers stay in persistence adapters (Prisma, Drizzle, SQLAlchemy, etc. are choices of the project, not of this methodology)

## Evaluation

Evaluation is part of development. See also [openspec-tasks-mandatory-steps.md](./openspec-tasks-mandatory-steps.md).

| Layer | What it proves |
| --- | --- |
| Unit | Typed policy, parsers, state machines, schema validation |
| Integration | Adapters against fakes or local doubles |
| Contract | HTTP and tool schemas match OpenAPI / JSON Schema |
| Tool calling | Valid args execute; invalid args never execute |
| Agent behavior | Golden conversations hit required outcomes |
| RAG | Retrieval quality and citation correctness |
| Prompt | Version A vs B on a frozen dataset |
| Adversarial | Injection, jailbreak, tool exfiltration, social engineering |
| Regression | Previous fixtures still pass after prompt/model/tool changes |
| Voice conversation | Turn-taking, confirmation, interruption, recovery |
| Production monitoring | Online quality, latency, cost, error rate, eval samples |

Rules:

- Probabilistic tests assert schema, tool sequence, groundedness, or score thresholds — not exact wording unless required
- Gate production on eval suites for the changed surface
- Record dataset version, prompt version, model version, and scores on `EvaluationRun`

## Observability

Every production turn should be reconstructable.

Minimum trace fields:

- trace id, session id, turn id
- prompt id and version, model id and version
- input/output (redacted as required)
- token counts and estimated cost
- latency (model, tools, retrieval, total)
- tool name, arguments, result, error, retry count
- retrieval query, hit ids, scores, corpus version
- eval scores when attached
- error class and fallback used

Use an observability adapter (Langfuse or equivalent). Domain code publishes a `Trace` port; it does not import vendor SDK types.

## Security

- Never commit secrets. Validate required env vars at process start
- Separate secrets for LLM, voice, DB, MCP, and automation
- Sanitize and bound all untrusted text before it enters prompts
- Treat retrieved documents and tool results as untrusted for policy purposes
- PII: collect minimum, log redacted, retain per policy
- Authorization on every tool and HTTP route; agents are not a bypass
- Threat-model prompt injection and confused-deputy tool use for every new tool

## Testing

- TDD for deterministic code
- Fakes for LLM and voice ports in unit tests; never call paid APIs in unit tests
- Contract tests from [api-spec.yml](./api-spec.yml)
- Arrange-Act-Assert; behavior-oriented names: `should_[behavior]_when_[condition]`
- Coverage on deterministic modules remains a project gate; generative paths are gated by evaluation, not line coverage alone

## Development workflow

- Feature branches; English conventional commits
- Specs and eval fixtures update in the same change as code
- Do not merge agent or prompt changes without the evaluation report required by OpenSpec tasks
- ESLint/typecheck (TS) and equivalent Python lint/typecheck before merge
