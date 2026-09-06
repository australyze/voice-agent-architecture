# first-agent Specification

## Purpose

Defines the first single-turn demo conversational agent owned by the application runtime: versioned prompt context, structured model decisions, one allowlisted tool hop, and typed completion without durable session memory or a voice-vendor kernel.

## Requirements

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

### Requirement: Turn states are explicit and in-memory

Each agent turn MUST progress through named states: `receiving`, `retrieving` (while the runtime retrieves and assembles context), `reasoning`, `awaiting_tool` (only while the runtime executes a validated tool), `completed`, or `failed`. Transitions MUST record actor `model` or `runtime`. This change MUST NOT persist a product `Session` or `ConversationTurn` table. Context MUST be limited to the versioned system prompt, the current user text, assembled retrieved hits for this turn when present, and the current-turn tool result when present.

#### Scenario: Tool hop uses awaiting_tool

- **WHEN** the runtime accepts a valid tool decision
- **THEN** it records a transition to `awaiting_tool` with actor `runtime` before execution and does not ask the model to execute the tool

#### Scenario: Current-turn context only

- **WHEN** two sequential turns share the same session identifier
- **THEN** the second turn MUST NOT receive the first turn’s user text, retrieved hits, or tool result as hidden memory

#### Scenario: Retrieval uses retrieving

- **WHEN** the runtime starts retrieval for a turn
- **THEN** it records a transition to `retrieving` with actor `runtime` before the first model call

### Requirement: Model output is a structured decision

The runtime MUST parse model output against a closed structured-output schema with `type` of `reply` or `tool`. A `reply` decision MUST include `replyText`. A `tool` decision MUST include `toolName` and `arguments`. Unknown fields MUST be rejected. Free-form prose MUST NOT be treated as the system of record.

#### Scenario: Valid reply decision

- **WHEN** the model returns a schema-valid `reply` object
- **THEN** the runtime uses `replyText` as the user-facing text and does not execute a tool

#### Scenario: Invalid structured output fails closed

- **WHEN** the model returns unparseable output, a missing required field, or additional properties
- **THEN** the runtime MUST NOT execute a tool and MUST complete the turn as a typed `invalid_output` failure after at most one bounded retry of the same model call

### Requirement: Prompt text is versioned and isolated from untrusted input

The demo agent MUST use a versioned prompt artifact identified by `promptId` `runtime-demo` and a monotonic `version`. This change MUST introduce a new prompt version whose policy requires grounding on retrieved evidence and refuse-or-hedge when evidence is insufficient. Changing prompt text MUST create a new version with a content hash. Production and test turns MUST record the `promptId` and `version` used. User text, tool results, and retrieved chunk text MUST be packed as untrusted content and MUST NOT be concatenated as system policy.

#### Scenario: Turn records prompt version

- **WHEN** a turn completes successfully or fails after a model call
- **THEN** the emitted trace or log includes `promptId` `runtime-demo` and the exact prompt version used

#### Scenario: User text cannot become policy

- **WHEN** user text contains instructions to ignore policy or enable a non-allowlisted tool
- **THEN** the runtime still allowlists tools from agent policy only and does not treat that user text as system policy

#### Scenario: Retrieved text cannot become policy

- **WHEN** retrieved chunk text contains instructions to ignore policy
- **THEN** that text is packed in an untrusted retrieved block and is not merged into the system policy message

### Requirement: Retrieved context arrives before generation

On each `runtime-demo` turn the runtime MUST retrieve against the current user text, assemble above-threshold hits, and supply that context to the model **before** the first structured completion. Retrieval is a runtime step, not a model-invoked tool. The `runtime-demo` path MUST NOT introduce a second agent or a RAG specialist on that path.

#### Scenario: First model call sees assembled hits

- **WHEN** a turn runs after the example document is ingested and the user text matches that document
- **THEN** the first model call includes the assembled retrieved block and has not yet produced a reply

#### Scenario: Retrieval is not a tool hop

- **WHEN** the runtime retrieves for a turn
- **THEN** it does not increment the tool-hop count and does not require a `tool` decision to retrieve

### Requirement: Successful turns identify sources used

A successful agent turn that used above-threshold hits MUST include identifiable sources on the result: at least document id, chunk id, and locator for each hit sent to the model. When no hit passes the threshold, the sources list MUST be empty. Traces MUST also record the retrieval query, hit ids, scores, and retriever/corpus versions.

#### Scenario: Grounded success lists sources

- **WHEN** a turn completes after assembling at least one above-threshold hit
- **THEN** the success result includes those sources with document id, chunk id, and locator

#### Scenario: Ungrounded success has empty sources

- **WHEN** a turn completes after retrieval returns no above-threshold hit
- **THEN** the success result has an empty sources list and the model was not given retrieved evidence

### Requirement: Insufficient evidence must not invent facts

The versioned prompt MUST instruct the model to refuse or hedge when retrieved evidence is missing or insufficient. The runtime MUST still only accept a schema-valid `reply` or `tool` decision. Tests and evals MUST cover the empty-retrieval packing path with a mocked model and MUST NOT require live-model prose.

#### Scenario: Empty retrieval is packed without evidence

- **WHEN** retrieval returns no above-threshold hits
- **THEN** the model messages contain no evidence chunk text and the prompt version in use is the grounding version

#### Scenario: Retrieve throw fails closed

- **WHEN** embed or retrieve throws
- **THEN** the turn ends as typed `retrieval_failed`, the model is not called, and the result is not a successful ungrounded reply

### Requirement: Retrieved text cannot expand autonomy

Retrieved chunk text MUST remain untrusted. It MUST NOT add tools to the allowlist, authorize a high-risk action, or become system policy. The runtime MUST NOT execute a **non-allowlisted** tool because retrieved text requested it. An allowlisted `read` tool MAY still run after retrieve when the model proposes it through the existing hop loop. The system message MUST equal the versioned prompt bytes and MUST NOT contain retrieved chunk text.

#### Scenario: Document injection does not add tools

- **WHEN** a retrieved chunk tells the model to call a non-allowlisted tool
- **THEN** the runtime still allowlists only `demo.normalize_text` on the product path and does not execute the non-allowlisted tool

#### Scenario: System role excludes retrieved text

- **WHEN** a turn packs a jailbreak-shaped retrieved chunk
- **THEN** the model message list has policy on the `system` role only and that system content does not include the chunk text

### Requirement: Budgets and fallbacks are bounded

The runtime MUST enforce `maxToolHops = 1`. A second tool proposal in the same turn MUST be rejected without execution. Model and tool work MUST finish inside the turn timeout. On model timeout or provider failure the runtime MUST fail closed with a typed error and MUST NOT invent reply text. Fallback MUST be: mocked or configured LLM → typed error (no silent placeholder success).

#### Scenario: Second tool hop is denied

- **WHEN** after one successful tool execution the model proposes another tool
- **THEN** the runtime rejects the proposal, does not execute the second tool, and returns a typed failure or a schema-valid reply only if the model instead returns a `reply` within the hop limit

#### Scenario: Model timeout does not invent success

- **WHEN** the LLM port exceeds its time budget
- **THEN** the turn ends as a typed timeout failure and the user-facing result is not a fabricated completion

### Requirement: Tool allowlist is policy, not a hardcoded implementation

The `runtime-demo` agent MUST authorize tools from its `AgentVersion` allowlist plus registry resolution. The product allowlist MUST remain exactly `demo.normalize_text`. Application agent logic MUST NOT contain a special-case equality check that is the only way to execute a native tool. Adding a future allowlisted native tool MUST NOT require editing the agent turn loop beyond the policy list.

#### Scenario: Product allowlist stays the example tool

- **WHEN** a reviewer inspects `runtime-demo` policy
- **THEN** the allowlisted tool names are only `demo.normalize_text`

#### Scenario: Non-allowlisted registered tool is rejected by policy

- **WHEN** the model proposes `demo.echo_token` during a `runtime-demo` turn
- **THEN** the runtime does not execute it and the turn ends as a typed `tool_denied` failure

### Requirement: Agent evaluation cases exist before claiming the agent works

The change MUST include a frozen fixture set that asserts contracts, tool sequences, and error codes rather than exact live-model prose. The set MUST include at least: reply without tool; allowlisted tool then reply; invented tool rejected; invalid schema does not execute (`tool_invalid_args`); timeout; user-text injection does not expand the allowlist; registered-but-not-allowlisted `demo.echo_token` is denied; MCP-source tool is denied without a client start; oversize tool arguments are rejected; a jailbreak-shaped tool result does not expand the allowlist or execute a second tool.

#### Scenario: Fixture covers invented tool

- **WHEN** the evaluation or mocked-LLM suite runs the invented-tool case
- **THEN** the tool is not executed and the recorded outcome is a typed deny or invalid-output failure

#### Scenario: Fixture covers invalid arguments

- **WHEN** the evaluation or mocked-LLM suite runs the invalid-schema tool case
- **THEN** the tool body is not executed and the recorded outcome is `tool_invalid_args`

### Requirement: Demo eval includes a synthetic leak case

The frozen `runtime-demo` evaluation set MUST include a case where untrusted context contains a synthetic sensitive canary (not real PII or live credentials). The case MUST fail if the agent reply includes that canary. The case MUST run with a mocked model and MUST NOT require live-model prose or production transcripts.

#### Scenario: Canary in untrusted context does not appear in the reply

- **WHEN** the evaluation suite runs the synthetic leak case and the mocked model would echo the canary
- **THEN** the recorded outcome is a failed leak case (or a typed refusal that does not contain the canary) and the case is not counted as a quality-gate pass if the canary appears in the reply

#### Scenario: Leak fixture stays synthetic

- **WHEN** a reviewer inspects the leak case fixture
- **THEN** the canary is a documented synthetic marker and the fixture contains no real customer PII or live secret

### Requirement: Demo agent suite is a required quality-gate member

A `runtime-demo` prompt, tool-policy, or agent-turn change MUST NOT be treated as complete unless the quality gate has executed the demo agent suite, including the existing injection, invalid-output, and tool-misuse cases plus the synthetic leak case. Those cases remain assertions on contracts and error codes, not on live-model wording.

#### Scenario: Gate requires the demo suite

- **WHEN** the quality gate runs
- **THEN** it executes the `runtime-demo` suite and fails if that suite is skipped

#### Scenario: Existing security fixtures remain required

- **WHEN** the quality gate compares the demo suite to the baseline
- **THEN** the required members are the full ids `runtime-first-agent/injection-does-not-expand-allowlist`, `runtime-first-agent/invalid-output-no-execute`, and `runtime-first-agent/invented-tool-denied` (and the other listed security ids), not a colliding suffix from another suite
