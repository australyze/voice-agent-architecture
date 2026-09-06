# runtime-observability Specification

## Purpose

Gives AI Engineers reconstructable, secret-safe records of a runtime execution so they can diagnose errors, latency, consumption, and agent-step behavior without a vendor console or a product dashboard.

## Requirements

### Requirement: One correlation identity reconstructs an execution

Every production execution that enters the agent path MUST share one `traceId` across the inbound request record, the agent-turn record, and child LLM, tool, and retrieval records. When a session identifier, request identifier, or interaction identifier is already available and valid, those values MUST appear on the same records. An engineer MUST be able to select all records for one run by `traceId`.

#### Scenario: Successful voice inbound run is reconstructable

- **WHEN** a valid inbound voice turn completes a successful agent reply after retrieval and optional tool use
- **THEN** the observability port receives records that share one `traceId` for request, agent turn, retrieval, LLM, and tool (when a tool ran), and include the valid session identifier plus any inbound request or interaction identifiers

#### Scenario: Failed run keeps the same identity

- **WHEN** a turn fails after an LLM, tool, or retrieval error
- **THEN** the error records use the same `traceId` as the request and agent-turn records for that execution

### Requirement: Step kinds are distinguishable

Emitted records MUST use distinct kinds so LLM, tool, retrieval, inbound request, and agent-turn steps are not interchangeable. Request records MUST use kind `http`. Agent-turn records MUST use kind `workflow`. Child records MUST keep kinds `llm`, `tool`, and `retrieval`.

#### Scenario: Kinds are distinct on a tool hop

- **WHEN** a turn retrieves knowledge, calls the model, and executes an allowlisted tool
- **THEN** the observability port receives at least one record of each kind `http`, `workflow`, `retrieval`, `llm`, and `tool`

### Requirement: Orchestrated runs share one correlation identity

Every production execution that enters the orchestrated path MUST share one `traceId` across the demo HTTP request record, the orchestration workflow record, route and handoff records, and the specialist LLM record when a specialist ran. When a session identifier or request identifier is already available and valid, those values MUST appear on the same records.

#### Scenario: Successful orchestrate run is reconstructable

- **WHEN** a valid `POST /demo/orchestrate` request completes after one specialist model call
- **THEN** the observability port receives records that share one `traceId` for the HTTP request, the orchestration workflow, the route record, the handoff record, and the specialist LLM record

#### Scenario: Failed orchestrate run keeps the same identity

- **WHEN** an orchestrated request fails as `unroutable` or after a specialist error
- **THEN** the error records use the same `traceId` as the request and orchestration workflow records for that execution

### Requirement: Route and handoff steps are distinguishable

Orchestrated executions MUST emit workflow records named so route and handoff are distinguishable from the parent orchestration and from `runtime-demo` agent-turn records. Route and handoff records MUST use kind `workflow` with names `orchestration.route` and `orchestration.handoff`. Specialist model calls MUST keep kind `llm`. Health-check routes MUST NOT be required to emit those records.

#### Scenario: Happy path emits route and handoff

- **WHEN** intent `normalize` is routed and the specialist completes
- **THEN** the observability port receives workflow records named `orchestration.route` and `orchestration.handoff` plus an `llm` record for `demo-normalize`

#### Scenario: Unroutable emits route without specialist LLM

- **WHEN** the request is `unroutable`
- **THEN** a route record is present and no specialist `llm` record is required

### Requirement: Latency and status are recorded

Every request, agent-turn, LLM, tool, and retrieval record MUST include a latency in milliseconds and a status of `ok` or `error`. Error records MUST include a stable error class and MUST NOT include secret values.

#### Scenario: Error records latency and class

- **WHEN** structured output validation fails
- **THEN** the LLM record has status `error`, a latency value, a stable validation-failure class, and no secret values

#### Scenario: Success records latency

- **WHEN** a retrieval, LLM call, and agent turn all succeed
- **THEN** those records have status `ok` and a latency value each

### Requirement: Consumption is recorded when known

An LLM record MUST include input and output token counts and an estimated cost when the model path reports them. When the model path does not report usage, those fields MUST be omitted rather than invented.

#### Scenario: Reported usage is copied onto the LLM record

- **WHEN** the model path returns token counts (and optionally cost) for a structured completion
- **THEN** the LLM observability record includes those values

#### Scenario: Unknown usage is omitted

- **WHEN** the model path does not report token counts
- **THEN** the LLM record is still emitted with kind, latency, and status, and does not invent token or cost numbers

### Requirement: Default emit is structured and secret-safe

The process default observability adapter MUST write structured, machine-readable lines that include reconstructable metadata: `traceId`, kind, name, status, latency, error class when present, session and inbound identifiers when present, and consumption fields when present. The default adapter MUST NOT write secrets, raw user utterances, unredacted tool argument values, full retrieved chunk bodies, or API keys. Retrieval spans on the port MUST NOT include raw query text (a bounded hash is allowed). An in-memory collector MAY retain those hashed or metadata-only span objects in tests only. Secret-shaped caller correlation ids MUST be redacted on the composed default logger path.

#### Scenario: Default emit includes reconstructable metadata

- **WHEN** the default adapter emits a successful tool span
- **THEN** the structured line includes `traceId`, kind `tool`, name, status `ok`, and latency, and does not include raw user text or secret values

#### Scenario: Default adapter still does not retain payloads in memory

- **WHEN** the application starts with the default observability adapter and handles a tool hop
- **THEN** the adapter does not accumulate span payloads on an in-process list

#### Scenario: Composed default path redacts secret-shaped request ids

- **WHEN** the default logging adapter emits a span whose `requestId` matches a secret key shape
- **THEN** the structured JSON line does not contain the secret value

#### Scenario: Retrieval span does not carry caller speech

- **WHEN** a turn retrieves knowledge for a user utterance
- **THEN** the retrieval span on the observability port does not include that utterance as query text

### Requirement: Emission stays vendor-ready and vendor-free

Domain and application MUST publish records only through the existing observability port. A later observability-platform adapter MUST be able to implement that port without rewriting use cases. This increment MUST NOT add an observability vendor SDK or require a networked observability backend to become live.

#### Scenario: Default start needs no observability vendor

- **WHEN** the application starts in its default local configuration
- **THEN** it becomes live without an observability-vendor credential or network export

#### Scenario: Core has no observability vendor SDK

- **WHEN** a reviewer inspects domain, application, and package manifests
- **THEN** those layers have no observability-vendor SDK imports and no such package is declared
