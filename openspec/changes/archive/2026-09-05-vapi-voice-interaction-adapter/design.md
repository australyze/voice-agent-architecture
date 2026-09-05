## Context

The foundation already boots a hexagonal TypeScript process (`src/domain`, `src/application`, `src/adapters/http|persistence|logging`, `src/composition`) with fail-closed config (`NODE_ENV`, `PORT`, `DATABASE_URL`), loopback listen, structured logs, and `/health/live` plus `/health/ready` (persistence ping). Provider ports exist as unused interfaces, including `SpeechPort` (`transcribe` / `synthesize`). Architecture tests forbid Vapi and other vendor imports in domain and application.

See `proposal.md` for motivation. Stakeholder defaults: engineers/QA only, Spanish (`es`) as configured locale, deterministic runtime placeholder, inbound only, simulator proof required, live Vapi optional.

Canonical contracts: `lidr-specboot/docs/base-standards.md` (Vapi is an adapter), `backend-standards.md` (Voice AI; media vs business state), `data-model.md` (`Session.externalChannelId`, ConversationTurn reserved), `api-spec.yml` (`POST /ingress/interaction` is generic and 202-oriented). This change does not materialize session tables.

## Goals / Non-Goals

**Goals:**

- Smallest inbound pipe: authenticate → validate → `VoiceTurn` → runtime placeholder `VoiceReply` → consumer mapping.
- Keep voice config optional for process start; keep readiness independent of Vapi.
- Extend logging and health without collapsing media identity into business state.
- Name change-type gates: **code**, **api**, **voice**.

**Non-Goals:**

- Product agent topology, LLM loop, tools, RAG, HITL records, or Session persistence (proposal Non-goals).
- Full voice UX (barge-in, silence, transfer, wrap-up). Those policies are reserved; this design only states that they are not implemented.
- Documenting vendor-native webhook field names in domain specs. Those belong in project adapter notes written during apply.

## Decisions

### D1 — Deterministic workflow, not an agent

**Decision:** This increment is a typed inbound workflow. No model loop, no session owner beyond request-scoped correlation, no multi-agent topology.

**Why:** The successful turn is fully specified (`base-standards.md`: deterministic workflows wherever possible). A generative placeholder would add vendor gravity with no user outcome.

**Alternatives:** Echo-through-LLM; Vapi-hosted assistant as the runtime. Rejected: contaminates the core and contradicts HU #002.

**Change types:** `code` | `api` | `voice`. Not `tools` | `agent` | `rag` | `ui`.

### D2 — Internal contract owned by domain/application

**Decision:** Introduce request-scoped types (names may be adjusted in code, meaning is fixed):

| Concept | Role |
| --- | --- |
| `VoiceTurn` | Validated inbound turn: session id (internal UUID when we mint one), opaque `externalChannelId`, optional `interactionId` / `requestId`, `eventType`, `inputText`, `occurredAt`, locale hint, non-sensitive metadata |
| `VoiceReply` | Deterministic structured reply: text, locale, status |
| `VoiceError` | Typed failure with stable code |
| `VoiceSessionRef` | Identity only (ids + timestamps). Not a persisted `AgentSession` |

Application use case `handleVoiceTurn(turn) → VoiceReply | VoiceError`. Locale text catalog lives in application config, not in the adapter and not as a domain business rule.

**Why:** Matches HU contracts and `data-model.md` (provider ids are opaque). Avoids inventing a Session table for a smoke pipe.

**Alternatives:** Persist ConversationTurn now; reuse `SpeechPort` as the turn API. Rejected: persistence is a later aggregate; speech is media STT/TTS, not ingress.

### D3 — Speech port stays unused; adapter is ingress

**Decision:** Do not implement `SpeechPort` in this change. The first Vapi adapter is an **inbound HTTP interaction adapter** under `src/adapters/voice/`. Domain/application call only `handleVoiceTurn`.

```text
Voice vendor or simulator
        │
        ▼
src/adapters/voice/     # auth, validate, map in/out
        │ VoiceTurn
        ▼
src/application/        # handleVoiceTurn, timeout, placeholder
        │ VoiceReply
        ▼
src/adapters/voice/
```

**Why:** `backend-standards.md` and existing `SpeechPort` describe transcribe/synthesize. Inbound events already carry interaction text. Using the speech port for webhooks would overload the wrong abstraction.

**Alternatives:** Widen `SpeechPort` with `handleEvent`. Rejected: mixes media I/O with session commands.

### D4 — HTTP surfaces

**Decision:**

| Path | Auth | Role |
| --- | --- | --- |
| `GET /health/live` | none | unchanged |
| `GET /health/ready` | none | unchanged; voice not essential |
| `GET /health/voice` | none | diagnostic: `not_configured` \| `configured` \| `error` |
| `POST /adapters/voice/inbound` | shared secret when configured | Vapi-facing inbound; vendor body stays here |

Do **not** implement canonical `POST /ingress/interaction` as the Vapi URL. Vapi requires a vendor-shaped body; the generic ingress schema is 202 Accepted and is not a synchronous reply. The adapter maps to the same *concepts* (`eventType`, `occurredAt`, `externalChannelId`) internally.

Project OpenAPI (`openapi/`) documents health plus the inbound adapter path. Error HTTP responses use the canonical envelope. Success mapping for the voice consumer is documented in the project adapter note, not as a domain resource.

Inbound is **synchronous request/response** so the consumer can speak the placeholder. That differs from canonical 202 ingress; record it as an adapter exception, not a rewrite of `api-spec.yml`.

**Auth:** When voice is configured, require a shared secret (header comparison in constant time). When not configured, return typed `VOICE_CONFIG` without processing. Do not authorize health routes.

**Why:** Foundation already made health unauthenticated + loopback. Product voice ingress must be authenticated (`backend-standards.md`, `api-spec.yml`).

**Alternatives:** Put Vapi on `/ingress/interaction`; async 202 only. Rejected: leaks vendor shape into the product API; HU requires a mapped reply.

### D5 — Optional voice configuration

**Decision:** Required to boot remains `NODE_ENV`, `PORT`, `DATABASE_URL` (+ optional `LISTEN_HOST`). Voice settings are optional:

- Shared inbound secret
- Provider API credential (for optional live smoke / future outbound; unused on default start)
- Provider base URL (if needed for a bounded config check)
- Handling timeout (default documented, e.g. 2000 ms)
- Default locale (default `es`)

Absent voice settings → process starts; `/health/voice` = `not_configured`; inbound POST = configuration error.

Present but invalid → fail closed at start (same pattern as listen host).

Never require a live provider network call to become live. A connectivity probe, if added, is bounded and only affects `/health/voice` = `error`, not readiness.

**Why:** Stakeholder: no mandatory external dependency. Foundation fail-closed applies to *present* invalid values.

### D6 — Error codes and HITL

**Decision:** Stable codes: `VOICE_PAYLOAD_INVALID`, `VOICE_SESSION_INVALID`, `VOICE_EVENT_UNSUPPORTED`, `VOICE_TIMEOUT`, `VOICE_CONFIG`, `VOICE_PROVIDER`, `VOICE_RUNTIME` (plus existing config/internal codes at HTTP edges).

No product tools. Risk class: none. HITL: not applicable; reserved policy in `provider-ports` remains. Never speak or return unverified side-effect success (there are no side effects).

**Budgets:** handling timeout default 2000 ms; no token or tool-hop budgets (no LLM/tools). Time-to-first-audio is owned by the voice vendor; we only bound our processing time. The handling timer MUST be cleared when the turn finishes so a winning race does not later reject.

### D10 — Inbound field and body bounds (adversarial remediation)

**Decision:** Cap simulator/adapter fields before they reach logs or the runtime: `inputText` max 4096 characters; `eventType` max 64; `externalChannelId`, `interactionId`, and `requestId` max 128; `sessionId` when present MUST be a UUID (36 chars). Inbound HTTP body limit is 16 KiB. Invalid session identifiers are rejected at the adapter and MUST NOT be written to logs.

**Why:** Adversarial review FAIL: unbounded strings and an uncleared `Promise.race` timer.

**Alternatives:** Rely on Fastify's 1 MiB default only. Rejected: too large for a placeholder ingress and does not stop log of invalid ids.

### D7 — Observability

**Decision:** Extend `LogEvent` with optional correlation fields (`sessionId`, `requestId`, `interactionId`, `eventType`, `processingTimeMs`, `status`) rather than adopting Langfuse. Domain still does not import an observability vendor. Redact secrets with the existing redaction helper; do not log raw inbound bodies.

**Why:** Foundation chose logs over traces. This HU asked for reconstructable interactions, not a vendor tracer.

### D8 — Voice UX policy for this thin pipe

**Decision (voice-ai-engineer):**

| Concern | This change |
| --- | --- |
| media vs business | `externalChannelId` / inbound event vs no `businessStatus` change |
| barge-in / silence / transfer | not implemented; unsupported events rejected |
| confirmation | N/A (no tools) |
| failure recovery | typed safe error / fallback text from runtime, never a fabricated success |
| language | configured locale `es` for smoke |

Eval evidence: deterministic fixtures (simulated inbound event → expected `VoiceReply` or code). Not live telephony. Full conversation eval (interruption, confirmation) is out of scope and omitted with reason in `tasks.md`.

### D9 — Tests and local proof

**Decision:** TDD. Unit tests for mapping, auth, unsupported events, errors. Application tests invoke `handleVoiceTurn` with no adapter. One HTTP integration test uses an in-process server and simulated payload. Architecture test continues to ban Vapi in `domain/` and `application/`. Live smoke is a documented optional procedure, never a CI gate.

## Risks / Trade-offs

- [Vendor payload drift] → Keep field mapping only in `src/adapters/voice/` and a project adapter note; specs stay vendor-neutral.
- [Optional config vs fail-closed] → Absent is allowed; present-invalid exits; inbound while absent is a typed error.
- [Synchronous adapter vs canonical 202 ingress] → Document as adapter exception; do not fork `api-spec.yml` in methodology.
- [PII in transcripts] → Request-scoped only; do not persist; do not log full utterances by default; smoke is engineers/QA only.
- [Unconfigured public bind] → Keep default `LISTEN_HOST=127.0.0.1`; exposing the inbound route on `0.0.0.0` remains opt-in.
- [Health diagnostic leak] → `/health/voice` returns status codes only, no credentials, still unauthenticated by the health exception.

## Migration Plan

- Additive. Existing health and persistence behavior unchanged.
- New optional env keys in `.env.example` only.
- Rollback: disable inbound route or omit voice env; runtime still serves health.
- Foundation tests MUST keep passing.

## Open Questions

None that change specs or tasks. Provider-native inbound JSON keys are an apply-time adapter-note detail, not a domain decision.
