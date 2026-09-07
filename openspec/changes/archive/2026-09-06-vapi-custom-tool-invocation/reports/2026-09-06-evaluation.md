# Verification Report - Evaluation

- Date: 2026-09-06
- Change: `vapi-custom-tool-invocation`
- Agent: evaluation-engineer
- Phase: `/verify` (post-adversarial remediation-2)

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
| scores | **7/7** tests passed (100%) |
| thresholds | Every fixture `ok` / `code` / `invocationSource` assertion must pass; `runAgent` must be rejected |
| gate | `openspec` `/verify` |
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
| load fixture version | version `1`, ≥5 cases | PASS |

## EvaluationRun (WOM regression)

| Field | Value |
| --- | --- |
| suite | `wom-customer-service` |
| dataset | `eval/wom-customer-service/cases.json` (frozen) |
| datasetVersion | as frozen in suite |
| model | fake LLM (scripted) |
| scores | suite metadata + every frozen case passed (2/2 tests) |
| gateResult | **PASS** |

## Commands executed

```text
npx vitest run \
  eval/vapi-channel-tools/vapi-channel-tools.eval.test.ts \
  eval/wom-customer-service/wom-customer-service.eval.test.ts
```

- Result: **9 passed**, 0 failed
- Paid Vapi / live LLM: not used

## Observability smoke (task 5.5)

- Channel path emits tool records with `source: vapi_custom_tool`, latency, shared `traceId`
- Session `ToolCall.invocationSource === vapi_custom_tool` asserted in unit + eval fixtures
- Remediation-2: channel spans use `argumentsRedacted: {}`; Supabase hydrate maps `invocation_source` → `invocationSource`
- Covered by channel unit/HTTP/eval + supabase-persistence green runs

## Outcome

- Status: **PASS**
- Live paid Vapi: not required / not used
