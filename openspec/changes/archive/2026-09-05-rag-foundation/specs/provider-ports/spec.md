## ADDED Requirements

### Requirement: Retrieval and embedding stay behind ports

The retrieval port MUST support ingesting versioned chunks with embeddings and retrieving scored hits. Embedding MUST be a port capability (on the LLM port or an equivalent embed port), not a vendor type in domain. A future pgvector or other store adapter MUST implement the same retrieval port. Official embedding, vector, and LLM vendor SDKs MUST NOT be added to package manifests.

#### Scenario: Core has no vector or embedding SDK

- **WHEN** a reviewer inspects domain, application, and package manifests
- **THEN** those layers have no vector-store or embedding vendor SDK imports and no such packages are declared

#### Scenario: Future store adapter uses the same port

- **WHEN** a later change adds a PostgreSQL/pgvector store adapter
- **THEN** it MUST implement the existing retrieval port without changing domain ingest or retrieve shapes

## MODIFIED Requirements

### Requirement: This change does not implement product adapters

The runtime MUST NOT ship a runtime MCP server, runtime MCP client, or observability vendor as product behavior. An inbound voice channel adapter remains an interaction adapter. This increment MAY ship an in-process retrieval pipeline and store adapter behind the existing retrieval port. An optional HTTP LLM or embed adapter MAY implement the existing LLM/embed port when credentials are configured. Default local start MUST NOT call a live LLM, embedding, or vector vendor, MUST NOT place a live voice-vendor call, MUST NOT start an MCP client, and MUST NOT require those credentials or an MCP server to become live. Domain and application MUST still depend on ports, not vendor SDK types. Official LLM vendor SDKs and MCP client SDKs MUST NOT be added to package manifests.

#### Scenario: No product LLM or voice adapter

- **WHEN** the application starts in its default local configuration for this change
- **THEN** it does not call a live LLM provider, does not place a live voice-vendor call, and does not require LLM or voice credentials to become live

#### Scenario: Optional LLM adapter stays behind the port

- **WHEN** optional LLM credentials and endpoint are configured
- **THEN** an adapter implementing the existing LLM port MAY perform the model call, and domain and application still have no vendor SDK imports

#### Scenario: Test fakes are not product adapters

- **WHEN** core tests exercise a port, the agent-turn use case, the knowledge pipeline, or the voice-turn use case
- **THEN** they may use an in-process fake or simulator and MUST NOT require a paid or networked vendor

#### Scenario: Default start has no MCP client

- **WHEN** the application starts in its default local configuration
- **THEN** it does not connect to an MCP server and does not require an MCP process

#### Scenario: Default start has no live retrieval vendor

- **WHEN** the application starts in its default local configuration
- **THEN** it does not call a live embedding or vector vendor and does not require those credentials to become live
