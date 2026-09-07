## ADDED Requirements

### Requirement: Vapi-native path keeps runtime tool authority without dual reasoning

On the Vapi-native interview/demo path, the voice channel MAY own conversational reasoning and tool *selection*, while the Agent Runtime MUST remain the sole authority for tool authorization and execution of `wom.get_customer_usage`, `wom.get_bill_status`, and `wom.check_service_status`. That path MUST NOT also run the WOM conversational agent loop for the same tool hop. A `tool_failed` or `tool_timeout` (or equivalent normalized failure) returned to the channel MUST fail closed for business facts: the system MUST NOT supply fabricated usage, bill, or incident payloads as a successful tool result. Spoken honesty and refusal of unsupported work remain product requirements for the channel prompt configuration, which is outside the runtime prompt file for this path.

#### Scenario: Channel-selected allowlisted tool executes once in the runtime

- **WHEN** the Vapi-native path requests `wom.get_customer_usage` through the Custom Tool interface with valid arguments
- **THEN** the runtime executes that tool once under the WOM allowlist and returns a bounded success or normalized failure without invoking the WOM agent turn loop for that hop

#### Scenario: Tool failure does not return fake business data

- **WHEN** a Vapi-native Custom Tool attempt for a WOM tool times out or fails
- **THEN** the tool response is a normalized failure and MUST NOT include a successful canned usage, bill, or incident payload
