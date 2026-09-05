# provider-ports Specification

## Purpose

Declares vendor-independent ports for later LLM, voice, tool, retrieval, and observability adapters so those products never become the domain or the runtime kernel.

## Requirements

### Requirement: Provider capabilities are ports, not vendors

The runtime MUST declare ports for LLM completion, voice or speech interaction, tool execution, retrieval, and observability. Domain and application code MUST depend on those ports, not on a vendor SDK type.

#### Scenario: Core has no AI provider SDK

- **WHEN** a reviewer inspects domain and application code
- **THEN** those layers have no imports of an LLM, voice, embedding, or observability vendor SDK

#### Scenario: Ports exist for later adapters

- **WHEN** a later change adds an LLM, voice, tool, retrieval, or observability adapter
- **THEN** that adapter can implement an existing port without a structural rewrite of domain logic

### Requirement: This change does not implement product adapters

The runtime MUST NOT ship a retrieval pipeline, runtime MCP server, or observability vendor as product behavior. An inbound voice channel adapter remains an interaction adapter. An optional HTTP LLM adapter MAY implement the existing LLM port when credentials are configured. Default local start MUST NOT call a live LLM provider, MUST NOT place a live voice-vendor call, and MUST NOT require those credentials to become live. Domain and application MUST still depend on ports, not vendor SDK types. Official LLM vendor SDKs MUST NOT be added to package manifests.

#### Scenario: No product LLM or voice adapter

- **WHEN** the application starts in its default local configuration for this change
- **THEN** it does not call a live LLM provider, does not place a live voice-vendor call, and does not require LLM or voice credentials to become live

#### Scenario: Optional LLM adapter stays behind the port

- **WHEN** optional LLM credentials and endpoint are configured
- **THEN** an adapter implementing the existing LLM port MAY perform the model call, and domain and application still have no vendor SDK imports

#### Scenario: Test fakes are not product adapters

- **WHEN** core tests exercise a port, the agent-turn use case, or the voice-turn use case
- **THEN** they may use an in-process fake or simulator and MUST NOT require a paid or networked vendor

### Requirement: Voice is an adapter, not the runtime

A voice provider MUST integrate as an interaction adapter. The runtime MUST NOT treat a voice vendor as the agent kernel, session system of record, or tool executor.

#### Scenario: Next voice increment stays at the edge

- **WHEN** this change adds a voice channel adapter
- **THEN** session or business state ownership remains in the application runtime, and the voice vendor remains replaceable behind the adapter boundary and internal voice contract

### Requirement: Inbound voice events use the interaction edge not the speech port

This change MUST treat inbound voice-channel events as interaction ingress. The existing speech port (`transcribe` / `synthesize`) MUST remain unused as a product adapter. Domain and application MUST depend on the internal voice-turn contract, not on a vendor webhook type.

#### Scenario: Speech port stays unused in product paths

- **WHEN** a valid inbound voice turn is handled in the default local configuration
- **THEN** the process does not call `transcribe` or `synthesize` on the speech port

#### Scenario: Core still has no vendor SDK

- **WHEN** a reviewer inspects domain and application code after this change
- **THEN** those layers have no imports of a voice-vendor SDK

### Requirement: HTTP LLM adapter preserves untrusted message roles

When the optional HTTP LLM adapter performs a model call, it MUST send the application-supplied message list. System or policy text MUST use a non-user role. User text and tool results MUST remain on untrusted roles. The adapter MUST NOT send a single user message that concatenates policy with untrusted content when a message list is present. The request MUST use an abort signal tied to the model time budget and MUST reject provider bodies over a documented byte limit.

#### Scenario: Outbound body keeps policy off the user role

- **WHEN** the HTTP adapter posts a completion with a system policy message and an untrusted user message
- **THEN** the JSON body has more than one message, the policy text is not in a `user` role, and the user text is not in a `system` role

#### Scenario: Timeout aborts the provider request

- **WHEN** the model time budget elapses during an HTTP completion
- **THEN** the adapter aborts the in-flight request and maps the outcome to a typed LLM timeout or provider failure

### Requirement: Future high-risk actions require human confirmation

The runtime MUST NOT execute irreversible or externally visible business actions. A read-only native demo tool is allowed. Changes that introduce `write`, `irreversible`, or `external_comm` risk MUST require confirmation or approval before side effects.

#### Scenario: Foundation has no side-effecting product tools

- **WHEN** this change is running
- **THEN** the runtime exposes no product tool that writes, charges, transfers, or sends external communications

#### Scenario: Policy reserved for later tools

- **WHEN** a later change adds a side-effecting tool
- **THEN** that change MUST classify the tool risk and MUST NOT execute high-risk actions without confirmation
