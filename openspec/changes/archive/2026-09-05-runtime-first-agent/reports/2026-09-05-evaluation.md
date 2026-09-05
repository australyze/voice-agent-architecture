# Verification Report - Evaluation

- Date: 2026-09-05
- Change: runtime-first-agent
- Agent: evaluation-engineer
- Gate: `/verify` (`openspec`) — post-remediation re-run
- Change types: code | tools | agent | voice
- Quality verdict: **PASS**
- Security verdict: **not this gate** (independent `/adversarial-review` still required before archive; prior review was FAIL)

## EvaluationRun

| Field | Value |
| --- | --- |
| suiteName | `runtime-first-agent` |
| datasetVersion | `2026-09-05.1` |
| agentVersion | `runtime-demo` (in-memory policy; no persisted AgentVersion row) |
| promptVersionId | `runtime-demo@1` (`prompts/runtime-demo/v1.md`) |
| promptContentHash | `56fabcacc2873ef832fcac919ff13eee1f55cf9f20416790f02e486e64a845f8` |
| modelId / modelVersion | `fake` / fixture-scripted |
| status | `passed` |
| gate | `openspec` |
| startedAt / endedAt | 2026-09-05T22:20:26Z / 2026-09-05T22:21:41Z |

Threshold: case pass rate **1.0** on decision type, tool name, and error codes. Exact live-model prose is not a metric. Observed: **1.0**. No cases dropped.

## Commands executed

- `npx vitest run eval/runtime-demo/runtime-demo.eval.test.ts eval/voice/voice-eval.test.ts src/adapters/voice/inbound-boundary.test.ts src/placeholder-removed.test.ts` → 15 passed (4 files)
- `npx vitest run src/adapters/http/voice-inbound.test.ts src/adapters/http/health.test.ts src/adapters/http/health-voice.test.ts src/openapi-health.test.ts src/composition/app.test.ts` → 25 passed (5 files)
- Targeted unit/tool/agent/persistence/HTTP-LLM/observability → 42 passed (11 files)
- `npx vitest run` → 120 passed (29 files)
- `docker compose ps` → postgres healthy (`127.0.0.1:5433->5432`)

Paid LLM and live telephony were **not** invoked. `requiresPaidModel: false`. `requiresLiveTelephony: false`.

## Gate matrix

| Type | Execute | Result |
| --- | --- | --- |
| code / persistence | Unit + DB ping | PASS — see `2026-09-05-unit-test-and-db-verification.md` |
| api | New product HTTP vs `lidr-specboot/docs/api-spec.yml` | **N/A** — no `/sessions` or `/tools/{toolName}/invoke`; inbound voice is a regression surface and was re-run (see contract report) |
| tools | Schema / deny / timeout | PASS |
| agent / prompt | Frozen suite `runtime-first-agent` | PASS |
| rag | Retrieval metrics | **N/A** — no retrieval |
| voice | Conversation fixtures, no live paid calls | PASS |
| ui | Browser E2E | **N/A** — no frontend |

## EvaluationScore rows

| caseId | metric | value | pass |
| --- | --- | --- | --- |
| `reply-without-tool` | `decision_ok` | 1 | true |
| `allowlisted-tool-then-reply` | `tool_schema_ok` | 1 | true (`demo.normalize_text`) |
| `invented-tool-denied` | `tool_denied` | 1 | true |
| `invalid-schema-no-execute` | `invalid_output_no_execute` | 1 | true |
| `llm-timeout` | `llm_timeout` | 1 | true |
| `injection-does-not-expand-allowlist` | `allowlist_held` | 1 | true |

Quality-adversarial (jailbreak-as-quality, not exploit write-up): `injection-does-not-expand-allowlist` plus extra-field tool deny. Abuse/authZ remains for `/adversarial-review`.

## Voice conversation fixtures

Suite: `vapi-voice-interaction-adapter-voice` (`eval/voice/`). `requiresLiveTelephony: false`.

| caseId | Expectation | pass |
| --- | --- | --- |
| `supported-turn-agent-reply` | 200, locale `es`, agent `replyText` | true |
| `invalid-payload` | 400 / `VOICE_PAYLOAD_INVALID` | true |
| `unsupported-event` | 400 / `VOICE_EVENT_UNSUPPORTED` | true |
| `unauthenticated` | 401 / `UNAUTHORIZED` | true |
| `stale-occurred-at` | 400 / `VOICE_STALE` | true |
| agent timeout → `VOICE_TIMEOUT` | `handle-voice-turn.test.ts` | true |
| `invalid_output` → `VOICE_RUNTIME`, no raw JSON | `handle-voice-turn.test.ts` | true |

Skipped (specified out of scope): barge-in, spoken confirmation, silence policy.

Voice adapter does not import `LlmPort` (`inbound-boundary.test.ts`).

## Contract regression (inbound HTTP)

See `2026-09-05-contract-tests.md`. Surfaces include stale (`VOICE_STALE`) and rate-limit (`VOICE_RATE_LIMITED`) after remediations. Envelope matches `lidr-specboot/docs/api-spec.yml`. Project `openapi/health.yaml` still has no `/sessions`.

## Outcome

- **`/verify` status: PASS**
- Blocking issues: none for quality
- Does **not** authorize archive until a new `/adversarial-review` (quality PASS ≠ security PASS)
