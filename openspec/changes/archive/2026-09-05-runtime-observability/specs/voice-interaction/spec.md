## MODIFIED Requirements

### Requirement: Voice turns emit correlatable secret-safe logs

Each handled voice turn MUST emit a structured log that, when the values are available, includes session identifier, request identifier, interaction identifier, the turn `occurredAt` timestamp as ISO-8601, event type, processing time, status, and the same `traceId` used on observability spans for that execution. Logs MUST NOT contain API keys, credentials, or unnecessary sensitive payload fields.

#### Scenario: Successful turn is correlatable

- **WHEN** a valid voice turn completes
- **THEN** a success log includes the available correlation identifiers, the execution `traceId`, the turn `occurredAt` timestamp, event type, processing time, and a success status

#### Scenario: Failed turn is correlatable

- **WHEN** a voice turn fails
- **THEN** a failure log includes the available correlation identifiers, the execution `traceId` when one was assigned, a stable error code, and no secret values

#### Scenario: Invalid session identifier is not logged raw

- **WHEN** the runtime rejects a turn because the session identifier is not a UUID
- **THEN** the failure log includes a stable session-invalid code and MUST NOT include the raw invalid identifier
