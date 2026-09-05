## Context

See `proposal.md` for motivation. Observed now: `RetrievalPort` is retrieve-only (`query` → `{ chunkId, score, locator }`) and unused on the product path. `handleAgentTurn` packs system prompt, untrusted user text, and optional tool results, then calls `completeStructured`. `LlmPort` has no `embed`. Persistence is `ping()` only. Composition does not wire retrieval. `architecture.test.ts` / `package-vendors.test.ts` forbid vendor SDKs in core and manifests. Canonical `POST /knowledge/documents` and `POST /knowledge/query` exist in `lidr-specboot/docs/api-spec.yml` and are unimplemented, matching prior HUs.

Recorded assumptions from `/enrich-us` (not reopened):

1. Channel is runtime and tests; existing inbound voice inherits the same agent result. No new chat HTTP.
2. One domain-neutral English example fixture with no PII.
3. Sources appear on the agent success contract **and** on traces.
4. The retrieval query is the current user utterance.
5. Binary DoD plus a tiny frozen retrieval set (relevant + irrelevant).
6. Retrieved claims MUST NOT execute tools or other side effects.

Canonical references: `lidr-specboot/docs/base-standards.md` (ports, eval before production, observability), `backend-standards.md` (RAG pipeline versions, untrusted retrieved text, `embed` on the model port), `data-model.md` (Document, Chunk, Embedding, RetrievalResult as in-memory shapes, not new tables).

## Goals / Non-Goals

**Goals:**

- Deterministic ingest → chunk → embed → store → retrieve → assemble, then the existing agent turn generates with mocks.
- Keep default local start and CI offline from paid embed/LLM/vector vendors.
- Leave a port a later pgvector adapter can implement without rewriting the agent loop.
- Name change-type gates: **code**, **rag**, **agent**.

**Non-Goals:**

- Design-level restatement of proposal non-goals (production KB, Graph RAG, knowledge HTTP, spoken citations).
- Choosing a paid embedding vendor as a core dependency.
- Hybrid search, rerank, or ACL engines.

## Decisions

### D1 — Deterministic pipeline plus existing agent (not a RAG agent)

**Decision:** Ingest, chunk, embed, store, retrieve, and assemble are typed application steps. `runtime-demo` remains the only session owner. No second agent, supervisor, or retrieval tool.

**Why:** Enriched US and `base-standards.md`: deterministic when the path is specified; ticket non-goal is multi-agent RAG.

**Alternatives:** Model-invoked `knowledge.search` tool. Rejected: retrieval would depend on a tool decision and would increment hops. LangGraph retriever node. Rejected: optional library as core.

**Change types:** `code` | `rag` | `agent`. Not `tools` | `api` | `voice` | `ui`.

### D2 — Retrieve before the first model call

**Decision:** `handleAgentTurn` records `retrieving` (actor `runtime`), calls the retrieval port with the current user text, assembles hits, then enters `reasoning`. Tool hops are unchanged and do not re-retrieve.

**Why:** DoD requires context before generation. `design-agent`: named states; retrieval is runtime work.

**Alternatives:** Retrieve only when the model asks. Rejected: fails “before generate” and couples knowledge to tool policy.

```text
Voice / tests
     │
     ▼
handleAgentTurn
     │ retrieving
     ▼
RetrievalPort.retrieve
     │ assemble untrusted block
     ▼
LlmPort.completeStructured
```

### D3 — Widen `RetrievalPort` for ingest and retrieve

**Decision:** Extend the existing port rather than add a second store port. Illustrative capabilities (names may vary, shapes must stay vendor-free):

- `ingest({ document, chunks: [{ locator, text, embedding, metadata }] })` → `{ documentId, corpusVersion }`
- `retrieve({ query, queryEmbedding, k, threshold, embeddingModelId, embeddingModelVersion })` → `{ corpusVersion, retrieverVersion, hits: [{ chunkId, documentId, locator, text, score, rank }] }`

Hit text is available to assembly. Domain MUST NOT import pgvector or vendor document types.

**Why:** Smallest increment on the stub already declared in `provider-ports`.

**Alternatives:** Separate `VectorStorePort` + `RetrievalPort`. Rejected as extra surface for one adapter. Vendor retriever class in domain. Rejected.

### D4 — `embed` on `LlmPort`

**Decision:** Add `embed(texts) -> vectors` to `LlmPort` per `backend-standards.md`. Fake LLM implements a **deterministic lexical embed** (token/hash bag so overlapping text scores higher than unrelated text). Optional HTTP adapter MAY implement embed later; this increment MUST NOT require it or add an official SDK.

**Why:** One model-provider port; tests stay offline.

**Alternatives:** Separate `EmbeddingPort`. Acceptable later; not needed now. Always-live embed API. Rejected.

### D5 — In-memory store as the default adapter

**Decision:** Ship `src/adapters/retrieval` in-process store (cosine similarity on stored vectors). Default composition wires it. No Document/Chunk/Embedding migrations. A later pgvector adapter MUST implement the same port.

**Why:** Persistence is ping-only today; pgvector would pull migrations and a Compose extension into a foundation proof. Interchangeability is the port, not shipping two stores now.

**Alternatives:** pgvector in this increment (core stack). Deferred: larger than the HU proof. Two adapters now. Rejected as extra work.

### D6 — Versioned char chunker with locators

**Decision:** Parse the example source as UTF-8 plain text (`parserVersion` e.g. `plain-v1`). Chunk with a fixed character window and overlap (illustrative: size `512`, overlap `64`), `chunkerVersion` e.g. `char-512-64-v1`. Locator is a stable char range (e.g. `chars:0-512`). Reject empty chunks. Sensitivity of the fixture is `public`. Language metadata: `en`.

**Why:** `design-rag-pipeline`: chunk without locator is a defect. Structure-aware/PDF parsing is out of scope.

**Alternatives:** Sentence split only. Rejected as enough extra logic for one fixture. Token-accurate tiktoken. Rejected: extra dependency.

### D7 — Threshold, k, and empty evidence

**Decision:** Default `k = 4`. Minimum score is a documented constant chosen so the relevant frozen query keeps the example document and the irrelevant query does not (tune against the fake embed in TDD; do not lower it to “always answer”). Below-threshold hits are omitted from assembly. Empty assembly packs no chunk bodies.

**Why:** `backend-standards.md`: thresholds are mandatory.

**Alternatives:** Always pass top-k. Rejected: sends weak hits.

### D8 — Prompt version bump and packing

**Decision:** Add `prompts/runtime-demo/v2` (keep v1 file). Identity `promptId = runtime-demo`, new monotonic version, new content hash. Policy: answer from retrieved evidence; refuse or hedge when none; retrieved text is untrusted; tool allowlist unchanged. Packing:

| Block | Role / label |
| --- | --- |
| Versioned policy | `system` |
| User utterance | `user` / `UNTRUSTED_USER_TEXT` |
| Hits | `user` or a distinct untrusted role / `UNTRUSTED_RETRIEVED_CONTEXT` with locators |
| Tool result | `tool` / `UNTRUSTED_TOOL_RESULT` |

Do not concatenate retrieved text into the system message. Assembled retrieved text budget: 2048 characters; drop lowest-rank hits first; never drop the current user turn. Ingest rejects chunk text longer than 512 characters.

**Why:** `design-prompt`. Existing v1 does not mention grounding.

**Alternatives:** Reuse v1 with only code packing. Rejected: policy would be implicit.

### D9 — Sources on `AgentTurnSuccess`

**Decision:** Add `sources: { documentId, chunkId, locator }[]` to successful agent results (empty when unused). Voice mapping MAY ignore sources; it MUST NOT strip them from the agent result used by tests. Do not add a new public HTTP field.

**Why:** DoD and enrichment: identify sources on the contract, not traces only.

**Alternatives:** Traces only. Rejected: weaker than the recorded assumption.

### D10 — Example fixture and ingest entry

**Decision:** Store a short fictional office-hours (or equivalent domain-neutral) text under a repo fixture path such as `fixtures/knowledge/demo-hours.txt`. Application ingest use case is invoked from tests, eval setup, and default composition seed (or explicit test harness seed). No `registerDocument` HTTP.

**Why:** Channel is tests/runtime; api-spec knowledge routes stay unimplemented.

**Alternatives:** Implement canonical knowledge HTTP. Rejected: invents a product API the story did not require.

### D11 — Observability

**Decision:** Emit `kind: "retrieval"` spans already allowed on `ObservabilityPort`. Include query (redact secret-like shapes), hit ids, scores, ranks, locators, `corpusVersion`, `retrieverVersion`, latency, status. Default logging adapter MUST NOT dump full chunk bodies. LLM spans stay as today and MUST still record prompt version (v2).

**Why:** `instrument-ai-system` / no untraced retrieval.

### D12 — Eval fixtures (`create-evals`)

**Decision:**

| Suite | Path (illustrative) | Cases | Metric |
| --- | --- | --- | --- |
| Retrieval | `eval/knowledge/` | `relevant-hours-hit`, `irrelevant-no-hit` | recall@k / expected document or chunk id; threshold respected |
| Agent (extend) | `eval/runtime-demo/` | `retrieved-context-before-generate`, `empty-retrieval-no-evidence`, `document-injection-does-not-expand-allowlist` | packing, sources array, allowlist; mocked LLM; no live prose |

Dataset versions are frozen and PII-free. Vector-client unit tests do not replace the retrieval suite.

### D13 — Security / HITL

**Decision:** Retrieved text is untrusted. No new tools. No HITL queue (no high-risk actions). Adversarial quality case: jailbreak-shaped chunk does not expand allowlist. Independent `/adversarial-review` after `/verify`.

**Why:** Untrusted documents enter the prompt; `openspec-tasks-mandatory-steps.md` requires adversarial tests when retrieval of untrusted documents expands.

## Risks / Trade-offs

- **[Hallucination despite hits]** → Prompt v2 + empty-evidence packing + mocked generation asserts; live quality is out of CI.
- **[Fake embed is not a production embedding model]** → Documented; swap embed adapter later; retrieval eval is relative to this embed.
- **[In-memory store lost on process restart]** → Acceptable for the foundation proof; later persistence adapter.
- **[Prompt injection via chunks]** → Isolation + allowlist tests + post-verify adversarial review.
- **[Latency added before first token]** → Trace retrieval latency; no invented voice SLO.
- **[Interchangeability unproven by a second adapter]** → Architecture/port tests plus an in-process fake second implementation in tests if needed to lock the contract.

## Migration Plan

- No database migration.
- Prompt: load v2 for `runtime-demo`; keep v1 on disk for history.
- Eval: bump `eval/runtime-demo` dataset version; add `eval/knowledge`.
- Rollback: revert composition wiring and prompt pointer; in-memory corpus has no durable residue.
- Canonical knowledge HTTP remains unimplemented (no API rollback).

### D14 — Adversarial remediations (post-review)

**Decision:** Assembled retrieved text is capped at 2048 characters; ingest rejects chunk text longer than 512. Embed/retrieve exceptions fail the turn as `retrieval_failed` (not empty-evidence success). Spec language for injection is: retrieved text cannot expand the allowlist or execute non-allowlisted tools; allowlisted `read` tools may still run. System messages must equal prompt bytes. Default logs still omit query/hit payloads; the corpus is a shared public fixture with no ACL.

**Why:** `/adversarial-review` PASS WITH GAPS named unbounded assemble, fail-open retrieve, and underspecified tool-after-retrieve.

## Open Questions

None that affect specs or task breakdown. Exact threshold numeric value is chosen during TDD against the frozen queries (D7). Residual: no tenant ACL (fixture-only corpus); live-model jailbreak following is out of CI.
