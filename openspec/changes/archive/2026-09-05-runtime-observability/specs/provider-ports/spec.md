## ADDED Requirements

### Requirement: Observability span contract carries correlation and metrics

The observability port MUST accept a span that includes name, kind (`llm` | `tool` | `retrieval` | `http` | `workflow` | `voice`), status (`ok` | `error`), `traceId`, latency, and optional session, request, interaction, and parent identifiers. Optional fields MUST include prompt id and version, model id, tool name and source, redacted arguments, bounded results, validation outcome, error class, retrieval versions, token counts, estimated cost, and retry count. Domain and application MUST NOT import an observability vendor type to populate those fields.

#### Scenario: Port accepts a reconstructable LLM span

- **WHEN** application code emits an LLM span with `traceId`, parent identifier, latency, status, and optional token counts
- **THEN** the observability port accepts that span without requiring a vendor SDK type

#### Scenario: Future platform adapter uses the same port

- **WHEN** a later change adds an observability-platform adapter
- **THEN** it MUST implement the existing observability port without changing domain span shapes
