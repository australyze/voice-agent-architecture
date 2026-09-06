# AI Agent Runtime architecture

This note binds later increments. Methodology rules stay in `lidr-specboot/docs/`. This file is the implementing-repo view of the runtime, the inbound voice channel, and the first demo agent.

## Layering

```text
Vapi = Interaction Adapter
Agent Runtime = Application / Execution Layer
Domain = Provider Independent
```

```text
src/
  domain/           # errors, ports, VoiceTurn — no frameworks, drivers, or vendor SDKs
  application/      # config, health, handleVoiceTurn, handleAgentTurn, handleOrchestratedTurn, error mapping
  adapters/
    http/           # health + inbound + demo orchestrate route wiring
    voice/          # Vapi/simulator translation only
web/                # HU #010 interviewer UI (React). Not the runtime.
    llm/            # fake + optional HTTP completions adapter; `embed` is lexical offline
    tools/          # product registry (demo.normalize_text + wom.*); test-only demo.echo_token off the product catalog
    wom/            # in-process canned WOM directory (no network)
    retrieval/      # in-memory cosine store (default); port-swappable
    eval/           # suite runners for the quality gate (fakes only)
    persistence/    # PostgreSQL driver
    logging/        # structured JSON logger
  composition/      # process wiring
eval/               # frozen cases + quality-gate baseline
```

Dependencies point inward. Replacing a voice, LLM, store, or observability vendor must not rewrite domain or application use cases.

## Ports

| Port | Role | Status |
| --- | --- | --- |
| LLM | `complete`, `stream`, structured output, `embed` | Fake by default; optional HTTP adapter. Embed is deterministic lexical (no live vendor) |
| Speech | `transcribe`, `synthesize` | Interface only — unused on the inbound text path |
| Tools | authorize + execute | In-process registry; product `demo.normalize_text` and three `wom.*` read tools (`native`); MCP source reserved and denied |
| Retrieval | `ingest` + `retrieve` with locators and scores | In-memory cosine adapter by default; later pgvector implements the same port |
| Observability | emit span/trace | Logging adapter by default writes reconstructable metadata (`traceId`, kind, name, latency, status, optional tokens/cost). Retrieval spans use `queryHash` only. No in-heap span list; `MemoryObservability` is test-only. No vendor SDK |
| Persistence | `ping` (later repositories) | PostgreSQL adapter |
| Logger | operation + outcome + correlation / trace metadata | JSON adapter; redacts secret shapes |
| Judge | structured quality score | Optional port; unused on the default quality gate |

## Voice adapter ≠ runtime

```text
Vapi / simulator → adapters/voice → VoiceTurn → handleVoiceTurn → handleAgentTurn → VoiceReply → adapter → consumer
```

- **Vapi** is the interaction adapter (first inbound implementation).
- **Agent Runtime** owns session-owner agents (`runtime-demo` by default, optional `wom-customer-service-agent` via `VOICE_SESSION_OWNER`): prompt, LLM port, tool allowlist bound on the production tool port and on `handleAgentTurn`, traces.
- **Domain** stays provider independent. Placeholder success is no longer the voice happy path.

Media / channel identity (`externalChannelId`) is not business state. This increment does not persist `Session` or `ConversationTurn` tables.

The Vapi-facing URL is `POST /adapters/voice/inbound`. It is **not** canonical `POST /ingress/interaction`. See [adapters/vapi-inbound.md](./adapters/vapi-inbound.md).

## Human-in-the-loop (reserved)

This increment executes no product side effects. Later tools MUST declare a risk class (`read` | `write` | `irreversible` | `external_comm`). `write`, `irreversible`, and `external_comm` actions require confirmation or approval before execution.

## Dual MCP

- **Development MCP** (Cursor / coding agents) stays on the developer machine. It is not part of the product runtime.
- **Runtime MCP** is a later optional adapter behind the same tool port, with allowlists, timeouts, and audit. Catalog `source` may be `mcp`; this increment does not start a client or execute MCP tools. Do not register IDE MCP servers as product tools.

## What this increment does not ship

No multi-agent topology, production knowledge base, Graph RAG, LangGraph domain, Langfuse SDK, runtime MCP, outbound calling, or Session/Conversation/Document/Chunk/EvaluationRun tables. Canonical `lidr-specboot/docs/api-spec.yml` `/sessions`, `/tools/{toolName}/invoke`, `/knowledge/documents`, `/knowledge/query`, and `/evaluations/runs` remain unimplemented.

See [knowledge.md](./knowledge.md), [agents/runtime-demo.md](./agents/runtime-demo.md), [agents/wom-customer-service-agent.md](./agents/wom-customer-service-agent.md), and [evaluation-gate.md](./evaluation-gate.md).

The WOM path is a **simulated** customer-service environment. It does not call WOM APIs. The interviewer web UI (HU #010) lives in `web/` and talks to Vapi only for browser media. Persistence/observability UI (HU #011) and public evaluation/deploy (HU #012) remain deferred. See [adapters/vapi-web-demo.md](./adapters/vapi-web-demo.md).

## Local network and health

- Compose PostgreSQL is published on `127.0.0.1` only. Default credentials are local placeholders.
- The process defaults to listen host `127.0.0.1`. `0.0.0.0` is opt-in.
- `/health/live`, `/health/ready`, and `/health/voice` are unauthenticated. That is an explicit exception to authorizing every HTTP route: they expose only liveness, readiness, and voice integration status. `POST /adapters/voice/inbound` MUST be authenticated when voice is configured.

`lidr-specboot/docs/` was not changed by this increment. Canonical AI-engineering rules remain there.
