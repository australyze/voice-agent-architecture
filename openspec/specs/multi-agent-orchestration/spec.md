# multi-agent-orchestration Specification

## Purpose

Lets an AI Engineer send one programmatic request through a deterministic orchestrator that routes to exactly one of two specialists under a shared contract, with typed context, structured results, fail-closed errors, and hard execution limits.

## Requirements

### Requirement: Catalog exposes one orchestrator and two specialists

The application MUST expose catalog identities `runtime-orchestrator` (session owner for this path), `demo-normalize`, and `demo-classify`. The orchestrator MUST NOT call a model. Each specialist MUST declare an `AgentVersion` with an empty tool allowlist and `maxToolHops` of `0`. This path MUST NOT persist a product `Session` or `ConversationTurn` table. `Session.agentVersionId` for an orchestrated request MUST identify the orchestrator, not a specialist.

#### Scenario: Catalog identities are named

- **WHEN** a reviewer inspects orchestrated-path policy
- **THEN** the three identities `runtime-orchestrator`, `demo-normalize`, and `demo-classify` are defined and specialists have no allowlisted tools

#### Scenario: Orchestrator is the session owner

- **WHEN** a valid orchestrated request completes
- **THEN** the recorded owner identity is `runtime-orchestrator` and the specialist identity is only the invoked specialist

### Requirement: Specialists share a common contract

Both specialists MUST accept the same inbound contract: request identity, closed `intent`, user text, locale, and an orchestrator-owned context packet. Both MUST return a closed structured result with `replyText` plus exactly one job field: `normalizedText` for `demo-normalize` or `label` for `demo-classify`. Unknown fields MUST be rejected. A specialist MUST NOT return a `tool` decision. Specialists MUST NOT send messages to each other.

#### Scenario: Normalize success uses the shared envelope

- **WHEN** intent `normalize` is routed and the specialist returns a schema-valid result
- **THEN** the orchestrator completes with structured success that includes `replyText` and `normalizedText`

#### Scenario: Classify success uses the shared envelope

- **WHEN** intent `classify` is routed and the specialist returns a schema-valid result
- **THEN** the orchestrator completes with structured success that includes `replyText` and `label`

#### Scenario: Extra fields fail closed

- **WHEN** a specialist returns additional properties or a `tool` variant
- **THEN** the orchestrator MUST NOT treat the output as success and MUST complete as typed `invalid_output`

### Requirement: Routing is an explicit closed intent

The orchestrator MUST select the specialist from a closed request `intent` of `normalize` or `classify` using a named, inspectable rule. `normalize` MUST invoke only `demo-normalize`. `classify` MUST invoke only `demo-classify`. Missing or unknown intent MUST fail closed as `unroutable` without invoking a model or a specialist. The runtime MUST NOT use a model to choose topology, fan out to both specialists, or ask a specialist to pick the next agent.

#### Scenario: Normalize routes to one specialist

- **WHEN** a request carries intent `normalize`
- **THEN** only `demo-normalize` is invoked and `demo-classify` is not invoked

#### Scenario: Classify routes to one specialist

- **WHEN** a request carries intent `classify`
- **THEN** only `demo-classify` is invoked and `demo-normalize` is not invoked

#### Scenario: Missing intent is unroutable

- **WHEN** a request omits `intent`
- **THEN** the result is typed `unroutable` and no model call occurs

#### Scenario: Unknown intent is unroutable

- **WHEN** a request carries an intent outside `normalize` and `classify`
- **THEN** the result is typed `unroutable` and no specialist is invoked

### Requirement: Context is an orchestrator-owned packet

The orchestrator MUST pass a typed handoff packet to the specialist: user text, locale, and packed context labeled untrusted. The packet MUST NOT be merged into specialist system policy. Specialists MUST NOT read another agent’s private state or a shared mutable prompt. A typed handoff event MUST record `fromAgentId` `runtime-orchestrator`, `toAgentId` of the chosen specialist, `reason` `routed_intent`, and the correlation identity.

#### Scenario: Packet reaches the specialist as untrusted context

- **WHEN** a valid intent is routed
- **THEN** the specialist model messages include the orchestrator packet outside the system policy role

#### Scenario: Injection in the packet does not add tools

- **WHEN** user text or packed context instructs the specialist to call a tool or another agent
- **THEN** no tool executes, no second specialist is invoked, and routing is unchanged

### Requirement: Orchestrator states and limits are explicit

An orchestrated request MUST progress through named states `receiving`, `routing`, `awaiting_specialist`, then `completed` or `failed`, with actor `runtime` on those transitions. The runtime MUST enforce `maxSpecialistInvocations` of `1` and `maxSteps` of `4` covering receive, route, invoke, and complete. A second specialist invocation on the same request MUST fail as `budget_exceeded` without calling the second specialist. Specialists MUST NOT invoke other specialists or re-enter the orchestrator.

#### Scenario: Happy path records owner states

- **WHEN** a valid normalize request completes
- **THEN** transitions include `receiving`, `routing`, `awaiting_specialist`, and `completed` with actor `runtime`

#### Scenario: Second invocation is denied

- **WHEN** the same request would invoke a specialist after one invocation has already occurred
- **THEN** the run ends as typed `budget_exceeded` and the additional specialist is not invoked

#### Scenario: Step budget is enforced

- **WHEN** the request has already consumed `maxSteps` transitions
- **THEN** the run ends as typed `budget_exceeded` and no specialist model is called

### Requirement: Specialist failures fail closed

On schema-invalid specialist output the orchestrator MUST complete as `invalid_output` after at most one bounded retry of the same model call. On model timeout the orchestrator MUST complete as `llm_timeout`. On provider failure the orchestrator MUST complete as `llm_provider`. On an unexpected specialist exception that is not timeout or provider failure the orchestrator MUST complete as `specialist_failed`. `replyText` and job fields MUST reject strings longer than 2048 characters as `invalid_output`. Output that matches the sensitive-output detector (canary or secret-shaped text) MUST complete as `sensitive_output`. Messages MUST be safe. The runtime MUST NOT invent `replyText`, `normalizedText`, or `label`. Fallback MUST be mocked or configured LLM then typed error.

#### Scenario: Invalid specialist output does not invent success

- **WHEN** the specialist model returns unparseable output or missing required fields after the bounded retry
- **THEN** the result is typed `invalid_output` and no success payload is fabricated

#### Scenario: Specialist timeout does not invent success

- **WHEN** the specialist model exceeds its time budget
- **THEN** the result is typed `llm_timeout` and the user-facing result is not a fabricated completion

#### Scenario: Oversize specialist fields fail closed

- **WHEN** the specialist returns `replyText` or a job field longer than 2048 characters
- **THEN** the result is typed `invalid_output` and no success payload is fabricated

#### Scenario: Sensitive specialist output fails closed

- **WHEN** the specialist returns a canary or secret-shaped `replyText` or job field
- **THEN** the result is typed `sensitive_output` and no success payload is fabricated

### Requirement: Demo HTTP accepts an orchestrated request

The application MUST accept `POST /demo/orchestrate` with a JSON body that includes user text and the closed `intent`. A successful response MUST include session identity, intent, specialist identity, `replyText`, and the job field. Failures MUST use the canonical error envelope from `lidr-specboot/docs/api-spec.yml` (`success` false, `error.message`, `error.code`) with codes `unroutable`, `invalid_output`, `llm_timeout`, `llm_provider`, `budget_exceeded`, `specialist_failed`, `sensitive_output`, `unauthorized`, `orchestration_config`, `rate_limited`, `payload_invalid`, or `session_invalid` as applicable. Canonical `POST /sessions` and `POST /sessions/{sessionId}/turns` MUST remain unimplemented. Voice inbound MUST NOT call this path. HTTP MUST NOT accept `consumedInvocations` or `packedContext` as request fields.

#### Scenario: Successful demo request

- **WHEN** a client posts a valid `normalize` body to `/demo/orchestrate`
- **THEN** the response is success with specialist `demo-normalize` and `normalizedText`

#### Scenario: Unroutable demo request uses the envelope

- **WHEN** a client posts a body without a valid intent to `/demo/orchestrate`
- **THEN** the response matches the canonical error envelope with code `unroutable`

#### Scenario: Session CRUD stays unimplemented

- **WHEN** a client calls `POST /sessions` or `POST /sessions/{sessionId}/turns`
- **THEN** the server does not accept those operations as implemented product routes

### Requirement: Demo HTTP is authenticated and bounded

When `DEMO_ORCHESTRATE_SECRET` or `VOICE_INBOUND_SECRET` is configured, `POST /demo/orchestrate` MUST require header `x-demo-orchestrate-secret` and MUST reject a missing or wrong secret as `unauthorized` (401) without calling a model. When no secret is configured and the LLM adapter is HTTP mode, the route MUST fail closed as `orchestration_config` (503) without calling a model. The route MUST apply a 16 KiB body limit (413 on oversize), inbound-style rate limiting (`rate_limited`, 429), and MUST reject empty or over-4096-character `userText` as `payload_invalid` before a model call. A provided HTTP `sessionId` MUST be a UUID or the request fails as `session_invalid`.

#### Scenario: Missing demo secret is unauthorized when configured

- **WHEN** a demo or inbound secret is configured and a client omits `x-demo-orchestrate-secret`
- **THEN** the response is 401 with code `unauthorized` and no specialist model is called

#### Scenario: Oversize demo body is rejected

- **WHEN** a client posts a body larger than 16 KiB to `/demo/orchestrate`
- **THEN** the response is 413 and no specialist model is called

#### Scenario: Empty user text is rejected

- **WHEN** a client posts a valid intent with empty `userText`
- **THEN** the response uses the canonical envelope with code `payload_invalid` and no specialist model is called

### Requirement: Prompts are versioned and isolated

Each specialist MUST use a versioned prompt artifact (`promptId` `demo-normalize` or `demo-classify` with monotonic version `1` for this increment). Changing prompt text MUST create a new version with a content hash. Production and test turns MUST record `promptId` and `version`. User text and the context packet MUST be packed as untrusted content.

#### Scenario: Turn records specialist prompt version

- **WHEN** a specialist model call completes or fails
- **THEN** the emitted trace or log includes that specialist’s `promptId` and exact version

### Requirement: Multi-agent evaluation cases exist

The change MUST include a frozen fixture set `runtime-multi-agent` that asserts routing, contracts, error codes, and invocation counts rather than live-model prose. The set MUST include at least: `normalize-happy-path`, `classify-happy-path`, `context-packet-reaches-specialist`, `unroutable-missing-intent`, `unroutable-unknown-intent`, `specialist-invalid-output-fail-closed`, `specialist-timeout-fail-closed`, `specialist-injection-does-not-add-tools`, `second-invocation-denied`, `specialist-oversize-output-fail-closed`, and `specialist-canary-output-fail-closed`. Default execution MUST use a mocked model.

#### Scenario: Fixture covers unroutable intent

- **WHEN** the evaluation suite runs `unroutable-unknown-intent`
- **THEN** no specialist model is called and the recorded outcome is typed `unroutable`

#### Scenario: Fixture covers injection

- **WHEN** the evaluation suite runs `specialist-injection-does-not-add-tools`
- **THEN** no tool executes and no second specialist is invoked
