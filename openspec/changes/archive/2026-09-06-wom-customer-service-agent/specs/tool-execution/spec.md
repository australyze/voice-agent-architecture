## MODIFIED Requirements

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
