# Tasks: ai-agent-runtime-foundation

Change types: **code**, **api**.

Not in this change: tools, agent, RAG, voice, UI. Omit those gates (see section 9).

Reports: `openspec/changes/ai-agent-runtime-foundation/reports/`.

## 0. Setup: Create Feature Branch (MANDATORY - FIRST STEP)

- [x] 0.1 Create and switch to branch `feature/ai-agent-runtime-foundation` from the default branch and verify with `git branch --show-current`

## 1. Project skeleton

- [x] 1.1 Add the TypeScript/Node.js project at the implementing root (`package.json`, `tsconfig.json` with `strict`, Node `engines` >= 20.19, npm scripts for `build`, `start`, `test`) and verify `npm install` succeeds
- [x] 1.2 Create hexagonal folders `src/domain`, `src/application`, `src/adapters/http`, `src/adapters/persistence`, `src/adapters/logging`, `src/composition` and verify the tree matches `design.md` D2
- [x] 1.3 Add `.gitignore` covering `node_modules`, `dist`, `.env`, and coverage output and verify `.env` is untracked

## 2. Configuration (TDD)

- [x] 2.1 Write failing tests for missing and invalid required config (`NODE_ENV`, `PORT`, `DATABASE_URL`) and verify they fail for the right reason
- [x] 2.2 Implement fail-closed config loading (typed schema, no secret echo) and verify those tests pass
- [x] 2.3 Add `.env.example` with placeholders only and verify it contains no real credentials

## 3. Errors and logging (TDD)

- [x] 3.1 Write failing tests that boundary errors map to the canonical envelope (`success: false`, `error.message`, `error.code`) and omit secrets and stack traces
- [x] 3.2 Implement typed errors and the HTTP/error mapper and verify those tests pass
- [x] 3.3 Write failing tests that a named operation logs success and failure without `DATABASE_URL` userinfo or other secrets
- [x] 3.4 Implement the logger port and structured logging adapter and verify those tests pass

## 4. Provider ports (interfaces only)

- [x] 4.1 Add domain port interfaces for LLM (`complete`, `stream`, structured output), speech (`transcribe`, `synthesize`), tools, retrieval, observability, and persistence and verify they compile with `strict` and contain no vendor types
- [x] 4.2 Add an architecture test that `src/domain` and `src/application` do not import LLM, voice, observability vendor SDKs, or a database driver/ORM and verify the test passes
- [x] 4.3 Confirm `package.json` has no Vapi, LangGraph, LangChain, Langfuse, or LLM provider SDK dependency and verify with a package-lock inspection

## 5. Persistence port and Compose (TDD)

- [x] 5.1 Add `docker-compose.yml` for PostgreSQL (pgvector image) and verify `docker compose up -d` starts the service on a clean Docker host
- [x] 5.2 Write a failing test that readiness/persistence ping goes through the persistence port and that connection failures redact credentials
- [x] 5.3 Implement the `pg` adapter (`SELECT 1` with a short timeout, no ORM, no domain tables) and verify those tests pass against local Compose

## 6. Health HTTP (TDD)

- [x] 6.1 Write failing contract tests for `GET /health/live` (alive while the process runs; still alive if persistence is down) and `GET /health/ready` (ready only when persistence ping succeeds)
- [x] 6.2 Implement health use cases and the HTTP adapter and verify live/ready tests pass
- [x] 6.3 Write a failing test for an unexpected health-handler failure using the canonical error envelope and verify it passes after the mapper is wired
- [x] 6.4 Add a project OpenAPI fragment for `/health/live` and `/health/ready` that reuses the canonical error envelope and verify it matches the implemented routes

## 7. Process boot

- [x] 7.1 Wire the composition root (config → logger → persistence → HTTP) so the process listens only after valid config and verify a local start with documented env becomes probeable
- [x] 7.2 Verify default local start does not require LLM, voice, or observability credentials (process becomes live without those variables)

## 8. Review and update tests and eval fixtures (MANDATORY)

- [x] 8.1 Review unit, architecture, and contract tests against every scenario in `specs/*/spec.md` and add any missing case; verify the file list covers bootstrap, config, errors, logs, ports, persistence redaction, live, and ready
- [x] 8.2 Skip eval fixture authoring — no agent, prompt, tool, RAG, or voice surface in this change

## 9. Run verification gates (MANDATORY - AGENT MUST EXECUTE)

- [x] 9.1 Unit tests + database state (MANDATORY - AGENT MUST EXECUTE): start Compose, run the unit/integration suite without paid APIs, ping persistence through the port, restore no mutated domain rows (none expected), and write `openspec/changes/ai-agent-runtime-foundation/reports/YYYY-MM-DD-unit-test-and-db-verification.md`
- [x] 9.2 Contract tests (MANDATORY - AGENT MUST EXECUTE): start the app, exercise `GET /health/live` and `GET /health/ready` (ready and not-ready), assert status codes and the error envelope, and record commands and responses in the same reports folder
- [x] 9.3 Skip tool-calling tests — no product tools in this change
- [x] 9.4 Skip agent/prompt evaluation — no generative path; `create-evals` does not apply
- [x] 9.5 Skip RAG evaluation — no retrieval implementation
- [x] 9.6 Skip voice conversation evaluation — no voice adapter
- [x] 9.7 Skip UI E2E — no frontend
- [x] 9.8 Skip adversarial tool-expansion tests — no new tool trust boundary; secret-redaction unit tests remain in 9.1

## 10. Update technical documentation (MANDATORY)

- [x] 10.1 Add the implementing-repo README (prerequisites, `.env.example`, Compose, start, test) and verify a reader can follow it without implicit steps
- [x] 10.2 Document layering, ports, “voice adapter ≠ runtime,” reserved HITL policy for later `write` / `irreversible` / `external_comm` tools, and dual MCP, and verify the note lives in the implementing repo (not a fork of `lidr-specboot/docs/`)
- [x] 10.3 Confirm `lidr-specboot/docs/` needs no update (methodology unchanged) and note that confirmation in the README or change report

## 11. Adversarial-review remediations

- [x] 11.1 Write a failing test that Compose publishes Postgres on `127.0.0.1` and verify it fails against the all-interfaces mapping
- [x] 11.2 Bind Compose to `127.0.0.1:5433:5432` and verify that test passes
- [x] 11.3 Write failing tests that omitted `LISTEN_HOST` defaults to `127.0.0.1` and an invalid host fails closed without echoing secrets
- [x] 11.4 Implement optional `LISTEN_HOST` (default loopback) and verify those tests pass and local start listens on `127.0.0.1`
- [x] 11.5 Write failing tests that logs and error mapping redact bearer tokens, `sk-` keys, and `*_API_KEY=` assignments
- [x] 11.6 Extend `redactSecrets` and verify those tests pass
- [x] 11.7 Ignore `.env.*` except `.env.example` and verify the hygiene test rejects committing `.env.local` / `.env.production`

## 12. Review remediations and re-run gates (MANDATORY)

- [x] 12.1 Review tests against the new loopback, listen-host, redaction, and env-ignore scenarios and verify coverage
- [x] 12.2 Skip eval fixture authoring — still no agent, prompt, tool, RAG, or voice surface
- [x] 12.3 Unit tests + database state (MANDATORY - AGENT MUST EXECUTE): run the suite, confirm Compose loopback + persistence ping, write `openspec/changes/ai-agent-runtime-foundation/reports/YYYY-MM-DD-unit-test-and-db-verification.md`
- [x] 12.4 Contract tests (MANDATORY - AGENT MUST EXECUTE): probe live/ready on loopback and record results in the reports folder
- [x] 12.5 Skip tool, agent, RAG, voice, UI, and adversarial tool-expansion gates — unchanged non-goals
- [x] 12.6 Update README and architecture notes: loopback Compose, local-only credentials, default listen host, unauthenticated health exception, and verify a reader can follow them
