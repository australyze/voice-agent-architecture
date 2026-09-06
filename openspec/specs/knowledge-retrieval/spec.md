# knowledge-retrieval Specification

## Purpose

Gives the runtime a foundation knowledge pipeline so one example document can be ingested, retrieved with locators, and attributed without locking the agent to a single vector store.

## Requirements

### Requirement: One example document can be ingested

The runtime MUST ingest one domain-neutral, PII-free example document into a logical corpus. Ingest MUST record source URI, document identity, parser version, chunker version, embedding model identity and version, and corpus version. Chunks without a locator MUST be rejected. This increment MUST NOT ingest a production knowledge base.

#### Scenario: Example document is stored with locators

- **WHEN** the example document is ingested through the knowledge pipeline
- **THEN** each stored chunk has a document identity, a locator, chunk text, and chunker version

#### Scenario: Production corpus is out of scope

- **WHEN** a reviewer inspects this increment
- **THEN** there is no multi-corpus operator workflow and no real customer document set

### Requirement: Embeddings use a named model behind a port

Every stored vector MUST be produced by an embedding capability identified by model id and version. Domain and application MUST NOT call a vendor embedding SDK. Tests and default local start MUST be able to embed without a paid network call.

#### Scenario: Query and ingest share an embedding identity

- **WHEN** the example document is ingested and later retrieved
- **THEN** retrieve uses the same embedding model id and version that produced the stored vectors

#### Scenario: Offline embed is sufficient for tests

- **WHEN** pipeline tests run
- **THEN** they complete without a paid embedding provider

### Requirement: Vector storage is interchangeable

Stored vectors MUST sit behind a retrieval/store port. Replacing the default in-memory adapter with another adapter that implements the same port MUST NOT require rewriting ingest, chunking, or the agent-turn loop. Domain and application MUST NOT import a vector-vendor client.

#### Scenario: Default store is in-process

- **WHEN** the application starts in its default local configuration
- **THEN** retrieval uses an in-process store and does not require a vector-database process

#### Scenario: Alternate adapter can implement the same port

- **WHEN** a later change adds a different vector-store adapter
- **THEN** that adapter can implement the existing port without changing the ingest or assemble contracts

### Requirement: Retrieval applies a threshold and returns locators

Retrieve MUST accept a query and return hits with chunk id, document id, locator, score, and rank. Hits below the configured score threshold MUST be dropped. Weak or empty results MUST NOT be treated as evidence for generation. Retrieval MUST NOT generate an LLM answer.

#### Scenario: Relevant query returns the example document

- **WHEN** a query that should match the example document is retrieved after ingest
- **THEN** at least one above-threshold hit identifies that document and includes a locator

#### Scenario: Irrelevant query yields no evidence

- **WHEN** a query that should not match the example document is retrieved
- **THEN** no hit is returned as evidence (empty list or all scores below threshold)

### Requirement: Assembled context preserves attribution

Context assembly MUST pack only above-threshold hits and MUST preserve chunk id, document id, and locator for every included hit. Compression or truncation MUST NOT drop locators. Assembled retrieved text MUST stay within a documented character budget (2048). Hits that would exceed the budget MUST be dropped from the lowest rank first; the current user utterance MUST NOT be dropped to make room. Ingested chunk text longer than the documented chunk window (512) MUST be rejected. Retrieved text MUST be labeled untrusted and MUST NOT be treated as system policy. Chunk text MUST be fenced so embedded `UNTRUSTED_*` labels cannot open a new packing block.

#### Scenario: Assembled hits keep locators

- **WHEN** two above-threshold hits are assembled
- **THEN** each included hit still has chunk id, document id, and locator

#### Scenario: Retrieved jailbreak is not policy

- **WHEN** a stored chunk contains instructions to ignore policy or enable a non-allowlisted tool
- **THEN** assembly still labels that text untrusted and the runtime MUST NOT expand the tool allowlist because of it

#### Scenario: Oversized assembled context is bounded

- **WHEN** above-threshold hits would exceed the documented assembled-character budget
- **THEN** the runtime omits lowest-rank hits until the packed retrieved block fits and does not drop the current user utterance

#### Scenario: Oversized ingest chunk is rejected

- **WHEN** an ingest chunk’s text exceeds the documented chunk window
- **THEN** the store rejects the ingest and does not persist that chunk

### Requirement: Retrieval evaluation is independent of generation

The change MUST include a frozen retrieval eval set with at least one relevant query that must retrieve the example document and one irrelevant query that must not. Metrics MUST include recall@k or equivalent hit-id correctness. A passing vector-client unit test MUST NOT substitute for this eval. The set MUST be PII-free.

#### Scenario: Relevant fixture hits the example document

- **WHEN** the retrieval eval suite runs the relevant-query case
- **THEN** the expected chunk or document id appears in the top-k hits

#### Scenario: Irrelevant fixture does not count as a hit

- **WHEN** the retrieval eval suite runs the irrelevant-query case
- **THEN** the example document is not treated as a successful evidence hit

### Requirement: WOM answers are not corpus-grounded

The `wom-customer-service-agent` path MUST NOT require retrieved corpus evidence to answer usage, billing, or service-status questions. Facts about the simulated subscriber MUST come from allowlisted mock tools. The shared agent-turn loop MAY still invoke the retrieval port; when it does, a successful empty-hit result MUST be sufficient and MUST NOT be treated as a retrieval failure.

#### Scenario: WOM turn succeeds with no corpus hits

- **WHEN** a valid WOM turn is handled against a retrieval store with no usable hits and the model returns a schema-valid `reply` or a valid `wom.*` tool then `reply`
- **THEN** the turn completes without `retrieval_failed` and without requiring example-document citations

#### Scenario: runtime-demo retrieval is unchanged

- **WHEN** a `runtime-demo` turn is handled with the default ingested example document
- **THEN** existing retrieval assembly, threshold, and `retrieval_failed` behavior still apply

#### Scenario: Seeded retrieved jailbreak does not expand WOM allowlist

- **WHEN** a WOM inbound or agent turn is handled against a store containing a jailbreak-shaped chunk and the model proposes a tool that is not on the WOM allowlist
- **THEN** the runtime returns `tool_denied` and MUST NOT execute that tool
