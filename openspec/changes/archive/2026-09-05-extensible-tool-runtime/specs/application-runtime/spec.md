## ADDED Requirements

### Requirement: Tool composition does not require MCP

Default process composition MUST wire the in-process native tool registry only. Starting MUST succeed when no MCP server, MCP URL, or MCP credential is present. Present-but-unused MCP settings MUST NOT silently enable a product tool source in this increment.

#### Scenario: Start without MCP

- **WHEN** required process configuration is valid and no MCP settings are provided
- **THEN** the process becomes live and tool execution uses the native registry only

## MODIFIED Requirements

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

### Requirement: Model and tool calls emit secret-safe traces

Each model call and tool attempt on the agent path MUST emit an observability span through the existing observability port. A model span MUST include prompt id and version, model id, latency, validation outcome, and status. A tool span MUST include tool name, `source`, redacted arguments, bounded result or error code, validation outcome, latency, and status. A no-op or logging adapter is sufficient; a vendor observability SDK MUST NOT be required.

#### Scenario: Successful tool hop is traced

- **WHEN** a turn executes `demo.normalize_text` successfully
- **THEN** the observability port receives an `llm` span and a `tool` span with status `ok`, `source` `native`, and no secret values

#### Scenario: Failed validation is traced

- **WHEN** structured output validation fails
- **THEN** the observability port receives an `llm` span with status `error` and a validation-failure outcome
