# Verification Report - Retrieval Evaluation

- Date: 2026-09-05
- Change: rag-foundation
- Agent: evaluation-engineer
- Gate: `/verify` (`openspec`)
- Change types: code | rag | agent

This gate is **not** a vector-client unit test. It runs the frozen `eval/knowledge/` set after ingesting `fixtures/knowledge/demo-hours.txt`. Stale-document / ACL filter cases are **N/A** (not specified for this increment).

## EvaluationRun

| Field | Value |
| --- | --- |
| suiteName | `rag-foundation-retrieval` |
| datasetVersion | `2026-09-05.1` |
| agentVersionId | n/a (retrieval-only) |
| promptVersionId | n/a |
| parserVersion | `plain-v1` |
| chunkerVersion | `char-512-64-v1` |
| embeddingModelId / modelVersion | `fake-embed` / `1` |
| retrieverVersion | `cosine-v1` |
| k | 4 |
| threshold | 0.25 |
| requiresPaidModel | false |
| requiresVectorDatabase | false |
| requiresMcpServer | false |
| status | `passed` |
| gate | `openspec` |
| startedAt / endedAt | 2026-09-05T23:18:36Z / 2026-09-05T23:18:44Z |

Threshold: relevant recall@4 **= 1.0**; irrelevant evidence hit rate **= 0**. Observed: both met. No cases dropped.

## Commands executed

- `npx vitest run eval/knowledge` → 4 passed (2 files: retrieval cases + PII hygiene)

## EvaluationScore

| caseId | metric | value | pass |
| --- | --- | --- | --- |
| `relevant-hours-hit` | `retrieval_recall_at_k` | 1 | true |
| `irrelevant-no-hit` | `no_evidence_hit` | 1 | true |

PII hygiene: fixture and cases contain no email, phone, or `sk-` secrets.

## Outcome

- Status: PASS
- Blocking issues: none
