## ADDED Requirements

### Requirement: Persistence port records and reads session history

The persistence port MUST support recording Sessions, ConversationTurns, ToolCalls, and execution events, and reading a session list and a complete session report. Application and domain code MUST call these operations through the port. Adapters MAY implement the port with an in-process store, local PostgreSQL, or a hosted PostgreSQL provider. Domain and application MUST NOT import a persistence vendor SDK.

#### Scenario: Application writes through the port

- **WHEN** a voice turn or agent turn records history
- **THEN** the write goes through the persistence port and not through a vendor client in application code

#### Scenario: Domain stays vendor-free after history is added

- **WHEN** a reviewer inspects domain and application code
- **THEN** those layers have no imports of a database driver, ORM, or hosted-persistence SDK

### Requirement: Default tests use an in-process persistence implementation

Automated tests that do not opt into a networked store MUST use an in-process persistence implementation of the same port. A hosted-adapter suite MAY exist and MUST be skipped or no-op when hosted credentials are absent.

#### Scenario: Unit tests do not require a hosted project

- **WHEN** the default test command runs without hosted persistence environment variables
- **THEN** persistence tests still pass against the in-process implementation

## MODIFIED Requirements

### Requirement: Persistence is reached through a port

The application MUST access persistence through a port. Domain code MUST NOT import a database engine, driver, ORM type, or hosted-persistence SDK. Readiness ping MUST remain a port operation. Session-history writes and reads MUST also be port operations.

#### Scenario: Application connects through the port

- **WHEN** the application checks persistence availability
- **THEN** it does so through the persistence port rather than from domain code talking to the engine directly

#### Scenario: Domain stays engine-independent

- **WHEN** a reviewer inspects domain code
- **THEN** that code has no imports of a database driver, ORM, or vendor persistence SDK

#### Scenario: History is not a second unofficial access path

- **WHEN** the application records or retrieves a session report
- **THEN** it uses the persistence port rather than embedding SQL or a vendor query builder in domain or application code
