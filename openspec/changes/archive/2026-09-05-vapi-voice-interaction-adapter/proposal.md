## Why

The AI Agent Runtime foundation can boot, log, and probe health, but it has no interaction channel. The next increment must accept inbound voice turns without making a voice vendor the runtime, session system of record, or agent kernel. Without a provider-independent voice contract and a replaceable adapter, later product agents would couple to Vapi.

## What Changes

- Add provider-independent voice-turn contracts and a runtime use case that returns a **deterministic placeholder reply** (no LLM, no product agent).
- Add an inbound-only voice channel adapter (first implementation: Vapi) that validates external events, maps them to the internal contract, invokes the runtime, and maps the reply or typed error back to the consumer.
- Keep Vapi credentials, endpoints, timeouts, and locale **optional for process start**; the runtime must remain live and testable without a provider account.
- Authenticate inbound voice requests; reject invalid, unauthenticated, and unsupported events before they reach domain logic.
- Emit structured, secret-safe logs with correlation identifiers when present (`sessionId`, `requestId`, `interactionId`, `eventType`, `processingTime`, `status`).
- Distinguish operational health: process alive, essential deps ready, voice integration configured / not configured / configuration or connectivity error. Voice MUST NOT be an essential readiness dependency.
- Document a reproducible local/simulator path. A live Vapi smoke is optional and never required for Definition of Done.
- Preserve existing foundation tests and hexagonal isolation (`domain` / `application` MUST NOT import Vapi).
- After adversarial review: cancel the voice-turn handling timer on success and bound inbound field/body sizes so invalid identifiers are not logged.

Change types for gates: **code**, **api**, **voice**. Not tools, agents, RAG, or UI.

## Non-goals

- Customer-facing voice journey, production number, or outbound calling
- Product AI agent, LLM completion, prompts, RAG, embeddings, tool calling, MCP runtime, LangGraph, or multi-agent topology
- Conversational memory, Session/ConversationTurn persistence tables, or durable business state
- STT/TTS media processing on the existing speech port (inbound events arrive already as interaction events)
- Barge-in, silence, transfer, termination wrap-up, or spoken confirmation of side effects (no consequential tools)
- Advanced monitoring, multi-tenant production, or deep coupling to provider-specific assistant features
- Making a live Vapi account or paid call mandatory for tests, `/verify`, or archive
- Storing call audio or using transcripts beyond request-scoped correlation and redacted logs

## Capabilities

### New Capabilities

- `voice-interaction`: Provider-independent voice turn identity, input, deterministic runtime reply, typed voice errors, and correlation fields. Domain and application own this contract; no vendor types.
- `voice-channel-adapter`: Inbound-only adapter boundary: authenticate, validate, map external events to `voice-interaction`, map replies and errors outward, and keep provider SDKs and payloads out of the core.

### Modified Capabilities

- `health-checks`: Add a voice-integration diagnostic that distinguishes configured, not configured, and configuration/connectivity error without making voice essential for readiness.
- `application-runtime`: Optional external voice configuration, secret hygiene for provider credentials, and correlation-safe operation logs for voice turns. Process start MUST NOT require voice credentials.
- `provider-ports`: A voice channel adapter MAY exist behind the interaction edge. Domain and application MUST still depend on ports and internal voice contracts, not on a voice vendor SDK. Speech `transcribe` / `synthesize` remain unused product adapters in this change.

## Impact

- Implementing repo `src/` (domain contracts, application use case, HTTP adapter, composition, tests). Methodology in `lidr-specboot/` is unchanged.
- New inbound HTTP surface for the voice adapter (project OpenAPI). Canonical `lidr-specboot/docs/api-spec.yml` `/ingress/interaction` remains the generic product model; this change does not implement session CRUD or treat vendor payloads as public resources.
- Existing `/health/live` and `/health/ready` stay persistence-oriented. A separate voice diagnostic is added.
- New optional env vars (placeholders only in `.env.example`). No real secrets in Git.
- Tests: unit mapping/errors, runtime invocation without Vapi, one simulator integration of the full inbound path. No paid APIs in the default suite.
- Documentation: local simulator path, optional live smoke, architecture note that Vapi is the interaction adapter and the runtime remains the execution layer.
- Next intended increment: first real AI agent on this channel, still without importing Vapi in the domain.
