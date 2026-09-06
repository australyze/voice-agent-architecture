## ADDED Requirements

### Requirement: Adapter does not own WOM policy

The inbound voice adapter MUST continue to authenticate, validate, map vendor-free fields to `VoiceTurn`, and return the consumer response. It MUST NOT contain WOM prompts, tool names, mock payloads, or customer-service business rules. Composition — not the Vapi mapper — MUST choose which agent `runAgent` invokes.

#### Scenario: Inbound mapper stays policy-free

- **WHEN** a reviewer inspects the voice inbound mapping module
- **THEN** it does not import WOM prompt artifacts, `wom.*` tool executors, or mock WOM data

#### Scenario: HTTP contract unchanged

- **WHEN** a valid authenticated inbound event is accepted
- **THEN** the documented `POST /adapters/voice/inbound` request and error envelope remain the same regardless of the configured session owner
