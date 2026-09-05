## Purpose

Defines the first single-turn demo conversational agent owned by the application runtime: versioned prompt context, structured model decisions, one allowlisted tool hop, and typed completion without durable session memory or a voice-vendor kernel.

## ADDED Requirements

### Requirement: One runtime-owned demo agent executes a single turn

The application MUST expose one demo agent identity (`runtime-demo`) with an explicit `AgentVersion` policy: allowlisted tools, `maxToolHops` of `1`, and a latency budget no looser than the configured voice-turn handling timeout. The agent MUST be the session owner for user-facing reply text. The change MUST NOT introduce a second agent, supervisor, or typed handoff.

#### Scenario: Happy path without a tool

- **WHEN** a valid turn is handled and the model returns a schema-valid `reply` decision
- **THEN** the runtime completes the turn with structured success containing `replyText` and the configured or turn locale

#### Scenario: Happy path with the allowlisted tool

- **WHEN** a valid turn is handled and the model returns a schema-valid `tool` decision for `demo.normalize_text` with valid arguments
- **THEN** the runtime executes that tool once, calls the model again with the bounded tool result, and completes with structured success

#### Scenario: No second agent

- **WHEN** a reviewer inspects this increment’s agent policy
- **THEN** only `runtime-demo` is defined and there is no specialist or supervisor agent

### Requirement: Turn states are explicit and in-memory

Each agent turn MUST progress through named states: `receiving`, `reasoning`, `awaiting_tool` (only while the runtime executes a validated tool), `completed`, or `failed`. Transitions MUST record actor `model` or `runtime`. This change MUST NOT persist a product `Session` or `ConversationTurn` table. Context MUST be limited to the versioned system prompt, the current user text, and the current-turn tool result when present.

#### Scenario: Tool hop uses awaiting_tool

- **WHEN** the runtime accepts a valid tool decision
- **THEN** it records a transition to `awaiting_tool` with actor `runtime` before execution and does not ask the model to execute the tool

#### Scenario: Current-turn context only

- **WHEN** two sequential turns share the same session identifier
- **THEN** the second turn MUST NOT receive the first turn’s user text or tool result as hidden memory

### Requirement: Model output is a structured decision

The runtime MUST parse model output against a closed structured-output schema with `type` of `reply` or `tool`. A `reply` decision MUST include `replyText`. A `tool` decision MUST include `toolName` and `arguments`. Unknown fields MUST be rejected. Free-form prose MUST NOT be treated as the system of record.

#### Scenario: Valid reply decision

- **WHEN** the model returns a schema-valid `reply` object
- **THEN** the runtime uses `replyText` as the user-facing text and does not execute a tool

#### Scenario: Invalid structured output fails closed

- **WHEN** the model returns unparseable output, a missing required field, or additional properties
- **THEN** the runtime MUST NOT execute a tool and MUST complete the turn as a typed `invalid_output` failure after at most one bounded retry of the same model call

### Requirement: Prompt text is versioned and isolated from untrusted input

The demo agent MUST use a versioned prompt artifact identified by `promptId` `runtime-demo` and a monotonic `version`. Changing prompt text MUST create a new version with a content hash. Production and test turns MUST record the `promptId` and `version` used. User text and tool results MUST be packed as untrusted content and MUST NOT be concatenated as system policy.

#### Scenario: Turn records prompt version

- **WHEN** a turn completes successfully or fails after a model call
- **THEN** the emitted trace or log includes `promptId` `runtime-demo` and the exact prompt version used

#### Scenario: User text cannot become policy

- **WHEN** user text contains instructions to ignore policy or enable a non-allowlisted tool
- **THEN** the runtime still allowlists tools from agent policy only and does not treat that user text as system policy

### Requirement: Budgets and fallbacks are bounded

The runtime MUST enforce `maxToolHops = 1`. A second tool proposal in the same turn MUST be rejected without execution. Model and tool work MUST finish inside the turn timeout. On model timeout or provider failure the runtime MUST fail closed with a typed error and MUST NOT invent reply text. Fallback MUST be: mocked or configured LLM → typed error (no silent placeholder success).

#### Scenario: Second tool hop is denied

- **WHEN** after one successful tool execution the model proposes another tool
- **THEN** the runtime rejects the proposal, does not execute the second tool, and returns a typed failure or a schema-valid reply only if the model instead returns a `reply` within the hop limit

#### Scenario: Model timeout does not invent success

- **WHEN** the LLM port exceeds its time budget
- **THEN** the turn ends as a typed timeout failure and the user-facing result is not a fabricated completion

### Requirement: Agent evaluation cases exist before claiming the agent works

The change MUST include a frozen fixture set that asserts contracts, tool sequences, and error codes rather than exact live-model prose. The set MUST include at least: reply without tool; allowlisted tool then reply; invented tool rejected; invalid schema does not execute; timeout; user-text injection does not expand the allowlist.

#### Scenario: Fixture covers invented tool

- **WHEN** the evaluation or mocked-LLM suite runs the invented-tool case
- **THEN** the tool is not executed and the recorded outcome is a typed deny or invalid-output failure
