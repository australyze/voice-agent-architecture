## ADDED Requirements

### Requirement: Inbound voice events use the interaction edge not the speech port

This change MUST treat inbound voice-channel events as interaction ingress. The existing speech port (`transcribe` / `synthesize`) MUST remain unused as a product adapter. Domain and application MUST depend on the internal voice-turn contract, not on a vendor webhook type.

#### Scenario: Speech port stays unused in product paths

- **WHEN** a valid inbound voice turn is handled in the default local configuration
- **THEN** the process does not call `transcribe` or `synthesize` on the speech port

#### Scenario: Core still has no vendor SDK

- **WHEN** a reviewer inspects domain and application code after this change
- **THEN** those layers have no imports of a voice-vendor SDK

## MODIFIED Requirements

### Requirement: This change does not implement product adapters

This change MUST NOT ship a production LLM provider, retrieval pipeline, runtime MCP server, or observability vendor as product behavior. An inbound voice channel adapter is allowed as an interaction adapter. Optional no-op or fake implementations used only in tests remain allowed. Default local start MUST NOT call a live voice vendor or require those credentials.

#### Scenario: No product LLM or voice adapter

- **WHEN** the application starts in its default local configuration for this change
- **THEN** it does not call an LLM provider, does not place a live voice-vendor call, and does not require voice credentials to become live

#### Scenario: Test fakes are not product adapters

- **WHEN** core tests exercise a port or the voice-turn use case
- **THEN** they may use an in-process fake or simulator and MUST NOT require a paid or networked vendor

### Requirement: Voice is an adapter, not the runtime

A voice provider MUST integrate as an interaction adapter. The runtime MUST NOT treat a voice vendor as the agent kernel, session system of record, or tool executor.

#### Scenario: Next voice increment stays at the edge

- **WHEN** this change adds a voice channel adapter
- **THEN** session or business state ownership remains in the application runtime, and the voice vendor remains replaceable behind the adapter boundary and internal voice contract
