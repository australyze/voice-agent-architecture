## Why

The implementing repository has methodology and OpenSpec tooling but no application runtime. Without a vendor-independent, testable foundation, the next increment (Voice AI adapter) would have nowhere to plug in except a contaminated core. This change establishes the smallest bootable hexagonal shell so later LLM, tool, RAG, MCP, voice, observability, and evaluation work can land as adapters.

## What Changes

- Add a TypeScript/Node.js application that starts locally from documented configuration.
- Introduce hexagonal layer boundaries (domain, application, infrastructure, adapters) with no AI-provider SDK in the core.
- Validate required configuration at process start and fail closed on missing or invalid values; keep secrets out of source.
- Map errors at boundaries to a consistent envelope that does not leak secrets or provider internals.
- Emit operation-level structured logs without secrets or unnecessary sensitive data.
- Expose liveness and readiness HTTP checks (canonical `api-spec.yml` has no health paths today; this change adds them as a project API).
- Add a persistence port and reproducible local store connectivity without coupling the domain to an engine or ORM.
- Declare unused provider ports (LLM, voice/speech, tools, retrieval, observability) so later adapters do not rewrite the core.
- Add automated tests that run without paid LLM, voice, or observability services.
- Add containerized local infrastructure and clone-to-run documentation.
- Bind local Compose PostgreSQL and the default HTTP listen address to loopback so default credentials and unauthenticated health probes are not published on all host interfaces.
- Ignore `.env.*` variants (except `.env.example`) and redact common secret shapes in logs, not only Postgres URLs.

Change types for gates: **code**, **api**. Not tools, agents, RAG, voice, or UI.

## Non-goals

- Product conversational agent (voice or chat)
- Voice/telephony adapter implementation (including Vapi)
- LangGraph / LangChain as domain or default orchestrator
- RAG, embeddings, or vector search
- Runtime MCP (development MCP stays outside the product)
- Multi-agent topology
- Complex business workflows or a first tool allowlist
- Conversation, prompt, or retrieval evaluation suites
- A specific LLM provider as product behavior
- Operator or end-user UI
- Session, ToolCall, Trace, or eval tables as the system of record (reserved for later; see `lidr-specboot/docs/data-model.md`)
- Irreversible or externally visible business actions

## Capabilities

### New Capabilities

- `application-runtime`: Process bootstrap, fail-closed configuration, consistent boundary errors, and secret-safe operation logging.
- `health-checks`: Liveness vs readiness HTTP probes for the running process and essential dependencies.
- `persistence-port`: Persistence boundary and connectivity so the domain does not import a store engine or ORM type.
- `provider-ports`: Declared ports for LLM, voice/speech, tools, retrieval, and observability. Adapters are out of scope; the core must remain replaceable at these edges.

### Modified Capabilities

- None. There is no `openspec/specs/` baseline yet.

## Impact

- Greenfield application under the implementing repo root (`src/` and related project files). Methodology in `lidr-specboot/` is unchanged.
- New HTTP surface: health/readiness only. Session, tool, HITL, knowledge, evaluation, and ingress paths in `lidr-specboot/docs/api-spec.yml` stay unimplemented.
- Error responses MUST use the canonical envelope (`success: false`, `error.message`, `error.code`) from `lidr-specboot/docs/api-spec.yml`.
- New local dependency: containerized PostgreSQL (methodology default for durable state). No LLM, voice, Langfuse, or runtime MCP packages in the core.
- Documentation: project README / development setup for clone-to-run; architecture decisions that bind later components.
- Next intended increment after this change: Voice AI adapter behind the voice/speech port, not as the runtime.
