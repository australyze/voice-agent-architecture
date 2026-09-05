## ADDED Requirements

### Requirement: Knowledge composition does not require a live store

Default process composition MUST wire an in-process knowledge store and a non-networked embed path when paid embedding credentials are absent. Starting MUST succeed without vector-database, embedding-vendor, or knowledge-HTTP settings. Canonical HTTP `registerDocument` and `queryKnowledge` MUST remain unimplemented.

#### Scenario: Start without retrieval credentials

- **WHEN** required process configuration is valid and embedding or vector-vendor settings are omitted
- **THEN** the process becomes live and knowledge uses the in-process store

#### Scenario: Knowledge HTTP stays unimplemented

- **WHEN** a client calls `POST /knowledge/documents` or `POST /knowledge/query`
- **THEN** the server does not expose those product operations in this increment

### Requirement: Retrieval calls emit secret-safe traces

Each retrieval on the agent path MUST emit an observability span with kind `retrieval`. The span MUST include query text that is safe to log (no secrets), hit ids, scores, locators or a bounded hit summary, corpus version, retriever version, latency, and status. Retrieved chunk bodies MUST NOT be logged in full on the default adapter.

#### Scenario: Successful retrieve is traced

- **WHEN** a turn retrieves at least one above-threshold hit
- **THEN** the observability port receives a `retrieval` span with status `ok`, hit ids, and no secret values

#### Scenario: Empty retrieve is traced

- **WHEN** a turn retrieves no above-threshold hit
- **THEN** the observability port receives a `retrieval` span that records an empty or below-threshold outcome

#### Scenario: Failed retrieve is traced

- **WHEN** embed or retrieve throws
- **THEN** the observability port receives a `retrieval` span with status `error` and the turn fails as `retrieval_failed`

## MODIFIED Requirements

### Requirement: Runtime owns the agent-turn use case

The application runtime MUST retrieve and assemble current-turn knowledge, pack prompt and current-turn context, invoke the LLM port, authorize and execute allowlisted tools, validate structured output, and return a typed agent result including sources when hits were used. Voice and other adapters MUST invoke that use case rather than call an LLM, tool, or retrieval port directly.

#### Scenario: Adapter does not call the LLM port

- **WHEN** a valid inbound voice turn is processed
- **THEN** the voice adapter invokes the runtime agent-turn path and does not import or call the LLM port itself

#### Scenario: Typed agent success

- **WHEN** the agent-turn use case completes with a valid reply
- **THEN** the result includes reply text, locale, a success status the adapter can map, and a sources list (empty when no hit was used)

#### Scenario: Adapter does not call the retrieval port

- **WHEN** a valid inbound voice turn is processed
- **THEN** the voice adapter does not import or call the retrieval port itself

## ADDED Requirements

### Requirement: Retrieval and LLM failures include retrieval_failed

The runtime MUST classify embed or retrieve exceptions as `retrieval_failed` with a secret-safe message. Voice mapping MUST treat that code as a runtime failure, not as a successful reply.

#### Scenario: Embed throw is retrieval_failed

- **WHEN** the embed capability throws during a turn
- **THEN** the agent result is `retrieval_failed` and no structured completion runs
