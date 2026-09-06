## Adversarial review

**Scope**: OpenSpec change `runtime-observability` (HU #007). Working-tree observability diff on `feature/runtime-observability`, not the archived evaluation-gate commit that shares history with `origin/main`.

**Sources**: `openspec/changes/runtime-observability/{proposal,design,tasks,specs/**}`; `lidr-specboot/docs/base-standards.md` and `backend-standards.md` (Security / Observability); `git diff` of observability files vs HEAD; `src/adapters/observability/logging-observability.ts`, `json-logger.ts`, `handle-voice-turn.ts`, `handle-agent-turn.ts`, `create-server.ts`, `inbound.ts` (`MAX_CORRELATION_CHARS = 128`). `/verify` quality PASS was not treated as a security PASS.

**Independence**: This review ran in the same conversation that implemented the change. That weakens independence; a fresh-session re-review is still preferred before treating the verdict as fully independent.

### Spec and task alignment

Acceptance: one `traceId` reconstructs request + turn + LLM/tool/retrieval; default emit is structured metadata; secrets and raw utterances stay off the default path; no vendor SDK; no Trace tables.

Non-goals: dashboard, business analytics, 24/7 monitoring, Langfuse, trace-query HTTP, agent/RAG/voice behavior change.

HITL: none specified (no new side-effecting tools). Security-relevant non-goal: default adapter must not log full user text, unredacted tool args, or chunk bodies.

Spec vs code: voice-interaction still requires a timestamp on correlatable logs; `voice.turn` still omits `occurredAt`. Not an exploit. Default adapter drops `argumentsRedacted` / `resultBounded` as designed (D4). Production composition uses `JsonLogger` + `LoggingObservability`.

### Findings

| Severity | Area | Finding | Evidence | Suggested fix |
| --- | --- | --- | --- | --- |
| Minor | Traces / future adapter | Retrieval spans still attach `argumentsRedacted.query = redactSecrets(userText)` (caller speech minus secret *shapes*). Default logging adapter omits that field (tested). A later “platform” adapter that forwards the port object would export utterances. This change advertises vendor-ready emit without hashing/bounding the query on the port. | `handle-agent-turn.ts` retrieve emit; `logging-observability.ts` field allowlist; prior RAG review residual; spec allows query on the port for collectors | **code/OpenSpec**: hash or bound query on the span before emit, or state that collecting adapters MUST drop `argumentsRedacted.query` |
| Minor | Untrusted correlation | Inbound `requestId` / `interactionId` (max 128 on HTTP) are copied onto `voice.turn`, the `http` span, and every child span. `redactSecrets` covers only known shapes (`sk-`, Bearer, `*_API_KEY=`, postgres URLs). A partner or attacker can plant a token or PII-shaped string that is not those patterns; logs now repeat it more times. `traceId` is server-generated (good). | `inbound.ts` limits; `handle-voice-turn.ts` / `create-server.ts` copy-through; `redact.ts` patterns; no test that a secret-shaped `requestId` is redacted on the *composed* JsonLogger+LoggingObservability path | **tests**: compose logger+adapter with `requestId=sk-…`; **docs**: join runs by `traceId` only; consider hashing caller correlation ids |
| Minor | Spec vs code | Modified voice-interaction requirement still requires timestamp; implementation does not emit `occurredAt`. | `specs/voice-interaction/spec.md` vs `handle-voice-turn.ts` finish logs | **OpenSpec** or **code**: drop timestamp from the requirement or add a safe ISO field |
| Question | Process | Review is not a fresh session from the implementer. | This chat implemented `/opsx-apply` | Re-run `/adversarial-review` in a new session if archive policy requires independence |

### Surfaces considered (no additional finding)

- Prompt injection / tool abuse / MCP / HITL: no new tools, prompts, hops, or runtime MCP.
- AuthZ: inbound secret and rate limit unchanged; no new query API for traces.
- Default emit: tests refute logging of `normalizedText`, raw tool args, `sk-proj` inside dropped payloads, and invalid raw session ids.
- JSON log injection: `JsonLogger` uses `JSON.stringify`.
- No Trace/Span tables; no vendor SDK in manifests (declared).

### Verdict

**PASS WITH GAPS**

No Blocker or Major on the default production emit path. Residual risk is (1) query text still living on the port for a future retaining adapter and (2) caller-controlled correlation ids repeated in logs with incomplete secret shapes.

Archiving advisable: **Yes** (PASS WITH GAPS). Quality `/verify` PASS does not replace this.

### Recommended next steps (before archive)

1. Optional hardening (same change or follow-up): stop putting raw `userText` on `argumentsRedacted.query`; add a composed redaction test for `requestId`.
2. If independence is required, repeat this review in a fresh session.
3. Do not treat this as clearance to ship a collecting/vendor observability adapter without a new review.
