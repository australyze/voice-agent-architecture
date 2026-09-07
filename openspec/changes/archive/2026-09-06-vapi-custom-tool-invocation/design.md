## Context

See `proposal.md` for motivation. Today WOM tools execute only inside `handleAgentTurn` via `ToolRegistry` / `NativeToolPort` (`src/adapters/tools/`, `src/domain/wom-tools.ts`). Voice ingress is `POST /adapters/voice/inbound` with simulator-shaped events (`src/adapters/voice/inbound.ts`); valid transcript events invoke the runtime agent. Session history already persists ToolCalls and evaluation reads those records (`session-persistence`, call evaluation). The interview UI starts calls with Vapi Web SDK public key + assistant ID; it must not embed tool executors.

Constraints from `lidr-specboot/docs/base-standards.md`: Vapi is an interaction adapter; tool execution stays behind ports; vendor types stay out of domain; evaluation and observability before production paths; fail-closed on tool failure.

## Goals / Non-Goals

**Goals:**

- Introduce a Vapi Custom Tool HTTP adapter that executes the three WOM tools through ToolPort without `handleAgentTurn`.
- Prevent dual-brain processing on Vapi-native calls (channel reasoning + runtime agent turn on the same hop).
- Reuse persistence and observability contracts with `invocation_source: vapi_custom_tool` (or equivalent metadata).
- Enforce ≈2s hard timeout (target &lt;1s) on the custom-tool round-trip.
- Keep Option A / simulator inbound agent path available for tests and non–Vapi-native flows.

**Non-Goals:**

- Multi-tenant assistant management, MCP runtime exposure, live WOM APIs, or rewriting the Web SDK.
- Teaching domain code Vapi SDK types or storing vendor-native tool-call JSON as the application model.
- Automatically PATCHing the Vapi assistant from CI.

## Decisions

### D1 — Split reasoning (channel) from execution (runtime)

**Decision:** On the Vapi-native demo path, Vapi’s LLM selects tools and speaks; this process only authorizes/executes/records tools. `handleAgentTurn` MUST NOT run for those tool hops.

**Why:** Matches the resolved product decision and avoids two LLMs answering one turn (`base-standards.md`: controlled autonomy; separation of reasoning and execution).

**Alternatives:** Option A only (inbound transcript → `handleAgentTurn`); Vapi-hosted tools with no runtime. Rejected: dual brain or loss of tool authority.

**Change types:** `code` | `api` | `tools` | `voice`.

### D2 — New application use case, not a widened voice turn

**Decision:** Add an application use case such as `executeChannelToolInvocation` (name flexible) that: resolves session correlation (`externalChannelId` / session id when present), calls ToolPort with the WOM allowlist binding, applies the hard timeout, emits tool observability, persists ToolCall, and returns a normalized outcome. The voice adapter maps Vapi `tool-calls` payloads in/out only.

**Why:** Keeps vendor mapping in `src/adapters/voice/` (or sibling adapter module) and keeps domain free of Vapi types—same pattern as inbound.

**Alternatives:** Reuse `handleVoiceTurn` with a fake transcript; call registry from the HTTP layer. Rejected: conflates media turns with tool RPC; skips application authorization/persistence hooks.

### D3 — HTTP surface and auth

**Decision:**

| Path | Auth | Role |
| --- | --- | --- |
| `POST /adapters/voice/tools` (exact path may match OpenAPI note) | Shared secret header (reuse `VOICE_INBOUND_SECRET` / `x-voice-inbound-secret` **or** dedicated `VOICE_TOOL_SECRET` if design-time hygiene prefers separation; default **reuse inbound secret** for demo simplicity, documented) | Vapi Custom Tool Server URL |
| Existing `POST /adapters/voice/inbound` | unchanged | Lifecycle / transcript / EOC persistence; MUST NOT run agent turn for hops already covered by custom tools on the Vapi-native demo configuration |

Document the Vapi dashboard mapping: each WOM tool’s Server URL points at the tools path; header carries the shared secret (Custom Credential with header name matching the adapter, Bearer prefix off if using raw secret header).

**Why:** Smallest operable demo; one secret already required for voice. Dedicated secret is an optional hardening follow-up.

**Alternatives:** Single multiplexed inbound URL that branches on `message.type`. Acceptable later; separate path clarifies dual-brain guard and body limits.

### D4 — Allowlist binding

**Decision:** Compose the tools route with `NativeToolPort` (or equivalent) bound to `WOM_CUSTOMER_SERVICE_ALLOWLIST` only. Do not expose `demo.normalize_text` on this path. Keep authorization check inside ToolPort + explicit path allowlist documentation for future per-assistant maps (interface seam only; no tenant product).

**Why:** Proposal scope is WOM demo only; matches existing WOM allowlist constant.

### D5 — Timeout and fail-closed

**Decision:** Hard timeout ≈2000 ms wrapping auth→execute→persist light path (tool body already ≤500 ms in registry). On timeout/failure return Vapi-shaped `{ results: [{ toolCallId, result|error }] }` with normalized failure text/code; never return canned success payloads. Target &lt;1000 ms is a measured SLO in eval/report, not a separate code path.

**Why:** Voice UX budget from resolved decisions; aligns with existing tool fail-closed WOM policy.

### D6 — Persistence and evaluation parity

**Decision:** Call the same `recordToolCall` / PersistingObservability path used after agent tool hops. Set metadata `invocation_source: vapi_custom_tool`, `channel: voice`, `provider: vapi` when the persistence/observability model already accepts metadata; extend the record type minimally if required. Session report and call evaluation MUST see these ToolCalls like any other.

**Why:** Proposal decision #5; avoids a second evaluation story.

### D7 — Inbound vs tools concurrency guard

**Decision:** For the documented Vapi-native demo configuration, operators MUST not point transcript events at a Server URL mode that also runs `handleAgentTurn` for tool-bearing turns. Implementation: tools route never calls `handleAgentTurn`; inbound transcript → agent remains available for simulator/Option A. Docs MUST state the mutually exclusive conversational owner for demo interviews. Optional later: config flag `VOICE_REASONING_OWNER=vapi|runtime` that disables agent invocation on inbound transcript when `vapi`.

**Why:** Spec forbids dual processing; a config flag is the cleanest runtime guard if both URLs stay live—include as implementation task if low cost, otherwise documentation + eval assertion that tools path does not call agent.

**Preferred:** Add `VOICE_REASONING_OWNER` with default `runtime` (preserve tests) and set `vapi` for interview deploy (`render.yaml` / `.env.example` notes).

## Risks / Trade-offs

- [Vapi payload drift] → Keep mapping in adapter tests with fixtures; reject unknown shapes fail-closed.
- [Dual-brain if misconfigured] → `VOICE_REASONING_OWNER=vapi` + docs; contract test that tools handler never invokes agent turn.
- [Latency over 2s under cold start] → Warm `/health/live`; measure tool-only path; report in verify.
- [Session missing on first tool call] → Upsert/correlate by `externalChannelId` from Vapi call id when present; document if tool arrives before `call_started`.
- [Channel prompt invents numbers after tool failure] → Backend never returns fake success; channel system prompt honesty is operator DoD (reference existing WOM honesty policy).
- [Secret reuse blast radius] → Document; optional split secret later.

## Migration Plan

1. Deploy backend with tools route and `VOICE_REASONING_OWNER=vapi` on demo host.
2. Create/update Vapi assistant: voice + STT + three Custom Tools → tools URL + secret header; system prompt/first message for Spanish demo honesty (operator).
3. Point Server URL lifecycle/EOC as needed for persistence without agent reasoning.
4. Verify session report shows ToolCalls with `vapi_custom_tool` after a call.
5. Rollback: set reasoning owner back to `runtime`, remove custom tool URLs, rely on Option A/simulator.

## Open Questions

- Exact Vapi response field names (`result` vs error object) will be locked to current Vapi Custom Tools docs during apply with fixture capture—behavior specs already require per-`toolCallId` mapping and safe errors.
