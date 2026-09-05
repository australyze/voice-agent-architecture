## Context

The implementing repo has OpenSpec and `lidr-specboot/` methodology, and no application code. See `proposal.md` for motivation. Canonical contracts live in `lidr-specboot/docs/` (`base-standards.md`, `backend-standards.md`, `data-model.md`, `api-spec.yml`). Those docs describe a full agent platform; this change implements only the bootable shell.

Assumptions recorded from enrichment (not reopened here): users are implementing engineers; this increment has no product conversation channel; persistence means connectivity through a port, not first domain aggregates; health uses one HTTP contract for local Compose and later hosts; the next product increment is a Voice AI adapter.

## Goals / Non-Goals

**Goals:**

- Smallest hexagonal process that boots, fails closed on config, logs safely, checks live vs ready, and reaches PostgreSQL through a port.
- Leave typed ports so later adapters do not rewrite domain or application use cases.
- Make clone-to-run and core tests possible without paid AI services.

**Non-Goals:**

- Product agent, tools, RAG, voice media, runtime MCP, eval harness, or operator UI (see proposal Non-goals).
- Materializing `Session`, `ToolCall`, `Trace`, or eval tables (`data-model.md`: not required on day one).
- Choosing or installing optional methodology libraries (LangGraph, Langfuse, Promptfoo, n8n, Vapi).

## Decisions

### D1 — Deterministic runtime, not an agent

**Decision:** This increment is a typed process (config → composition root → HTTP health → persistence ping). No model loop, no session owner, no multi-agent topology.

**Why:** The path is fully specified. A generative step would add vendor gravity and non-determinism with no user outcome (`base-standards.md`: deterministic workflows wherever possible).

**Alternatives:** A placeholder “echo agent” or LangGraph hello-world. Rejected: contaminates the core and pretends a product exists.

### D2 — Hexagonal layout at the implementing root

**Decision:** Application code lives beside OpenSpec, not inside `lidr-specboot/`:

```text
src/
  domain/           # errors, port interfaces, no frameworks
  application/      # start, health, config use cases
  adapters/
    http/           # inbound health routes
    persistence/    # PostgreSQL driver
    logging/        # structured logger
  composition/      # wiring / process entry
```

Dependency direction: adapters → application → domain. Domain and application MUST NOT import Vapi, an LLM SDK, Langfuse, or ORM types (`backend-standards.md`).

**Why:** Matches the recommended structure without inventing a second architecture.

**Alternatives:** Monolithic `src/index.ts`, or methodology-nested `lidr-specboot/src`. Rejected: hides boundaries; methodology is not the product.

### D3 — TypeScript / Node.js core; no Python package yet

**Decision:** Pin Node.js LTS (>= 20.19 for OpenSpec). TypeScript `strict`. npm. No Python workspace until RAG or eval jobs exist.

**Why:** Methodology core default for HTTP, session control, and orchestration. Python is optional and unjustified here.

**Alternatives:** Python-first, or dual packages on day one. Rejected: extra toolchain for a process that only boots and checks health.

### D4 — PostgreSQL in Compose; driver only; no ORM; no domain tables

**Decision:** Docker Compose starts PostgreSQL (pgvector image so a later RAG change does not redo infra). Publish the host port as `127.0.0.1:5433:5432` only. Persistence adapter uses the `pg` driver. Port capability for this change: connectivity / readiness ping (`SELECT 1`). No Prisma/Drizzle. No Session/Tool/Trace migrations. Default Compose user/password are local placeholders and must not be reused outside local development.

**Why:** PostgreSQL is the methodology system of record. An ORM and full data model would invent aggregates the product does not have. Enabling pgvector in the image is infrastructure readiness, not a retrieval feature.

**Alternatives:** SQLite for “simpler local”; ORM from day one; create Session tables now. Rejected: SQLite diverges from the durable-state default; ORM types leak; empty session tables become a fake domain.

### D5 — HTTP surface is health only

**Decision:** Inbound API for this change:

- `GET /health/live` — process is running; does not query persistence
- `GET /health/ready` — persistence ping succeeds

Use the canonical error envelope from `lidr-specboot/docs/api-spec.yml` (`success: false`, `error.message`, `error.code`). Do not implement `/sessions`, tools, approvals, knowledge, evaluations, or ingress.

Document the two health paths in the implementing project (README and a project OpenAPI fragment). Do not treat them as a rewrite of the canonical product API.

**Why:** Canonical `api-spec.yml` has no health paths; health is operational. Implementing session APIs now would force a domain we are not building.

**Alternatives:** No HTTP at all (CLI-only health); implement session CRUD. Rejected: later Compose/orchestrators need a probe contract; session CRUD is a later change type.

**HTTP library:** Thin inbound adapter (Fastify or equivalent). Domain has no HTTP types. Prefer a library that validates at the boundary; the exact package is an implementation choice as long as the adapter stays at the edge.

**Listen host:** Optional `LISTEN_HOST`. Default `127.0.0.1`. Invalid values fail closed. Binding `0.0.0.0` is opt-in for a later orchestrator, not the local default.

**Health authentication:** Unauthenticated by design in this change. Exception to “authorize every HTTP route”: probes return only alive/ready and default to loopback. Product session/tool routes later MUST be authorized.

### D6 — Configuration at the composition root

**Decision:** Load environment from a gitignored `.env` plus process env. Validate with a typed schema at start. Required for this change: `NODE_ENV`, `PORT`, `DATABASE_URL`. Optional: `LISTEN_HOST` (default `127.0.0.1`). Fail closed; never log the secret parts of `DATABASE_URL`. Ship `.env.example` with placeholders only. Ignore `.env` and `.env.*` except `.env.example`.

Do not require LLM, voice, observability, or runtime MCP variables to become live.

**Why:** `base-standards.md` / `backend-standards.md`: validate env at process start; separate secrets per later adapter.

**Alternatives:** Implicit defaults for database URL in production-like modes. Rejected: hides misconfiguration.

### D7 — Error model and logging vs tracing

**Decision:** Domain/application throw typed errors (`config`, `dependency`, `internal`). The HTTP adapter maps them to the canonical envelope and a safe message. Structured JSON logs go through a logger port: operation name, outcome, error code. Redact Postgres URLs, `://user:pass@` userinfo, `Bearer` tokens, `sk-` style keys, and `*_API_KEY=` assignments. No prompt or PII in logs. No Langfuse (or equivalent) SDK.

Declare an observability / trace port (span kind, name, status) with a logging or no-op adapter only. Domain publishes to the port; it does not import a vendor.

**Why:** Logs are enough to diagnose boot, health, and persistence. Production model/tool/retrieval traces are a later change (`backend-standards.md` Observability). Installing Langfuse now would make the vendor look like application logic.

**Alternatives:** Console.log only; full Langfuse from day one. Rejected: unstructured logs hide operations; vendor SDK in the first commit violates provider independence.

### D8 — Provider ports declared, adapters not shipped

**Decision:** Place TypeScript port interfaces in `src/domain` (names illustrative):

| Port | Capabilities | This change |
| --- | --- | --- |
| LLM | `complete`, `stream`, structured output | Interface only |
| Speech / voice | `transcribe`, `synthesize` (not on the LLM port) | Interface only |
| Tools | authorize + execute with schema/timeout | Interface only; no product tools |
| Retrieval | query → hits with source locators | Interface only |
| Observability | emit trace/span | Logging or no-op adapter |
| Persistence | ping / later repositories | PostgreSQL ping adapter |

Composition root wires only persistence, logger, and HTTP. Unwired ports MUST NOT be constructed with vendor clients.

**Why:** `backend-standards.md` LLM and Voice sections: capabilities, not vendors. Speech is not the LLM port even if one vendor sells both. Next increment (voice adapter) implements Speech, not the runtime.

**HITL / risk:** No product tools. Reserved policy: later `write` | `irreversible` | `external_comm` tools require confirmation. No Approval API now.

**Budgets:** No token, hop, or spoken-latency budgets. Readiness ping MUST use a short timeout so “not ready” is a dependency signal, not a hung probe.

**Topology:** Single process. No session owner. No multi-agent.

**Dual MCP:** Development MCP stays in the IDE. Do not register Cursor MCP servers as product tools. Runtime MCP is a later optional adapter behind the tool port.

### D9 — Testing and change-type gates

**Decision:** Change types: `code`, `api`. TDD for deterministic modules. Unit tests use fakes for ports. Persistence verification uses local Compose PostgreSQL. Contract tests cover `GET /health/live` and `GET /health/ready` plus the error envelope.

Omit: tool-calling tests, agent/prompt eval, RAG eval, voice conversation eval, UI E2E, adversarial tool-expansion tests. Reason: those surfaces are non-goals. `create-evals` does not apply.

**Why:** `openspec-tasks-mandatory-steps.md` selects gates by change type.

**Alternatives:** Add a Promptfoo suite “for later.” Rejected: no generative path; a suite without a surface is theater.

### D10 — Documentation that binds later components

**Decision:** Implementing-repo README: prerequisites, env, Compose, start, test. Short architecture note (in README or `docs/` at the implementing root, not a fork of `lidr-specboot/docs/`): layering, ports, “voice adapter ≠ runtime,” reserved HITL policy. Update living methodology docs only if this change actually changes them (it should not).

**Why:** `documentation-standards.md` — specs precede code; do not invent a parallel canon inside `lidr-specboot/` for product setup.

## Risks / Trade-offs

- **[Empty ports look like unused code]** → Keep them as small interfaces plus an architecture test (core has no vendor imports). Do not add fake production adapters.
- **[pgvector image unused]** → Accept unused extension now to avoid a later Compose break; do not query embeddings.
- **[Health paths missing from canonical api-spec.yml]** → Document in the implementing project; add to methodology API only if the program later promotes health as a canonical path.
- **[Engineers add an LLM SDK “while scaffolding”]** → Spec and architecture test forbid core imports; tasks call this out.
- **[Readiness hangs on a bad network]** → Bound the persistence ping timeout.
- **[Secret leakage via DATABASE_URL in logs]** → Redact userinfo in logger and error mapper; test that redaction.

## Migration Plan

Greenfield. No production traffic.

1. Add application skeleton, config, logger, health, persistence ping, Compose, tests, README.
2. Developers start Compose, copy `.env.example`, run the app and tests.
3. Rollback is delete the application tree; methodology and OpenSpec remain.

## Open Questions

None that change specs, approach, or tasks. Framework package inside the HTTP adapter can be chosen during `/apply` if it stays at the edge.
