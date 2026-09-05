## Adversarial review

**Scope**: OpenSpec change `runtime-first-agent` (code + tools + agent + voice). Surfaces: `handleAgentTurn`, `demo.normalize_text`, optional `HttpLlm`, inbound `POST /adapters/voice/inbound` now invoking the agent. No RAG, MCP, HITL, or session HTTP.

**Sources**: Proposal, design (D1–D11), delta specs (`first-agent`, `tool-execution`, `application-runtime`, `provider-ports`, `voice-interaction`, `voice-channel-adapter`), `tasks.md`; `lidr-specboot/docs/base-standards.md` and `backend-standards.md` (Security, tools); prior residual in `openspec/changes/archive/2026-09-05-vapi-voice-interaction-adapter/reports/2026-09-05-adversarial-review-recheck.md`; working tree vs merge-base `origin/main` (`a60edf7`) plus uncommitted implementation. **No PR.** `/verify` quality PASS was not treated as a security PASS. Reviewer is in the **same conversation** as implement/`/apply` (independence weaker than the skill prefers).

### Spec and task alignment

**Accepted**

- One demo agent, `maxToolHops = 1`, closed structured decision, fail closed on invalid output.
- Single native `read` tool; no write / irreversible / external_comm; no HITL required for this catalog.
- No runtime/dev MCP mix-up (no MCP registered).
- Core stays free of vendor SDKs; fake LLM default; optional HTTP adapter.
- Voice adapter does not import `LlmPort` (boundary test).
- Tool extra fields / unknown names / invalid types do not execute (tool tests).
- Adapter-facing voice/agent errors omit raw model JSON and secrets (tested).
- Eval includes `injection-does-not-expand-allowlist` (quality allowlist, not a live-model red team).

**Non-goals honored (no extra product attack surface)**

- No `/sessions`, `/tools/invoke`, Session tables, RAG, or UI.

**Not refuted / mismatched**

- `first-agent`: user/tool text MUST NOT be concatenated as system policy. `HttpLlm` sends packed policy+user as one `user` message and ignores `messages[]`.
- `first-agent`: named turn states and actor transitions MUST be recorded. `handleAgentTurn` has no state machine records.
- Prior voice review reserved signed webhook / freshness for this HU. Still a static shared secret; replay now reaches the LLM.

### Findings

| Severity | Area | Finding | Evidence | Suggested fix |
| --- | --- | --- | --- | --- |
| Major | Prompt isolation / live LLM | Optional HTTP adapter concatenates system policy and untrusted user (and later tool JSON) into a single `user` message. Application builds a split `messages[]` array that the adapter discards. Live path weakens the isolation the spec requires. | `HttpLlm.post` uses `messages: [{ role: "user", content: input }]` with `input = packAgentContext(policy, userText, toolResult)`. `handleAgentTurn` passes unused `messages` with `role: system`. No test asserts HTTP packing roles. | **code + tests**: send `request.messages` (system vs untrusted user/tool). Bound/ignore `input` as a fallback only. Add a unit test that the outbound body has separate roles and does not put user text in `system`. **OpenSpec**: if isolation is HTTP-mandatory, say so in `provider-ports`. |
| Major | Inbound replay / cost | Static `x-voice-inbound-secret` has no timestamp, nonce, or rate limit. Prior review called replay harmless on placeholder and reserved freshness for the first agent/tools HU. Each replay now runs `handleAgentTurn` (fake or paid HTTP). Stolen/leaked secret or captured request can burn model budget and fill the in-memory span list. | `authenticateInbound` + prior `2026-09-05-adversarial-review-recheck.md` Minor. This change wires `runAgent` on the same route. | **OpenSpec + code**: freshness (signed webhook or timestamp+nonce) and/or inbound rate limit when LLM mode is `http`. Do not treat the shared header as enough once a model is on the path. |
| Major | Observability / PII | Default process wiring uses `MemoryObservability` with an unbounded `spans[]`. Tool success stores `resultBounded: { normalizedText }` (user-derived). Long-lived `npm start` retains every turn in heap. Args are redacted; results are not. Design said in-memory collector is for tests. | `create-server.ts` `observability ?? new MemoryObservability()`. `handle-agent-turn.ts` emit of `resultBounded`. | **code**: default to a logging/no-op adapter that does not retain payloads; cap or drop `normalizedText` from spans. Keep `MemoryObservability` for tests only. |
| Minor | LLM HTTP client | `fetch` is not aborted when `llmTimeoutMs` / voice timeout wins `Promise.race`. Response body size is unbounded before `JSON.parse`. A slow or huge provider response continues after the turn already failed. | `http-llm.ts` `post`; `handle-agent-turn.ts` race. | **code**: `AbortSignal` on fetch; max bytes before parse; max `replyText` length. |
| Minor | Spec vs code (audit) | Named states `receiving` / `reasoning` / `awaiting_tool` and actor transitions are specified and not implemented. Weakens reconstructability, not current tool abuse. | `specs/first-agent/spec.md` vs `handle-agent-turn.ts` | **OpenSpec** (narrow the requirement) or **code** (request-scoped state log). |
| Minor | Config SSRF | `LLM_BASE_URL` accepts any `http(s)` URL. A mistaken or malicious env value sends the API key to an internal host. Operator-controlled, not caller-controlled. | `load-config.ts` URL refine | **docs + code**: document allowlist; optionally deny link-local/private literals. |
| Question | Prompt hash | Hash is computed at load and tested, not pinned against a known digest at runtime. Tamper of `v1.md` on disk is not detected in process. | `load-prompt.ts` | **code** only if integrity is a requirement; else leave as Question. |
| Question | Injection fixture | `injection-does-not-expand-allowlist` scripts the fake to propose a denied tool. It proves the allowlist, not that labeled packing stops a live model. | `eval/runtime-demo/cases.json` | Accept as quality evidence; do not cite as a security PASS for live models. |

### Risks considered and refuted (for this increment)

- High-risk tools without HITL: catalog is `read` only; extra properties rejected.
- Parse-failure execute: invalid structured output does not call the tool (tested).
- Unbounded tool hops: second hop denied (tested).
- Dev/runtime MCP: none registered.
- Vendor SDK in core / committed LLM secrets: architecture + secrets-hygiene tests.
- Voice adapter owning prompts/tools: inbound source has no `LlmPort` import.

### Verdict

**FAIL**

Two or more Majors remain: live-path prompt concatenation, inbound replay now on a model-invoking route (explicit leftover from the voice HU), and default unbounded in-memory spans with user-derived tool results.

Quality `/verify` PASS does not clear this. Archiving is **not advisable**.

Independence note: this review was requested in the implementing session. Treat the verdict as valid for archive blocking; a second human or a fresh session can re-check after remediations.

### Recommended next steps (before archive)

1. Update OpenSpec (isolation on the HTTP adapter, inbound freshness or rate limit, observability default) — do not silent-patch only.
2. New `/apply` pass: HTTP `messages[]`, abort/size bounds, logging observability default, inbound replay control.
3. Re-run `/verify` and a **new** `/adversarial-review` session.
4. Then `/opsx-archive`.
