# Development Guide

This guide explains how to use this methodology repository and how to stand up a typical local environment for AI agent systems. It is not a clone-and-run guide for a specific product.

Replace placeholders (`your-org`, `your-project`, credentials) in the implementing application. Never commit real secrets.

## What this repository is

`lidr-specboot` provides Spec-Driven Development context for coding agents:

- `docs/` — technical methodology (this folder)
- `ai-specs/` — coding-agent roles and skills
- `AGENTS.md` / `CLAUDE.md` — load-path files that instruct agents to read [base-standards.md](./base-standards.md)

It does **not** include an application runtime. Application code, Docker Compose, and vendor accounts live in the project that adopts this methodology.

## Recommended project layout (implementing repo)

Adapt names; keep hexagonal dependency direction from [backend-standards.md](./backend-standards.md). Two layouts are valid:

**Flattened** (methodology copied to the implementing root):

```
.
├── docs/
├── ai-specs/
├── src/
├── python/                   # optional RAG / eval packages
├── eval/                     # optional
├── docker-compose.yml
├── openspec/
└── README.md
```

**Nested** (this workspace): methodology stays in `lidr-specboot/`, OpenSpec and application code stay at the parent root. Root `AGENTS.md`, `.cursor/rules/`, and `openspec/config.yaml` must prefix methodology paths with `lidr-specboot/`. Agent files that say `docs/` mean `lidr-specboot/docs/`. Cursor project skills must be real directories at `.cursor/skills/<name>/SKILL.md` (a junction into `lidr-specboot/` is not indexed in the `/` picker).

```
.
├── AGENTS.md
├── openspec/
├── lidr-specboot/            # docs/, ai-specs/, methodology agents and skills
├── src/                      # TypeScript orchestration, API, adapters
└── README.md
```

Optional: `web/` only if an operator or HITL UI exists ([frontend-standards.md](./frontend-standards.md)).

## Stack selection

Do not install the full catalog.

| Need | Adopt |
| --- | --- |
| HTTP API, sessions, tools, policy | TypeScript, Node.js |
| Durable state, embeddings | PostgreSQL, pgvector, Docker |
| Ingestion / evaluation jobs | Python (optional) |
| Graph orchestration | LangGraph or an internal state machine (optional; pick one approach per workflow) |
| LLM traces | Langfuse or equivalent (optional) |
| Prompt / agent eval runners | Promptfoo, DeepEval, or equivalent (optional) |
| Deterministic automations | n8n or typed workers (optional) |
| Voice / telephony | Vapi (or another provider) as an adapter (use-case) |
| Runtime tools over MCP | Runtime MCP servers behind the tool port (optional) |

Core local services to run by default: **PostgreSQL with pgvector**. Everything else is opt-in.

## Prerequisites (typical)

- Node.js LTS (project pins the exact version)
- npm, pnpm, or yarn (project choice)
- Docker and Docker Compose
- Git
- Python 3.x only if the project has RAG/eval packages

OpenSpec (recommended for the spec workflow) requires Node.js `20.19.0` or higher when used.

## Environment configuration

Use a `.env` file that is gitignored. Example **placeholders**:

```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/DB_NAME

# LLM adapter (provider-agnostic names; map in adapter config)
LLM_API_KEY=
LLM_BASE_URL=
LLM_MODEL_ID=

# Voice interaction adapter (only if voice is in scope)
VOICE_PROVIDER_API_KEY=
VOICE_WEBHOOK_SECRET=

# Observability adapter (optional)
OBSERVABILITY_PUBLIC_KEY=
OBSERVABILITY_SECRET_KEY=

# Runtime MCP (optional; never reuse Cursor MCP tokens)
RUNTIME_MCP_SERVER_URL=
RUNTIME_MCP_AUTH_TOKEN=
```

Validate required variables at process start. Fail closed if a production secret is missing.

## Local data store

Start PostgreSQL with pgvector via the project's Compose file, for example:

```bash
docker compose up -d postgres
```

Run migrations from the persistence adapter chosen by the project. Do not assume a specific ORM.

## Application services

Typical commands (names vary per project):

```bash
# TypeScript API
npm install
npm run dev
npm test

# Optional Python packages
python -m venv .venv
# activate, then:
pip install -e python/
pytest
```

Do not call paid LLM, voice, or observability APIs from unit tests. Use fakes. Integration tests may use local doubles or explicitly marked live tests.

## Evaluation and observability locally

- Keep frozen eval datasets under version control (redact PII)
- Run the project's eval command in CI and in OpenSpec evaluation gates
- A local observability backend is optional; if absent, traces still must be emitted to a port that can log or no-op

## Development MCP vs runtime MCP

- Configure Cursor / IDE MCP servers for tickets, browsers, and docs
- Configure production/runtime MCP separately, with product credentials
- Never point a production agent at the developer MCP configuration

See [backend-standards.md](./backend-standards.md) § MCP.

## OpenSpec workflow

Recommended command flow (see repository README):

1. `/enrich-us` (optional)
2. `/ff` or `/propose`
3. `/apply`
4. `/verify`
5. `/adversarial-review`
6. `/archive`
7. `/commit`

Gates for `tasks.md` are defined in [openspec-tasks-mandatory-steps.md](./openspec-tasks-mandatory-steps.md).

## Testing matrix (minimum)

| Change type | Required locally |
| --- | --- |
| Deterministic code | Unit tests |
| HTTP contract | Contract tests against [api-spec.yml](./api-spec.yml) |
| Tools | Schema + invocation tests |
| Prompts / agents | Evaluation suite |
| RAG | Retrieval evaluation |
| Voice flows | Conversation evaluation (fixtures; not live calls in unit tests) |
| UI (if any) | Component tests; E2E only for operator-critical paths |

## What not to do

- Do not copy sample ATS/recruiting domain models into a new agent project
- Do not put Vapi, LangChain, or Langfuse types in the domain layer
- Do not commit `.env` files or recorded production transcripts with PII
- Do not skip evaluation because unit tests passed
