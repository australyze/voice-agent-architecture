## MODIFIED Requirements

### Requirement: Completed call may fetch a thin session report

After the media client reports call-end, the demonstration UI MUST be able to request `GET /sessions/{sessionId}` or `GET /sessions?externalChannelId=` through the public backend base URL when a provider-independent session or channel id is known. For the public interview path the UI MUST send only `x-demo-public-token` from an on-screen passcode (never bake operator/inbound write secrets or the public token into Vite env for interviews). The UI MUST NOT call `GET /sessions?limit=1` (or any unfiltered latest-session list) to choose a report. On success it MUST show that a backend report exists and MUST render the call-evaluation result when `evaluation` is present (dimension ids in English, interviewer-facing subtitles and verdicts in Spanish: Cumplido / Parcial / No cumplido), including enough evidence summary for an interviewer to see what persisted data supported each dimension. The public interview UI MUST NOT offer “Re-evaluar” / recompute (operator-only). On missing configuration, missing channel identity, network failure, 401, or empty history it MUST show a safe unavailable state. Live transcript during `active` MUST continue to come from the media client, not from this fetch. The UI MUST remain within the existing `web/` architecture and WOM-inspired visual identity (shadcn/ui); it MUST NOT introduce a second frontend stack.

#### Scenario: Report loads after hang-up

- **WHEN** the UI is `completed` and the public backend base URL is configured and the report request succeeds with a non-null `evaluation`
- **THEN** the completed surface shows evaluation dimensions and Spanish verdict labels derived from that payload and confirms backend history was retrieved

#### Scenario: Report unavailable is honest

- **WHEN** the UI is `completed` and the backend base URL is missing, the channel identity is unknown, or the report request fails
- **THEN** the UI states that detailed backend history is unavailable and does not invent transcript, tool, or evaluation rows from a failed fetch

#### Scenario: Latest-global list is not used as identity

- **WHEN** the UI is `completed` and no `sessionId` or `externalChannelId` is known
- **THEN** the UI does not request `GET /sessions?limit=1` and shows the unavailable state

### Requirement: Secret hygiene for the browser bundle

The demonstration frontend MAY be configured with a voice-provider public key, an assistant identifier, and an optional public backend base URL. Interview authorization MUST use a typed passcode mapped to backend `DEMO_PUBLIC_TOKEN` at request time. The frontend MUST NOT document or ship as `VITE_*` the inbound shared secret, operator secret, `DEMO_PUBLIC_TOKEN`, voice-provider private or server API key, database URL, or service-role credentials.

#### Scenario: Example env lists only public client values

- **WHEN** a reviewer inspects the documented frontend environment example
- **THEN** it includes placeholders for the public key, assistant identifier, and public API base URL and does not include a private API key, service-role key, database URL, inbound/operator secret, or baked demo read token

#### Scenario: Automated tests do not place live calls

- **WHEN** the frontend automated suite runs
- **THEN** it uses a test double for the media client and does not contact a paid voice provider or require a microphone

## ADDED Requirements

### Requirement: Interviewer passcode for report access

When the public demo requires the read-only demo token, the UI MUST provide a single-line passcode entry (or equivalent) so an interviewer can authorize report/evaluation fetch without crafting HTTP headers manually. The passcode value MUST come from deployment configuration, MUST NOT be hard-coded in source as a production secret, and MUST NOT unlock service-role or inbound write capabilities by itself beyond what the backend grants to `DEMO_PUBLIC_TOKEN`.

#### Scenario: Passcode unlocks evaluation view

- **WHEN** the interviewer enters the configured demo passcode after a completed call and the backend accepts the token
- **THEN** the evaluation view can load the session report for the known channel or session id
