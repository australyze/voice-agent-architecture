## ADDED Requirements

### Requirement: External channel tool path uses the same authorization boundary

When an authenticated external channel adapter requests tool execution without running the conversational agent loop, the runtime MUST still enforce registry presence, `active` status, `riskClass` `read`, `source` `native`, closed input/output schemas, string length limits, and the current path allowlist before executing. For the Vapi-native WOM demo path, the allowlist MUST be exactly `wom.get_customer_usage`, `wom.get_bill_status`, and `wom.check_service_status`. Denials and validation failures MUST use the same stable error classes as other tool invocations (`tool_denied`, `tool_invalid_args`, `tool_failed`, `tool_timeout` as applicable) and MUST NOT run the tool body when denied or invalid.

#### Scenario: Vapi path allowlisted tool succeeds

- **WHEN** the external channel tool path authorizes `wom.get_bill_status` with schema-valid empty-object arguments
- **THEN** the tool executes and returns a bounded structured success payload

#### Scenario: Vapi path denies normalize tool

- **WHEN** the external channel tool path receives `demo.normalize_text` with otherwise valid arguments
- **THEN** the runtime returns `tool_denied` and MUST NOT run the normalizer

#### Scenario: Invalid arguments never execute on the channel path

- **WHEN** the external channel tool path invokes `wom.check_service_status` with an extra property
- **THEN** the runtime returns `tool_invalid_args` and MUST NOT run the mock body
