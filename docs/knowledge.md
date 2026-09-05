# Knowledge pipeline (RAG foundation)

Foundation proof: one PII-free example document can be ingested, retrieved, assembled, and cited before `runtime-demo` generates. This is not a production knowledge base.

## Fixture

- Path: `fixtures/knowledge/demo-hours.txt`
- Content: fictional Northwind Demo Desk hours (English, `public`)
- No personal names, emails, phones, or customer data

## Pipeline versions

| Step | Version | Notes |
| --- | --- | --- |
| Parser | `plain-v1` | UTF-8 text, CRLF normalized |
| Chunker | `char-512-64-v1` | 512-character window, 64 overlap; locator `chars:start-end` |
| Embed | `fake-embed@1` | Deterministic lexical vectors (stopwords removed, L2-normalized). No paid API |
| Retriever | `cosine-v1` | Cosine similarity, `k = 4`, threshold `0.25` |
| Corpus | `demo` | In-process only |

Chunks without a locator are rejected. Ingested chunk text longer than **512** characters is rejected. Assembled retrieved text is capped at **2048** characters; lowest-rank hits are dropped first. The current user utterance is never dropped to make room. Below-threshold hits are not evidence.

The demo corpus is a **shared public fixture** with **no ACL or tenant isolation**. Do not index customer or PII documents on this path.

## Store adapter

Default composition wires `InMemoryRetrieval`. Process restart drops the corpus; `createServer` re-ingests the fixture when no retrieval override is supplied.

To swap stores, implement `RetrievalPort` (`ingest` + `retrieve`) and pass it into `createServer({ retrieval })`. Domain and application must not import a vector vendor. A later PostgreSQL/pgvector adapter should use this port without changing ingest or `handleAgentTurn`.

## Agent contract

`handleAgentTurn` records `retrieving`, embeds the current user text, retrieves, assembles `UNTRUSTED_RETRIEVED_CONTEXT:` with document/chunk/locator, then calls the model. Retrieval is not a tool hop. Chunk bodies are fenced (`---BEGIN_RETRIEVED_CHUNK---` / `---END_RETRIEVED_CHUNK---`) and embedded `UNTRUSTED_*` labels are escaped so they cannot open a new packing block. Retrieved text is never placed on the `system` role.

Embed or retrieve exceptions fail the turn as `retrieval_failed` (fail-closed). The model is not called. That is distinct from empty evidence (`sources: []`, no evidence block). Voice mapping treats `retrieval_failed` as `VOICE_RUNTIME`, not as a successful ungrounded reply.

Successful turns include `sources: [{ documentId, chunkId, locator }]`. Empty retrieval yields `sources: []` and no evidence block (the prompt may still mention the label as policy).

Prompt: `runtime-demo@2` (`prompts/runtime-demo/v2.md`) — ground on retrieved evidence; refuse or hedge when insufficient.

Traces: `kind: retrieval` with redacted query, hit ids, scores, locators, corpus/retriever versions, latency. Default `LoggingObservability` logs only operation, outcome, status, and error code — it does **not** persist retrieval query text, hit payloads, or chunk bodies.

## HTTP

`POST /knowledge/documents` and `POST /knowledge/query` from `lidr-specboot/docs/api-spec.yml` are **unimplemented**. Ingest is an application use case used by tests, evals, and default process seed.

## Eval

- Retrieval: `eval/knowledge/` (`relevant-hours-hit`, `irrelevant-no-hit`)
- Agent: `eval/runtime-demo/` cases `retrieved-context-before-generate`, `empty-retrieval-no-evidence`, `document-injection-does-not-expand-allowlist`
