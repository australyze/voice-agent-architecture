# Tasks: rag-foundation

Change types: **code**, **rag**, **agent**.

Not in this change: **api** (no new routes; inbound voice and health are regression only), **tools** (no new product tool; retrieval is not model-invoked), **voice** (no media or turn-taking change), **ui**.

Reports: `openspec/changes/rag-foundation/reports/`.

## 0. Setup: Create Feature Branch (MANDATORY - FIRST STEP)

- [x] 0.1 Create and switch to branch `feature/rag-foundation` from the default branch and verify with `git branch --show-current`

## 1. Ports and architecture guards (TDD)

- [x] 1.1 Write a failing test that `LlmPort` exposes `embed` and that the fake LLM returns deterministic vectors where overlapping text scores higher than unrelated text, then implement `embed` on the fake (and keep HTTP LLM compiling without a live embed requirement) and verify the test passes
- [x] 1.2 Write a failing test that `RetrievalPort` supports ingest plus retrieve with hit fields `chunkId`, `documentId`, `locator`, `text`, `score`, and `rank`, then widen the port types and verify the test compiles and the old retrieve-only shape is gone
- [x] 1.3 Write failing architecture/package assertions that domain and application have no vector-store or embedding vendor SDK imports and that manifests still omit LangChain, LangGraph, Langfuse, OpenAI, Anthropic, and MCP packages, then implement the assertions and verify they pass

## 2. Ingest, chunk, store, retrieve (TDD)

- [x] 2.1 Add PII-free fixture `fixtures/knowledge/demo-hours.txt` and write a failing chunker test: plain-text parse `plain-v1`, windows `512`/`64`, locators like `chars:0-512`, empty chunks rejected; implement the chunker and verify the test passes
- [x] 2.2 Write failing in-memory store tests: ingest versioned chunks with embeddings; retrieve relevant query returns the example document above threshold with locators; irrelevant query yields no evidence hit; chunk without locator is rejected; implement the adapter (cosine, `k = 4`, documented threshold) and verify those tests pass
- [x] 2.3 Write a failing ingest use-case test that walks fixture → chunk → embed → store and returns `documentId` plus `corpusVersion`, then implement it and verify the test passes without a paid embed call
- [x] 2.4 Write a failing interchangeability test that a second in-process fake store implements the same port and that ingest/retrieve contracts do not mention a vendor type, then add the fake if needed and verify the test passes

## 3. Assemble and agent turn (TDD)

- [x] 3.1 Write failing assembly tests: above-threshold hits keep document id, chunk id, and locator; below-threshold hits are omitted; jailbreak-shaped chunk text is labeled `UNTRUSTED_RETRIEVED_CONTEXT` and is not merged into system policy; implement assembly and verify those tests pass
- [x] 3.2 Add prompt `runtime-demo` v2 (keep v1), write a failing load test that the product path uses the new version and hash, then wire the loader and verify the test passes
- [x] 3.3 Write failing `handleAgentTurn` tests: state `retrieving` before the first model call; first completion includes assembled context; success `sources` lists used hits; empty retrieval packs no chunk bodies and `sources` is `[]`; retrieval does not increment tool hops; document injection does not expand the allowlist; implement wiring plus retrieval spans and verify those tests pass
- [x] 3.4 Write a failing test that default composition starts without embedding/vector credentials, seeds or can ingest the example fixture in-process, and that `POST /knowledge/documents` and `POST /knowledge/query` remain unimplemented; wire composition and verify those tests pass

## 4. Eval fixtures (create-evals)

- [x] 4.1 Add `eval/knowledge/` with frozen cases `relevant-hours-hit` and `irrelevant-no-hit`, dataset version, embedding/chunker/retriever versions, recall@k (or expected id) criteria, and `requiresPaidModel: false`
- [x] 4.2 Extend `eval/runtime-demo/` (bump dataset version, prompt `runtime-demo@2`) with `retrieved-context-before-generate`, `empty-retrieval-no-evidence`, and `document-injection-does-not-expand-allowlist`; keep existing tool cases passing with the fake LLM

## 5. Review and update tests and eval fixtures (MANDATORY)

- [x] 5.1 Review unit, architecture, agent, and retrieval tests against every scenario in this change’s `specs/*/spec.md` and add any missing case
- [x] 5.2 Confirm eval fixtures contain no PII and do not require a paid model, paid call, vector database, or MCP server

## 6. Run verification gates (MANDATORY - AGENT MUST EXECUTE)

- [x] 6.1 Unit tests + database state (MANDATORY - AGENT MUST EXECUTE): start Compose if needed, run the suite without paid APIs, ping persistence through the port, confirm no new Document/Chunk/Embedding/Session tables or domain-row mutations, write `openspec/changes/rag-foundation/reports/YYYY-MM-DD-unit-test-and-db-verification.md`
- [x] 6.2 Contract tests (MANDATORY - AGENT MUST EXECUTE): regression on existing HTTP — `GET /health/live`, `GET /health/ready`, `GET /health/voice`, `POST /adapters/voice/inbound` (valid simulator with mocked LLM/retrieval); assert status codes and the canonical error envelope; confirm knowledge HTTP routes are absent; write `openspec/changes/rag-foundation/reports/YYYY-MM-DD-contract-tests.md`
- [x] 6.3 Skip dedicated tool-calling gate — no tool schema or executor change; existing allowlist cases remain in the agent suite
- [x] 6.4 Agent / prompt evaluation (MANDATORY - AGENT MUST EXECUTE): run `eval/runtime-demo/` with the fake LLM; record dataset version, prompt version, model identity (`fake`), and pass/fail per case including the new ids; write `openspec/changes/rag-foundation/reports/YYYY-MM-DD-evaluation.md`
- [x] 6.5 RAG evaluation (MANDATORY - AGENT MUST EXECUTE): run `eval/knowledge/`; record recall@k or hit-id results for relevant and irrelevant cases; do not treat store unit tests as this gate; append to the evaluation report or write `openspec/changes/rag-foundation/reports/YYYY-MM-DD-retrieval-evaluation.md`
- [x] 6.6 Skip voice conversation evaluation — no barge-in, confirmation, silence, or spoken-flow change; inbound mapping stays a contract/unit regression
- [x] 6.7 Skip UI E2E — no frontend
- [x] 6.8 Observability smoke (MANDATORY - AGENT MUST EXECUTE): assert a grounded turn emits a `retrieval` span (hit ids, scores, versions, latency) and an `llm` span with prompt v2, and that default logs omit full chunk bodies; record the assertion in the unit or evaluation report
- [x] 6.9 Adversarial quality cases (MANDATORY - AGENT MUST EXECUTE): document-injection does not expand allowlist; retrieved text is not system policy; empty retrieval is not treated as evidence; independent `/adversarial-review` remains after `/verify` before archive

## 7. Update technical documentation (MANDATORY)

- [x] 7.1 Document the knowledge pipeline (fixture, chunker/embed versions, threshold, in-memory store, how to swap adapters), prompt v2 packing, sources on the agent result, and that canonical knowledge HTTP stays unimplemented — verify a reader can follow without implicit steps
- [x] 7.2 Confirm `lidr-specboot/docs/` needs no methodology rewrite and that `lidr-specboot/docs/api-spec.yml` `/knowledge/documents` and `/knowledge/query` remain unimplemented

## 8. Adversarial remediations (TDD)

- [x] 8.1 Write failing tests: ingest chunk text over 512 characters is rejected; assembled retrieved block over 2048 characters drops lowest-rank hits and keeps the user utterance
- [x] 8.2 Write a failing test that embed or retrieve throw returns `retrieval_failed`, emits a retrieval error span, and does not call `completeStructured`
- [x] 8.3 Write a failing test that the system message equals prompt bytes and excludes jailbreak-shaped retrieved text (including embedded `UNTRUSTED_USER_TEXT:` fences)
- [x] 8.4 Implement the assemble cap, ingest reject, fail-closed `retrieval_failed`, and retrieved-text fencing; verify those tests pass
- [x] 8.5 Document the 2048/512 caps, fail-closed retrieve, shared public corpus with no ACL, and that the default logger does not persist retrieval query text

## 9. Remediation verification (MANDATORY - AGENT MUST EXECUTE)

- [x] 9.1 Re-run unit, agent eval, and retrieval eval suites without paid APIs and write `openspec/changes/rag-foundation/reports/2026-09-05-adversarial-remediation.md`
- [x] 9.2 Skip RAG/voice/UI gate changes beyond 9.1 — same N/A reasons as section 6; independent `/adversarial-review` re-check remains optional in a fresh session
