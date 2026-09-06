## ADDED Requirements

### Requirement: Configured session owner supplies the spoken reply

When the configured voice session owner is `wom-customer-service-agent`, a valid internal voice turn MUST produce a structured reply owned by that agent through the existing `VoiceTurn` / `VoiceReply` contract. Reply text MUST come from a schema-valid WOM `reply` decision after any authorized `wom.*` tool hop. The voice handling timeout, locale default `es`, and existing agent-to-voice error mapping MUST remain unchanged.

#### Scenario: WOM usage turn maps to VoiceReply

- **WHEN** inbound handling uses the WOM session owner and the mocked LLM selects `wom.get_customer_usage` then a Spanish `reply`
- **THEN** the voice-turn result is a structured success whose text is that `replyText`

#### Scenario: Default owner regression

- **WHEN** session-owner configuration is omitted
- **THEN** a valid mocked `runtime-demo` turn still yields a structured agent reply under the existing contract
