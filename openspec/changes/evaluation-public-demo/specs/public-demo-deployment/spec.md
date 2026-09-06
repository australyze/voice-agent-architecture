## Purpose

Makes the WOM voice demonstration reachable by an interviewer from the public internet with a stable HTTPS backend, hosted persistence, and documented secret-safe environment configuration, without claiming to be an official WOM production product.

## ADDED Requirements

### Requirement: Public frontend on Vercel

The demonstration frontend MUST be deployable to Vercel as a static (or SPA) build of the existing `web/` application. The public URL MUST load the demo UI without requiring the interviewer’s machine to run the Vite dev server. Client environment variables MUST be limited to public values (Vapi public key, assistant id, public API base URL, and the read-only demo token or passcode as documented) and MUST NOT include inbound secrets, service-role keys, or database URLs.

#### Scenario: Public URL serves the demo shell

- **WHEN** an interviewer opens the documented Vercel URL
- **THEN** the WOM demo UI loads and can initiate the existing voice client configuration path

### Requirement: Public backend HTTPS on Render

The application HTTP API MUST be deployable to Render (free tier as the documented default) with a stable HTTPS base URL. That URL MUST accept Vapi server events on the existing voice inbound route and MUST serve session report reads used by the demo. Cold start delay is acceptable for portfolio use but the process MUST remain a long-running Node server (not the default path for this demo). Railway or Fly.io MAY be documented as alternatives; Vercel serverless MUST NOT be the recommended backend host for this change.

#### Scenario: Inbound reaches the deployed backend

- **WHEN** the Vapi assistant Server URL is set to the Render HTTPS origin plus the inbound path and a new demo call is started from the public frontend
- **THEN** the deployed backend receives the inbound traffic and a Session can be persisted in the hosted store

### Requirement: Hosted Postgres remains Supabase Cloud

Public demo persistence MUST use Supabase Cloud PostgreSQL with the existing session-history schema (and any additive evaluation column/migration from this change). The change MUST NOT introduce a second product database technology. Local Compose Postgres MAY remain for local readiness and tests.

#### Scenario: Deployed report reads from hosted store

- **WHEN** a completed public demo call has been ingested by the deployed backend
- **THEN** `GET /sessions/{sessionId}` (or filtered list by `externalChannelId`) against the Render API returns the report backed by Supabase Cloud data

### Requirement: Environment and secret hygiene for deploy

All required deployment environment variable **names** MUST be documented in root and `web/` `.env.example` files. Secret **values** MUST NOT be committed. Backend env MUST hold inbound secret, demo-operator secret, optional `DEMO_PUBLIC_TOKEN`, Supabase URL and service-role key, and LLM/voice server secrets as already required. Frontend env on Vercel MUST NOT receive service-role or database credentials. Logs and health responses MUST NOT echo secrets.

#### Scenario: Example env has names without values

- **WHEN** a reviewer inspects committed `.env.example` files after this change
- **THEN** new variables appear as empty placeholders or comments and no live credentials are present in git

### Requirement: Vapi Server URL points at deployed backend

Updating the Vapi assistant Server URL to the deployed backend MUST be an in-scope verified Definition-of-Done step. The default procedure MUST be a documented manual dashboard update using the candidate’s credentials (never committed). An optional one-off script using a narrowly scoped Vapi API key MAY be provided. Continuous integration MUST NOT mutate the live assistant configuration.

#### Scenario: New public call persists through deployed Server URL

- **WHEN** the assistant Server URL targets the Render backend and an interviewer completes a supported Spanish scenario on the public URL
- **THEN** a SessionReport exists in the hosted store for that call with transcript and/or tool evidence as applicable

### Requirement: End-to-end public verification is documented

Documentation MUST describe how to open the public URL, start voice, run a supported scenario, end the call, and confirm the persisted report and evaluation are visible. The verification record for this change MUST state whether that path passed in the deployed environment (without embedding secrets).

#### Scenario: Interview demo procedure is reproducible from docs

- **WHEN** a reader follows the documented interview demo procedure
- **THEN** they can locate the public URL, required passcode/token step, supported utterances, and where evaluation appears after hang-up
