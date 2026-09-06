## ADDED Requirements

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
