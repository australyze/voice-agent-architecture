## Why

The WOM interview demo needs a Vapi-native voice path where Vapi’s LLM owns conversational reasoning while this Agent Runtime remains the sole authority for tool authorization and execution. Without a dedicated custom-tool HTTP adapter, WOM tools stay trapped inside `handleAgentTurn`, forcing either a dual-brain call (Vapi LLM plus runtime LLM on the same turn) or a full agent rebuilt only inside Vapi.

## What Changes

- Add an authenticated HTTP adapter that accepts Vapi Custom Tool (`tool-calls`) requests, authorizes against the WOM demo allowlist, validates schemas, executes registered native tools, and returns a Vapi-compatible normalized result/error envelope.
- Make Option B the authoritative tool-invocation path for Vapi-native calls: those tool requests MUST NOT also invoke `handleAgentTurn` for the same conversational turn.
- Keep the existing inbound Server URL path for lifecycle, transcript, persistence, and observability correlation only on that path—not for concurrent product reasoning when tools are invoked via custom tools.
- Persist and trace every Vapi-originated tool attempt with the same session-history and evaluation model as runtime tool calls, including metadata such as `invocation_source: vapi_custom_tool`.
- Enforce a tool round-trip budget (target &lt;1s, hard timeout ≈2s) with fail-closed normalized failure; the spoken reply path must not invent business facts after tool failure (Vapi-side policy + backend contract).
- Document operator setup: Vapi assistant custom tools point at this backend; browser still uses public key + assistant ID.

**Change types:** code, API, tools, voice (evaluation/observability gates apply; no new operator UI).

## Non-goals

- Production multi-tenant assistants, RBAC, billing, quotas, or per-tenant credential isolation.
- Runtime MCP exposure of `wom.*` tools to Vapi.
- Replacing or removing the Option A inbound transcript → `handleAgentTurn` architecture for non–Vapi-native or simulator paths.
- Registering WOM tools as client-side Web SDK tools.
- Live WOM / carrier APIs; tools remain the existing canned directory.
- Making Vapi the source of truth for session business state, prompts versioning in-repo, or evaluation scoring.
- Expanding the allowlist beyond `wom.get_customer_usage`, `wom.get_bill_status`, and `wom.check_service_status` for this demo.

## Capabilities

### New Capabilities

- `vapi-custom-tool-adapter`: Authenticated Vapi Custom Tool ingress that maps provider tool-calls to ToolPort execution and returns a consumer-compatible tool result envelope without running `handleAgentTurn`.

### Modified Capabilities

- `tool-execution`: Same registry/allowlist/schema/timeout fail-closed rules apply when the caller is the Vapi custom-tool adapter; product allowlist for this path is the three `wom.*` tools.
- `voice-channel-adapter`: Clarify split of duties—custom-tool path owns tool execution for Vapi-native calls; inbound Server URL must not run conversational agent reasoning for the same turn when tools are handled via custom tools; lifecycle/transcript/persistence remain in scope for inbound.
- `session-persistence`: Vapi-originated tool invocations MUST record ToolCalls (and correlatable session linkage) indistinguishable in shape from other tool invocations, with optional invocation-source metadata.
- `runtime-observability`: Tool spans/events for the Vapi custom-tool path MUST emit latency and status with `invocation_source` (or equivalent) without a separate vendor-only observability stack.
- `wom-customer-service`: On the Vapi-native demo path, conversational tool *selection* may be performed by the channel LLM, but authorization/execution remain runtime-owned; fail-closed tool outcomes must not be replaced by fabricated usage/bill/incident data.

## Impact

- New HTTP route(s) under voice adapters (alongside `/adapters/voice/inbound`), OpenAPI/docs updates, auth shared-secret or dedicated tool secret (design decision).
- Application use case for “execute authorized tool for external channel” distinct from `handleAgentTurn`.
- Persistence/observability metadata fields; evaluation fixtures that assert tools from the Vapi path appear in session reports.
- Vapi dashboard configuration (assistant custom tools Server URL)—manual DoD, not CI mutation.
- Existing simulator inbound + `handleAgentTurn` WOM path remains for tests and Option A; composition must prevent dual processing on the Vapi-native tool path.
