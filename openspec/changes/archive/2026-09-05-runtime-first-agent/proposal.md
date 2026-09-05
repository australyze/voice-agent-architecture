## Why

The runtime already accepts a validated inbound interaction and returns a deterministic placeholder. AI Engineers cannot yet prove a single conversational turn that reasons through an LLM port, optionally invokes an allowlisted tool, and yields a structured, runtime-owned result without making the voice vendor the agent kernel. This increment is the first product-agent proof on the existing hexagonal shell (HU #003).

## What Changes

- Add a thin **demo conversational agent** owned by the application runtime: versioned prompt/context, structured model output, at most one allowlisted tool hop, typed success or typed failure.
- Implement the existing **LLM port** with a test/fake adapter (mandatory for CI and default local start) and an optional HTTP LLM adapter (no vendor SDK in `package.json`; live calls never required for the suite).
- Implement the existing **tool port** for one native, side-effect-free tool (`demo.normalize_text`).
- **BREAKING** for current voice-turn behavior: a valid inbound voice turn no longer returns locale placeholder copy. The voice adapter maps a **runtime agent reply** (or a normalized agent/LLM/tool error). Existing placeholder-string assertions must be replaced.
- Expand observability spans so each model and tool call records prompt/model versions, latency, tool name/args/result (redacted), validation outcome, and error code.
- No new public chat or session HTTP API. No Session/Conversation persistence tables.

## Non-goals

- Multi-agent topology, typed handoffs, or specialist agents.
- RAG, embeddings, corpora, or citations.
- Durable conversation memory or `Session` / `ConversationTurn` tables.
- Runtime MCP or development MCP as product tools.
- Real business workflows (booking, billing, CRM writes, payments, transfers, outbound comms).
- Operator or end-user UI.
- Live paid LLM or telephony as a CI gate.
- High-risk tools (`write`, `irreversible`, `external_comm`) or HITL approval flows.
- Speech `transcribe` / `synthesize` product adapters, barge-in, or outbound calling.

## Change types

`code` | `tools` | `agent` | `voice`

Not in this change: `rag`, `ui`. No new product HTTP routes (`api` omitted). Existing inbound voice HTTP remains and is a regression surface, not a new contract family.

## Capabilities

### New Capabilities

- `first-agent`: Single-turn demo agent policy — states, structured decision schema, budgets, prompt versioning, fallbacks, and eval cases.
- `tool-execution`: Allowlisted native tool execution — schema, risk class, deny/timeout/invalid-args behavior for `demo.normalize_text`.

### Modified Capabilities

- `application-runtime`: Runtime owns prompt packing and the agent-turn use case; LLM/tool/timeout/invalid-output errors stay normalized and secret-safe.
- `provider-ports`: A later increment may ship an optional LLM adapter and a read-only product tool; default local start still MUST NOT require live LLM credentials; core still MUST NOT import vendor SDKs.
- `voice-interaction`: Valid turns produce a runtime-owned agent reply (not a non-LLM placeholder); agent failures map to typed voice-safe errors.
- `voice-channel-adapter`: Consumer mapping uses the agent reply (or typed error), still without adapter-owned prompts or tools.

## Impact

- **Code:** `src/application` gains an agent-turn use case; `src/domain` extends LLM/tool/observability contracts as needed; `src/adapters/llm` and `src/adapters/tools` are new; `handle-voice-turn` and inbound voice tests stop depending on `placeholder-replies` as the success path.
- **APIs:** `POST` inbound voice (existing) still authenticates and maps replies; response **text** is no longer the configured placeholder string. Health routes unchanged. Canonical `lidr-specboot/docs/api-spec.yml` session/tool HTTP is **not** implemented.
- **Dependencies:** No OpenAI, Anthropic, Vapi, LangGraph, or Langfuse packages. Optional LLM adapter uses platform HTTP (`fetch`) behind the port.
- **Data:** No new PostgreSQL migrations. In-memory current-turn context only.
- **Eval / security:** Frozen agent/tool fixtures required. Adversarial cases required because tools and untrusted user text enter the prompt boundary. Post-review remediations: HTTP LLM must forward split message roles and abort oversized/timed-out fetches; inbound `occurredAt` freshness and per-secret rate limits; process-default observability must not retain turn payloads.
