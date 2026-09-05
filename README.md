# Voice Agent Architecture

Implementing repository for an AI Agent Runtime. Methodology lives in `lidr-specboot/`. OpenSpec changes live in `openspec/`.

This repository is a bootable hexagonal AI Agent Runtime plus an inbound voice channel adapter. Vapi is an interaction adapter, not the runtime. The first voice turn returns a deterministic runtime placeholder (no LLM).

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
| `VOICE_INBOUND_SECRET` | Optional shared secret for `POST /adapters/voice/inbound`. Empty means not configured. |
| `VOICE_PROVIDER_API_KEY` | Optional provider credential for a later live smoke. Not required to start. |
| `VOICE_PROVIDER_BASE_URL` | Optional `http(s)` URL. If present it must be valid. |
| `VOICE_TIMEOUT_MS` | Optional handling timeout. Default `2000`. |
| `VOICE_DEFAULT_LOCALE` | Optional language tag. Default `es`. |

The process starts without voice credentials. Invalid *present* voice settings fail closed.

## Run

```bash
npm start
```

The process validates configuration at start and exits with a non-zero status if required values are missing or invalid. It does not serve traffic until configuration is valid.

Health probes (unauthenticated by design; they return only alive/ready/voice status, not conversation data):

- `GET /health/live` — process is running (does not query persistence)
- `GET /health/ready` — persistence ping succeeds (voice is **not** required)
- `GET /health/voice` — `not_configured` \| `configured` \| `error`

Inbound voice (authenticated when configured):

- `POST /adapters/voice/inbound` — simulator/Vapi-facing adapter. Not `/ingress/interaction`.

The process listens on `LISTEN_HOST` (default `127.0.0.1`). Probe from this machine unless you opted into a different bind.

Contract: [openapi/health.yaml](./openapi/health.yaml). Adapter field notes: [docs/adapters/vapi-inbound.md](./docs/adapters/vapi-inbound.md). Errors use the canonical envelope from `lidr-specboot/docs/api-spec.yml` (`success: false`, `error.message`, `error.code`).

### Simulator test

```bash
npm test
```

The suite includes an in-process POST to `/adapters/voice/inbound`. No Vapi account is required.

```bash
curl -s http://127.0.0.1:3000/health/voice
```

Configured example (put the secret only in `.env`):

```bash
curl -s -X POST http://127.0.0.1:3000/adapters/voice/inbound -H "content-type: application/json" -H "x-voice-inbound-secret: YOUR_SECRET" -d "{\"eventType\":\"transcript\",\"occurredAt\":\"2026-09-05T12:00:00.000Z\",\"inputText\":\"hola\",\"sessionId\":\"11111111-1111-4111-8111-111111111111\"}"
```

Logs are JSON lines. Successful turns use `operation=voice.turn` with correlation ids, `eventType`, `processingTimeMs`, and `status`. Secrets and raw utterances are not logged.

### Optional live Vapi smoke

Not required for Definition of Done. Tunnel loopback if needed and point an engineer-only Vapi server URL at `/adapters/voice/inbound`. See the adapter note. Do not attach a customer number.

### Common errors

| Code | Meaning |
| --- | --- |
| `VOICE_CONFIG` | Voice env absent or inbound used while unconfigured |
| `UNAUTHORIZED` | Missing or wrong `x-voice-inbound-secret` |
| `VOICE_PAYLOAD_INVALID` | Body failed strict validation |
| `VOICE_EVENT_UNSUPPORTED` | `eventType` is not `transcript` |
| `VOICE_TIMEOUT` | Handling exceeded `VOICE_TIMEOUT_MS` |

To expose beyond this machine, set `LISTEN_HOST=0.0.0.0` only on a controlled network.

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
src/adapters        HTTP, voice inbound, PostgreSQL, logging
src/composition     process entry
```

`lidr-specboot/docs/` was not modified for this increment. See [docs/architecture.md](./docs/architecture.md).
