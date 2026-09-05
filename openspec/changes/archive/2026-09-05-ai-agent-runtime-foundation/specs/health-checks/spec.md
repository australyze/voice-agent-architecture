## Purpose

Defines liveness and readiness probes so an operator or orchestrator can tell a living process from a process that cannot reach essential dependencies.

## ADDED Requirements

### Requirement: Liveness reports process aliveness

The application MUST expose an HTTP liveness check that reports whether the process is running. Liveness MUST NOT fail solely because an essential dependency is unavailable.

#### Scenario: Process is running

- **WHEN** an external system requests the liveness endpoint and the process is running
- **THEN** the response indicates the process is alive

#### Scenario: Dependency down does not fail liveness

- **WHEN** an essential dependency is unavailable and the process is still running
- **THEN** the liveness endpoint still indicates the process is alive

### Requirement: Readiness reports essential dependency availability

The application MUST expose an HTTP readiness check that reports whether essential dependencies required to serve the current scope are available. Persistence connectivity is an essential dependency for readiness.

#### Scenario: Dependencies available

- **WHEN** an external system requests the readiness endpoint and essential dependencies are available
- **THEN** the response indicates the application is ready

#### Scenario: Persistence unavailable

- **WHEN** persistence is unavailable
- **THEN** the readiness endpoint indicates the application is not ready and MUST NOT include connection secrets

### Requirement: Health probes are unauthenticated local-or-orchestrator checks

Health routes MUST remain unauthenticated in this change. This is an explicit exception to authorizing every HTTP route: the probes return only liveness and readiness, not product data. Combined with the default loopback listen host, they are intended for the local developer and a later orchestrator on a controlled network, not as a public API.

#### Scenario: Health does not require credentials

- **WHEN** a client calls `/health/live` or `/health/ready` without an authorization header
- **THEN** the probe is still evaluated (alive, ready, or not ready)

### Requirement: Health HTTP errors use the canonical envelope

Unexpected failures on health endpoints MUST use the canonical error envelope from `lidr-specboot/docs/api-spec.yml` and MUST NOT leak secrets.

#### Scenario: Unexpected health handler failure

- **WHEN** a health handler fails unexpectedly
- **THEN** the response uses `success: false` with `error.message` and `error.code` and omits secrets
