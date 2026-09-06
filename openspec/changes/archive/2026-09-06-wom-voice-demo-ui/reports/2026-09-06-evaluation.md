# Verification Report - Evaluation (`/verify`)

- Date: 2026-09-06
- Change: `wom-voice-demo-ui`
- Agent: evaluation-engineer
- Change types: `ui` | `voice` | `code`
- Context: Re-run after adversarial remediations (section 8)
- Gate: `openspec` (`/verify`; runner local default recorded `manual` in `eval/gate/last-run.json`)

## Verdict

**PASS**

Quality PASS is not a security PASS. Independent `/adversarial-review` already ran (PASS WITH GAPS); remediations are recorded in `2026-09-06-adversarial-remediation.md`.

## EvaluationRun

| Field | Value |
| --- | --- |
| id | `cdf056bc-0002-4f11-b7b3-b51130b75b25` |
| suiteName | `evaluation-quality-gate` |
| datasetVersion | `runtime-demo:2026-09-05.5\|knowledge:2026-09-05.1\|voice:2026-09-05.1\|runtime-multi-agent:2026-09-05.2\|wom-customer-service:2026-09-06.2` |
| agentVersionId | null (no new agent version) |
| promptVersionId | `runtime-demo@2` (gate primary pin; WOM suite separately `wom-customer-service-agent@1`) |
| model | `fake` (no paid model) |
| status | `passed` |
| startedAt / endedAt | `2026-09-06T17:31:08.208Z` / `2026-09-06T17:31:08.209Z` |
| gate | `manual` (process env); this report is the OpenSpec `/verify` record |

Threshold: every required `eval/gate/baseline.json` case executed with `pass: true` and `value: 1`. No cases dropped. Suite version pins unchanged. No new quality-gate member for the UI.

## Commands executed

- `npm test` — 282 passed, 57 files, 36.75s
- `npm --prefix web test` — 20 passed, 6 files, 28.89s
- `npm --prefix web run typecheck` — PASS
- `npm run test:eval-gate` — status `passed` (run `cdf056bc-0002-4f11-b7b3-b51130b75b25`)
- Targeted: `npx vitest run` health + inbound + OpenAPI + observability + `eval/voice` + `eval/wom-customer-service` + isolation + secret-hygiene — 48 passed, 10 files
- `docker compose exec … public_tables` — pre `0`, post `0`; no Session / ConversationTurn / ToolCall tables
- `npm run typecheck` (root) — FAIL, pre-existing `exactOptionalPropertyTypes` errors outside this change (not the eval threshold)

Paid APIs: none. Live Vapi / microphone: not used. `web/.env`: absent.

## Gates by change type

| Type | Gate | Result |
| --- | --- | --- |
| code | Unit + DB | PASS — 282 root tests; `public_tables=0`; no Session/ConversationTurn/ToolCall tables |
| api | New product HTTP | N/A — no new routes. Inbound regression PASS |
| tools | Tool calling | N/A — no schema/executor change. Existing WOM/demo tool cases still in the gate |
| agent / prompt | New behavior suite | N/A — no prompt/policy change. Regression: `wom-customer-service` + `runtime-first-agent` required cases PASS |
| rag | New retrieval suite | N/A — `knowledge` (`2026-09-05.1`) regression only |
| voice | Conversation fixtures | PASS — inbound suite `vapi-voice-interaction-adapter-voice` / `2026-09-05.1` (5/5 `voice_contract_ok`). UI call machine: idle→connecting→active→ending→completed, error, and 8s connecting timeout (mocked SDK, no live audio) |
| ui | E2E | PASS — Testing Library full-page flows including remediations (consent, honest status, timeout retry). No Playwright |
| production path | Observability | PASS — inbound mocked turns still emit shared `traceId` and agent/prompt identity. No new UI trace pipeline (HU #011) |

## Suite versions (baseline pins)

| Suite | datasetVersion | promptVersion |
| --- | --- | --- |
| runtime-first-agent | 2026-09-05.5 | runtime-demo@2 |
| rag-foundation-retrieval | 2026-09-05.1 | — |
| vapi-voice-interaction-adapter-voice | 2026-09-05.1 | — |
| runtime-multi-agent | 2026-09-05.2 | demo-normalize@1,demo-classify@1 |
| wom-customer-service | 2026-09-06.2 | wom-customer-service-agent@1 |

## UI / voice-state scores (deterministic)

Metric `ui_call_state_ok` = 1, pass = true, for:

- idle chrome + capabilities + suggested prompts do not start a call
- status does not claim a verified backend (`Listo para iniciar`)
- honest microphone-provider consent
- connecting feedback + disabled duplicate start
- connecting timeout (8s) → safe error + start enabled
- active LIVE + transcript + tool label + end control
- ending does not complete before call-end
- completed summary + HU #011 placeholder
- error copy contains no secrets
- transcript bounded (2048 / 50); tool events only `function-call` \| `tool-calls`
- no `localStorage` / `sessionStorage` in `web/src`

## Out of scope / not blocking `/verify`

- Live browser Vapi smoke: SKIP (no `web/.env` credentials). Required for human Definition of Done, not this quality gate.
- Root `tsc --noEmit`: pre-existing `exactOptionalPropertyTypes` failures outside this change.
- `/adversarial-review`: separate from this quality verdict (already executed).

## Outcome

- Status: **PASS**
- Blocking issues: none for quality
- Next: `/opsx-archive` for a **local demo** only after accepting live-smoke SKIP, or run the interview runbook when credentials exist
