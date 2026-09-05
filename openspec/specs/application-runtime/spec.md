# application-runtime Specification

## Purpose

Defines how the AI Agent Runtime process starts, loads configuration, reports failures, and logs operations without leaking secrets or coupling the core to a vendor.

## Requirements

### Requirement: Process starts from documented configuration

The application MUST start in a local environment when the documented required configuration is present and valid. Starting MUST NOT require undocumented manual steps.

#### Scenario: Valid local configuration

- **WHEN** a developer provides the documented required configuration and starts the application
- **THEN** the process becomes ready to accept health probes without additional undocumented setup

#### Scenario: Documented clone-to-run path

- **WHEN** a developer clones the repository and follows the install documentation
- **THEN** they can start the application and run the automated tests for this change

### Requirement: Configuration fails closed

The application MUST validate required configuration at process start. If required configuration is missing or invalid, the process MUST exit without serving traffic. Secrets MUST NOT be stored in source control.

#### Scenario: Missing required configuration

- **WHEN** a required configuration value is absent at start
- **THEN** the process exits with a non-zero status and an explicit error that does not include secret values

#### Scenario: Invalid required configuration

- **WHEN** a required configuration value is present but invalid
- **THEN** the process exits with a non-zero status and an explicit error that does not include secret values

#### Scenario: Secrets stay out of source

- **WHEN** a reviewer inspects the committed repository
- **THEN** no real secret values appear in tracked source, and secret files including `.env` and `.env.*` variants except `.env.example` are excluded from version control

### Requirement: Boundary errors use a consistent envelope

When an error crosses an HTTP boundary, the application MUST return the canonical error envelope from `lidr-specboot/docs/api-spec.yml`: `success` is `false`, and `error` contains `message` and `code`. The envelope MUST NOT include secrets, stack traces, or provider internals.

#### Scenario: Handled application error at the HTTP edge

- **WHEN** a handled application error is returned over HTTP
- **THEN** the response body matches the canonical error envelope and omits secrets and stack traces

#### Scenario: Unexpected error at the HTTP edge

- **WHEN** an unexpected error is returned over HTTP
- **THEN** the response uses the same envelope with a generic safe message and a stable error code

### Requirement: Operation logging is secret-safe

The application MUST emit logs that identify the operation and whether it succeeded or failed. Logs MUST NOT contain secrets or unnecessary sensitive data.

#### Scenario: Successful operation is identifiable

- **WHEN** a named operation completes successfully
- **THEN** a log entry identifies the operation and a success outcome

#### Scenario: Failed operation is identifiable

- **WHEN** a named operation fails
- **THEN** a log entry identifies the operation and a failure outcome without secret values

#### Scenario: Common secret shapes are redacted

- **WHEN** a log or mapped error message contains a Postgres URL, a bearer token, a `sk-` style key, or an `*_API_KEY=` assignment
- **THEN** those values are replaced before the line is written

### Requirement: Local process listens on loopback by default

The application MUST listen on a configurable host. When listen host is omitted, the default MUST be loopback (`127.0.0.1`). An invalid listen host MUST fail closed at configuration time.

#### Scenario: Default listen host is loopback

- **WHEN** required configuration is valid and listen host is not set
- **THEN** the process listens on `127.0.0.1`

#### Scenario: Invalid listen host fails closed

- **WHEN** listen host is present and is not a valid IPv4, IPv6, or hostname value
- **THEN** the process exits without serving traffic and the error does not include secrets

### Requirement: Core is testable without paid providers

Deterministic core behavior MUST be testable without calling real LLM, voice, embedding, or paid observability services.

#### Scenario: Core tests run offline from paid APIs

- **WHEN** the automated core tests for this change run
- **THEN** they pass without network calls to paid AI or observability providers

### Requirement: Voice-channel configuration is optional at process start

The process MUST start when documented required configuration is valid even if voice-channel credentials, endpoints, and timeouts are absent. When any voice-channel setting is present, the set MUST be validated; invalid present values MUST fail closed at start without logging secret values. Secrets MUST remain out of source control.

#### Scenario: Start without voice credentials

- **WHEN** required process configuration is valid and voice-channel settings are omitted
- **THEN** the process becomes live and does not exit because a voice vendor is unconfigured

#### Scenario: Invalid present voice setting fails closed

- **WHEN** a voice-channel setting is present and invalid
- **THEN** the process exits without serving traffic and the error does not include secret values

#### Scenario: Voice placeholders only in examples

- **WHEN** a reviewer inspects tracked environment examples
- **THEN** voice credentials appear only as empty or placeholder values and real secrets are not committed

### Requirement: Voice handling timeout is configurable

The runtime MUST apply a configurable timeout to inbound voice-turn handling. When the timeout setting is omitted, the process MUST use a documented default. The default MUST be suitable for a voice turn (tighter than unconstrained chat).

#### Scenario: Default timeout applies

- **WHEN** voice handling timeout is not set and a turn is processed
- **THEN** the runtime still enforces the documented default timeout

### Requirement: Runtime owns the agent-turn use case

The application runtime MUST retrieve and assemble current-turn knowledge, pack prompt and current-turn context, invoke the LLM port, authorize and execute allowlisted tools, validate structured output, and return a typed agent result including sources when hits were used. Voice and other adapters MUST invoke that use case rather than call an LLM, tool, or retrieval port directly.

#### Scenario: Adapter does not call the LLM port

- **WHEN** a valid inbound voice turn is processed
- **THEN** the voice adapter invokes the runtime agent-turn path and does not import or call the LLM port itself

#### Scenario: Typed agent success

- **WHEN** the agent-turn use case completes with a valid reply
- **THEN** the result includes reply text, locale, a success status the adapter can map, and a sources list (empty when no hit was used)

#### Scenario: Adapter does not call the retrieval port

- **WHEN** a valid inbound voice turn is processed
- **THEN** the voice adapter does not import or call the retrieval port itself

### Requirement: LLM and tool failures are normalized

The runtime MUST classify agent-path failures with stable codes covering at least: `invalid_output`, `tool_denied`, `tool_invalid_args`, `tool_failed`, `tool_timeout`, `llm_timeout`, and `llm_provider`. Messages MUST be safe. Stack traces, secrets, raw provider payloads, and unredacted tool arguments MUST NOT appear on the adapter-facing result.

#### Scenario: Invalid model output is normalized

- **WHEN** the LLM returns output that fails the structured-output schema after the bounded retry
- **THEN** the use case returns `invalid_output` and no tool executes

#### Scenario: Provider error is safe

- **WHEN** the LLM adapter reports a provider or network failure
- **THEN** the use case returns `llm_provider` with a generic safe message and no provider payload

#### Scenario: Invalid tool arguments are normalized

- **WHEN** the model proposes an allowlisted tool with schema-invalid arguments
- **THEN** the use case returns `tool_invalid_args` and the tool body does not run

### Requirement: LLM configuration is optional at process start

The process MUST start when documented required configuration is valid even if LLM credentials and endpoints are absent. When any LLM setting is present, the set MUST be validated; invalid present values MUST fail closed at start without logging secret values. Tracked environment examples MUST use empty or placeholder LLM secrets only.

#### Scenario: Start without LLM credentials

- **WHEN** required process configuration is valid and LLM settings are omitted
- **THEN** the process becomes live using the in-process fake or non-networked LLM adapter and does not exit because an LLM vendor is unconfigured

#### Scenario: Invalid present LLM setting fails closed

- **WHEN** an LLM setting is present and invalid
- **THEN** the process exits without serving traffic and the error does not include secret values

### Requirement: Tool composition does not require MCP

Default process composition MUST wire the in-process native tool registry only. Starting MUST succeed when no MCP server, MCP URL, or MCP credential is present. Present-but-unused MCP settings MUST NOT silently enable a product tool source in this increment.

#### Scenario: Start without MCP

- **WHEN** required process configuration is valid and no MCP settings are provided
- **THEN** the process becomes live and tool execution uses the native registry only

### Requirement: Model and tool calls emit secret-safe traces

Each model call and tool attempt on the agent path MUST emit an observability span through the existing observability port. A model span MUST include prompt id and version, model id, latency, validation outcome, and status. A tool span MUST include tool name, `source`, redacted arguments, bounded result or error code, validation outcome, latency, and status. A no-op or logging adapter is sufficient; a vendor observability SDK MUST NOT be required.

#### Scenario: Successful tool hop is traced

- **WHEN** a turn executes `demo.normalize_text` successfully
- **THEN** the observability port receives an `llm` span and a `tool` span with status `ok`, `source` `native`, and no secret values

#### Scenario: Failed validation is traced

- **WHEN** structured output validation fails
- **THEN** the observability port receives an `llm` span with status `error` and a validation-failure outcome

### Requirement: Default observability does not retain turn payloads

The process default observability adapter MUST NOT accumulate unbounded span payloads in process memory. Tool spans MUST NOT store raw or normalized user text. An in-memory collector is allowed in tests only.

#### Scenario: Default server does not keep normalized user text

- **WHEN** the application starts with the default observability adapter and handles a tool hop
- **THEN** the adapter does not retain `normalizedText` or unredacted user text on an in-process list

### Requirement: Knowledge composition does not require a live store

Default process composition MUST wire an in-process knowledge store and a non-networked embed path when paid embedding credentials are absent. Starting MUST succeed without vector-database, embedding-vendor, or knowledge-HTTP settings. Canonical HTTP `registerDocument` and `queryKnowledge` MUST remain unimplemented.

#### Scenario: Start without retrieval credentials

- **WHEN** required process configuration is valid and embedding or vector-vendor settings are omitted
- **THEN** the process becomes live and knowledge uses the in-process store

#### Scenario: Knowledge HTTP stays unimplemented

- **WHEN** a client calls `POST /knowledge/documents` or `POST /knowledge/query`
- **THEN** the server does not expose those product operations in this increment

### Requirement: Retrieval calls emit secret-safe traces

Each retrieval on the agent path MUST emit an observability span with kind `retrieval`. The span MUST include query text that is safe to log (no secrets), hit ids, scores, locators or a bounded hit summary, corpus version, retriever version, latency, and status. Retrieved chunk bodies MUST NOT be logged in full on the default adapter.

#### Scenario: Successful retrieve is traced

- **WHEN** a turn retrieves at least one above-threshold hit
- **THEN** the observability port receives a `retrieval` span with status `ok`, hit ids, and no secret values

#### Scenario: Empty retrieve is traced

- **WHEN** a turn retrieves no above-threshold hit
- **THEN** the observability port receives a `retrieval` span that records an empty or below-threshold outcome

#### Scenario: Failed retrieve is traced

- **WHEN** embed or retrieve throws
- **THEN** the observability port receives a `retrieval` span with status `error` and the turn fails as `retrieval_failed`

### Requirement: Retrieval and LLM failures include retrieval_failed

The runtime MUST classify embed or retrieve exceptions as `retrieval_failed` with a secret-safe message. Voice mapping MUST treat that code as a runtime failure, not as a successful reply.

#### Scenario: Embed throw is retrieval_failed

- **WHEN** the embed capability throws during a turn
- **THEN** the agent result is `retrieval_failed` and no structured completion runs

### Requirement: Agent reply text is bounded

A schema-valid `reply` decision whose `replyText` exceeds the documented maximum MUST be treated as `invalid_output` and MUST NOT be returned to the consumer.

#### Scenario: Overlong reply is rejected

- **WHEN** the model returns a schema-shaped reply whose text exceeds the documented limit
- **THEN** the turn fails as `invalid_output`
