# application-runtime Specification

## Purpose

Defines how the AI Agent Runtime process starts, loads configuration, reports failures, and logs operations without leaking secrets or coupling the core to a vendor.

## Requirements

### Requirement: Process starts from documented configuration

The application MUST start in a local environment when the documented required configuration is present and valid. Starting MUST NOT require undocumented manual steps.

#### Scenario: Valid local configuration

- **WHEN** a developer provides the documented required configuration and starts the application
- **THEN** the process becomes ready to accept health probes without additional undocumented setup

#### Scenario: Documented clone-to-run path

- **WHEN** a developer clones the repository and follows the install documentation
- **THEN** they can start the application and run the automated tests for this change

### Requirement: Configuration fails closed

The application MUST validate required configuration at process start. If required configuration is missing or invalid, the process MUST exit without serving traffic. Secrets MUST NOT be stored in source control.

#### Scenario: Missing required configuration

- **WHEN** a required configuration value is absent at start
- **THEN** the process exits with a non-zero status and an explicit error that does not include secret values

#### Scenario: Invalid required configuration

- **WHEN** a required configuration value is present but invalid
- **THEN** the process exits with a non-zero status and an explicit error that does not include secret values

#### Scenario: Secrets stay out of source

- **WHEN** a reviewer inspects the committed repository
- **THEN** no real secret values appear in tracked source, and secret files including `.env` and `.env.*` variants except `.env.example` are excluded from version control

### Requirement: Boundary errors use a consistent envelope

When an error crosses an HTTP boundary, the application MUST return the canonical error envelope from `lidr-specboot/docs/api-spec.yml`: `success` is `false`, and `error` contains `message` and `code`. The envelope MUST NOT include secrets, stack traces, or provider internals.

#### Scenario: Handled application error at the HTTP edge

- **WHEN** a handled application error is returned over HTTP
- **THEN** the response body matches the canonical error envelope and omits secrets and stack traces

#### Scenario: Unexpected error at the HTTP edge

- **WHEN** an unexpected error is returned over HTTP
- **THEN** the response uses the same envelope with a generic safe message and a stable error code

### Requirement: Operation logging is secret-safe

The application MUST emit logs that identify the operation and whether it succeeded or failed. Logs MUST NOT contain secrets or unnecessary sensitive data.

#### Scenario: Successful operation is identifiable

- **WHEN** a named operation completes successfully
- **THEN** a log entry identifies the operation and a success outcome

#### Scenario: Failed operation is identifiable

- **WHEN** a named operation fails
- **THEN** a log entry identifies the operation and a failure outcome without secret values

#### Scenario: Common secret shapes are redacted

- **WHEN** a log or mapped error message contains a Postgres URL, a bearer token, a `sk-` style key, or an `*_API_KEY=` assignment
- **THEN** those values are replaced before the line is written

### Requirement: Local process listens on loopback by default

The application MUST listen on a configurable host. When listen host is omitted, the default MUST be loopback (`127.0.0.1`). An invalid listen host MUST fail closed at configuration time.

#### Scenario: Default listen host is loopback

- **WHEN** required configuration is valid and listen host is not set
- **THEN** the process listens on `127.0.0.1`

#### Scenario: Invalid listen host fails closed

- **WHEN** listen host is present and is not a valid IPv4, IPv6, or hostname value
- **THEN** the process exits without serving traffic and the error does not include secrets

### Requirement: Core is testable without paid providers

Deterministic core behavior MUST be testable without calling real LLM, voice, embedding, or paid observability services.

#### Scenario: Core tests run offline from paid APIs

- **WHEN** the automated core tests for this change run
- **THEN** they pass without network calls to paid AI or observability providers

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
