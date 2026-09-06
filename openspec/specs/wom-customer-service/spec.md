# wom-customer-service Specification

## Purpose

Defines the simulated WOM Chile customer-service agent: a runtime-owned Spanish session owner that answers usage, billing, and service-status questions from three deterministic mock tools, without live WOM systems or a voice-vendor kernel.

## Requirements

### Requirement: WOM agent is a runtime-owned session owner

The application MUST expose product agent identity `wom-customer-service-agent` with an explicit `AgentVersion` policy: allowlisted tools exactly `wom.get_customer_usage`, `wom.get_bill_status`, and `wom.check_service_status`; `maxToolHops` of `1`; and a latency budget no looser than the configured voice-turn handling timeout. On the WOM path this agent MUST be the session owner for user-facing reply text. The WOM path MUST NOT introduce a supervisor, typed specialist handoff, or invoke `runtime-orchestrator`, `demo-normalize`, or `demo-classify`. The WOM path MUST reuse the existing single-turn agent loop and structured `reply` | `tool` decision contract.

#### Scenario: Happy path without a tool

- **WHEN** a valid WOM turn is handled and the model returns a schema-valid `reply` decision
- **THEN** the runtime completes the turn with structured success containing `replyText` and the turn or configured locale

#### Scenario: Happy path with an allowlisted tool

- **WHEN** a valid WOM turn is handled and the model returns a schema-valid `tool` decision for one allowlisted `wom.*` tool with valid arguments
- **THEN** the runtime executes that tool once, calls the model again with the bounded tool result, and completes with structured success

#### Scenario: No orchestration on the WOM path

- **WHEN** a reviewer inspects the WOM turn policy
- **THEN** that path defines only `wom-customer-service-agent` as session owner and does not invoke the orchestrated catalog

### Requirement: Interaction language is Spanish by default

The WOM agent MUST treat Spanish as the default customer language. When the inbound turn omits locale, the configured default locale MUST remain `es`. Successful `replyText` for the demonstration utterances MUST be Spanish. Technical artifacts (code, specs, logs, error codes) MUST remain English.

#### Scenario: Spanish usage question

- **WHEN** the user text is a Spanish request for remaining mobile data and the model selects `wom.get_customer_usage`
- **THEN** the completed `replyText` is Spanish and uses fields from the tool payload

#### Scenario: Default locale is Spanish

- **WHEN** a WOM turn is handled without a turn-level locale
- **THEN** the result locale is the configured default `es`

### Requirement: Demo honesty and limited capability

The versioned WOM prompt MUST instruct the agent to identify itself as a demonstration assistant when asked or when refusing unsupported work, and MUST forbid claiming access to real WOM systems, real customer accounts, or live network operations. Unsupported customer requests MUST receive a polite Spanish explanation that the demonstration supports only usage, billing status, and service status. User text MUST be packed as untrusted content and MUST NOT overwrite system instructions or expand the allowlist.

#### Scenario: Unsupported request is refused

- **WHEN** the user asks for an action outside usage, billing status, and service status and the model returns a schema-valid `reply`
- **THEN** the reply explains the demonstration limits and no non-allowlisted tool executes

#### Scenario: Injection does not expand the allowlist

- **WHEN** user text instructs the agent to ignore policy or call a tool that is not on the WOM allowlist
- **THEN** the runtime still allowlists only the three `wom.*` tools and does not treat that user text as system policy

### Requirement: Replies are grounded on mock tools

The WOM agent MUST use returned tool data to formulate usage, billing, and service-status answers. The agent MUST NOT invent usage, bill, or incident figures when a tool is not executed or when a tool returns a typed failure. A `tool_failed` or `tool_timeout` result MUST fail the turn closed with that error code. The runtime MUST NOT call the model again for a spoken fallback and MUST NOT present a successful usage, bill, or incident payload. Grounding of numeric claims in a successful `reply` that skipped a tool is prompt- and eval-enforced this increment, not a runtime payload-to-prose check. Facts about the simulated subscriber MUST come from the mock tools, not from retrieved corpus text.

#### Scenario: Usage reply uses tool fields

- **WHEN** `wom.get_customer_usage` returns a schema-valid payload and the model then returns a `reply`
- **THEN** the reply is treated as grounded only if the completed turn recorded that tool success; the runtime MUST NOT supply invented usage numbers after a tool failure

#### Scenario: Billing tool failure does not fabricate

- **WHEN** `wom.get_bill_status` returns `tool_failed` or `tool_timeout`
- **THEN** the turn MUST NOT present a successful bill amount, due date, or paid status as if the tool succeeded

### Requirement: Canned demo subscriber without identity product

WOM tools MUST serve a single deterministic canned demo subscriber. Tool input schemas MUST be closed objects with `additionalProperties` false and MUST NOT require a phone number, RUT, account id, or login. This change MUST NOT add CRM, authentication, or ANI-based identity. Mock modules MUST NOT perform network I/O or call external WOM systems.

#### Scenario: Usage tool needs no identity arguments

- **WHEN** `wom.get_customer_usage` is authorized with `{}`
- **THEN** it returns the canned demo usage payload and does not call an external system

#### Scenario: Extra identity fields are rejected

- **WHEN** a WOM tool is invoked with an undeclared field such as `phoneNumber`
- **THEN** the runtime returns `tool_invalid_args` and MUST NOT run the mock body

### Requirement: Execution stays bounded and traced

A WOM turn MUST execute at most one tool hop. A second tool proposal MUST be `tool_denied` and MUST NOT run a tool body. Each WOM turn MUST reuse existing correlation (`traceId` and optional request, interaction, or session identifiers). Emitted traces or logs MUST identify agent id `wom-customer-service-agent`, prompt id and version, start and end or latency, status, each tool name, tool duration, success or failure, and a normalized error code when failed. Secrets and API keys MUST NOT appear in logs or results.

#### Scenario: Second tool hop is denied

- **WHEN** the model proposes a second tool after one authorized WOM tool hop
- **THEN** the runtime returns `tool_denied` and does not execute the second tool

#### Scenario: Turn is reconstructable

- **WHEN** a WOM turn completes after a tool hop
- **THEN** the emitted workflow and tool spans share the same `traceId` and record agent or prompt identity, tool name, latency, and status
