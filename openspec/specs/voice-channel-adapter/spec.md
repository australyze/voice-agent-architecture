# voice-channel-adapter Specification

## Purpose

Defines the inbound-only voice channel adapter: authenticate and validate external events, translate them to the internal voice contract, invoke the runtime, and return a controlled consumer response without placing vendor types or business rules in the core.

## Requirements

### Requirement: Inbound voice interface is authenticated and validated

The application MUST expose a documented inbound HTTP interface for voice-channel events. The interface MUST accept only the methods required for this inbound flow, authenticate the caller with a configured shared secret when the integration is configured, and reject unauthenticated, malformed, or schema-invalid payloads before invoking the runtime. Vendor-native field names MUST remain in the adapter and project adapter documentation, not in domain contracts.

#### Scenario: Valid authenticated event is accepted

- **WHEN** a configured integration receives a valid authenticated inbound voice event that maps to a supported turn
- **THEN** the adapter maps it to the internal voice contract and invokes the runtime

#### Scenario: Missing or invalid authentication is rejected

- **WHEN** an inbound voice request lacks valid authentication
- **THEN** the adapter rejects the request without invoking the runtime and without leaking the configured secret

#### Scenario: Invalid payload is rejected

- **WHEN** an inbound voice request body is missing required mapped fields or fails validation
- **THEN** the adapter rejects the request with a typed invalid-payload outcome and does not invoke the runtime

#### Scenario: Overlong fields are rejected

- **WHEN** an authenticated inbound request includes `inputText` or a correlation identifier longer than the documented maximum
- **THEN** the adapter rejects the request with a typed invalid-payload or invalid-session outcome and does not invoke the runtime

#### Scenario: Oversized body is rejected

- **WHEN** an authenticated inbound request body exceeds the documented inbound body limit
- **THEN** the adapter rejects the request without invoking the runtime and without leaking the inbound secret

### Requirement: Unsupported events do not enter domain logic

The adapter MUST recognize supported inbound event kinds for this change. Unsupported or unexpected events MUST be rejected or acknowledged as unsupported with a typed error and MUST NOT be forwarded as a voice turn to the runtime.

#### Scenario: Unsupported event is not executed

- **WHEN** an authenticated inbound request uses an unsupported event kind
- **THEN** the adapter returns a typed unsupported-event outcome and does not invoke the voice-turn use case

### Requirement: Adapter maps replies and errors to the consumer

After the runtime returns an internal reply or typed voice error, the adapter MUST map that result to the documented consumer response. HTTP errors that leave the process MUST use the canonical error envelope from `lidr-specboot/docs/api-spec.yml`. Mapped consumer responses MUST NOT include stack traces, secrets, or raw internal exceptions.

#### Scenario: Placeholder reply is mapped outward

- **WHEN** the runtime returns a structured agent reply
- **THEN** the adapter returns a consumer-compatible success response that contains the reply text and does not expose internal type names as the resource model

#### Scenario: Typed failure is mapped safely

- **WHEN** the runtime or adapter produces a typed voice error
- **THEN** the outbound response uses a stable error code and a safe message and omits provider internals

### Requirement: Unconfigured integration does not process turns

When voice-channel configuration is absent, the inbound voice interface MUST NOT process a turn as if the provider were configured. The outcome MUST be a typed configuration error.

#### Scenario: Inbound request while not configured

- **WHEN** an inbound voice request arrives and voice-channel configuration is absent
- **THEN** the adapter does not invoke a live provider and returns a typed configuration error

### Requirement: Adapter contains no product agent logic

The adapter MUST NOT own prompts, tool decisions, conversational memory, or business workflows. Its responsibility is translation, validation, authentication, timeout enforcement at the edge, and error mapping.

#### Scenario: Adapter does not decide product replies

- **WHEN** a valid supported turn is processed
- **THEN** the spoken or textual reply content is produced by the runtime use case, not invented by adapter-local business rules

### Requirement: First implementation is inbound only

This change MUST implement inbound voice events only. The adapter MUST NOT initiate outbound calls, manage phone numbers, or run campaigns. The design MUST NOT prevent a later outbound increment.

#### Scenario: No outbound call API

- **WHEN** a reviewer inspects the shipped voice adapter surface
- **THEN** there is no interface that places an outbound call or provisions a phone number

### Requirement: Simulator proves the full inbound path

Automated tests MUST prove the path from an external-shaped request through the adapter, internal contract, runtime, and mapped response without a live voice-vendor account. A live provider smoke, if performed, is optional and MUST NOT be required for the suite to pass.

#### Scenario: Simulator integration without live vendor

- **WHEN** the automated integration test posts a simulated inbound request to the adapter
- **THEN** the response is a mapped runtime agent reply or a typed error, and the test does not call a paid voice provider

### Requirement: Inbound turns are fresh and rate limited

After authentication, the inbound adapter MUST reject an `occurredAt` timestamp whose absolute skew from the process clock exceeds the documented maximum. Authenticated turns MUST be rate limited per inbound secret using an in-process window. Stale turns MUST use a stable stale code. Rate-limited turns MUST use a stable rate-limit code. Neither outcome MAY invoke the agent-turn path. Messages MUST NOT include the inbound secret.

#### Scenario: Stale occurredAt is rejected

- **WHEN** an authenticated inbound request has `occurredAt` older than the configured skew
- **THEN** the adapter returns a typed stale outcome and does not invoke the agent-turn use case

#### Scenario: Excess authenticated turns are rate limited

- **WHEN** authenticated inbound requests for the same configured secret exceed the documented window limit
- **THEN** the next request is rejected with a typed rate-limit outcome and does not invoke the agent-turn use case

### Requirement: Adapter does not own WOM policy

The inbound voice adapter MUST continue to authenticate, validate, map vendor-free fields to `VoiceTurn`, and return the consumer response. It MUST NOT contain WOM prompts, tool names, mock payloads, or customer-service business rules. Composition — not the Vapi mapper — MUST choose which agent `runAgent` invokes.

#### Scenario: Inbound mapper stays policy-free

- **WHEN** a reviewer inspects the voice inbound mapping module
- **THEN** it does not import WOM prompt artifacts, `wom.*` tool executors, or mock WOM data

#### Scenario: HTTP contract unchanged

- **WHEN** a valid authenticated inbound event is accepted
- **THEN** the documented `POST /adapters/voice/inbound` request and error envelope remain the same regardless of the configured session owner

### Requirement: Browser media client is not inbound ingress

The voice adapter family MAY include a browser media client that starts and ends a live web call. That client MUST talk to the configured voice-provider media infrastructure only. It MUST NOT implement a second Server URL, webhook, or inbound HTTP contract. Server-side conversation events MUST continue to use the existing authenticated inbound interface. The browser MUST NOT receive provider Server URL webhooks directly.

#### Scenario: Existing inbound remains the only server ingress

- **WHEN** a reviewer inspects shipped HTTP routes after this change
- **THEN** voice server events still enter only through the documented inbound voice interface and no parallel frontend webhook exists

#### Scenario: Browser does not handle Server URL posts

- **WHEN** the demonstration web application is running
- **THEN** it does not expose an HTTP endpoint that accepts provider Server URL events

### Requirement: Browser media client contains no product agent logic

The browser media client MUST start and stop call media and surface provider events to the demonstration UI. It MUST NOT own prompts, tool authorization, mock customer-service data, or reply invention. Customer-service tools whose results MUST return to the model MUST remain server-side. The client MUST NOT register those tools as client-executed tools.

#### Scenario: Start does not execute WOM tools in the browser

- **WHEN** the user starts a demonstration call
- **THEN** the browser media client does not execute usage, bill, or service-status tool bodies

#### Scenario: Inbound mapper stays policy-free

- **WHEN** a reviewer inspects the existing inbound mapping module
- **THEN** it still does not import WOM prompt artifacts, `wom.*` tool executors, or mock WOM data

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
