## MODIFIED Requirements

### Requirement: Runtime owns the orchestrated-turn use case

The application runtime MUST own closed-intent routing, context-packet construction, specialist invocation, structured-result validation, execution limits, and typed orchestration errors. HTTP adapters MUST invoke that use case rather than call an LLM port or a specialist directly. The voice inbound adapter MUST continue to invoke the existing agent-turn path (`handleAgentTurn`) for the configured session owner (`runtime-demo` by default, or `wom-customer-service-agent` when selected) and MUST NOT invoke the orchestrated-turn use case.

#### Scenario: Demo HTTP does not call the LLM port

- **WHEN** a valid `POST /demo/orchestrate` request is processed
- **THEN** the HTTP adapter invokes the runtime orchestrated-turn path and does not import or call the LLM port itself

#### Scenario: Voice inbound stays on the agent-turn path

- **WHEN** a valid inbound voice turn is processed
- **THEN** the voice adapter invokes the runtime agent-turn path and does not invoke the orchestrated-turn path

#### Scenario: Configured WOM owner uses agent-turn

- **WHEN** the configured session owner is `wom-customer-service-agent` and a valid inbound voice turn is processed
- **THEN** composition invokes `handleAgentTurn` with the WOM prompt and allowlist and does not invoke `/demo/orchestrate` or the orchestrated-turn use case

## ADDED Requirements

### Requirement: Voice inbound selects a documented session owner

Process configuration MUST select the voice inbound session owner from a documented allowlist of agent identities. The default MUST be `runtime-demo`. A present-but-invalid owner MUST fail closed at configuration time without echoing secrets. Changing the owner MUST change only composition inputs to `handleAgentTurn` (prompt, allowlist, tool-port policy, retrieval store). It MUST NOT add a second turn loop or a new public HTTP route.

#### Scenario: Default owner remains runtime-demo

- **WHEN** session-owner configuration is omitted
- **THEN** inbound voice uses `runtime-demo` prompt and allowlist

#### Scenario: Invalid owner fails closed

- **WHEN** session-owner configuration is present and is not an allowed identity
- **THEN** the process exits without serving traffic and the error does not include secret values

#### Scenario: Production tool port binds the selected owner allowlist

- **WHEN** `createServer` composes the default inbound `ToolPort`
- **THEN** that port is constructed with the selected session-owner allowlist so `authorizeAndExecute` denies other catalog tools without relying only on `handleAgentTurn`
