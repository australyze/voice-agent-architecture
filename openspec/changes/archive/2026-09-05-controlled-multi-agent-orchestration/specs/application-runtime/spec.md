## ADDED Requirements

### Requirement: Runtime owns the orchestrated-turn use case

The application runtime MUST own closed-intent routing, context-packet construction, specialist invocation, structured-result validation, execution limits, and typed orchestration errors. HTTP adapters MUST invoke that use case rather than call an LLM port or a specialist directly. The voice inbound adapter MUST continue to invoke the existing `runtime-demo` agent-turn path and MUST NOT invoke the orchestrated-turn use case.

#### Scenario: Demo HTTP does not call the LLM port

- **WHEN** a valid `POST /demo/orchestrate` request is processed
- **THEN** the HTTP adapter invokes the runtime orchestrated-turn path and does not import or call the LLM port itself

#### Scenario: Voice inbound stays on the agent-turn path

- **WHEN** a valid inbound voice turn is processed
- **THEN** the voice adapter invokes the runtime agent-turn path and does not invoke the orchestrated-turn path

### Requirement: Orchestration failures are normalized

The runtime MUST classify orchestrated-path failures with stable codes covering at least: `unroutable`, `invalid_output`, `llm_timeout`, `llm_provider`, `budget_exceeded`, `specialist_failed`, `sensitive_output`, `unauthorized`, `orchestration_config`, `rate_limited`, `payload_invalid`, and `session_invalid`. Messages MUST be safe. Stack traces, secrets, raw provider payloads, and unredacted user text MUST NOT appear on the adapter-facing result.

#### Scenario: Unroutable is normalized

- **WHEN** the request intent is missing or unknown
- **THEN** the use case returns `unroutable` with a generic safe message

#### Scenario: Provider error on a specialist is safe

- **WHEN** the specialist LLM adapter reports a provider or network failure
- **THEN** the use case returns `llm_provider` with a generic safe message and no provider payload

## MODIFIED Requirements

### Requirement: LLM and tool failures are normalized

The runtime MUST classify agent-path failures with stable codes covering at least: `invalid_output`, `tool_denied`, `tool_invalid_args`, `tool_failed`, `tool_timeout`, `llm_timeout`, and `llm_provider`. Messages MUST be safe. Stack traces, secrets, raw provider payloads, and unredacted tool arguments MUST NOT appear on the adapter-facing result. Orchestrated-path codes `unroutable`, `budget_exceeded`, and `specialist_failed` MUST NOT be reused to describe `runtime-demo` tool or retrieval failures.

#### Scenario: Invalid model output is normalized

- **WHEN** the LLM returns output that fails the structured-output schema after the bounded retry
- **THEN** the use case returns `invalid_output` and no tool executes

#### Scenario: Provider error is safe

- **WHEN** the LLM adapter reports a provider or network failure
- **THEN** the use case returns `llm_provider` with a generic safe message and no provider payload

#### Scenario: Invalid tool arguments are normalized

- **WHEN** the model proposes an allowlisted tool with schema-invalid arguments
- **THEN** the use case returns `tool_invalid_args` and the tool body does not run
