## ADDED Requirements

### Requirement: Retrieved context arrives before generation

On each `runtime-demo` turn the runtime MUST retrieve against the current user text, assemble above-threshold hits, and supply that context to the model **before** the first structured completion. Retrieval is a runtime step, not a model-invoked tool. The change MUST NOT introduce a second agent or a RAG specialist.

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

## MODIFIED Requirements

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
