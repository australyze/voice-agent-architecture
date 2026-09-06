## ADDED Requirements

### Requirement: Agent-turn LLM and tool steps persist through the port

When a Session identity is known, each LLM completion and authorized tool attempt on the agent-turn path MUST be recorded through the persistence port using the same `traceId` and `sessionId` already used on observability spans. Application code MUST NOT import a hosted-persistence SDK. Tool argument and result payloads MUST stay bounded and redacted per existing secret-safe trace rules.

#### Scenario: Tool hop writes a tool call and matching events

- **WHEN** an allowlisted tool executes during an agent turn that has a session identifier
- **THEN** the persistence port receives a ToolCall plus tool start and completion events that share that session and trace identifier

#### Scenario: LLM completion writes an execution event

- **WHEN** structured model completion finishes on that path
- **THEN** the persistence port receives an LLM execution event with latency and status and without API keys

### Requirement: Persistence configuration is optional for process start

The process MUST start without hosted persistence credentials. When those credentials are absent, readiness MAY continue to use the existing local PostgreSQL ping. Session-history writes MUST use the in-process or configured adapter without requiring a hosted project to become live.

#### Scenario: Default start without hosted persistence

- **WHEN** the application starts in its default local configuration without hosted persistence variables
- **THEN** the process becomes live and does not import or call a hosted persistence API from domain or application code
