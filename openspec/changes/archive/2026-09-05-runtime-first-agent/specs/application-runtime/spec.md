## ADDED Requirements

### Requirement: Runtime owns the agent-turn use case

The application runtime MUST pack prompt and current-turn context, invoke the LLM port, authorize and execute allowlisted tools, validate structured output, and return a typed agent result. Voice and other adapters MUST invoke that use case rather than call an LLM or tool port directly.

#### Scenario: Adapter does not call the LLM port

- **WHEN** a valid inbound voice turn is processed
- **THEN** the voice adapter invokes the runtime agent-turn path and does not import or call the LLM port itself

#### Scenario: Typed agent success

- **WHEN** the agent-turn use case completes with a valid reply
- **THEN** the result includes reply text, locale, and a success status the adapter can map

### Requirement: LLM and tool failures are normalized

The runtime MUST classify agent-path failures with stable codes covering at least: `invalid_output`, `tool_denied`, `tool_failed`, `tool_timeout`, `llm_timeout`, and `llm_provider`. Messages MUST be safe. Stack traces, secrets, raw provider payloads, and unredacted tool arguments MUST NOT appear on the adapter-facing result.

#### Scenario: Invalid model output is normalized

- **WHEN** the LLM returns output that fails the structured-output schema after the bounded retry
- **THEN** the use case returns `invalid_output` and no tool executes

#### Scenario: Provider error is safe

- **WHEN** the LLM adapter reports a provider or network failure
- **THEN** the use case returns `llm_provider` with a generic safe message and no provider payload

### Requirement: LLM configuration is optional at process start

The process MUST start when documented required configuration is valid even if LLM credentials and endpoints are absent. When any LLM setting is present, the set MUST be validated; invalid present values MUST fail closed at start without logging secret values. Tracked environment examples MUST use empty or placeholder LLM secrets only.

#### Scenario: Start without LLM credentials

- **WHEN** required process configuration is valid and LLM settings are omitted
- **THEN** the process becomes live using the in-process fake or non-networked LLM adapter and does not exit because an LLM vendor is unconfigured

#### Scenario: Invalid present LLM setting fails closed

- **WHEN** an LLM setting is present and invalid
- **THEN** the process exits without serving traffic and the error does not include secret values

### Requirement: Model and tool calls emit secret-safe traces

Each model call and tool attempt on the agent path MUST emit an observability span through the existing observability port. A model span MUST include prompt id and version, model id, latency, validation outcome, and status. A tool span MUST include tool name, redacted arguments, bounded result or error code, latency, and status. A no-op or logging adapter is sufficient; a vendor observability SDK MUST NOT be required.

#### Scenario: Successful tool hop is traced

- **WHEN** a turn executes `demo.normalize_text` successfully
- **THEN** the observability port receives an `llm` span and a `tool` span with status `ok` and no secret values

#### Scenario: Failed validation is traced

- **WHEN** structured output validation fails
- **THEN** the observability port receives an `llm` span with status `error` and a validation-failure outcome

### Requirement: Default observability does not retain turn payloads

The process default observability adapter MUST NOT accumulate unbounded span payloads in process memory. Tool spans MUST NOT store raw or normalized user text. An in-memory collector is allowed in tests only.

#### Scenario: Default server does not keep normalized user text

- **WHEN** the application starts with the default observability adapter and handles a tool hop
- **THEN** the adapter does not retain `normalizedText` or unredacted user text on an in-process list

### Requirement: Agent reply text is bounded

A schema-valid `reply` decision whose `replyText` exceeds the documented maximum MUST be treated as `invalid_output` and MUST NOT be returned to the consumer.

#### Scenario: Overlong reply is rejected

- **WHEN** the model returns a schema-shaped reply whose text exceeds the documented limit
- **THEN** the turn fails as `invalid_output`
