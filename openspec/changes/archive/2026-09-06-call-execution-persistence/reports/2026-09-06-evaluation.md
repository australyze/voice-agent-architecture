# Evaluation Report — call-execution-persistence

- Date: 2026-09-06
- Change: `call-execution-persistence`
- Phase: `/verify` (after section 10 session-read auth remediations)
- Agent: evaluation-engineer
- Branch: `feature/call-execution-persistence`
- Change types: `code`, `api`, `voice`, `ui`
- Verdict: **PASS**

This report supersedes the earlier same-day `/verify` write-up. Quality PASS is not a security PASS. Independent `/adversarial-review` in a **fresh** session is still required before `/opsx-archive`.

## EvaluationRun

Recorded from `npm run test:eval-gate` writing `eval/gate/last-run.json` (gate `manual`).

| Field | Value |
| --- | --- |
| id | `190fcc65-c137-414b-a084-baf1204b97bb` |
| suiteName | `evaluation-quality-gate` |
| datasetVersion | `runtime-demo:2026-09-05.5\|knowledge:2026-09-05.1\|voice:2026-09-05.1\|runtime-multi-agent:2026-09-05.2\|wom-customer-service:2026-09-06.2` |
| agentVersionId | `null` |
| promptVersionId | `runtime-demo@2` (WOM member: `wom-customer-service-agent@1`; multi-agent: `demo-normalize@1`, `demo-classify@1`) |
| modelId | `fake` (knowledge embeddings `fake-embed`) |
| status | `passed` |
| gate | `manual` |
| startedAt | `2026-09-06T18:19:30.303Z` |
| endedAt | `2026-09-06T18:19:30.304Z` |
| scores | 46 recorded, 46 `pass: true`, value `1` on every case |

Threshold: every `eval/gate/baseline.json` required case must `pass === true` and `value === 1`. No cases were dropped and no thresholds were lowered.

## Gate matrix

| Type | Required for this change | Result | Evidence |
| --- | --- | --- | --- |
| code / persistence | Yes | PASS | `npm test` — 296 passed / 60 files; Compose `public_tables` 0 → 0 |
| api | Yes | PASS | `sessions.test.ts` (401/503/200/400/404 + `externalChannelId` filter); inbound lifecycle; OpenAPI fragment |
| tools | N/A | N/A | No tool schema/executor/allowlist change |
| agent / prompt | Regression only | PASS | Existing quality gate; no new prompt/policy cases |
| rag | Regression only | PASS | Frozen knowledge cases in the same gate |
| voice | Yes (existing fixtures) | PASS | `eval/voice` `2026-09-05.1` — 5/5 `voice_contract_ok` |
| ui | Yes | PASS | `npm run web:test` — 23 passed; Playwright N/A |

## Commands executed (this verify session)

| Command | Result |
| --- | --- |
| `git branch --show-current` | `feature/call-execution-persistence` |
| `docker compose ps` | postgres Up (healthy), `127.0.0.1:5433` |
| `psql` pre | ping `1`; `public_tables = 0` |
| `npm test` | 296 passed, 0 failed |
| `npm run test:eval-gate` | `status: passed` |
| `npm run web:test` | 23 passed |
| `npx vitest run` sessions + inbound + `eval/voice` + hygiene | executed as part of default suite / targeted files |
| `psql` post | `public_tables = 0` |

Paid APIs: none. Live telephony: not run. Hosted Supabase: not configured.

## Code / persistence

Default suite uses in-memory `PersistencePort`. Compose Postgres is readiness ping only.

- Pre/post public table count: 0 / 0
- Restored: yes
- Hosted writes: not exercised

See also `2026-09-06-unit-test-and-db-verification.md` and `2026-09-06-session-read-auth.md`.

## API contract (including section 10)

Aligned with project `openapi/health.yaml` and canonical `/sessions` resources.

- Unauthenticated `GET /sessions` and `GET /sessions/{id}` — 401 `unauthorized`, no transcript
- No demo-operator secret configured — 503 `orchestration_config`
- Authenticated list/detail — 200; `evaluation: null`; no credentials in body
- `GET /sessions?externalChannelId=` — matching session only
- Malformed id — 400 `SESSION_ID_INVALID`; unknown UUID — 404 envelope
- Inbound `call_started` / `call_ended` / `transcript` — unchanged auth/skew/size; lifecycle does not invoke the agent

## Voice fixtures

Frozen set: `eval/voice/cases.json`, `datasetVersion: 2026-09-05.1`, `requiresLiveTelephony: false`.

| caseId | metric | value | pass |
| --- | --- | --- | --- |
| `vapi-voice-interaction-adapter-voice/supported-turn-agent-reply` | `voice_contract_ok` | 1 | true |
| `vapi-voice-interaction-adapter-voice/invalid-payload` | `voice_contract_ok` | 1 | true |
| `vapi-voice-interaction-adapter-voice/unsupported-event` | `voice_contract_ok` | 1 | true |
| `vapi-voice-interaction-adapter-voice/unauthenticated` | `voice_contract_ok` | 1 | true |
| `vapi-voice-interaction-adapter-voice/stale-occurred-at` | `voice_contract_ok` | 1 | true |

No new conversation-eval cases (no barge-in / spoken-UX change).

## UI

- Vitest + Testing Library (Playwright not wired)
- Completed fetch skipped without `externalChannelId` (no `limit=1`)
- Loaded path sends `x-demo-orchestrate-secret` and looks up by channel id
- 401 → unavailable copy

## Observability smoke

Inbound persist still asserts stored `traceId` after a successful transcript turn. `LoggingObservability` remains under `PersistingObservability`. Quality-gate workflow span `evaluation-gate` emitted for this run (`traceId` = EvaluationRun id).

## Regression quality scores

All 46 gate scores passed. Suites unchanged:

| Suite | Dataset | Role |
| --- | --- | --- |
| runtime-first-agent | `2026-09-05.5` | regression |
| rag-foundation-retrieval | `2026-09-05.1` | regression |
| vapi-voice-interaction-adapter-voice | `2026-09-05.1` | required voice |
| runtime-multi-agent | `2026-09-05.2` | regression |
| wom-customer-service | `2026-09-06.2` | regression |

## N/A with reason

- **Tools gate:** no schema/deny/timeout change
- **New agent/prompt suite:** no generative policy change
- **New RAG suite:** no retrieval change
- **Playwright E2E:** runner not present
- **Hosted Supabase integration:** credentials unset
- **Live paid calls:** not configured

## Blocking issues

None for `/verify` quality.

## Next

Fresh-session `/adversarial-review` before archive. Prior review FAIL was against unauthenticated GETs and latest-global fetch; those controls are now specified and tested, but this report does not re-grade security.
