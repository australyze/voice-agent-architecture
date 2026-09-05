# Voice Agent Architecture

Implementing repository for an AI Agent Runtime. Methodology lives in `lidr-specboot/`. OpenSpec changes live in `openspec/`.

This foundation is a bootable hexagonal process: configuration, health probes, secret-safe logs, and PostgreSQL connectivity through a port. It is not a voice vendor and not an LLM product.

Architecture decisions that bind later components: [docs/architecture.md](./docs/architecture.md).

## Prerequisites

- Node.js 20.19.0 or newer (see `.nvmrc`)
- npm
- Docker and Docker Compose
- Git

## Setup

```bash
git clone <repository-url>
cd "Voice Agent Architecture"
npm install
cp .env.example .env
docker compose up -d
```

Wait until PostgreSQL is healthy (`docker compose ps`). The database is published on **127.0.0.1:5433** only (loopback) so it is not reachable from other machines. Port 5433 avoids colliding with a local PostgreSQL on 5432. The Compose user and password are **local placeholders**. Do not reuse them outside this Compose file.

The Compose service uses the `pgvector/pgvector` image so later retrieval work does not redo local infrastructure. This change does not query embeddings.

`.env` and `.env.*` (except `.env.example`) are gitignored. Do not commit real secrets. `.env.example` contains local placeholders only.

Required environment variables:

| Name | Purpose |
| --- | --- |
| `NODE_ENV` | `development`, `test`, or `production` |
| `PORT` | HTTP port |
| `LISTEN_HOST` | Optional. Defaults to `127.0.0.1`. Set `0.0.0.0` only when an orchestrator on a controlled network must probe the process. |
| `DATABASE_URL` | PostgreSQL URL used through the persistence port |

LLM, voice, and observability credentials are not required to start.

## Run

```bash
npm start
```

The process validates configuration at start and exits with a non-zero status if required values are missing or invalid. It does not serve traffic until configuration is valid.

Health probes (unauthenticated by design; they return only alive/ready, not product data):

- `GET /health/live` — process is running (does not query persistence)
- `GET /health/ready` — persistence ping succeeds

The process listens on `LISTEN_HOST` (default `127.0.0.1`). Probe from this machine unless you opted into a different bind.

Contract: [openapi/health.yaml](./openapi/health.yaml). Errors use the canonical envelope from `lidr-specboot/docs/api-spec.yml` (`success: false`, `error.message`, `error.code`).

## Test

```bash
npm test
```

Core tests use in-process fakes. They do not call paid LLM, voice, or observability APIs. Persistence adapter tests may use the local Compose database when it is running.

```bash
npm run typecheck
```

## Layout

```text
src/domain          application core and ports
src/application     use cases
src/adapters        HTTP, PostgreSQL, logging
src/composition     process entry
```

`lidr-specboot/docs/` was not modified for this foundation. See [docs/architecture.md](./docs/architecture.md).
