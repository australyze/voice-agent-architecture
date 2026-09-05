# Eval suite: rag-foundation-retrieval

- **Suite name:** `rag-foundation-retrieval`
- **Dataset version:** `2026-09-05.1`
- **Embedding:** `fake-embed@1` (lexical, offline)
- **Chunker:** `char-512-64-v1`
- **Retriever:** `cosine-v1`, `k=4`, threshold `0.25`
- **Paid model required:** no
- **Vector database required:** no
- **MCP server required:** no

## Pass criteria

- `relevant-hours-hit`: the ingested example document id appears in top-k hits
- `irrelevant-no-hit`: the example document is not an evidence hit

This suite is retrieval evaluation, not a vector-client unit test and not live-model generation.

Run: `npx vitest run eval/knowledge/knowledge.eval.test.ts`
