## ADDED Requirements

### Requirement: Existing spans become durable without replacing logs

Production spans already emitted on the observability port MUST also be recorded as session execution events when a Session identity is known. The default structured logger MUST continue to emit the same reconstructable metadata. This change MUST NOT add a second span kind vocabulary or an observability-vendor SDK.

#### Scenario: Tool span is both logged and stored

- **WHEN** a tool span is emitted with a session identifier
- **THEN** the default logger still writes a structured line and the persistence port receives a matching execution event with the same `traceId`, kind, name, status, and latency

#### Scenario: Logging adapter is not removed

- **WHEN** a reviewer inspects the default observability composition
- **THEN** the existing structured logging adapter remains the live emit path

### Requirement: Durable events omit secrets and raw utterances on span metadata

Stored execution events MAY reference a turn or tool row. Span metadata MUST NOT include API keys, authorization headers, unredacted secrets, or stack traces. Retrieval events MUST NOT store raw query text.

#### Scenario: Stored LLM event has no credentials

- **WHEN** an LLM span is persisted
- **THEN** the stored metadata includes safe model identity when present and does not include API keys
