# tool-execution Specification

## Purpose

Defines allowlisted native tool execution for the first demo agent: one side-effect-free tool, strict JSON Schema, runtime authorization, and structured errors so the model never executes side effects itself.

## Requirements

### Requirement: Catalog contains one native read-only tool

The runtime MUST register product tools `demo.normalize_text`, `wom.get_customer_usage`, `wom.get_bill_status`, and `wom.check_service_status`. Each MUST have `riskClass` `read`, `source` `native`, status `active`, and a documented timeout no greater than 500 ms. Those tools MUST NOT write customer data, charge, transfer, send communications, or fetch arbitrary URLs. HITL MUST NOT be required for these tools. Tools with `write`, `irreversible`, or `external_comm` risk MUST NOT be added in this change. The runtime MUST also be able to register one **test-only** native tool `demo.echo_token` (`riskClass` `read`, `source` `native`) that is not on any product-agent allowlist and MUST NOT appear in the default **product** composition catalog. Adding `demo.echo_token` MUST require registry registration and an allowlist entry only—not a change to agent reasoning or a hardcoded implementation branch.

#### Scenario: Allowlisted tool is invocable

- **WHEN** the runtime authorizes `demo.normalize_text` with schema-valid arguments
- **THEN** the tool executes and returns a bounded structured success payload

#### Scenario: High-risk tools are absent

- **WHEN** a reviewer inspects the shipped tool catalog
- **THEN** no tool is classified `write`, `irreversible`, or `external_comm`

#### Scenario: Test-only tool is registered not product-allowlisted

- **WHEN** a reviewer inspects the test/demo registry and product-agent policies
- **THEN** `demo.echo_token` is registered as `source` `native` and `riskClass` `read`, and it is absent from the `runtime-demo` and `wom-customer-service-agent` allowlists

#### Scenario: Product composition catalog excludes echo

- **WHEN** the process starts with default tool composition
- **THEN** the product catalog contains `demo.normalize_text` and the three `wom.*` tools, and `demo.echo_token` is not registered there

#### Scenario: WOM tools are invocable when allowlisted

- **WHEN** the runtime authorizes `wom.get_customer_usage` with schema-valid arguments (empty object)
- **THEN** the tool executes and returns the canned demo usage payload

### Requirement: Arguments use a closed JSON Schema

`demo.normalize_text` MUST accept an object with required `text` of type string and `additionalProperties` false. `demo.echo_token` MUST accept an object with required `token` of type string and `additionalProperties` false. Argument validation MUST occur in the runtime before execution. Each string argument and each string field of a success payload MUST be at most 2048 characters. The JSON used as the next model tool-result block MUST be at most 2048 characters. Oversize arguments MUST return `tool_invalid_args` and MUST NOT run the tool body. Oversize success payloads MUST return `tool_failed` and MUST NOT be packed into the next model call. A successful payload MUST match that tool’s closed output schema (`normalizedText` string for the product tool; `echoedToken` string equal to the input `token` for the test-only tool). Unknown fields, wrong types, missing required fields, or a schema-invalid success payload MUST NOT be treated as success. Invalid arguments MUST return `{ ok: false, code: "tool_invalid_args", message }` and MUST NOT run the tool body.

#### Scenario: Valid arguments execute

- **WHEN** the tool is invoked with `{ "text": "  Hello   World " }`
- **THEN** execution returns `{ "ok": true, "payload": { "normalizedText": "hello world" } }` (trim, collapse internal whitespace, lowercase)

#### Scenario: Extra properties never execute

- **WHEN** the tool is invoked with an extra field besides `text`
- **THEN** the runtime returns `{ ok: false, code: "tool_invalid_args", message }` and MUST NOT run the normalizer

#### Scenario: Echo token validates independently

- **WHEN** `demo.echo_token` is invoked through the registry with `{ "token": "abc" }` by a caller that allowlists it
- **THEN** execution returns `{ "ok": true, "payload": { "echoedToken": "abc" } }`

#### Scenario: Oversize arguments never execute

- **WHEN** `demo.normalize_text` is invoked with a `text` string longer than 2048 characters
- **THEN** the runtime returns `tool_invalid_args` and MUST NOT run the normalizer

### Requirement: Unknown or denied tools never execute

The runtime MUST execute only names that are both present, `active`, `riskClass` `read`, and `source` `native` in the registry **and** present on the current agent allowlist. An unknown name, a disabled tool, a name not on the current agent allowlist, a resolved tool whose `source` is not `native`, or a tool whose `riskClass` is `write`, `irreversible`, or `external_comm` MUST be denied with a stable `tool_denied` code and MUST NOT run the body. This increment MUST NOT return `awaiting_approval` (no HITL). Schema-invalid arguments MUST use `tool_invalid_args`, not `tool_denied`. Product composition MUST bind the selected session-owner allowlist on the production `NativeToolPort` constructor (`allowedTools`). An unbound product port MUST NOT be the default inbound `ToolPort`. `handleAgentTurn` MUST still pass the same allowlist as a second check. `ToolExecuteRequest` has no per-call allowlist field.

#### Scenario: Invented tool is denied

- **WHEN** the model proposes `demo.delete_everything` or any name other than an allowlisted registry name
- **THEN** the runtime does not execute a function body and returns `tool_denied`

#### Scenario: Registered but not allowlisted tool is denied

- **WHEN** the `runtime-demo` agent proposes `demo.echo_token` or a `wom.*` tool with schema-valid arguments
- **THEN** the runtime does not execute that tool body and returns `tool_denied`

#### Scenario: Production demo-bound port denies WOM tools

- **WHEN** the default inbound composition binds the `runtime-demo` allowlist on `NativeToolPort` and a caller invokes `wom.get_customer_usage` without `handleAgentTurn`
- **THEN** the port returns `tool_denied` and MUST NOT run the mock body

#### Scenario: WOM path cannot execute the demo normalizer

- **WHEN** the `wom-customer-service-agent` path proposes `demo.normalize_text` with schema-valid arguments
- **THEN** the runtime returns `tool_denied` and MUST NOT run the normalizer

#### Scenario: Production WOM-bound port denies the demo normalizer

- **WHEN** the default inbound composition binds the WOM allowlist on `NativeToolPort` and a caller invokes `demo.normalize_text` without `handleAgentTurn`
- **THEN** the port returns `tool_denied` and MUST NOT run the normalizer

#### Scenario: Disabled tool is denied

- **WHEN** a registered tool has `status` `disabled` and is invoked with schema-valid arguments
- **THEN** the runtime returns `tool_denied` and MUST NOT run the tool body

#### Scenario: High-risk registered tool never executes

- **WHEN** a native tool with `riskClass` `write`, `irreversible`, or `external_comm` is registered and invoked
- **THEN** the runtime returns `tool_denied` and MUST NOT run the body or require a human approval record in this increment

### Requirement: Tool failures are structured and timed out

Tool errors MUST use `{ ok: false, code, message }` without stack traces or secrets. The runtime MUST enforce the tool timeout. A hung or over-budget execution MUST map to `tool_timeout`, MUST abort or ignore in-flight work, and MUST NOT treat a late success payload as the result of that attempt or of a later turn. An unexpected throw from a tool body MUST map to `tool_failed` and MUST NOT crash the process or leave later turns unservable.

#### Scenario: Tool timeout is typed

- **WHEN** tool execution exceeds its configured timeout
- **THEN** the result is `{ ok: false, code: "tool_timeout" }` (or an equivalent stable code), in-flight work is aborted or ignored, and a late success payload MUST NOT be returned for that attempt

#### Scenario: Thrown tool error is contained

- **WHEN** a registered tool body throws during an authorized, schema-valid invocation
- **THEN** the caller receives `{ ok: false, code: "tool_failed", message }` with no stack trace and the process remains able to handle a subsequent invocation

### Requirement: Runtime MCP is not a tool source

This change MUST NOT attach development MCP or runtime MCP servers to the product agent. Catalog metadata MAY include `source` `mcp` as a reserved source value. The runtime MUST NOT start an MCP client, MUST NOT add an MCP package as a process dependency, and MUST NOT execute a tool whose resolved `source` is `mcp`. Credentials used by coding-agent MCP MUST NOT be reachable from the demo agent.

#### Scenario: No MCP tool source

- **WHEN** a reviewer inspects the tool catalog
- **THEN** every shipped **product** tool has `source` `native` and no MCP server is attached to the agent

#### Scenario: No executed MCP tool source

- **WHEN** a reviewer inspects the shipped product catalog and process dependencies
- **THEN** every executed product tool has `source` `native`, no MCP client is started, and no MCP SDK is required to boot

#### Scenario: Reserved MCP source is denied

- **WHEN** the registry resolves a tool whose `source` is `mcp` (including a test-injected entry)
- **THEN** the runtime returns `tool_denied` and MUST NOT open a network connection or MCP session

### Requirement: Tools are registered and resolved through one contract

The runtime MUST expose a single register/resolve contract for tools. Registration MUST record at least `name`, `riskClass`, closed input schema, closed output schema, `timeoutMs`, `source` (`native` | `mcp` | `http` | `workflow`), and `status`. Resolve-by-name MUST return the catalog entry or a typed miss. A new native tool MUST become invocable for an agent that allowlists its name without modifying that agent’s reasoning implementation.

#### Scenario: Second native tool invokes without agent code change

- **WHEN** `demo.echo_token` is registered and a test agent allowlist includes only that name
- **THEN** a schema-valid invoke succeeds through the same authorize-and-execute contract used by `demo.normalize_text`

#### Scenario: Unknown name does not resolve to an executor

- **WHEN** resolve is asked for a name that was never registered
- **THEN** no executor runs and the authorize path returns `tool_denied`

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
