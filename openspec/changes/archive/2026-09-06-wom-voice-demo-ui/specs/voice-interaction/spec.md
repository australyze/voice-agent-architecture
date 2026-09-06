## ADDED Requirements

### Requirement: Frontend call state is not business session state

A demonstration UI MAY track media or call presentation state (`idle`, `connecting`, `active`, `ending`, `completed`, `error`). That presentation state MUST remain distinct from runtime business session state. Completing or ending the UI call MUST NOT create a persisted Session or ConversationTurn aggregate in this change and MUST NOT be treated as proof that the backend finished asynchronous end-of-call processing.

#### Scenario: UI completed does not imply backend persistence

- **WHEN** the demonstration UI enters `completed` after the media client reports call end
- **THEN** the runtime is not required to have persisted a Session or ConversationTurn and the UI MUST NOT claim a durable execution report exists

#### Scenario: Media identity stays opaque

- **WHEN** the media client exposes a provider call identifier
- **THEN** the demonstration UI may display call status and duration but MUST NOT use that identifier as a product customer identity

### Requirement: Voice budgets for the browser path stay on the runtime

Spoken replies and tool execution on a browser-originated call MUST continue to follow the existing runtime voice-turn contract and timeouts. The demonstration UI MUST NOT implement a second agent-turn loop or a looser tool-hop policy. Time-to-first-audio and connecting feedback are UI concerns; they MUST NOT replace runtime timeout classification.

#### Scenario: Browser call still uses runtime replies

- **WHEN** a live browser call produces a user utterance that the provider forwards as a supported inbound turn
- **THEN** the spoken reply content is still produced by the runtime use case, not invented by the demonstration UI
