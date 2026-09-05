## Purpose

Declares vendor-independent ports for later LLM, voice, tool, retrieval, and observability adapters so those products never become the domain or the runtime kernel.

## ADDED Requirements

### Requirement: Provider capabilities are ports, not vendors

The runtime MUST declare ports for LLM completion, voice or speech interaction, tool execution, retrieval, and observability. Domain and application code MUST depend on those ports, not on a vendor SDK type.

#### Scenario: Core has no AI provider SDK

- **WHEN** a reviewer inspects domain and application code
- **THEN** those layers have no imports of an LLM, voice, embedding, or observability vendor SDK

#### Scenario: Ports exist for later adapters

- **WHEN** a later change adds an LLM, voice, tool, retrieval, or observability adapter
- **THEN** that adapter can implement an existing port without a structural rewrite of domain logic

### Requirement: This change does not implement product adapters

This change MUST NOT ship a production LLM provider, voice provider, retrieval pipeline, runtime MCP server, or observability vendor as product behavior. Optional no-op or fake implementations used only in tests are allowed.

#### Scenario: No product LLM or voice adapter

- **WHEN** the application starts in its default local configuration for this change
- **THEN** it does not call an LLM or voice provider and does not require those provider credentials to become live

#### Scenario: Test fakes are not product adapters

- **WHEN** core tests exercise a port
- **THEN** they may use an in-process fake and MUST NOT require a paid or networked vendor

### Requirement: Voice is an adapter, not the runtime

A future voice provider MUST integrate as an interaction adapter. The runtime MUST NOT treat a voice vendor as the agent kernel, session system of record, or tool executor.

#### Scenario: Next voice increment stays at the edge

- **WHEN** a later change adds a voice adapter
- **THEN** session or business state ownership remains in the application runtime, and the voice vendor remains replaceable behind the voice or speech port

### Requirement: Future high-risk actions require human confirmation

The foundation MUST NOT execute irreversible or externally visible business actions. Later tool or agent changes that introduce `write`, `irreversible`, or `external_comm` risk MUST require confirmation or approval before side effects.

#### Scenario: Foundation has no side-effecting product tools

- **WHEN** this change is running
- **THEN** the runtime exposes no product tool that writes, charges, transfers, or sends external communications

#### Scenario: Policy reserved for later tools

- **WHEN** a later change adds a side-effecting tool
- **THEN** that change MUST classify the tool risk and MUST NOT execute high-risk actions without confirmation
