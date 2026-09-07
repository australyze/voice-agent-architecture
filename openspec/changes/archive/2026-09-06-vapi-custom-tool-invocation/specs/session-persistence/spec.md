## ADDED Requirements

### Requirement: Vapi-originated tool invocations use the same history model

Tool invocations that enter through the Vapi Custom Tool path MUST persist as ToolCall records under the same Session history model as other authorized tool attempts. When a correlatable Session exists (including via `externalChannelId`), each attempt MUST store tool name, status, started and completed times, duration, bounded validated arguments, bounded result or normalized error class, and parent Session. The system MUST record provider-independent metadata that distinguishes the invocation source (for example `invocation_source` equal to `vapi_custom_tool`) without creating a separate history store. Stack traces and secrets MUST NOT be stored. Completed attempts MUST NOT be overwritten by a retry; a retry MUST create a new ToolCall.

#### Scenario: Successful Vapi tool is reconstructable in the session report

- **WHEN** an allowlisted tool completes successfully through the Vapi Custom Tool path for a known Session
- **THEN** the Session report includes that ToolCall with status succeeded, duration, bounded arguments and result, and invocation-source metadata identifying the Vapi custom-tool path

#### Scenario: Failed Vapi tool remains reconstructable

- **WHEN** a Vapi Custom Tool attempt is denied, invalid, failed, or timed out for a known Session
- **THEN** the Session report includes a ToolCall with the normalized failure status or error class and does not store secrets or stack traces
