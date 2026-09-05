## ADDED Requirements

### Requirement: Tool allowlist is policy, not a hardcoded implementation

The `runtime-demo` agent MUST authorize tools from its `AgentVersion` allowlist plus registry resolution. The product allowlist MUST remain exactly `demo.normalize_text`. Application agent logic MUST NOT contain a special-case equality check that is the only way to execute a native tool. Adding a future allowlisted native tool MUST NOT require editing the agent turn loop beyond the policy list.

#### Scenario: Product allowlist stays the example tool

- **WHEN** a reviewer inspects `runtime-demo` policy
- **THEN** the allowlisted tool names are only `demo.normalize_text`

#### Scenario: Non-allowlisted registered tool is rejected by policy

- **WHEN** the model proposes `demo.echo_token` during a `runtime-demo` turn
- **THEN** the runtime does not execute it and the turn ends as a typed `tool_denied` failure

## MODIFIED Requirements

### Requirement: Agent evaluation cases exist before claiming the agent works

The change MUST include a frozen fixture set that asserts contracts, tool sequences, and error codes rather than exact live-model prose. The set MUST include at least: reply without tool; allowlisted tool then reply; invented tool rejected; invalid schema does not execute (`tool_invalid_args`); timeout; user-text injection does not expand the allowlist; registered-but-not-allowlisted `demo.echo_token` is denied; MCP-source tool is denied without a client start; oversize tool arguments are rejected; a jailbreak-shaped tool result does not expand the allowlist or execute a second tool.

#### Scenario: Fixture covers invented tool

- **WHEN** the evaluation or mocked-LLM suite runs the invented-tool case
- **THEN** the tool is not executed and the recorded outcome is a typed deny or invalid-output failure

#### Scenario: Fixture covers invalid arguments

- **WHEN** the evaluation or mocked-LLM suite runs the invalid-schema tool case
- **THEN** the tool body is not executed and the recorded outcome is `tool_invalid_args`
