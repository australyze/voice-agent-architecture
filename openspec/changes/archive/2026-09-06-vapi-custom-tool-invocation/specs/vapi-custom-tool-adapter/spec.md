## Purpose

Accepts authenticated Vapi Custom Tool HTTP requests for the WOM interview demo, authorizes and executes allowlisted native tools through the Agent Runtime tool boundary, and returns a channel-compatible result without running conversational agent reasoning.

## ADDED Requirements

### Requirement: Custom tool ingress is authenticated and schema-validated

The application MUST expose a documented HTTP interface for Vapi Custom Tool invocations. When the integration is configured, the interface MUST authenticate the caller with a configured shared secret before any tool authorization or execution. Unauthenticated, malformed, oversized, or schema-invalid payloads MUST be rejected without executing a tool body and without leaking the configured secret. Vendor-native field names MUST remain in the adapter and adapter documentation, not in domain contracts.

#### Scenario: Valid authenticated tool-calls request is accepted

- **WHEN** a configured integration receives a valid authenticated Custom Tool request that maps to one or more supported tool invocations
- **THEN** the adapter maps each invocation to the runtime tool boundary and returns a channel-compatible success or per-call failure envelope

#### Scenario: Missing or invalid authentication is rejected

- **WHEN** a Custom Tool request lacks valid authentication
- **THEN** the adapter rejects the request without executing any tool and without leaking the configured secret

#### Scenario: Invalid or oversized payload is rejected

- **WHEN** an authenticated Custom Tool request body fails validation or exceeds the documented body limit
- **THEN** the adapter rejects the request without executing any tool

### Requirement: Conversational reasoning is not invoked on this path

The Custom Tool ingress MUST NOT invoke `handleAgentTurn` (or any equivalent conversational agent loop) for the same conversational turn. Tool selection and spoken reply composition for the Vapi-native path MAY occur in the voice channel; this interface MUST only authenticate, authorize, validate, execute, persist/trace, and return normalized tool outcomes.

#### Scenario: Tool request does not run the agent turn loop

- **WHEN** a valid authenticated Custom Tool request is processed
- **THEN** the runtime executes only the tool boundary path and does not produce a conversational `replyText` from an agent turn use case

### Requirement: Only the WOM demo allowlist is executable

For this change, the Custom Tool path MUST authorize only `wom.get_customer_usage`, `wom.get_bill_status`, and `wom.check_service_status`. Unknown names, cross-allowlist names, disabled tools, and high-risk risk classes MUST return a normalized denial or failure and MUST NOT run the tool body. Authorization MUST remain isolated so a future assistant- or tenant-specific allowlist can replace the demo binding without changing domain tool contracts.

#### Scenario: Allowlisted WOM tool executes

- **WHEN** the authenticated request names `wom.get_customer_usage` with schema-valid arguments
- **THEN** the tool executes and the response includes a bounded success result for that tool call id

#### Scenario: Non-allowlisted tool is denied

- **WHEN** the authenticated request names `demo.normalize_text` or any tool outside the WOM demo allowlist
- **THEN** the adapter returns a normalized denial or failure for that call and MUST NOT run the tool body

### Requirement: Round-trip latency budget is enforced and fail-closed

The measurable Custom Tool round-trip (authentication through normalized response) MUST target under 1000 ms and MUST hard-timeout at approximately 2000 ms. When the hard timeout is exceeded, the path MUST fail closed with a normalized failure for the affected tool call and MUST NOT return fabricated usage, billing, or incident payloads. Tool latency MUST be recorded through the existing observability model.

#### Scenario: Timeout returns normalized failure

- **WHEN** tool execution exceeds the hard timeout budget
- **THEN** the response for that tool call is a normalized failure and no successful business payload is returned

#### Scenario: Latency is traced

- **WHEN** a Custom Tool invocation completes or fails
- **THEN** observability records include tool latency and status for that invocation under the shared correlation identity for the call when available

### Requirement: Channel response is safe and reconstructable

Outbound Custom Tool responses MUST map each provider tool call id to a bounded result or normalized error. Responses MUST NOT include stack traces, secrets, or raw internal exceptions. Successful and failed attempts MUST be durable under the session-history model when a correlatable session exists.

#### Scenario: Success maps by tool call id

- **WHEN** an allowlisted tool completes successfully
- **THEN** the HTTP response associates the provider tool call id with a bounded result payload

#### Scenario: Failure maps safely

- **WHEN** authorization, validation, execution, or timeout fails for a tool call
- **THEN** the HTTP response associates that tool call id with a safe normalized error and omits provider or runtime internals
