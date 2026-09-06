## Purpose

Makes a completed voice demonstration session reconstructable from durable, provider-independent records so an interviewer can retrieve transcript, tool executions, a chronological execution trace, and basic metrics without a vendor console.

## ADDED Requirements

### Requirement: Session history is relational and correlatable

The system MUST persist one Session per voice demonstration call, with child ConversationTurns, ToolCalls, and execution events that reference that Session. When an inbound `externalChannelId` is present, at most one Session MAY exist for that identifier. The Session MUST retain `sessionId`, `traceId` when known, `externalChannelId` when known, agent identity, status, `startedAt`, and `endedAt` plus duration when the call has ended.

#### Scenario: One provider call maps to one session

- **WHEN** two inbound events share the same `externalChannelId`
- **THEN** they attach to the same Session and do not create a second Session for that identifier

#### Scenario: Child records join the parent session

- **WHEN** turns, tool calls, and execution events are stored for a session
- **THEN** each child record references that Session identifier

### Requirement: Transcript turns are normalized

User and assistant speech MUST be stored as ConversationTurns with role `user` or `assistant`, text, a sequence index, and a timestamp when known. Raw vendor message objects MUST NOT be the application data model.

#### Scenario: User and assistant turns are distinguishable

- **WHEN** a transcript turn is handled and the runtime produces an assistant reply
- **THEN** the stored transcript includes a user turn and an assistant turn in order

### Requirement: Tool executions are durable with latency

Each authorized tool attempt MUST be stored with tool name, status, started and completed times, duration, bounded validated arguments, bounded result or a normalized error class, and the parent Session. Stack traces and secrets MUST NOT be stored. Completed attempts MUST NOT be overwritten by a retry; a retry MUST create a new ToolCall.

#### Scenario: Successful tool is reconstructable

- **WHEN** an allowlisted tool completes successfully
- **THEN** the stored ToolCall has status succeeded, a duration in milliseconds, and bounded arguments and result

#### Scenario: Failed tool stores a class not a stack

- **WHEN** a tool fails with a typed runtime error class
- **THEN** the stored ToolCall has a failed status and that error class and does not include a stack trace

### Requirement: Execution events reconstruct a chronological trace

The system MUST persist execution events sufficient to reconstruct time order for call start, user transcript, agent start, LLM start/complete, tool start/complete, assistant transcript, call end, and normalized errors when those steps occurred. Event kinds MUST reuse the existing observability kinds and names (`http`, `workflow`, `llm`, `tool`, `retrieval`) rather than a second vocabulary. Each event MUST carry `traceId` and Session identity when known.

#### Scenario: Happy-path order is reconstructable

- **WHEN** a call starts, a user transcript is handled with one LLM call and one tool, the assistant replies, and the call ends
- **THEN** retrieving the session report yields those events in chronological order sharing one `traceId`

### Requirement: Lifecycle ingest is idempotent and order-tolerant

Duplicate identifiable events MUST NOT create a second Session, a second completion, or a corrupted duration. An end event that arrives before a non-critical earlier event MUST still upsert the Session and MUST NOT crash the process. Call start MUST initialize or refresh start metadata. Call end MUST set end time, duration when both timestamps exist, and a final status.

#### Scenario: Duplicate end does not fork the session

- **WHEN** the same `call_ended` event is processed twice for one `externalChannelId`
- **THEN** exactly one Session exists and duration is not doubled

#### Scenario: End without a prior start is safe

- **WHEN** a `call_ended` event arrives and no Session exists yet for that identity
- **THEN** the system creates or upserts the Session as ended and does not throw

### Requirement: Metrics are deterministic counts

A session report MUST include duration when ended, conversation turn count, tool-call count, and error count derived from stored rows. It MAY also include successful tool count, failed tool count, average tool latency, and LLM-call count when those rows exist. Metrics MUST NOT include evaluation scores.

#### Scenario: Counts match stored rows

- **WHEN** a session has six turns, two tool calls, and one stored error event
- **THEN** the report metrics are turn count 6, tool-call count 2, and error count 1

### Requirement: Read API lists recent sessions and returns one report

The HTTP API MUST expose read-only `GET /sessions` and `GET /sessions/{sessionId}` consistent with `lidr-specboot/docs/api-spec.yml` session resources and the project error envelope. Both routes MUST require the demo-operator shared secret (`x-demo-orchestrate-secret`, resolved as `DEMO_ORCHESTRATE_SECRET` or else `VOICE_INBOUND_SECRET`). Missing server secret MUST return 503 with a typed config error. Missing or wrong secret MUST return 401 with the canonical error envelope. Loopback bind and store RLS MUST NOT be treated as authorization. The list MUST return lightweight recent sessions including session id, start time, duration when known, status, agent identity, turn count, and tool-call count. The list MAY filter by `externalChannelId`. The detail MUST return metadata, transcript, tool calls, chronological trace, metrics, and `evaluation` as null. Responses MUST NOT include database credentials, service-role keys, or raw vendor payloads. Unknown ids MUST return 404. Malformed session ids MUST return 400.

#### Scenario: List is lightweight

- **WHEN** a client requests `GET /sessions`
- **THEN** the response is a list of recent sessions with counts and without full traces

#### Scenario: Detail reconstructs the call

- **WHEN** a client requests `GET /sessions/{sessionId}` for a persisted session
- **THEN** the body includes metadata, transcript, tool calls, trace, metrics, and `evaluation` equal to null

#### Scenario: Unknown session is 404

- **WHEN** an authenticated client requests a well-formed session id that does not exist
- **THEN** the response is 404 with the canonical error envelope

#### Scenario: Unauthenticated history read is rejected

- **WHEN** a client requests `GET /sessions` or `GET /sessions/{sessionId}` without a valid demo-operator secret
- **THEN** the response is 401 with the canonical error envelope and no session list or transcript

### Requirement: Persistence credentials stay off the public surface

Anonymous or public store credentials MUST NOT be able to read session history tables. Service-role and database passwords MUST exist only as backend configuration. Transcript retention MUST be documented as demo-lifetime synthetic data with no automated retention engine in this change.

#### Scenario: Public store cannot list history

- **WHEN** a reviewer inspects the published schema security for session history tables
- **THEN** those tables are not readable through an anonymous public key

#### Scenario: Default tests do not need hosted credentials

- **WHEN** the default automated suite runs without hosted persistence credentials
- **THEN** the suite still passes using an in-process persistence implementation
