---
name: design-rag-pipeline
description: Use when the change involves knowledge: ingestion, parsing, chunking, metadata, embeddings, vector or hybrid search, reranking, thresholds, attribution, stale documents, or retrieval-eval design. Do not use for generation-only prompt tweaks or tool execution.
author: LIDR.co
version: 1.0.0
---

# design-rag-pipeline

End-to-end retrieval as a **versioned pipeline**. Retrieval eval ≠ generation eval.

**Agent:** `rag-engineer`

## When not to use

- No corpus (pure tools/LLM)
- Running the release suite → `verify-ai-implementation`
- Prompt packing only → `design-prompt` (this skill still owns hit shape)

## Inputs

- Sources, sensitivity/ACL, OpenSpec change

## Steps

1. Load `docs/backend-standards.md` (RAG) and `docs/data-model.md` (Document, Chunk, Embedding, RetrievalResult).
2. Ingest: source URI, parser version, chunk strategy, metadata (locator, timestamps, ACL, language, doc version).
3. Embed: named model + version; store vectors behind a port (pgvector typical); keep text relational.
4. Retrieve: filters, thresholds, optional hybrid/rerank; compression **preserves locators**.
5. Attribute every hit used on a turn. Untrusted text ≠ system policy.
6. Stale: `source_updated_at` vs `indexed_at` — skip, recency-boost, or refuse.
7. Define retrieval metrics and a frozen set for `create-evals` (recall@k / citation precision or project equivalent).

## Outputs

- Pipeline spec (versions, thresholds, failure modes: empty, stale, low score)
- Retrieval dataset outline (PII redacted)

## Quality gates

- Chunk without locator is a defect
- Vector-client unit test is not RAG eval
- Sensitivity considered or explicitly N/A

## Documents

- `docs/backend-standards.md`, `docs/data-model.md`, `docs/api-spec.yml` (knowledge)
- `docs/openspec-tasks-mandatory-steps.md`

## OpenSpec

`/ff` and `/apply` when change type includes RAG.

## Combines with

- `design-prompt` (how hits enter context)
- `create-evals` / `verify-ai-implementation`
- `adversarial-review` (injection via documents)

## Verification

| Check | Pass |
| --- | --- |
| “Index PDFs for support” | Parser/chunker/embed versions + locators |
| Avoids | Vendor retriever class as domain; answering with no threshold |
