# AI Agent Runtime architecture

This note binds later increments. Methodology rules stay in `lidr-specboot/docs/`. This file is the implementing-repo view of the foundation.

## Layering

```text
src/
  domain/           # errors, ports — no frameworks, drivers, or vendor SDKs
  application/      # config, health, error mapping
  adapters/
    http/           # inbound health routes
    persistence/    # PostgreSQL driver
    logging/        # structured JSON logger
  composition/      # process wiring
```

Dependencies point inward. Replacing a voice, LLM, store, or observability vendor must not rewrite domain or application use cases.

## Ports

| Port | Role | This foundation |
| --- | --- | --- |
| LLM | `complete`, `stream`, structured output | Interface only |
| Speech | `transcribe`, `synthesize` | Interface only — not on the LLM port |
| Tools | authorize + execute | Interface only; no product tools |
| Retrieval | query → source-located hits | Interface only |
| Observability | emit span/trace | Port declared; logging is the operational signal |
| Persistence | `ping` (later repositories) | PostgreSQL adapter |
| Logger | operation + outcome | JSON adapter |

## Voice adapter ≠ runtime

A later Voice AI adapter (for example Vapi) is an interaction adapter. It is not the agent kernel, not the session system of record, and not the tool executor. Call/media state is not business state.

## Human-in-the-loop (reserved)

This foundation executes no product side effects. Later tools MUST declare a risk class (`read` | `write` | `irreversible` | `external_comm`). `write`, `irreversible`, and `external_comm` actions require confirmation or approval before execution.

## Dual MCP

- **Development MCP** (Cursor / coding agents) stays on the developer machine. It is not part of the product runtime.
- **Runtime MCP** is a later optional adapter behind the tool port, with allowlists, timeouts, and audit. Do not register IDE MCP servers as product tools.

## What this foundation does not ship

No conversational agent, RAG pipeline, LangGraph domain, Langfuse SDK, or session/tool/trace tables. Those land in later OpenSpec changes behind the ports above.

## Methodology docs

## Local network and health

- Compose PostgreSQL is published on `127.0.0.1` only. Default credentials are local placeholders.
- The process defaults to listen host `127.0.0.1`. `0.0.0.0` is opt-in.
- `/health/live` and `/health/ready` are unauthenticated. That is an explicit exception to authorizing every HTTP route: they expose only liveness and readiness. Later session and tool routes MUST be authorized.

`lidr-specboot/docs/` was not changed by this foundation. Canonical AI-engineering rules remain there.
