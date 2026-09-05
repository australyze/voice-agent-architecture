# persistence-port Specification

## Purpose

Defines the persistence boundary so the runtime can connect to durable storage without making a database engine or access framework part of the domain.

## Requirements

### Requirement: Persistence is reached through a port

The application MUST access persistence through a port. Domain code MUST NOT import a database engine, driver, or ORM type.

#### Scenario: Application connects through the port

- **WHEN** the application checks persistence availability
- **THEN** it does so through the persistence port rather than from domain code talking to the engine directly

#### Scenario: Domain stays engine-independent

- **WHEN** a reviewer inspects domain code
- **THEN** that code has no imports of a database driver, ORM, or vendor persistence SDK

### Requirement: Local persistence is reproducible

A clean development environment MUST be able to start the required persistence service using the documented containerization path.

#### Scenario: Clean environment starts persistence

- **WHEN** a developer follows the documented containerization steps on a clean machine with the documented prerequisites
- **THEN** the persistence service required for local development starts without undocumented host installs of the database engine

### Requirement: Local Compose persistence is loopback-only

The documented Compose file MUST publish PostgreSQL on the host loopback address only. Default Compose credentials are local placeholders and MUST NOT be reused outside that local file. Documentation MUST state that this store is local-only.

#### Scenario: Compose publishes Postgres on loopback

- **WHEN** a reviewer inspects the documented Compose publish mapping
- **THEN** the host bind is `127.0.0.1` and is not all interfaces

#### Scenario: Local credentials are documented as placeholders

- **WHEN** a developer reads the install documentation
- **THEN** they are told the Compose password is local-only and must not be reused outside local development

### Requirement: Persistence failure is safe to observe

A persistence connection or readiness failure MUST be reported without exposing credentials, connection strings, or engine internals that are not needed to diagnose the outage.

#### Scenario: Connection failure hides secrets

- **WHEN** persistence cannot be reached
- **THEN** logs and HTTP responses identify the failed operation without including credentials or full connection strings
