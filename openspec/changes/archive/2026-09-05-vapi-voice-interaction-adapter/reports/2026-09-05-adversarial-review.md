# Adversarial review

**Scope**: OpenSpec change `vapi-voice-interaction-adapter` (code + api + voice). New inbound HTTP surface `POST /adapters/voice/inbound`, `GET /health/voice`, optional voice config, deterministic placeholder runtime. No product agent, tools, RAG, or UI.

**Sources**: Proposal, design, delta specs (`voice-interaction`, `voice-channel-adapter`, `health-checks`, `application-runtime`, `provider-ports`), `tasks.md`; `lidr-specboot/docs/base-standards.md` and `backend-standards.md` (Security, MCP); working tree vs merge-base `origin/main` (`a60edf7`). **No PR.** Branch `feature/vapi-voice-interaction-adapter` has **zero commits** of this change (implementation is uncommitted). `/verify` quality PASS was not treated as a security PASS. Reviewer is in the same conversation as `/apply` (independence gap noted).

## Spec and task alignment

**Accepted / in scope:** inbound-only adapter; shared-secret auth when configured; strict payload; unsupported events rejected; runtime independence; no Vapi types in domain; logs correlatable without secrets or raw bodies; voice not required for readiness; engineer/QA smoke only.

**Non-goals:** customer number, outbound call, LLM/agent/tools/RAG, session persistence, barge-in/confirmation, live Vapi as DoD.

**Security/HITL underspecified:** no max field lengths, no body-size bound, no webhook timestamp/nonce, no rate limit. HITL reserved and correctly unused (no tools). Dual MCP not introduced.

**AI surfaces:** no prompt, no tools, no retrieval. Transcript `inputText` is not echoed and not sent to an LLM. Prompt injection and tool abuse have no current execution path.

---

## Adversarial review
**Scope**: see above
**Sources**: see above

### Spec and task alignment
See above. `tasks.md` 9.9 claims oversized JSON was exercised; tests cover extra fields and malformed JSON only.

### Findings

| Severity | Area | Finding | Evidence | Suggested fix |
| --- | --- | --- | --- | --- |
| Major | Availability / inbound | Every successful `handleVoiceTurn` starts a `setTimeout` in `Promise.race` and never clears it. When work wins, the timeout still rejects later → timer leak and `unhandledRejection` on the orphaned promise. Authenticated callers can pile timers (default 2000 ms each). | `src/application/handle-voice-turn.ts` lines 61–68; no `clearTimeout`; no test that the timer is cancelled | **code + tests**: cancel the timer when work completes; add a test that a successful turn does not emit `unhandledRejection` |
| Minor | Validation / tests | Inbound strings (`inputText`, `sessionId`, `requestId`, `interactionId`) have no max length. Fastify default `bodyLimit` is implicit, not asserted. Task 9.9 listed oversized JSON; no test sends an oversized body. Invalid `sessionId` is still written to logs via `finish()`. | `inbound.ts` zod schema; `handle-voice-turn.ts` `finish` before/after UUID check; `voice-inbound.test.ts` has no size case | **code + tests + OpenSpec**: cap lengths; reject before log; add an oversized-body case; tighten 9.9 |
| Minor | Auth | Shared static header secret, no timestamp/nonce. Replay is harmless today (placeholder only) and becomes dangerous on the first side-effecting agent. | `authenticateInbound`; design D4 | **OpenSpec** for the next agent HU: signed webhook + freshness; do not reuse this header as the only control |
| Minor | Health | `GET /health/voice` is unauthenticated and distinguishes configured vs not. Spec + foundation loopback exception. Residual if `LISTEN_HOST=0.0.0.0`. | `create-server.ts`; health-checks delta | **docs** already warn; keep loopback default; do not treat this probe as public |
| Question | Process | Change is uncommitted; merge-base diff of tracked files is incomplete without the untracked tree. Same chat as `/apply`. | `git status`; `HEAD == origin/main` | Human: commit without `.env`; prefer a second-session review if archive is high-stakes |
| Question | Live channel | Custom `x-voice-inbound-secret` is not a vendor signature scheme. Optional live smoke may fail closed or skip auth if miswired. | `docs/adapters/vapi-inbound.md` | **docs / later adapter note**: do not disable auth to make Vapi connect |

**Refuted (evidence):**

- Prompt injection via transcript: reply is catalog text; `inputText` is not logged and not completed through `LlmPort`.
- Tool abuse / extra tool args / HITL skip: no product tools.
- Dev vs runtime MCP mix-up: no runtime MCP.
- Domain import of Vapi SDK: architecture + package allowlist tests.
- Secret echo on 401/config errors: tests assert secret not in body.
- Extra vendor fields accepted: `.strict()` + test.
- Auth skip when configured: missing header → 401, runtime not invoked.

### Verdict

**FAIL** (one Major). `/verify` quality PASS does not change this. Archiving is **not** advisable until the timeout/`unhandledRejection` defect is specified and fixed in a **new** `/apply` pass.

### Recommended next steps (before archive)

1. Update OpenSpec (`handleVoiceTurn` timeout cancellation; optional inbound field bounds) then implement in a new apply session — do not silently patch from this review.
2. Re-run `/verify` on the timeout and bounds tests.
3. Re-run `/adversarial-review` in a different session if possible.
4. Then `/opsx-archive`.
