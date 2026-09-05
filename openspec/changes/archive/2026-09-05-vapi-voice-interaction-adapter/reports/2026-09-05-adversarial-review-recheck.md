# Adversarial review (recheck)

**Scope**: OpenSpec change `vapi-voice-interaction-adapter` (code + api + voice). Surfaces: `POST /adapters/voice/inbound`, `GET /health/voice`, optional voice config, deterministic placeholder runtime. No product agent, tools, RAG, or UI.

**Sources**: Proposal, design (D1–D10), delta specs (`voice-interaction`, `voice-channel-adapter`, `health-checks`, `application-runtime`, `provider-ports`), `tasks.md`; `lidr-specboot/docs/base-standards.md` and `backend-standards.md` (Security); prior FAIL report `2026-09-05-adversarial-review.md`; working tree vs merge-base `origin/main` (`a60edf7`). **No PR.** Branch `feature/vapi-voice-interaction-adapter` still has **zero commits** of this change (implementation is uncommitted). `/verify` quality PASS was not treated as a security PASS. Reviewer is in the **same conversation** as implement/`/apply` (independence weaker than the skill prefers).

## Spec and task alignment

**Accepted / in scope:** inbound-only adapter; shared-secret auth when configured; strict payload; unsupported events rejected; runtime independence; no Vapi types in domain; correlatable logs without secrets or raw utterances; voice not required for readiness; engineer/QA smoke only; D10 field/body bounds; handling timer cancelled on success.

**Non-goals:** customer number, outbound call, LLM/agent/tools/RAG, session persistence, barge-in/confirmation, live Vapi as DoD.

**Security/HITL underspecified (accepted for this HU):** no webhook timestamp/nonce, no rate limit. HITL reserved and unused (no tools). Dual MCP not introduced.

**AI surfaces:** no prompt, no tools, no retrieval. Transcript `inputText` is not echoed and not sent to an LLM.

---

## Adversarial review
**Scope**: see above
**Sources**: see above

### Spec and task alignment
See above. Prior spec gaps (timer cancel, field/body bounds, invalid session not logged) are now in D6/D10 and `tasks.md` §11–12. Tests exist for those cases. Task 9.9 / 11.5 oversized-body claim is now backed by `should_reject_oversized_inbound_body_without_leaking_secret`.

### Findings

| Severity | Area | Finding | Evidence | Suggested fix |
| --- | --- | --- | --- | --- |
| Minor | Auth / next HU | Shared static header secret, no timestamp/nonce. Replay is harmless on a placeholder and becomes dangerous on the first side-effecting agent or tool. | `authenticateInbound`; design D4; `docs/adapters/vapi-inbound.md` | **OpenSpec** on the first agent/tools change: signed webhook + freshness. Do not treat this header as the only control once side effects exist. |
| Minor | Health | `GET /health/voice` is unauthenticated and distinguishes `configured` vs `not_configured`. Spec + loopback exception. Residual if `LISTEN_HOST=0.0.0.0`. | `create-server.ts`; health-checks delta; adapter note | **docs** already warn. Keep loopback default. Do not publish this probe. |
| Question | Process | Change is still uncommitted; merge-base diff of tracked files is incomplete without the untracked tree. Same chat as `/apply`. | `git status`; `HEAD == origin/main` | Human: commit without `.env`. Prefer a later independent review if archive is high-stakes. |
| Question | Future work hook | `Promise.race` abandons `work` after timeout. Production `work` is a no-op, so a late reject cannot happen today. The first async LLM/tool `work` can `unhandledRejection` if it fails after the timeout wins. | `handle-voice-turn.ts`; HTTP path does not pass `work` | **code** on the first non-noop work: cancel or swallow late rejection. Not a current execution path. |
| Question | Live channel | Custom `x-voice-inbound-secret` is not a vendor signature scheme. Optional live smoke may fail closed if Vapi cannot send that header. | `docs/adapters/vapi-inbound.md` | **docs / later adapter**: do not disable auth to make Vapi connect. |

**Prior Major — refuted:** `handleVoiceTurn` now `clearTimeout`s in `finally`. Test `should_not_emit_unhandled_rejection_when_turn_finishes_before_timeout` waits past the timeout budget and asserts no `unhandledRejection`. Spec scenario “Successful turn cancels the handling timer” is implemented.

**Prior Minor (unbounded strings / invalid session logged / missing oversized body) — refuted:** D10 caps (`inputText` 4096, correlation 128, `eventType` 64, body 16 KiB, `sessionId` UUID). Adapter rejects before runtime. Runtime `finish()` omits non-UUID `sessionId`. Contract test covers oversized body without secret leak.

**Refuted (still holds):**

- Prompt injection via transcript: catalog placeholder; `inputText` is not logged and not completed through `LlmPort`.
- Tool abuse / extra tool args / HITL skip / MCP mix-up: no product tools or runtime MCP.
- Domain import of Vapi SDK: architecture + package allowlist tests.
- Secret echo on 401/config/413: tests assert secret not in body; `.env.example` placeholders only.
- Extra vendor fields accepted: `.strict()` + test.
- Auth skip when configured: missing header → 401, runtime not invoked.
- SSRF via `VOICE_PROVIDER_BASE_URL`: health parses URL only; no fetch.
- Eval PASS as security PASS: not used.

### Verdict

**PASS WITH GAPS** (no Blocker, no open Major). Quality `/verify` PASS does not substitute for this review.

Archiving is **advisable** from a security-gate standpoint for this HU’s risk class (deterministic placeholder, no tools, loopback default). Residual Minors are accepted for the next increment, not for this smoke pipe.

Independence caveat: this recheck ran in the same conversation as implementation. That is a process gap, not a remaining Major in the code.

### Recommended next steps (before archive)

1. Human: commit the change without `.env` if you want a durable review baseline.
2. `/opsx-archive` is allowed on PASS WITH GAPS.
3. On the first product agent/tools HU: signed inbound + freshness; cancel late `work` rejections; do not reuse static header-only auth as the sole control.
