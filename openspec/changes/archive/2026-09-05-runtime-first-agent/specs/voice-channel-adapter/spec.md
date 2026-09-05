## MODIFIED Requirements

### Requirement: Adapter maps replies and errors to the consumer

After the runtime returns an internal reply or typed voice error, the adapter MUST map that result to the documented consumer response. HTTP errors that leave the process MUST use the canonical error envelope from `lidr-specboot/docs/api-spec.yml`. Mapped consumer responses MUST NOT include stack traces, secrets, or raw internal exceptions.

#### Scenario: Placeholder reply is mapped outward

- **WHEN** the runtime returns a structured agent reply
- **THEN** the adapter returns a consumer-compatible success response that contains the reply text and does not expose internal type names as the resource model

#### Scenario: Typed failure is mapped safely

- **WHEN** the runtime or adapter produces a typed voice error
- **THEN** the outbound response uses a stable error code and a safe message and omits provider internals

## ADDED Requirements

### Requirement: Inbound turns are fresh and rate limited

After authentication, the inbound adapter MUST reject an `occurredAt` timestamp whose absolute skew from the process clock exceeds the documented maximum. Authenticated turns MUST be rate limited per inbound secret using an in-process window. Stale turns MUST use a stable stale code. Rate-limited turns MUST use a stable rate-limit code. Neither outcome MAY invoke the agent-turn path. Messages MUST NOT include the inbound secret.

#### Scenario: Stale occurredAt is rejected

- **WHEN** an authenticated inbound request has `occurredAt` older than the configured skew
- **THEN** the adapter returns a typed stale outcome and does not invoke the agent-turn use case

#### Scenario: Excess authenticated turns are rate limited

- **WHEN** authenticated inbound requests for the same configured secret exceed the documented window limit
- **THEN** the next request is rejected with a typed rate-limit outcome and does not invoke the agent-turn use case
