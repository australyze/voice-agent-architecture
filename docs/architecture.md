# AI Agent Runtime architecture

This note binds later increments. Methodology rules stay in `lidr-specboot/docs/`. This file is the implementing-repo view of the runtime plus the inbound voice channel.

## Layering

```text
Vapi = Interaction Adapter
Agent Runtime = Application / Execution Layer
Domain = Provider Independent
```

```text
src/
  domain/           # errors, ports, VoiceTurn — no frameworks, drivers, or vendor SDKs
  application/      # config, health, handleVoiceTurn, error mapping
  adapters/
    http/           # health + inbound route wiring
    voice/          # Vapi/simulator translation only
    persistence/    # PostgreSQL driver
    logging/        # structured JSON logger
  composition/      # process wiring
```

Dependencies point inward. Replacing a voice, LLM, store, or observability vendor must not rewrite domain or application use cases.

## Ports

| Port | Role | Status |
| --- | --- | --- |
| LLM | `complete`, `stream`, structured output | Interface only |
| Speech | `transcribe`, `synthesize` | Interface only — unused on the inbound text path |
| Tools | authorize + execute | Interface only; no product tools |
| Retrieval | query → source-located hits | Interface only |
| Observability | emit span/trace | Port declared; logging is the operational signal |
| Persistence | `ping` (later repositories) | PostgreSQL adapter |
| Logger | operation + outcome + optional correlation | JSON adapter |

## Voice adapter ≠ runtime

```text
Vapi / simulator → adapters/voice → VoiceTurn → handleVoiceTurn → VoiceReply → adapter → consumer
```

- **Vapi** is the interaction adapter (first inbound implementation).
- **Agent Runtime** owns execution of the turn (deterministic placeholder in this increment).
- **Domain** stays provider independent.

Media / channel identity (`externalChannelId`) is not business state. This increment does not persist `Session` or `ConversationTurn` tables.

The Vapi-facing URL is `POST /adapters/voice/inbound`. It is **not** canonical `POST /ingress/interaction`. See [adapters/vapi-inbound.md](./adapters/vapi-inbound.md).

## Human-in-the-loop (reserved)

This increment executes no product side effects. Later tools MUST declare a risk class (`read` | `write` | `irreversible` | `external_comm`). `write`, `irreversible`, and `external_comm` actions require confirmation or approval before execution.

## Dual MCP

- **Development MCP** (Cursor / coding agents) stays on the developer machine. It is not part of the product runtime.
- **Runtime MCP** is a later optional adapter behind the tool port, with allowlists, timeouts, and audit. Do not register IDE MCP servers as product tools.

## What this increment does not ship

No product conversational agent, RAG pipeline, LangGraph domain, Langfuse SDK, tool calling, outbound calling, or session/tool/trace tables.

## Local network and health

- Compose PostgreSQL is published on `127.0.0.1` only. Default credentials are local placeholders.
- The process defaults to listen host `127.0.0.1`. `0.0.0.0` is opt-in.
- `/health/live`, `/health/ready`, and `/health/voice` are unauthenticated. That is an explicit exception to authorizing every HTTP route: they expose only liveness, readiness, and voice integration status. `POST /adapters/voice/inbound` MUST be authenticated when voice is configured.

`lidr-specboot/docs/` was not changed by this increment. Canonical AI-engineering rules remain there.
