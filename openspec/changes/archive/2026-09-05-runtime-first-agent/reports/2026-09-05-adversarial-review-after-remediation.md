## Adversarial review

**Scope**: OpenSpec change `runtime-first-agent` after §11 remediations (code + tools + agent + voice). Surfaces: `handleAgentTurn`, `demo.normalize_text`, optional `HttpLlm`, `POST /adapters/voice/inbound`. No RAG, MCP, HITL, or session HTTP.

**Sources**: Proposal, design D1–D15, delta specs (`first-agent`, `tool-execution`, `application-runtime`, `provider-ports`, `voice-interaction`, `voice-channel-adapter`), `tasks.md` §11; `lidr-specboot/docs/base-standards.md` and `backend-standards.md` (Security, tools); prior FAIL `2026-09-05-adversarial-review.md`; working tree vs merge-base `origin/main` (`a60edf7`) plus uncommitted agent/adapter files. **No PR.** `/verify` quality PASS was not treated as a security PASS.

**Independence**: This review ran in the **same conversation** that implemented remediations. That is weaker than the skill’s preferred fresh session. Verdict is still archive-blocking if Major/Blocker remain; a second human can re-check.

### Spec and task alignment

**Accepted (evidence refutes prior Majors)**

- HTTP LLM posts `request.messages` when present: system policy vs untrusted user/tool (`http-llm.ts`, `http-llm.test.ts` split-role case). `handleAgentTurn` always supplies that list, including a `tool` role after a hop.
- Inbound freshness (`VOICE_STALE`) and per-secret-hash rate limit (`VOICE_RATE_LIMITED`) run after auth and before `handleAgentTurn` (`create-server.ts`, inbound + voice-inbound tests, voice eval `stale-occurred-at`).
- Default observability is `LoggingObservability` (no `spans[]`). Tool spans emit `{ ok: true }`, not `normalizedText`. `MemoryObservability` is test-only.
- Named turn states recorded, including `awaiting_tool` / `runtime`.
- `replyText` > 2048 → `invalid_output`. Fetch abort + 64 KiB body cap on HTTP LLM.
- Single `read` tool; closed schema; extra fields / unknown names do not execute; hop limit 1; no MCP; no vendor SDKs in core; voice adapter does not import `LlmPort`.
- Adapter-facing errors omit raw model JSON and secrets (tested).

**Non-goals honored**

- No `/sessions`, `/tools/invoke`, Session tables, RAG, UI, or high-risk tools.

**Residual (specified, not a mismatch)**

- D14 / Open Questions: vendor-signed webhooks are deferred. `occurredAt` is **caller-supplied**. Freshness stops *stale captured bodies*, not a stolen secret minting new timestamps. The windowed rate limit is the cost bound.

### Findings

| Severity | Area | Finding | Evidence | Suggested fix |
| --- | --- | --- | --- | --- |
| Minor | Auth residual | Shared static `x-voice-inbound-secret` remains. Anyone with the secret can set `occurredAt` to now and invoke the agent up to 30 times / 60s per process (60 model calls if every turn tools). In-memory limiter does not share across processes. | `authenticateInbound`; `assertInboundFreshness` uses client `occurredAt`; `InboundRateLimiter` in-process; D14 deferred signatures | **OpenSpec + later code**: vendor-signed webhook or HMAC over body+timestamp+nonce when this route is internet-exposed with a paid LLM. Not required to match current D14. |
| Minor | Voice vs LLM cancel | `handleVoiceTurn` `Promise.race` does not abort an in-flight `HttpLlm` fetch if `VOICE_TIMEOUT_MS` < `LLM_TIMEOUT_MS`. Adapter abort is only the LLM budget. | `handle-voice-turn.ts` race; `http-llm.ts` own timer | **code**: pass one `AbortSignal` from the voice budget into the LLM port. |
| Minor | HTTP fallback | If `messages` is omitted, `HttpLlm` still posts packed `input` as a single `user` message. Product path always sends `messages`; a regression would collapse isolation. | `http-llm.ts` `outbound` ternary | **code**: fail closed when `completeStructured` is used without `messages`, or refuse to send `input` that contains `UNTRUSTED_`. |
| Minor | Config SSRF | `LLM_BASE_URL` still accepts any `http(s)` URL. Operator/env mistake sends `LLM_API_KEY` to an internal host. Not caller-controlled. | `load-config.ts` URL refine | **docs + code**: document; optionally deny link-local/private literals. |
| Question | Prompt integrity | Hash is computed at load, not pinned to a known digest at runtime. Disk edit of `v1.md` is not detected as a version break. | `load-prompt.ts` | **code** only if integrity is required; else leave. |
| Question | Injection fixture | `injection-does-not-expand-allowlist` still scripts the fake to propose a denied tool. Proves allowlist, not live-model isolation. | `eval/runtime-demo/cases.json` | Accept as quality evidence only. |
| Question | Trace reconstructability | `LoggingObservability` drops `promptId` / `promptVersion` / `modelId` from logs. Port `emit` still carries them; first-agent asked traces or logs to include prompt identity. | `logging-observability.ts` vs `first-agent` / `application-runtime` span fields | **code** (log those ids) or **OpenSpec** (logging adapter may drop fields). Not an abuse path. |

### Prior Majors — disposition

| Prior Major | Now |
| --- | --- |
| HTTP packed policy as one `user` message | **Refuted** on the product path (messages forwarded; test asserts roles) |
| Inbound replay unbounded on the model route | **Reduced to Minor residual** (freshness + rate limit match D14; no signature) |
| Default `MemoryObservability` + `normalizedText` | **Refuted** (logging default; redacted tool result) |

### Risks considered and still refuted

- High-risk tools without HITL: catalog is `read` only.
- Parse-failure execute: invalid structured output does not call the tool.
- Unbounded hops: second hop denied.
- Dev/runtime MCP: none registered.
- Unbounded provider body / no abort: capped and aborted on the HTTP adapter.
- Default heap retention of user-derived tool results: logging adapter does not keep a span list.
- Vendor SDK in core / committed LLM secrets: architecture + secrets-hygiene.
- Voice adapter owning prompts/tools: inbound source has no `LlmPort` import.

### Verdict

**PASS WITH GAPS**

No Blocker or Major remains against the *updated* spec. Residual shared-secret replay (within the documented window), operator SSRF, and the HTTP `messages` fallback are gaps, not archive blockers for this demo `read` tool.

Quality `/verify` PASS is separate. Archiving is **advisable** from a security-review standpoint **if** a stakeholder accepts the documented residual (static secret, no vendor signature). Prefer a fresh-session confirmation when possible.

Independence note: same implementing conversation. Treat as sufficient to unblock archive of this increment; do not treat as a live-model red team.

### Recommended next steps (before archive)

1. Stakeholder accept D14 residual (or delay archive until signed inbound).
2. `/opsx-archive` if accepted.
3. Later increment: signed webhook / HMAC, private-URL deny for `LLM_BASE_URL`, fail-closed HTTP without `messages`.
