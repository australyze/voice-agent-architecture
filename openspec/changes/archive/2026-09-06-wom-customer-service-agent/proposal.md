## Why

The runtime already owns a single-turn agent loop, allowlisted native tools, an LLM port, and a Vapi inbound adapter, but the only voice session owner is the generic `runtime-demo` normalizer. An interviewer cannot yet see a realistic **simulated WOM Chile** customer-service agent that chooses among usage, billing, and service-status mocks without treating Vapi or a vendor SDK as the kernel.

## What Changes

- Add a second runtime-owned product agent identity `wom-customer-service-agent`: versioned Spanish prompt, explicit allowlist of exactly three read-only mock WOM tools, structured `reply` | `tool` decisions through existing `handleAgentTurn`, and demo-honest replies that never claim live WOM systems.
- Register three native `read` tools (`wom.get_customer_usage`, `wom.get_bill_status`, `wom.check_service_status`) behind the existing registry and `ToolPort`. Each tool reads a deterministic in-process mock, not a WOM API.
- Extend voice inbound **composition** so the session owner is selected from documented configuration. Default remains `runtime-demo` so existing HU #002 / first-agent tests stay green. When configured, inbound routes a normalized `VoiceTurn` to the WOM agent without changing inbound HTTP contracts.
- Reuse existing LLM, observability, and correlation (`traceId`). Do not add a second turn loop, orchestrator path, HTTP chat API, or RAG corpus for WOM.
- Add frozen WOM agent/tool/voice-regression fixtures and include the new suite in the quality gate while keeping existing required members.

## Non-goals

- Real WOM, CRM, billing, or network APIs; real customer authentication; ANI/phone-number product identity.
- React frontend, shadcn/ui, Vapi Web SDK, call dashboard, recordings, telephony, WhatsApp, SMS (HU #010 / later).
- Durable Session/Conversation persistence or observability UI (HU #011).
- Public evaluation program and production deployment (HU #012) beyond this change’s frozen fixtures.
- Replacing `runtime-demo`, `/demo/orchestrate`, RAG, or multi-agent orchestration.
- A second architecture, Vapi-hosted assistant as the agent kernel, Runtime MCP, high-risk tools, HITL write approvals, or extra customer-service tools.
- New public HTTP “run agent” route. Smoke is `handleAgentTurn` tests plus existing voice inbound/simulator.

## Change types

`code` | `tools` | `agent` | `voice`

Not in this change: `rag`, `ui`. No new product HTTP routes (`api` omitted). Existing inbound voice HTTP is a regression surface. Config may add a session-owner selector; that is not a new OpenAPI family.

## Capabilities

### New Capabilities

- `wom-customer-service`: Simulated WOM Chile customer-service agent — identity, Spanish/demo-honest policy, three mock tools, canned subscriber, fallbacks, and eval cases.

### Modified Capabilities

- `first-agent`: `runtime-demo` remains the default single-turn demo agent; a second product session owner MAY exist and MUST NOT be invoked from the `runtime-demo` path or the orchestrator catalog.
- `tool-execution`: Product catalog MAY include the three `wom.*` tools in addition to `demo.normalize_text`; per-agent allowlists still decide what executes.
- `application-runtime`: Voice inbound composition MUST select the configured session-owner agent (`runtime-demo` default, or `wom-customer-service-agent`) and MUST still NOT invoke `/demo/orchestrate`.
- `voice-interaction`: A configured WOM session owner MUST produce runtime-owned Spanish replies (or typed voice-safe errors) through the existing `VoiceTurn` / `VoiceReply` contract.
- `voice-channel-adapter`: Inbound mapping stays vendor-free; the adapter MUST NOT own WOM prompts or tools; composition chooses which agent `runAgent` invokes.
- `knowledge-retrieval`: The WOM path MUST NOT require retrieved corpus evidence to answer; facts come from mock tools. The shared turn loop MAY still call retrieval with a successful empty-hit result.
- `evaluation-gate`: Quality gate MUST add the WOM agent suite as a required member without dropping existing required suites.

## Impact

- **Code:** New WOM prompt, agent doc, three native tools + mock module, composition/config for session-owner selection, empty-hit or no-op retrieval wiring on the WOM path, architecture tests that WOM application code still does not import Vapi or an LLM SDK.
- **APIs:** `POST /adapters/voice/inbound` unchanged at the HTTP contract. No new chat or orchestrate route. Health routes unchanged.
- **Dependencies:** No new vendor SDKs. Existing `LLM_*` and `VOICE_*` remain. One optional config key selects the voice session owner.
- **Data:** No PostgreSQL migrations. Mocks are in-process and deterministic. No real customer PII.
- **Eval / security:** Frozen WOM fixtures required. Adversarial cases required (allowlist, injection, no fabrication on tool failure). Existing `runtime-demo`, knowledge, voice, and multi-agent gate members remain required.
