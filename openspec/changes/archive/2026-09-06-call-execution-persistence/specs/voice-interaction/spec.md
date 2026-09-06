## ADDED Requirements

### Requirement: Voice turns persist onto the session

A supported inbound voice turn MUST upsert the Session using existing correlation fields and persist the user utterance when the event is a transcript. After a successful agent reply, the assistant text MUST be persisted as an assistant ConversationTurn. Persistence failure MUST be logged as a dependency failure and MUST NOT replace the spoken reply with a crash when the agent already produced a reply.

#### Scenario: Transcript persists user and assistant text

- **WHEN** a valid `transcript` turn completes with an agent reply
- **THEN** the Session has a user turn with the input text and an assistant turn with the reply text

#### Scenario: Persist failure does not drop a successful reply

- **WHEN** the agent reply is ready and writing history fails
- **THEN** the voice result remains the structured reply and the failure is recorded as a typed persistence error on logs

### Requirement: Lifecycle events update media-adjacent session status without mixing identities

`call_started` MUST set or keep Session start time and an active or initiated status. `call_ended` MUST set end time, duration when start is known, and a completed or failed status. `mediaStatus` and `businessStatus` MUST remain independent. Lifecycle events MUST NOT invent a second correlation id scheme.

#### Scenario: Start then end fills duration

- **WHEN** a session receives `call_started` then `call_ended` with later `occurredAt`
- **THEN** the Session has both timestamps and a non-negative duration

### Requirement: Live transcript is not read from persistence

The live spoken path MUST continue to use the inbound contract and, in the browser, the media-client transcript. Persistence MUST NOT be required to render live turns.

#### Scenario: Active speech does not wait on history read

- **WHEN** a live transcript event is processed
- **THEN** the runtime does not read the session report in order to produce the spoken reply
