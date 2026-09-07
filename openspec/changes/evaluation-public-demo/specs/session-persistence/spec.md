## MODIFIED Requirements

### Requirement: Read API lists recent sessions and returns one report

The HTTP API MUST expose read-only `GET /sessions` and `GET /sessions/{sessionId}` consistent with `lidr-specboot/docs/api-spec.yml` session resources and the project error envelope. Both routes MUST require authentication via the demo-operator shared secret (`x-demo-orchestrate-secret`, resolved as `DEMO_ORCHESTRATE_SECRET` or else `VOICE_INBOUND_SECRET`) **or** a dedicated read-only demo token via header `x-demo-public-token` resolved as `DEMO_PUBLIC_TOKEN` when configured. The public token MUST NOT be accepted on the operator header. `DEMO_PUBLIC_TOKEN` MUST differ from inbound and operator secrets (misconfiguration → typed config error / 503). Missing server secret configuration for operator mode MUST return 503 with a typed config error when neither operator secret nor demo public token can authorize the request as documented. Missing or wrong credentials MUST return 401 with the canonical error envelope. Loopback bind and store RLS MUST NOT be treated as authorization. The list MUST return lightweight recent sessions including session id, start time, duration when known, status, agent identity, turn count, and tool-call count. The list MAY filter by `externalChannelId`. When authenticated with the public token, `GET /sessions` MUST require `externalChannelId` and MUST return 403 without it. The detail MUST return metadata, transcript, tool calls, chronological trace, metrics, and `evaluation` populated for terminal sessions according to `session-call-evaluation` (persisted result by default). Detail MUST accept an optional recompute signal that re-runs the deterministic scorer **for operator authentication only**; public-token requests with recompute MUST return 403 and MUST NOT write evaluation. Public-token detail reads MUST NOT lazy-backfill or otherwise mutate evaluation. Session history GETs MUST apply inbound-style rate limiting. Responses MUST NOT include database credentials, service-role keys, or raw vendor payloads. Unknown ids MUST return 404. Malformed session ids MUST return 400.

#### Scenario: List is lightweight

- **WHEN** a client requests `GET /sessions`
- **THEN** the response is a list of recent sessions with counts and without full traces

#### Scenario: Detail reconstructs the call

- **WHEN** a client requests `GET /sessions/{sessionId}` for a persisted terminal session
- **THEN** the body includes metadata, transcript, tool calls, trace, metrics, and a non-null `evaluation` object when scoring completed successfully

#### Scenario: Unknown session is 404

- **WHEN** an authenticated client requests a well-formed session id that does not exist
- **THEN** the response is 404 with the canonical error envelope

#### Scenario: Unauthenticated history read is rejected

- **WHEN** a client requests `GET /sessions` or `GET /sessions/{sessionId}` without a valid demo-operator secret or demo public token
- **THEN** the response is 401 with the canonical error envelope and no session list or transcript

#### Scenario: Read-only demo token can fetch a report

- **WHEN** `DEMO_PUBLIC_TOKEN` is configured and a client sends that token as `x-demo-public-token` without the operator secret
- **THEN** `GET /sessions/{sessionId}` succeeds for an existing session and still MUST NOT expose service-role material

#### Scenario: Public token cannot list unscoped sessions

- **WHEN** a client authenticates with `x-demo-public-token` and requests `GET /sessions` without `externalChannelId`
- **THEN** the response is 403 with a typed forbidden error and no session list

#### Scenario: Public token cannot recompute

- **WHEN** a client authenticates with `x-demo-public-token` and requests `GET /sessions/{sessionId}?recompute=true`
- **THEN** the response is 403 and the stored evaluation is unchanged

## ADDED Requirements

### Requirement: Session store retains persisted call evaluation

The persistence port and adapters MUST be able to store and load the session call-evaluation payload on the Session so that `getSessionReport` can return it without recomputing unless asked. The physical representation MUST remain on the existing session-history PostgreSQL technology (additive column or equivalent bounded JSON on `sessions`). The change MUST NOT create a second call-history database or vendor-specific evaluation product store.

#### Scenario: Round-trip evaluation through persistence

- **WHEN** a terminal session evaluation is saved through the persistence port and later loaded
- **THEN** the report’s `evaluation` matches the stored dimensions, overall status, evidence refs, scorer version, and evaluated-at timestamp
