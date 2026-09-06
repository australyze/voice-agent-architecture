## Context

The process already owns a single-turn loop (`handleAgentTurn`: pack versioned prompt → retrieve → structured `reply` | `tool` → at most one `ToolPort.authorizeAndExecute` hop), native `ToolRegistry`, fake/HTTP `LlmPort`, and `POST /adapters/voice/inbound` → `handleVoiceTurn` → `runAgent`. Voice inbound composition today hard-wires `runtime-demo` (`loadRuntimeDemoPrompt`, `RUNTIME_DEMO_ALLOWLIST`, product registry with only `demo.normalize_text`, ingested example corpus). Orchestration (`/demo/orchestrate`) is a separate catalog and must stay off this path. See `proposal.md` for motivation.

Recorded assumptions from `/enrich-us` (not reopened):

1. Proof channel: `handleAgentTurn` tests plus existing voice inbound/simulator. No new chat HTTP.
2. Single canned demo subscriber; tools take a closed empty object (no phone/RUT/login).
3. Default voice session owner remains `runtime-demo`; WOM is selectable via documented config.
4. WOM facts come from mock tools, not RAG. Shared loop may retrieve; empty hits are enough.
5. Tool names are namespaced `wom.*`. `maxToolHops` stays `1`. Default locale stays `es`.
6. One optional HTTP LLM via existing `LLM_*`. CI stays fake-LLM.

Canonical references: `lidr-specboot/docs/base-standards.md` (ports, Vapi as adapter, eval before production, controlled autonomy), `backend-standards.md` (reasoning vs execution, tool schemas, prompt versions), `data-model.md` (`AgentVersion`, `Tool`, `ToolCall`, `Trace` as in-memory/trace shapes — no new tables).

Observed (not assumed): `create-server.ts` builds `NativeToolPort` with `allowedTools: RUNTIME_DEMO_ALLOWLIST`. Expanding the product registry without a per-owner allowlist would still deny `wom.*` on a demo-baked port. Quality gate required keys are `runtime-demo`, `knowledge`, `voice`, `runtime-multi-agent`.

## Goals / Non-Goals

**Goals:**

- Add a second **session-owner bundle** on the existing loop: identity `wom-customer-service-agent`, versioned Spanish prompt, three native read tools, in-process mock directory.
- Select that bundle from fail-closed config for voice inbound without changing HTTP contracts or `handleAgentTurn` control flow.
- Name change-type gates: **code**, **tools**, **agent**, **voice**.

**Non-Goals:**

- A second agent kernel, LangGraph, Runtime MCP, or Vapi-hosted assistant as policy owner.
- New product HTTP, Session migrations, React/Vapi Web SDK, telephony, recordings, dashboard (proposal Non-goals / HU #010–#012).
- WOM RAG corpus, specialist handoffs, write/HITL tools, extra CS tools.
- Voice media policy (barge-in, silence, STT/TTS, spoken confirmation of writes). `voice-ai-engineer` is consult-only for inbound routing; no new media states.

## Decisions

### D1 — Second session owner on the same loop (not a new runtime)

**Decision:** Implement `wom-customer-service-agent` as another `handleAgentTurn` caller: different `PromptVersion`, `allowedTools`, and retrieval store. Keep `maxToolHops = 1`, closed decision schema, untrusted packing, request-scoped states, existing error codes, and existing voice mapping (`llm_timeout` / `tool_timeout` → `VOICE_TIMEOUT`; other agent failures → `VOICE_RUNTIME`).

**Why:** Smallest change consistent with HU #001/#002 and later increments. `design-agent`: one user-facing owner, no supervisor.

**Alternatives:** New WOM use case that reimplements the loop. Host tools in Vapi. Route WOM through `handleOrchestratedTurn`. Rejected: second architecture / vendor kernel / wrong catalog.

**Change types:** `code` | `tools` | `agent` | `voice`. Not `api` | `rag` | `ui`.

**Topology:** Single agent. No typed handoff.

**HITL / risk:** All three tools `read`. No approval aggregate. Future real WOM writes would need a new change and HITL.

**Budgets:** `maxToolHops = 1`; tool timeout ≤ 500 ms (same class as `DEMO_TOOL_TIMEOUT_MS`); LLM timeout `LLM_TIMEOUT_MS`; whole turn ≤ `VOICE_TIMEOUT_MS`.

### D2 — Composition bundle selected by `VOICE_SESSION_OWNER`

**Decision:** Add optional config `VOICE_SESSION_OWNER` with allowlist `runtime-demo` | `wom-customer-service-agent`. Omit or empty → `runtime-demo`. Invalid present value → fail closed at `loadConfig` (same pattern as other invalid *present* settings). Composition in `createServer` / inbound `runAgent` picks:

| Owner | Prompt | Allowlist | Retrieval |
| --- | --- | --- | --- |
| `runtime-demo` | `runtime-demo` current version | `demo.normalize_text` | Existing ingested example store |
| `wom-customer-service-agent` | `wom-customer-service-agent@1` | the three `wom.*` names | In-memory store **without** the example ingest (successful empty hits) |

The product catalog still holds both demo and WOM tools. Production composition MUST construct `NativeToolPort` with the **selected** session-owner allowlist (`RUNTIME_DEMO_ALLOWLIST` or `WOM_CUSTOMER_SERVICE_ALLOWLIST`). `handleAgentTurn` still receives the same allowlist as a second check. Do not ship an unbound product port as the default inbound `ToolPort`. `ToolExecuteRequest` has no per-call allowlist field.

**Why:** Preserves HU #002 / first-agent tests by default. Matches `application-runtime` fail-closed config.

**Alternatives:** Replace inbound default with WOM (breaks existing voice fixtures). New inbound route per agent. Rejected.

### D3 — Native `wom.*` tools plus a replaceable mock directory

**Decision:** Register three native tools on the product catalog (not test-only). Names: `wom.get_customer_usage`, `wom.get_bill_status`, `wom.check_service_status`. Each: `source: native`, `riskClass: read`, `additionalProperties: false`, required property set empty, timeout ≤ 500 ms, string fields ≤ 2048 chars. Executors call an in-process **simulated WOM directory** (application interface + default canned adapter), not literals scattered in the agent or prompt.

Illustrative canned payloads (deterministic; English field names):

| Tool | Success payload (conceptual) |
| --- | --- |
| `wom.get_customer_usage` | `phoneNumber`, `dataPlanGb`, `dataUsedGb`, `dataRemainingGb`, `billingCycleEnds` |
| `wom.get_bill_status` | `amount`, `currency` (`CLP`), `dueDate`, `status` (`pending`) |
| `wom.check_service_status` | `service` (`mobile-data`), `status` (`operational`), `incident` (`null`) |

`phoneNumber` on the **output** is demo flavor only; it is not an input and is not ANI identity. Directory methods MUST NOT perform network I/O. A later `WomBillingApiAdapter` would implement the same directory interface; this change does not add that adapter.

Tests may inject a failing directory to force `tool_failed` without inventing numbers in the model.

**Why:** `design-tool` + ticket layering Agent → registry → tool → mock system.

**Alternatives:** Hardcode JSON in the prompt. New HTTP-backed tools. Identity args (`phoneNumber` required). Rejected.

### D4 — WOM skips product RAG without forking the loop

**Decision:** Do not add `skipRetrieval` unless empty-hit retrieval proves insufficient (for example if zero hits currently fail). Prefer an empty `RetrievalPort` store on the WOM bundle so `retrieving` still occurs and `retrieval_failed` is only for port errors. WOM prompt MUST forbid treating retrieved text as subscriber facts.

**Why:** `runtime-demo` still needs retrieve-before-generate. Ticket non-goal is RAG for WOM, not a second kernel.

**Alternatives:** Always share the example corpus (risk: hours-doc contamination). Duplicate turn loop without retrieval. Rejected unless empty-hit is impossible in the current loop (then the smallest flag is allowed).

### D5 — Versioned Spanish prompt with demo honesty

**Decision:** Add `prompts/wom-customer-service-agent/v1.md` loaded like existing prompts (`promptId`, monotonic version, content hash). Policy blocks (English technical file; customer language Spanish): identity as a **demonstration** assistant; Chilean CS tone (clear, concise, friendly, professional); never claim live WOM systems; call at most one of the three tools; refuse unsupported work; do not invent figures. Tool failure fail-closes the turn (`tool_failed` / `tool_timeout`) with no second model hop for a spoken fallback. Packing stays `UNTRUSTED_USER_TEXT` / tool / retrieved — user text cannot become policy.

Document the agent at `docs/agents/wom-customer-service-agent.md`.

**Why:** `design-prompt` / `data-model.md` `PromptVersion`.

**Alternatives:** Inline string in composition. Prompt only in Vapi dashboard. Rejected.

### D6 — No new HTTP; inbound contract unchanged

**Decision:** Do not add `POST /sessions/{id}/turns` or a “run WOM agent” route. Do not implement `lidr-specboot/docs/api-spec.yml` session/tool invoke APIs. Smoke: unit/`handleAgentTurn` plus existing inbound simulator with mocked LLM and `VOICE_SESSION_OWNER=wom-customer-service-agent` in that test process.

**Why:** Proposal Non-goals; HU #010 owns the web demo.

### D7 — Observability reuse

**Decision:** Reuse `traceId` (and optional `requestId` / `interactionId` / `sessionId`). Workflow + llm + tool spans already exist. WOM turns MUST set agent/prompt identity to `wom-customer-service-agent` and the prompt version. No Langfuse, no second trace model, no HU #011 persistence.

**Why:** `instrument-ai-system` already satisfied by the loop; only identity fields change.

### D8 — Eval fixtures and gate membership

**Decision:** Add `eval/wom-customer-service/` (cases JSON + Vitest executor, fake LLM). Suite key `wom-customer-service` becomes a `REQUIRED_SUITE_KEYS` member. Existing required suites and security case ids stay. Voice suite remains **regression** for default `runtime-demo` inbound; add WOM voice cases only as needed to prove session-owner mapping (scripted, no live telephony).

Named cases (create-evals):

| id | Assert |
| --- | --- |
| `usage-tool-then-reply` | tool `wom.get_customer_usage` then success |
| `bill-tool-then-reply` | `wom.get_bill_status` |
| `service-tool-then-reply` | `wom.check_service_status` |
| `wom-reply-without-tool` | schema-valid reply, no tool |
| `bill-tool-failed-no-fabricate` | `tool_failed` / `tool_timeout`; turn must not present a successful bill payload |
| `unsupported-request-reply` | reply, zero `wom.*` executions |
| `second-hop-denied` | `tool_denied` after one hop |
| `wom-invented-tool-denied` | unknown name |
| `invalid-args-no-execute` | extra property → `tool_invalid_args` |
| `wom-injection-does-not-expand-allowlist` | still only three `wom.*` |
| `cross-allowlist-normalize-denied` | `demo.normalize_text` denied on WOM path |

Assert tool names, codes, `toolBodyRan`, locale `es` — not live prose. Dataset version pinned; no PII.

**Why:** `evaluation-gate` + `openspec-tasks-mandatory-steps.md`. HU #012 can add a public program later.

### D9 — Architecture tests

**Decision:** Extend existing architecture / package-vendor tests so WOM application/domain modules do not import Vapi, an LLM SDK, or mock “HTTP WOM” clients. Tools resolve through the registry, not a hardcoded branch in `handleAgentTurn`.

## Risks / Trade-offs

- **[Default inbound still demo]** → Interviewer must set `VOICE_SESSION_OWNER` for a live WOM voice smoke. Document it; tests cover both owners.
- **[Empty retrieval vs skip flag]** → If the current loop treats zero hits as failure, add the smallest skip — record in apply if needed; do not silently require the hours document.
- **[Shared NativeToolPort allowlist]** → Constructor allowlist would hide WOM tools. Per-owner policy is mandatory.
- **[Hallucinated bills]** → Fail-closed tool errors + eval case; prompt forbids invention; do not assert exact Spanish sentences in CI.
- **[Identity misunderstanding]** → Output `phoneNumber` is canned; docs must say there is no customer authentication.
- **[Prompt injection]** → Existing packing + allowlist + adversarial fixture. `/adversarial-review` still runs before archive.
- **[Catalog wording]** → Main `tool-execution` “exactly one product tool” is superseded by this change’s delta.

## Migration Plan

1. Land on `feature/wom-customer-service-agent`.
2. Register tools + mock directory with TDD; keep `runtime-demo` allowlist exclusive of `wom.*`.
3. Add prompt, WOM `handleAgentTurn` tests, eval suite.
4. Add `VOICE_SESSION_OWNER`; wire inbound composition; keep default demo fixtures green.
5. Add WOM suite to the quality gate and update the checked-in baseline (explicit human/agent edit in this change).
6. Update docs / `.env.example` (placeholders only).
7. Rollback: revert the branch; inbound returns to hard-wired `runtime-demo`.

## Open Questions

- Vendor-signed Vapi webhooks remain a later adapter increment (unchanged).
- Whether HU #010 should default `VOICE_SESSION_OWNER` to WOM for the public web demo (out of scope here).
