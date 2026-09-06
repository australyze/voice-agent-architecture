## ADDED Requirements

### Requirement: Normalized lifecycle event kinds are supported

The inbound adapter MUST accept provider-independent event kinds `transcript`, `call_started`, and `call_ended`. `call_started` and `call_ended` MUST authenticate and validate with the same shared-secret, freshness, and size rules as transcript events. They MUST map to the internal voice contract and MUST NOT invoke the agent-turn use case. Vendor-native field names MUST remain in the adapter. The adapter MUST NOT persist through a vendor database client.

#### Scenario: Authenticated call start is accepted without an agent hop

- **WHEN** an authenticated inbound body uses event kind `call_started` and valid correlation fields
- **THEN** the adapter maps it to the internal contract, the runtime records session start, and the agent-turn use case is not invoked

#### Scenario: Authenticated call end is accepted without an agent hop

- **WHEN** an authenticated inbound body uses event kind `call_ended`
- **THEN** the adapter maps it to the internal contract, the runtime records session end, and the agent-turn use case is not invoked

#### Scenario: Unknown event kind remains unsupported

- **WHEN** an authenticated inbound request uses an event kind other than `transcript`, `call_started`, or `call_ended`
- **THEN** the adapter returns a typed unsupported-event outcome and does not invoke the voice-turn use case
