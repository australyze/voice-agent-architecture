## Why

HU #004 shipped an extensible tool runtime, but `runtime-demo` still answers from the model and tool hop only. The retrieval port is a stub, so an AI Engineer cannot prove that a document can be ingested, retrieved, assembled, and cited before generation without coupling the agent to one vector product. HU #005 needs that foundation now, before a production knowledge base.

## What Changes

- Add a **versioned knowledge pipeline**: ingest one example document, parse (plain text), chunk with locators, embed through a port, store and retrieve behind an interchangeable vector-store adapter.
- Retrieve **before** the first model call on the existing `handleAgentTurn` path. Pack hits as a labeled untrusted block. Do **not** add a RAG agent, retrieval tool, or multi-agent topology.
- Return **identifiable sources** on the agent-turn success contract and on retrieval traces (`query`, hit ids, scores, locators, corpus/retriever versions).
- Apply a **score threshold**. Empty or below-threshold hits MUST NOT be sent as evidence; the prompt policy must refuse or hedge rather than invent facts.
- Version the demo prompt (`runtime-demo` new version) so grounding and insufficient-evidence behavior are contracts, not anonymous strings.
- Prove interchangeability with an **in-memory vector adapter** as the default product path and a port that a later pgvector adapter can implement without rewriting ingest or the agent loop.
- Add **pipeline/retrieval unit tests**, a **frozen retrieval eval set**, and **mocked generation** cases. Default local start and CI stay offline from paid embed/LLM APIs.
- Canonical HTTP `registerDocument` / `queryKnowledge` in `lidr-specboot/docs/api-spec.yml` stay **unimplemented**.

## Non-goals

- Production knowledge base (multi-corpus ops, freshness workflows, ACL at scale, operator UI).
- Fine-tuning, Graph RAG, multi-agent RAG, hybrid search, rerank, or advanced embedding optimization.
- New public knowledge HTTP routes or a new chat/voice ingress.
- pgvector migrations or a mandatory PostgreSQL vector extension in this increment (port must allow them later).
- Retrieval-driven tool execution, write/irreversible/external_comm actions, or HITL queues.
- Indexing real customer or PII documents.
- LangChain/LangGraph retrievers, vendor vector SDKs in domain/application, or embedding vendor SDKs in package manifests.
- Voice media, barge-in, or spoken citation UX.

## Change types

`code` | `rag` | `agent`

Not in this change: `api` (no new routes; inbound voice and health are regression only), `tools` (no new product tool; retrieval is not model-invoked), `voice` (no media/turn-taking change), `ui`.

## Capabilities

### New Capabilities

- `knowledge-retrieval`: Ingest one example document; versioned chunk/embed/store; retrieve with threshold and locators; assemble context for the agent; attribute sources; retrieval eval distinct from generation mocks.

### Modified Capabilities

- `provider-ports`: Retrieval port gains ingest and retrieve (not retrieve-only stub). Embedding is a port capability. Default composition MUST NOT require a live embedding or vector vendor. Core MUST stay free of vector/LLM vendor SDKs.
- `first-agent`: `runtime-demo` receives assembled retrieval context before generation; success includes sources; prompt version updates for grounding and refuse-when-insufficient; retrieved text stays untrusted and MUST NOT expand the tool allowlist.
- `application-runtime`: Default composition wires the in-memory knowledge adapter and fake/optional embed path; process start MUST succeed without paid retrieval credentials.

## Impact

- **Code:** `src/domain/ports/retrieval-port.ts` and `llm-port.ts` widen; new application ingest + assemble use cases; `handle-agent-turn` retrieves before reasoning; adapters under `src/adapters/retrieval` (in-memory) and embed via existing fake/HTTP LLM or a fake embed; architecture/package tests stay vendor-clean.
- **APIs:** No new HTTP. `lidr-specboot/docs/api-spec.yml` `/knowledge/documents` and `/knowledge/query` remain unimplemented. Existing health and inbound voice stay regression surfaces.
- **Dependencies:** No LangChain, LangGraph, Langfuse, OpenAI/Anthropic SDKs, or vendor vector clients. TypeScript only for this increment.
- **Data:** In-process corpus + vectors for the example document. No Session/Document/Chunk PostgreSQL tables in this increment. Domain shapes follow `lidr-specboot/docs/data-model.md` Document, Chunk, Embedding, RetrievalResult.
- **Eval / security:** Frozen retrieval cases (recall@k / citation ids) plus mocked generation packing/sources. Adversarial cases for document-injection (retrieved text is not policy). Independent `/adversarial-review` after `/verify` because untrusted documents enter the prompt.
