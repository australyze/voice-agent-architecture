## Context

The hexagonal process already boots, checks health, and handles inbound voice as `VoiceTurn` → `handleVoiceTurn` → locale **placeholder** `VoiceReply`. Ports exist (`LlmPort`, `ToolPort`, `ObservabilityPort`) but are unused on the product path. `package-vendors.test.ts` and `architecture.test.ts` forbid LLM/voice vendor SDKs in manifests and in domain/application. See `proposal.md` for motivation.

Recorded assumptions from `/enrich-us` (not reopened here):

1. Proof channel: runtime/use-case tests first; existing inbound voice consumes the same agent reply (no new chat HTTP).
2. One pure function tool: `demo.normalize_text`.
3. Locale stays configurable; default `es`.
4. CI is mocked-LLM only; live HTTP LLM is optional and never a suite gate.
5. Current-turn context only; no durable conversation store.

Canonical references: `lidr-specboot/docs/base-standards.md` (ports, eval before production, observability), `backend-standards.md` (reasoning vs execution, tool schema, prompt versions), `data-model.md` (`AgentVersion`, `Tool`, `ToolCall`, `Trace` as **in-memory/trace shapes**, not new tables).

## Goals / Non-Goals

**Goals:**

- Smallest agent loop behind existing ports: pack versioned prompt → structured LLM decision → optional one-hop tool → structured reply or typed error.
- Keep default local start and CI offline from paid LLM/voice.
- Replace placeholder success on the voice path without moving prompts or tools into the voice adapter.
- Name change-type gates: **code**, **tools**, **agent**, **voice**.

**Non-Goals:**

- New HTTP product APIs, Session migrations, LangGraph, vendor observability, RAG, MCP, HITL (proposal Non-goals).
- Voice media policy (barge-in, silence, STT/TTS). `voice-ai-engineer` is not required for this increment.
- Choosing a paid LLM vendor as a core dependency.

## Decisions

### D1 — Thin agent plus deterministic runtime (not a scripted-only path)

**Decision:** One session-owner agent `runtime-demo` with `maxToolHops = 1`. The model proposes a closed structured decision (`reply` | `tool`). The runtime validates, allowlists, executes, times out, and records. No LangGraph/LangChain. No multi-agent.

**Why:** HU #003 requires proving an LLM path. The successful *execution* path is fully specified (`base-standards.md`: controlled autonomy; `backend-standards.md`: model never executes side effects).

**Alternatives:** Keep placeholder (fails the HU). Host the agent only in the voice vendor. Rejected: vendor becomes the kernel.

**Change types:** `code` | `tools` | `agent` | `voice`. Not `api` (no new routes) | `rag` | `ui`.

### D2 — Agent-turn use case is the voice `work`

**Decision:** Add an application use case (name illustrative) `handleAgentTurn(input) → AgentTurnResult` that owns prompt packing, LLM calls, tool hops, and traces. `handleVoiceTurn` keeps UUID/timeout/log behavior and uses the agent use case as `work`, mapping `AgentTurnResult` onto `VoiceReply` or a voice-safe error. Adapters still call only the voice/application boundary, not `LlmPort` / `ToolPort`.

```text
Voice adapter / tests
        │ VoiceTurn
        ▼
handleVoiceTurn          # timeout, session UUID, voice logs
        │
        ▼
handleAgentTurn          # prompt, LLM, tool, traces
        │ AgentTurnResult
        ▼
VoiceReply | VoiceError
```

**Why:** Preserves the inbound contract and timeout already proven. Avoids a second public ingress.

**Alternatives:** New `POST /sessions/{id}/turns`; leave voice on placeholder until a later change. Rejected: invents API the story forbade; would leave the only interaction adapter on placeholder.

### D3 — Structured decision on the LLM port

**Decision:** Extend `LlmPort` so one call can return a typed decision and optional tool proposal without a vendor SDK shape. Keep `complete` / `stream` / `completeStructured`. Application supplies the decision schema (closed JSON Schema). Illustrative decision:

| Field | Rule |
| --- | --- |
| `type` | `reply` \| `tool` |
| `replyText` | required when `type = reply` |
| `toolName` | required when `type = tool` |
| `arguments` | object, required when `type = tool` |

`additionalProperties: false`. After a tool hop, a second `completeStructured` call includes the bounded tool result as untrusted content. A second `tool` decision is denied.

**Why:** Existing `completeStructured` is the capability already declared. Tool-calling is a runtime loop, not a vendor “assistant” object in domain.

**Alternatives:** Vendor-native tool_calls array as the domain model. Rejected: locks the core to one provider.

### D4 — Fake LLM by default; optional HTTP adapter; no SDK package

**Decision:** Composition wires an in-process **fake LLM adapter** when LLM settings are omitted. The fake is scriptable from tests (return reply, return tool, return garbage, delay past timeout). When optional `LLM_BASE_URL` + `LLM_API_KEY` (names illustrative) are valid, wire an **HTTP adapter** using platform `fetch` to a generic chat/completions-style endpoint. Map provider errors to `llm_provider`. Do **not** add `openai`, `@anthropic-ai/sdk`, or similar to `package.json`. Core remains import-clean.

**Why:** `provider-ports` and `package-vendors.test.ts` already ban SDKs. HU requires an adapter, not a paid CI dependency.

**Alternatives:** Add official SDK only in adapters (still fails the lockfile allowlist). Live-only LLM. Rejected.

### D5 — Native tool executor for `demo.normalize_text`

**Decision:** Implement `ToolPort.authorizeAndExecute` in `src/adapters/tools` (or application policy + adapter execute). Catalog is in-process, not a DB table. Schema: `{ type: object, additionalProperties: false, required: ["text"], properties: { text: { type: "string" } } }`. Result payload: `{ normalizedText }` = trim + collapse whitespace + lowercase. `riskClass: read`, `source: native`, timeout tight (≤ 500 ms). Unknown names → `tool_denied`. Parse failure does not execute.

**Why:** `design-tool`: namespaced name, closed schema, structured errors. Matches enrichment default (pure function).

**Alternatives:** `clock.now` (less useful for proving argument validation). HTTP-backed tool. Rejected as extra risk.

### D6 — Versioned prompt artifact, not an inline anonymous string

**Decision:** Store prompt text under a repo path such as `prompts/runtime-demo/v1.md` (or `.json` blocks). Identity: `promptId = runtime-demo`, `version = 1`, content hash computed at load. Changing text is a new version file plus eval fixture update. Packing: system/policy block from the artifact; user and tool result in labeled untrusted blocks. Do not drop the current user turn when applying a small token budget.

**Why:** `design-prompt` / `data-model.md` `PromptVersion`. Anonymous strings are not the source of truth.

**Alternatives:** Prompt only in the voice vendor dashboard. Rejected.

### D7 — Observability port fields, not a vendor

**Decision:** Widen `TraceSpan` (or a related payload) so emitters can attach: `promptId`, `promptVersion`, `modelId`, `latencyMs`, `toolName`, redacted args, bounded result/error, `validationOk`. Kinds stay `llm` | `tool` (plus existing). Default adapter: logging or in-memory collector for tests. No Langfuse.

**Why:** `instrument-ai-system` and `base-standards.md`: no untraced model/tool call.

**Alternatives:** Logs only with free-form strings. Rejected: cannot assert spans in tests.

### D8 — Error mapping

**Decision:** Agent codes (`invalid_output`, `tool_denied`, `tool_failed`, `tool_timeout`, `llm_timeout`, `llm_provider`) stay internal to the agent result. Voice mapping:

| Agent | Voice |
| --- | --- |
| `llm_timeout`, `tool_timeout`, overall turn budget | `VOICE_TIMEOUT` |
| all other agent failures | `VOICE_RUNTIME` (safe message) |

Do not put raw model JSON on `VoiceError.message`. One bounded retry only for `invalid_output` (same prompt/version). Tools are not retried (they are already idempotent/read-only, but a retry is unnecessary complexity).

**Why:** Existing voice consumers already understand timeout vs runtime. Adding many new public voice codes is optional later.

**Alternatives:** New public voice code per agent failure. Deferred; internal codes are enough for tests.

### D9 — No Session tables; no new HTTP

**Decision:** Turn state (`receiving` → `reasoning` → `awaiting_tool` → `completed` | `failed`) is request-scoped. Do not implement `lidr-specboot/docs/api-spec.yml` `/sessions` or `/tools/{toolName}/invoke`. Inbound `POST /adapters/voice/inbound` stays the only conversational HTTP surface.

**Why:** Enrichment and existing voice spec forbid durable memory in this increment.

### D10 — Eval fixtures live in-repo; runner stays local

**Decision:** Place frozen cases under `eval/runtime-demo/` (or `openspec/changes/runtime-first-agent/eval/` during apply, then move to `eval/`). Case ids: `reply-without-tool`, `allowlisted-tool-then-reply`, `invented-tool-denied`, `invalid-schema-no-execute`, `llm-timeout`, `injection-does-not-expand-allowlist`. Assertions: decision type, tool name, error codes, schema validity — not live prose. Use the existing Vitest runner with scripted fake LLM; do not add Promptfoo/DeepEval as a required package unless already present.

**Why:** `create-evals`: freeze cases; do not mandate a new vendor runner.

### D11 — HITL and risk

**Decision:** `demo.normalize_text` is `read`. No approval aggregate. Adding any other risk class is a new OpenSpec change.

## Risks / Trade-offs

- **[Placeholder tests break]** → Expected **BREAKING** on success text; rewrite assertions to mocked agent replies in the same change.
- **[Fake LLM over-proves]** → Contracts are mocked; live adapter is optional and untested in CI. Document that production-ready live-model claims need a later eval gate.
- **[Prompt injection]** → Isolation + allowlist; adversarial fixture required. Do not treat the fixture as a full red team (`/adversarial-review` still runs before archive).
- **[Voice latency]** → Entire agent loop stays inside existing voice handling timeout; fail as `VOICE_TIMEOUT`.
- **[SDK temptation]** → Lockfile test remains the guardrail.
- **[Misleading “agent” if fake always replies]** → Fake must be able to propose the tool and to fail; eval cases must exercise both.

## Migration Plan

1. Land on `feature/runtime-first-agent`.
2. Implement agent use case + fake LLM + tool with TDD; keep health/persistence unchanged.
3. Switch `handleVoiceTurn` success path from placeholder catalog to agent result; delete or confine placeholder helpers to unused code (do not keep a silent success fallback).
4. Update inbound simulator tests and project OpenAPI/docs that mention placeholder copy.
5. Rollback: revert the change; voice inbound would again be placeholder-only (previous archived spec).

### D12 — HTTP LLM sends split roles and aborts

**Decision:** `HttpLlm` MUST post `request.messages` when present (system policy vs untrusted user/tool). It MUST abort `fetch` with `AbortSignal` at `LLM_TIMEOUT_MS` and reject bodies larger than 64 KiB. `replyText` longer than 2048 characters is `invalid_output`.

**Why:** Adversarial review Major: packed `input` as a single user message collapsed isolation. Unbounded fetch after timeout wastes budget.

### D13 — Logging observability is the process default

**Decision:** `createServer` wires a logging (or no-op) observability adapter. `MemoryObservability` stays test-only. Tool spans emit `{ ok: true }` or an error code, never `normalizedText`.

**Why:** Adversarial review Major: unbounded in-heap spans with user-derived tool results.

### D14 — Inbound freshness and rate limit

**Decision:** After auth, reject `|now - occurredAt| > VOICE_INBOUND_MAX_SKEW_MS` (default 60s) as `VOICE_STALE`. Limit authenticated turns per inbound-secret hash to `VOICE_INBOUND_RATE_LIMIT` (default 30) per `VOICE_INBOUND_RATE_WINDOW_MS` (default 60s) as `VOICE_RATE_LIMITED`. HTTP 400 / 429. Signed vendor webhooks remain a later increment.

**Why:** Adversarial review Major: static secret replay now reaches the model path. Timestamp skew plus a windowed limit is the smallest control that does not invent a vendor signature scheme.

### D15 — Request-scoped turn states

**Decision:** `handleAgentTurn` records `receiving` → `reasoning` → `awaiting_tool` (runtime) → `completed` | `failed` on the result. Not persisted.

**Why:** Specified in `first-agent`; was missing.

## Open Questions

- Vendor-signed webhook verification (Vapi or other) remains a later adapter increment.
- Whether a later change adds a dedicated `VOICE_AGENT_*` public error code family (D8 keeps mapping to `VOICE_RUNTIME` / `VOICE_TIMEOUT`).
