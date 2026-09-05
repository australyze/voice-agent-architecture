# Verification Report - Retrieval Evaluation

- Date: 2026-09-05
- Change: evaluation-ai-security
- Agent: evaluation-engineer
- Suite: `rag-foundation-retrieval`
- Dataset version: `2026-09-05.1`
- Embedding model: `fake-embed` / `1`
- Retriever: `cosine-v1`, k=4
- Paid / vector vendor: none (`InMemoryRetrieval`)

## Commands executed
- `npx vitest run eval/knowledge/knowledge.eval.test.ts`

## Results
- 1 file, 3 passed (metadata + two frozen cases)

| caseId | metric | value | pass | notes |
| --- | --- | --- | --- | --- |
| relevant-hours-hit | retrieval_hit_id | 1 | true | weekday hours query hits ingested example document |
| irrelevant-no-hit | retrieval_hit_id | 1 | true | gyroscope query has no hit on the example document |

Vector-client / store unit tests were not treated as this gate.

## Outcome
- Status: PASS
- Blocking issues: none
