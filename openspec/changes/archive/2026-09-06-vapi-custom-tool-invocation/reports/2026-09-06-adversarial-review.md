## Adversarial review

**Scope**: OpenSpec change `vapi-custom-tool-invocation` — `POST /adapters/voice/tools`, `executeChannelToolInvocation`, WOM allowlist binding, shared-secret auth, `VOICE_REASONING_OWNER` dual-brain guard, ToolCall / observability persistence (`invocation_source`), session-report reconstructability on memory and Supabase hydrate paths.

**Sources**:
- Specs: `proposal.md`, `design.md`, `tasks.md`, delta specs under `openspec/changes/vapi-custom-tool-invocation/specs/`
- Standards: `lidr-specboot/docs/base-standards.md` (security by design, controlled autonomy), `lidr-specboot/docs/backend-standards.md` (Tool calling, Security), skill `adversarial-review`
- Prior FAIL claims (re-verified, not trusted): `reports/2026-09-06-adversarial-review.md` (prior FAIL), `…-adversarial-remediation.md`, `…-adversarial-remediation-2.md`, superseded post-remediation note
- Implementation: uncommitted/untracked work on `feature/vapi-custom-tool-invocation` vs merge base `feature/evaluation-public-demo` (`1b4e0f3`)
- Targeted tests re-run (2026-09-06): `execute-channel-tool-invocation.test.ts`, `voice-tools.test.ts`, `supabase-persistence.test.ts`, `eval/vapi-channel-tools` — **4 files, 23 passed** (quality evidence only; does not alone grant security PASS)

### Spec and task alignment

**Acceptance (security-relevant):**
- Authenticated Custom Tool ingress; reject unauth / invalid / oversized without execution or secret leak
- Path must not invoke `handleAgentTurn` / conversational agent loop
- Allowlist only three `wom.*` tools; deny `demo.*` and unknowns fail-closed; strict empty-object schemas
- Hard timeout ≈2s; never return fabricated success business payloads
- Persist ToolCalls with bounded **validated** arguments and `invocation_source: vapi_custom_tool`; no secrets/stack traces; no attacker keys on session `toolCalls` **or** `trace`
- Observability: shared `traceId`, latency/status, invocation-source metadata; raw args/secrets not in default emit
- `VOICE_REASONING_OWNER=vapi` disables agent reasoning on inbound transcript while lifecycle/EOC persist

**Non-goals (accepted residuals):** multi-tenant RBAC, runtime MCP, live WOM APIs, dedicated tool secret (design D3 allows shared inbound secret)

**Underspecified / residual risk called in design:** shared secret blast radius; dual-brain if `VOICE_REASONING_OWNER` left at default `runtime`; spoken honesty after tool failure is Vapi-prompt owned; no toolCallId idempotency / freshness on tools route.

**Prior Majors (remediation-2) — independent re-check:** both addressed in current code + tests (see Refuted).

### Findings

| Severity | Area | Finding | Evidence | Suggested fix |
| --- | --- | --- | --- | --- |
| Minor | Auth / secret hygiene | Tools and inbound share `VOICE_INBOUND_SECRET` — one leak opens lifecycle + tool execution. | Design D3; both routes call `authenticateInbound`; docs note shared secret. Acceptable for interview demo non-goal. | Optional later `VOICE_TOOL_SECRET` (**docs**/config); keep documented until then. |
| Minor | Dual-brain / config | Default `VOICE_REASONING_OWNER=runtime`; Custom Tools + inbound without `vapi` can dual-process. | `load-config.ts` default; `.env.example` still `runtime`; `render.yaml` sets `vapi`; docs warn. | Keep deploy checklist; optional fail-closed if tools route used while owner=`runtime` (**code**/OpenSpec). |
| Minor | Replay / DoS | No freshness/idempotency on provider `toolCallId`; duplicate ToolCalls possible; shared rate bucket with inbound. Channel `Promise.race` does not abort a hanging executor after hard-timeout response (NativeToolPort has its own AbortController for normal paths). | No `assertInboundFreshness` on tools; hanging test returns fail-closed without AbortSignal to deps. Read-only canned tools reduce impact. | Document residual; later idempotency by `(externalChannelId, toolCallId)` (**OpenSpec**/code). |
| Minor | Maintainability | `persistSpan` skips duplicate ToolCall write via hardcoded `span.source !== "vapi_custom_tool"` instead of `CHANNEL_TOOL_INVOCATION_SOURCE`. Drift would double-persist. | `persist-execution.ts` literal vs `load-config.ts` constant (currently equal). | Import/use the constant (**code**). |
| Question | Channel honesty | Failures return as Vapi `results[].result` strings under HTTP 200; spoken fabrication after failure depends on Vapi system prompt. | `mapChannelToolOutcomesToVapi`; design/Open Questions; WOM honesty is operator DoD. | Operator DoD prompt honesty (**docs**); not a backend Blocker for this demo. |
| Question | Hosted ops | Supabase/Postgres must apply `supabase/migrations/20260906220000_tool_call_invocation_source.sql` or writes that set `invocation_source` may fail and fall back. | Migration present; hydrate + write code assume column. | Confirm migration applied on hosted demo (**ops**/docs). |

### Refuted

| Claim | Verdict |
| --- | --- |
| **Prior Major** — attacker argument keys in session `trace` via `argumentsRedacted` | **Refuted** — channel path always emits `argumentsRedacted: persistedToolArguments()` → `{}`; unit test `should_not_persist_attacker_fields_on_deny_or_invalid_args` asserts empty keys on `trace` and forbids attacker tokens in `JSON.stringify({ toolCalls, trace })` |
| **Prior Major** — Supabase drops `invocation_source` on hydrate | **Refuted** — `getSessionReport` maps `tool.invocation_source` → `invocationSource`; `should_round_trip_invocation_source_on_getSessionReport` passes with mocked fetch |
| Auth bypass when secret configured | **Refuted** — timing-safe shared secret; missing/wrong secret → 401; wrong-secret test asserts no secret echo; empty/missing config → CONFIG (no open tools) |
| Allowlist escape / `demo.*` on tools route | **Refuted** — dedicated `channelTools` bound to `WOM_CUSTOMER_SERVICE_ALLOWLIST` (not `dependencies.tools`); unit/HTTP/eval deny cases; WOM inputs `.strict()` empty object |
| Tools path runs `handleAgentTurn` | **Refuted** — composition never passes `runAgent`; use case throws if injected; eval asserts reject |
| Dual-brain when `VOICE_REASONING_OWNER=vapi` | **Refuted** — inbound `skipAgentReasoning`; empty reply on transcript (`voice-tools.test.ts`) |
| Timeout returns canned success business payload | **Refuted** — fail-closed timeout/deny/invalid outcomes; no success payload on timeout |
| Raw attacker **values**/keys in `ToolCall.arguments` | **Refuted** — `persistedToolArguments()` always `{}` on success and failure |
| Secrets in `web/` / Vite | **Refuted** — secret-hygiene tests; `.env.example` empty keys; `render.yaml` sync:false |
| Oversized body / wrong secret contract gaps | **Refuted** — `voice-tools.test.ts` 401 + 413 cases |
| Uncleared hard-timeout timer | **Refuted** — `clearTimeout` in `finally` |
| `dependencies.tools` widens channel allowlist | **Refuted** — tools route always uses separate `channelTools` WOM port |

### Verdict

**PASS WITH GAPS**

No open Blocker or Major after independent re-verification of remediation-2. Remaining items are documented residuals / ops questions aligned with non-goals. Quality `/verify` PASS was **not** used as a substitute for this review.

Archiving is **advisable** with gaps accepted (shared secret, default reasoning-owner misconfig risk, replay/timeout residual, channel prompt honesty, migration apply).

### Recommended next steps (before archive)

1. Accept Minors/Questions as interview-demo residuals (or harden shared secret / reasoning-owner fail-closed in a follow-up change).
2. Confirm hosted apply of `invocation_source` migration before relying on Supabase session reports in production demo.
3. Optionally import `CHANNEL_TOOL_INVOCATION_SOURCE` in `persistSpan` to avoid literal drift.
4. Proceed to `/opsx-archive` if product accepts the residual risk list above.
