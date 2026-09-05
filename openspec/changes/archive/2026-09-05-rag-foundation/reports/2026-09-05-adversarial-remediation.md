# Adversarial remediation

- Date: 2026-09-05
- Change: rag-foundation
- Agent: ai-engineer
- Follows: `reports/2026-09-05-adversarial-review.md` PASS WITH GAPS
- Change types: code | rag | agent

## Commands executed

- `npx vitest run src/adapters/retrieval/in-memory-retrieval.test.ts src/application/assemble-retrieval.test.ts src/application/handle-agent-turn.test.ts src/domain/agent.test.ts` → 35 passed
- `npx vitest run` → 178 passed (40 files)
- `npx vitest run eval/runtime-demo/runtime-demo.eval.test.ts` → 16 passed
- `npx vitest run eval/knowledge/knowledge.eval.test.ts` → 3 passed (suite file; dataset still `2026-09-05.1`)

Paid embed, live LLM, vector database, and MCP servers were not used.

## Remediations

| Review item | Change |
| --- | --- |
| Minor: unbounded assembled retrieve | `MAX_ASSEMBLED_RETRIEVAL_CHARS` 2048; lowest-rank hits dropped first; user utterance kept. Ingest rejects chunk text over 512 |
| Minor: retrieve/embed fail-open | Embed or retrieve throw → `retrieval_failed`, retrieval error span, no `completeStructured`. Voice still maps non-timeout agent codes to `VOICE_RUNTIME` |
| Minor: injection spec vs allowlisted tool | Spec tightened: no allowlist expansion; no non-allowlisted execute. Existing `demo.normalize_text` hop unchanged |
| Minor: delimiter / role isolation | Chunk text fenced; embedded `UNTRUSTED_*` escaped; `FakeLlm` records messages; system role equals prompt bytes |
| Question: no ACL | Documented residual: shared public fixture, no tenant ACL |
| Question: query on spans | Default `LoggingObservability` still omits query and hit payloads |

## Eval

- Agent: dataset **`2026-09-05.4`**, prompt `runtime-demo@2`, model `fake` — 16/16
- Retrieval: dataset **`2026-09-05.1`** — `relevant-hours-hit` and `irrelevant-no-hit` still pass
- No new eval cases required; remediations are deterministic unit tests

## Skipped gates (same N/A as section 6)

- Dedicated tool-schema gate: no tool schema change
- Voice conversation eval: no barge-in / spoken-flow change
- UI E2E: no frontend
- Knowledge HTTP: still unimplemented

## Outcome

- Status: PASS (implementation + regression)
- Independent `/adversarial-review` in a **fresh session** is still recommended before `/opsx-archive`
- Residuals: no tenant ACL; default logger does not persist query text; live-model jailbreak following is out of CI
