## ADDED Requirements

### Requirement: Voice integration diagnostic is distinct from readiness

The application MUST expose an HTTP diagnostic that reports voice-channel integration status as one of: configured, not configured, or error. Voice-channel availability MUST NOT be an essential dependency for readiness. Liveness MUST continue to report process aliveness even when voice is not configured.

#### Scenario: Voice not configured

- **WHEN** a client requests the voice integration diagnostic and voice-channel settings are absent
- **THEN** the response indicates not configured and `/health/ready` can still be ready when persistence is available

#### Scenario: Voice configured

- **WHEN** a client requests the voice integration diagnostic and required voice-channel settings are present and syntactically valid
- **THEN** the response indicates configured and MUST NOT include secret values

#### Scenario: Voice configuration or connectivity error

- **WHEN** voice-channel settings are present but invalid, or a bounded configuration check fails
- **THEN** the diagnostic indicates error with a stable code and MUST NOT include secret values

#### Scenario: Missing voice does not fail readiness

- **WHEN** voice-channel settings are absent and persistence is available
- **THEN** readiness still indicates the application is ready

## MODIFIED Requirements

### Requirement: Health probes are unauthenticated local-or-orchestrator checks

Health routes MUST remain unauthenticated in this change. This is an explicit exception to authorizing every HTTP route: the probes return only liveness, readiness, and voice-integration diagnostic status, not product conversation data. Combined with the default loopback listen host, they are intended for the local developer and a later orchestrator on a controlled network, not as a public API.

#### Scenario: Health does not require credentials

- **WHEN** a client calls `/health/live`, `/health/ready`, or the voice integration diagnostic without an authorization header
- **THEN** the probe is still evaluated (alive, ready or not ready, or a voice diagnostic status)
