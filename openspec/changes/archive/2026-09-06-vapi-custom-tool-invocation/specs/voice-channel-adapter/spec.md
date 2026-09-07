## ADDED Requirements

### Requirement: Vapi-native tool calls do not share a conversational turn with agent reasoning

When the voice channel uses Custom Tools as the authoritative tool-invocation path for a Vapi-native call, the inbound voice interface MUST NOT invoke conversational agent reasoning (`handleAgentTurn` or equivalent) for the same conversational turn that is already handled by Custom Tool execution. The inbound interface MAY still accept authenticated lifecycle, transcript, and end-of-call events for persistence, observability, and correlation. Unsupported dual processing of the same turn (channel LLM tool hop plus runtime agent turn) MUST NOT occur.

#### Scenario: Custom tool hop does not also run agent turn

- **WHEN** a Vapi-native call invokes an allowlisted tool through the Custom Tool interface
- **THEN** that tool hop is not also processed as a conversational agent turn on the inbound voice interface

#### Scenario: Lifecycle events remain acceptable on inbound

- **WHEN** an authenticated inbound lifecycle or end-of-call event arrives for a Vapi-native call that uses Custom Tools for tools
- **THEN** the adapter MAY persist and correlate the event without invoking conversational agent reasoning for a tool hop
