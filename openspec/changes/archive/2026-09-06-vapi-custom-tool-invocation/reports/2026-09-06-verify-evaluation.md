# Verification Report - Evaluation (/verify)

- Date: 2026-09-06
- Change: `vapi-custom-tool-invocation`
- Agent: evaluation-engineer
- Phase: `/verify` (post-adversarial remediation-2)
- Change types: `code` | `api` | `tools` | `voice`

## Gate selection

| Gate | Applicable | Result |
| --- | --- | --- |
| Unit + persistence | Yes | **PASS** (58 combined; 16 persistence supplemental) |
| Contract (HTTP tools) | Yes | **PASS** (7/7) |
| Tool calling | Yes | **PASS** (allowlist / invalid / timeout / deny / empty args / no attacker fields in toolCalls+trace) |
| Voice / channel-tool fixtures | Yes | **PASS** (`vapi-channel-tools` dataset v1) |
| Observability smoke | Yes | **PASS** (`invocation_source`, latency, shared `traceId`, empty `argumentsRedacted`) |
| WOM agent regression | Yes (unchanged surface) | **PASS** |
| RAG | N/A — no retrieval change | — |
| UI E2E | N/A — no frontend change | — |
| Adversarial security | Separate `/adversarial-review` | Not part of quality PASS; remediation-2 + prior review notes exist |

## EvaluationRun (channel tools)

| Field | Value |
| --- | --- |
| suite | `vapi-channel-tools` |
| dataset | `eval/vapi-channel-tools/cases.json` |
| datasetVersion | `1` |
| promptId / promptVersion | n/a (channel LLM is Vapi-owned; runtime executes tools only) |
| modelId / modelVersion | n/a (ToolPort + canned WOM directory; fake path) |
| agentId | `wom-customer-service-agent` (allowlist binding) |
| cases | 5 fixtures + dual-brain guard + load check |
| scores | 7/7 tests passed (100%) |
| thresholds | Every fixture `ok`/`code`/`invocationSource` assertion must pass; `runAgent` must be rejected |
| gateResult | **PASS** |

### Fixture outcomes

| Case id | Expected | Observed |
| --- | --- | --- |
| channel-usage-tool | ok + `invocationSource=vapi_custom_tool` | PASS |
| channel-bill-tool | ok + invocationSource | PASS |
| channel-service-tool | ok + invocationSource | PASS |
| channel-deny-normalize | `tool_denied` | PASS |
| channel-invalid-args | `tool_invalid_args` | PASS |
| dual-brain guard | reject `runAgent` | PASS |

## EvaluationRun (WOM regression)

| Field | Value |
| --- | --- |
| suite | `wom-customer-service` |
| dataset | `eval/wom-customer-service/cases.json` (frozen) |
| model | fake LLM (scripted) |
| gateResult | **PASS** (suite metadata + every frozen case) |

## Commands executed

```text
npx vitest run \
  src/application/execute-channel-tool-invocation.test.ts \
  src/adapters/http/voice-tools.test.ts \
  src/application/load-config.test.ts \
  src/application/handle-voice-turn.test.ts \
  src/adapters/persistence/memory-persistence.test.ts \
  eval/vapi-channel-tools/vapi-channel-tools.eval.test.ts \
  eval/wom-customer-service/wom-customer-service.eval.test.ts
```

- Result: **58 passed**, 0 failed
- Runtime: ~4.2s
- Paid Vapi / live LLM: not used

Persistence supplemental (includes remediation-2 Supabase hydrate):

```text
npx vitest run \
  src/application/execute-channel-tool-invocation.test.ts \
  src/adapters/persistence/memory-persistence.test.ts \
  src/adapters/persistence/postgres-persistence.test.ts \
  src/adapters/persistence/supabase-persistence.test.ts
```

- Result: **16 passed**, 0 failed (~1.9s)

### Remediation-2 focused cases

| Case | Result |
| --- | --- |
| Trace `argumentsRedacted: {}` — no attacker keys in `toolCalls` + `trace` | PASS |
| Supabase `invocation_source` → `invocationSource` round-trip (mocked fetch) | PASS |
| Wrong secret → 401, no secret echo | PASS (prior remediation, still green) |
| Oversized body → 413 | PASS (prior remediation, still green) |
| Persisted args `{}` / no attacker fields | PASS |

## Observability smoke

- Channel path emits `http.voice.tools` + `kind: tool` with `source: vapi_custom_tool`, latency, shared `traceId`
- Session `ToolCall.invocationSource === vapi_custom_tool` asserted in unit + eval fixtures
- Channel spans always use empty `argumentsRedacted: {}` (remediation-2)

## N/A gates

- **UI E2E**: no frontend change in this OpenSpec change
- **RAG**: no retrieval corpus / ingestion change

## Quality vs security

- This report is **quality `/verify` PASS** only.
- Security archive readiness is owned by `/adversarial-review` (see remediation and post-remediation review notes). Quality PASS ≠ security PASS.

## Verdict

**PASS** for OpenSpec `/verify` on change `vapi-custom-tool-invocation`.

Quality residual blocking verify: **none**.
