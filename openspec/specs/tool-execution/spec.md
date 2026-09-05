# tool-execution Specification

## Purpose

Defines allowlisted native tool execution for the first demo agent: one side-effect-free tool, strict JSON Schema, runtime authorization, and structured errors so the model never executes side effects itself.

## Requirements

### Requirement: Catalog contains one native read-only tool

The runtime MUST register exactly one product tool for this increment: `demo.normalize_text`. The tool MUST have `riskClass` `read`, `source` `native`, and a documented timeout. The tool MUST NOT write customer data, charge, transfer, send communications, or fetch arbitrary URLs. HITL MUST NOT be required for this tool. Tools with `write`, `irreversible`, or `external_comm` risk MUST NOT be added in this change.

#### Scenario: Allowlisted tool is invocable

- **WHEN** the runtime authorizes `demo.normalize_text` with schema-valid arguments
- **THEN** the tool executes and returns a bounded structured success payload

#### Scenario: High-risk tools are absent

- **WHEN** a reviewer inspects the shipped tool catalog
- **THEN** no tool is classified `write`, `irreversible`, or `external_comm`

### Requirement: Arguments use a closed JSON Schema

`demo.normalize_text` MUST accept an object with required `text` of type string and `additionalProperties` false. Argument validation MUST occur in the runtime before execution. Unknown fields, wrong types, or missing `text` MUST NOT execute the tool.

#### Scenario: Valid arguments execute

- **WHEN** the tool is invoked with `{ "text": "  Hello   World " }`
- **THEN** execution returns `{ "ok": true, "payload": { "normalizedText": "hello world" } }` (trim, collapse internal whitespace, lowercase)

#### Scenario: Extra properties never execute

- **WHEN** the tool is invoked with an extra field besides `text`
- **THEN** the runtime returns a structured `{ ok: false, code, message }` result and MUST NOT run the normalizer

### Requirement: Unknown or denied tools never execute

The runtime MUST execute only names on the current agent allowlist. An unknown name, a disabled tool, or a name not on `runtime-demo` MUST be denied with a stable `tool_denied` code.

#### Scenario: Invented tool is denied

- **WHEN** the model proposes `demo.delete_everything` or any name other than `demo.normalize_text`
- **THEN** the runtime does not execute a function body and returns `tool_denied`

### Requirement: Tool failures are structured and timed out

Tool errors MUST use `{ ok: false, code, message }` without stack traces or secrets. The runtime MUST enforce the tool timeout. A hung or over-budget execution MUST map to `tool_timeout` and MUST NOT leave an unbounded wait.

#### Scenario: Tool timeout is typed

- **WHEN** tool execution exceeds its configured timeout
- **THEN** the result is `{ ok: false, code: "tool_timeout" }` (or an equivalent stable code) and no further tool work runs on that attempt

### Requirement: Runtime MCP is not a tool source

This change MUST NOT register development MCP or runtime MCP servers as product tools. Credentials used by coding-agent MCP MUST NOT be reachable from the demo agent.

#### Scenario: No MCP tool source

- **WHEN** a reviewer inspects the tool catalog
- **THEN** every shipped tool has `source` `native` and no MCP server is attached to the agent
