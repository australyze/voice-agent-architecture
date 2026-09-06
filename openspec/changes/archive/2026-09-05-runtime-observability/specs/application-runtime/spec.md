## ADDED Requirements

### Requirement: Request and agent-turn parent spans are emitted

Each inbound product request that runs the agent path MUST emit an `http` span for the request and a `workflow` span for the agent turn. Child LLM, tool, and retrieval spans MUST set a parent identifier that points at the agent-turn span. Health-check routes that do not run the agent path MUST NOT be required to emit those parent spans.

#### Scenario: Inbound voice request emits parents

- **WHEN** a valid inbound voice request runs the agent-turn path
- **THEN** the observability port receives an `http` span and a `workflow` span that share the execution `traceId`

#### Scenario: Children point at the turn

- **WHEN** the agent-turn path emits an LLM span
- **THEN** that span includes the same `traceId` as the `workflow` span and a parent identifier for that turn

## MODIFIED Requirements

### Requirement: Model and tool calls emit secret-safe traces

Each model call and tool attempt on the agent path MUST emit an observability span through the existing observability port. A model span MUST include prompt id and version, model id, latency, validation outcome, status, `traceId`, and parent identifier. A tool span MUST include tool name, `source`, redacted arguments, bounded result or error code, validation outcome, latency, status, `traceId`, and parent identifier. Token counts and estimated cost MUST be copied onto the model span when the model path reports them and MUST be omitted when unknown. A no-op or logging adapter is sufficient; a vendor observability SDK MUST NOT be required.

#### Scenario: Successful tool hop is traced

- **WHEN** a turn executes `demo.normalize_text` successfully
- **THEN** the observability port receives an `llm` span and a `tool` span with status `ok`, `source` `native`, a shared `traceId`, and no secret values

#### Scenario: Failed validation is traced

- **WHEN** structured output validation fails
- **THEN** the observability port receives an `llm` span with status `error`, a validation-failure outcome, latency, and the execution `traceId`

### Requirement: Default observability does not retain turn payloads

The process default observability adapter MUST NOT accumulate unbounded span payloads in process memory. The default adapter MUST emit structured reconstructable metadata (identifiers, kind, name, latency, status, error class, consumption when present). Tool spans MUST NOT store raw or normalized user text on the default emit path. An in-memory collector is allowed in tests only.

#### Scenario: Default server does not keep normalized user text

- **WHEN** the application starts with the default observability adapter and handles a tool hop
- **THEN** the adapter does not retain `normalizedText` or unredacted user text on an in-process list

#### Scenario: Default emit writes reconstructable metadata

- **WHEN** the default adapter handles a successful tool hop
- **THEN** the structured emit includes `traceId`, kind, name, latency, and status, and does not include raw user text or secrets

### Requirement: Retrieval calls emit secret-safe traces

Each retrieval on the agent path MUST emit an observability span with kind `retrieval`. The span MUST include `traceId`, parent identifier, hit ids, scores, locators or a bounded hit summary, corpus version, retriever version, latency, and status. The span MUST NOT carry raw or secret-redacted caller query text. A bounded query hash MAY appear on the port object for collectors. Retrieved chunk bodies and raw user utterances MUST NOT be written on the default adapter emit. Empty or below-threshold outcomes and failures MUST still emit a retrieval span.

#### Scenario: Successful retrieve is traced

- **WHEN** a turn retrieves at least one above-threshold hit
- **THEN** the observability port receives a `retrieval` span with status `ok`, hit ids, the execution `traceId`, no raw query text, and no secret values

#### Scenario: Empty retrieve is traced

- **WHEN** a turn retrieves no above-threshold hit
- **THEN** the observability port receives a `retrieval` span that records an empty or below-threshold outcome and the execution `traceId`

#### Scenario: Failed retrieve is traced

- **WHEN** embed or retrieve throws
- **THEN** the observability port receives a `retrieval` span with status `error`, the execution `traceId`, and the turn fails as `retrieval_failed`
