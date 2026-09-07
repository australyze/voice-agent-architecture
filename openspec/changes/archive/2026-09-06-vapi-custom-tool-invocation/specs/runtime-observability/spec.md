## ADDED Requirements

### Requirement: Vapi custom-tool invocations share correlation and tool kind

Every production Custom Tool execution that enters the Vapi custom-tool path MUST emit observability records that use kind `tool` and share one `traceId` with the HTTP request record for that invocation. When a session identifier, external channel identifier, request identifier, or interaction identifier is already available and valid, those values MUST appear on the same records. Records MUST include latency and status. Records MUST carry invocation-source metadata identifying the Vapi custom-tool path (for example `invocation_source: vapi_custom_tool`) without requiring a separate vendor observability product. Raw tool argument values, secrets, and stack traces MUST NOT be required in default emit (bounded metadata only, consistent with existing secret-safe rules).

#### Scenario: Successful custom-tool hop is reconstructable by traceId

- **WHEN** a valid authenticated Custom Tool request completes an allowlisted tool successfully
- **THEN** the observability port receives records that share one `traceId` for the HTTP request and the tool step, include latency and status, and identify the Vapi custom-tool invocation source

#### Scenario: Failed custom-tool hop keeps the same identity

- **WHEN** a Custom Tool request fails authorization, validation, execution, or timeout
- **THEN** the error or tool records use the same `traceId` as the HTTP request record for that invocation
