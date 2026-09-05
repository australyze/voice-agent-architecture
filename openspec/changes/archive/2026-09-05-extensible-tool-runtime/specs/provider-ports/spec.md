## ADDED Requirements

### Requirement: Tool port stays source-agnostic and MCP-free in this increment

The existing tool port MUST remain the only execution boundary for native and future MCP-backed tools. Domain and application MUST NOT import an MCP SDK or a vendor tool client. A future Runtime MCP adapter MUST implement the same port. This increment MUST NOT ship a runtime MCP client adapter as a boot dependency.

#### Scenario: Core has no MCP SDK

- **WHEN** a reviewer inspects domain, application, and package manifests
- **THEN** there is no MCP client package and those layers have no MCP SDK imports

#### Scenario: Future MCP adapter would use the same port

- **WHEN** a later change adds a Runtime MCP tool adapter
- **THEN** it MUST implement the existing tool port and MUST still allowlist and schema-validate before execution

## MODIFIED Requirements

### Requirement: This change does not implement product adapters

The runtime MUST NOT ship a retrieval pipeline, runtime MCP server, runtime MCP client, or observability vendor as product behavior. An inbound voice channel adapter remains an interaction adapter. An optional HTTP LLM adapter MAY implement the existing LLM port when credentials are configured. Default local start MUST NOT call a live LLM provider, MUST NOT place a live voice-vendor call, MUST NOT start an MCP client, and MUST NOT require those credentials or an MCP server to become live. Domain and application MUST still depend on ports, not vendor SDK types. Official LLM vendor SDKs and MCP client SDKs MUST NOT be added to package manifests.

#### Scenario: No product LLM or voice adapter

- **WHEN** the application starts in its default local configuration for this change
- **THEN** it does not call a live LLM provider, does not place a live voice-vendor call, and does not require LLM or voice credentials to become live

#### Scenario: Optional LLM adapter stays behind the port

- **WHEN** optional LLM credentials and endpoint are configured
- **THEN** an adapter implementing the existing LLM port MAY perform the model call, and domain and application still have no vendor SDK imports

#### Scenario: Test fakes are not product adapters

- **WHEN** core tests exercise a port, the agent-turn use case, or the voice-turn use case
- **THEN** they may use an in-process fake or simulator and MUST NOT require a paid or networked vendor

#### Scenario: Default start has no MCP client

- **WHEN** the application starts in its default local configuration
- **THEN** it does not connect to an MCP server and does not require an MCP process
