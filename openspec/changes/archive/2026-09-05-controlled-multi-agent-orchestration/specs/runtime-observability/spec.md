## ADDED Requirements

### Requirement: Orchestrated runs share one correlation identity

Every production execution that enters the orchestrated path MUST share one `traceId` across the demo HTTP request record, the orchestration workflow record, route and handoff records, and the specialist LLM record when a specialist ran. When a session identifier or request identifier is already available and valid, those values MUST appear on the same records.

#### Scenario: Successful orchestrate run is reconstructable

- **WHEN** a valid `POST /demo/orchestrate` request completes after one specialist model call
- **THEN** the observability port receives records that share one `traceId` for the HTTP request, the orchestration workflow, the route record, the handoff record, and the specialist LLM record

#### Scenario: Failed orchestrate run keeps the same identity

- **WHEN** an orchestrated request fails as `unroutable` or after a specialist error
- **THEN** the error records use the same `traceId` as the request and orchestration workflow records for that execution

### Requirement: Route and handoff steps are distinguishable

Orchestrated executions MUST emit workflow records named so route and handoff are distinguishable from the parent orchestration and from `runtime-demo` agent-turn records. Route and handoff records MUST use kind `workflow` with names `orchestration.route` and `orchestration.handoff`. Specialist model calls MUST keep kind `llm`. Health-check routes MUST NOT be required to emit those records.

#### Scenario: Happy path emits route and handoff

- **WHEN** intent `normalize` is routed and the specialist completes
- **THEN** the observability port receives workflow records named `orchestration.route` and `orchestration.handoff` plus an `llm` record for `demo-normalize`

#### Scenario: Unroutable emits route without specialist LLM

- **WHEN** the request is `unroutable`
- **THEN** a route record is present and no specialist `llm` record is required
