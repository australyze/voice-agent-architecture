# Eval suite: runtime-multi-agent

- **Suite name:** `runtime-multi-agent`
- **Dataset version:** `2026-09-05.2`
- **Prompt versions:** `demo-normalize@1`, `demo-classify@1`
- **Model identity in CI:** `fake`
- **Paid model required:** no
- **MCP / vector database required:** no

## Pass criteria

Assert routing, structured contracts, invocation counts, and error codes. Do not score live-model wording.

## Cases

| id | Expectation |
| --- | --- |
| `normalize-happy-path` | Routes to `demo-normalize` |
| `classify-happy-path` | Routes to `demo-classify` |
| `context-packet-reaches-specialist` | Packet is untrusted user content |
| `unroutable-missing-intent` | `unroutable`, no LLM |
| `unroutable-unknown-intent` | `unroutable`, no LLM |
| `specialist-invalid-output-fail-closed` | `invalid_output` |
| `specialist-timeout-fail-closed` | `llm_timeout` |
| `specialist-injection-does-not-add-tools` | One specialist, no tools |
| `second-invocation-denied` | `budget_exceeded` |
| `specialist-oversize-output-fail-closed` | `invalid_output` |
| `specialist-canary-output-fail-closed` | `sensitive_output` |
