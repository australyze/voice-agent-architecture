## MODIFIED Requirements

### Requirement: One runtime-owned demo agent executes a single turn

The application MUST expose demo agent identity `runtime-demo` with an explicit `AgentVersion` policy: allowlisted tools, `maxToolHops` of `1`, and a latency budget no looser than the configured voice-turn handling timeout. On the `runtime-demo` path the agent MUST be the session owner for user-facing reply text. The `runtime-demo` path MUST NOT introduce a supervisor or typed specialist handoff. A separate orchestrated catalog MAY exist and MUST NOT be invoked from this path.

#### Scenario: Happy path without a tool

- **WHEN** a valid turn is handled and the model returns a schema-valid `reply` decision
- **THEN** the runtime completes the turn with structured success containing `replyText` and the configured or turn locale

#### Scenario: Happy path with the allowlisted tool

- **WHEN** a valid turn is handled and the model returns a schema-valid `tool` decision for `demo.normalize_text` with valid arguments
- **THEN** the runtime executes that tool once, calls the model again with the bounded tool result, and completes with structured success

#### Scenario: No second agent

- **WHEN** a reviewer inspects the `runtime-demo` turn policy
- **THEN** that path defines only `runtime-demo` as session owner and does not invoke `demo-normalize`, `demo-classify`, or `runtime-orchestrator`

### Requirement: Retrieved context arrives before generation

On each `runtime-demo` turn the runtime MUST retrieve against the current user text, assemble above-threshold hits, and supply that context to the model **before** the first structured completion. Retrieval is a runtime step, not a model-invoked tool. The `runtime-demo` path MUST NOT introduce a second agent or a RAG specialist on that path.

#### Scenario: First model call sees assembled hits

- **WHEN** a turn runs after the example document is ingested and the user text matches that document
- **THEN** the first model call includes the assembled retrieved block and has not yet produced a reply

#### Scenario: Retrieval is not a tool hop

- **WHEN** the runtime retrieves for a turn
- **THEN** it does not increment the tool-hop count and does not require a `tool` decision to retrieve
