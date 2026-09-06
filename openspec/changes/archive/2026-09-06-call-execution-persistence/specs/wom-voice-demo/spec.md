## ADDED Requirements

### Requirement: Completed call may fetch a thin session report

After the media client reports call-end, the demonstration UI MAY request `GET /sessions/{sessionId}` or `GET /sessions?externalChannelId=` through the public backend base URL when a provider-independent session or channel id is known. The request MUST send the demo-operator secret header. The UI MUST NOT call `GET /sessions?limit=1` (or any unfiltered latest-session list) to choose a report. On success it MUST show that a backend report exists (at minimum status or turn count from the API). On missing configuration, missing channel identity, network failure, 401, or empty history it MUST show a safe unavailable state. It MUST NOT render the full HU #012 observability or evaluation UI. Live transcript during `active` MUST continue to come from the media client, not from this fetch.

#### Scenario: Report loads after hang-up

- **WHEN** the UI is `completed` and the public backend base URL is configured and the report request succeeds
- **THEN** the completed surface replaces the persistence-unavailable placeholder with confirmation that backend history was retrieved

#### Scenario: Report unavailable is honest

- **WHEN** the UI is `completed` and the backend base URL is missing, the channel identity is unknown, or the report request fails
- **THEN** the UI states that detailed backend history is unavailable and does not invent transcript or tool rows from a failed fetch

#### Scenario: Latest-global list is not used as identity

- **WHEN** the UI is `completed` and no `sessionId` or `externalChannelId` is known
- **THEN** the UI does not request `GET /sessions?limit=1` and shows the unavailable state

### Requirement: Browser never receives persistence admin credentials

The demonstration frontend MUST NOT contain, document, or bundle a hosted-persistence service-role key, database password, or private database URL. Session history MUST be read only through the backend HTTP API.

#### Scenario: Frontend env example has no service-role key

- **WHEN** a reviewer inspects the documented frontend environment example
- **THEN** it does not include a service-role key, database password, or private database URL

## MODIFIED Requirements

### Requirement: Deterministic call lifecycle

The demonstration UI MUST represent exactly these call states: `idle`, `connecting`, `active`, `ending`, `completed`, and `error`. Transitions MUST be driven by the media-client abstraction, not by a generative model. Duplicate start MUST be disabled while connecting or active. Ending MUST request the media client to stop, enter `ending`, and move to `completed` only after the client reports the call has ended.

#### Scenario: Idle shows start

- **WHEN** the application is in `idle` and the media client is configured
- **THEN** a primary start-conversation control is available and enabled

#### Scenario: Connecting gives feedback

- **WHEN** the user activates start
- **THEN** the UI enters `connecting`, shows that the microphone or call is initializing, and disables a second start action

#### Scenario: Connecting timeout returns to a retryable error

- **WHEN** the user activates start and the media client does not report call-start within 8 seconds
- **THEN** the UI enters `error`, shows the safe configuration message, and the start-conversation control is available again

#### Scenario: Active shows live call

- **WHEN** the media client reports the call has started
- **THEN** the UI is `active` and shows a live indicator, elapsed time, agent identity WOM Customer Service AI, a simple voice-activity cue, the transcript region, and an end-conversation control

#### Scenario: End waits for call-end

- **WHEN** the user activates end during `active`
- **THEN** the UI enters `ending` and MUST NOT treat the conversation as completed until the media client reports the call has ended

#### Scenario: Completed shows a client-side summary

- **WHEN** the media client reports the call has ended after a started call
- **THEN** the UI is `completed` and shows that the conversation finished, duration if known, visible turn or message count if known, and a traceability area that either confirms a backend session report was retrieved or states that backend history is unavailable
