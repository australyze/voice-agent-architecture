## MODIFIED Requirements

### Requirement: One runtime-owned demo agent executes a single turn

The application MUST expose demo agent identity `runtime-demo` with an explicit `AgentVersion` policy: allowlisted tools, `maxToolHops` of `1`, and a latency budget no looser than the configured voice-turn handling timeout. On the `runtime-demo` path the agent MUST be the session owner for user-facing reply text. The `runtime-demo` path MUST NOT introduce a supervisor or typed specialist handoff. A separate orchestrated catalog MAY exist and MUST NOT be invoked from this path. A separate product session owner `wom-customer-service-agent` MAY exist and MUST NOT be invoked from the `runtime-demo` path.

#### Scenario: Happy path without a tool

- **WHEN** a valid turn is handled and the model returns a schema-valid `reply` decision
- **THEN** the runtime completes the turn with structured success containing `replyText` and the configured or turn locale

#### Scenario: Happy path with the allowlisted tool

- **WHEN** a valid turn is handled and the model returns a schema-valid `tool` decision for `demo.normalize_text` with valid arguments
- **THEN** the runtime executes that tool once, calls the model again with the bounded tool result, and completes with structured success

#### Scenario: No second agent

- **WHEN** a reviewer inspects the `runtime-demo` turn policy
- **THEN** that path defines only `runtime-demo` as session owner and does not invoke `demo-normalize`, `demo-classify`, `runtime-orchestrator`, or `wom-customer-service-agent`
