## ADDED Requirements

### Requirement: Voice-channel configuration is optional at process start

The process MUST start when documented required configuration is valid even if voice-channel credentials, endpoints, and timeouts are absent. When any voice-channel setting is present, the set MUST be validated; invalid present values MUST fail closed at start without logging secret values. Secrets MUST remain out of source control.

#### Scenario: Start without voice credentials

- **WHEN** required process configuration is valid and voice-channel settings are omitted
- **THEN** the process becomes live and does not exit because a voice vendor is unconfigured

#### Scenario: Invalid present voice setting fails closed

- **WHEN** a voice-channel setting is present and invalid
- **THEN** the process exits without serving traffic and the error does not include secret values

#### Scenario: Voice placeholders only in examples

- **WHEN** a reviewer inspects tracked environment examples
- **THEN** voice credentials appear only as empty or placeholder values and real secrets are not committed

### Requirement: Voice handling timeout is configurable

The runtime MUST apply a configurable timeout to inbound voice-turn handling. When the timeout setting is omitted, the process MUST use a documented default. The default MUST be suitable for a voice turn (tighter than unconstrained chat).

#### Scenario: Default timeout applies

- **WHEN** voice handling timeout is not set and a turn is processed
- **THEN** the runtime still enforces the documented default timeout
