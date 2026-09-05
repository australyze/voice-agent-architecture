## Adversarial review

**Scope**: OpenSpec change `rag-foundation` (HU #005). Ingest → retrieve → assemble → generate-with-sources on `runtime-demo`. Working tree on `feature/rag-foundation` vs `origin/feature/extensible-tool-runtime` (implementation is uncommitted).

**Sources**: `openspec/changes/rag-foundation/{proposal,design,tasks,specs/*}`; `lidr-specboot/docs/{base-standards,backend-standards,data-model}.md`; implementation under `src/application/{handle-agent-turn,assemble-retrieval,ingest-document,chunk-document}.ts`, `src/adapters/retrieval/`, `src/adapters/http/create-server.ts`, `prompts/runtime-demo/v2.md`; `/verify` reports (quality only, not treated as security evidence).

**Independence**: This review ran in the **same conversation** as `/apply`. That weakens independence. A fresh-session re-review is still preferred before treating archive as hardened.

### Spec and task alignment

Acceptance (must hold): one example document ingestible and retrievable; context assembled **before** generation; sources identifiable; store interchangeable; retrieval not a tool; retrieved text untrusted and must not expand the allowlist; threshold drops weak hits; knowledge HTTP unimplemented; no new high-risk tools; default start offline from paid embed/vector vendors.

Non-goals: production KB/ACL, Graph RAG, multi-agent RAG, knowledge HTTP, retrieval-driven side effects, PII corpus, spoken citations.

Gaps the spec left open: no numeric cap on assembled retrieved bytes (design D8 names a token budget; specs do not); “MUST NOT execute tools as a consequence of retrieved claims” vs still allowing the existing `read` tool after retrieve; retrieval failure mode not specified (code fail-opens to empty evidence).

### Findings

| Severity | Area | Finding | Evidence | Suggested fix |
| --- | --- | --- | --- | --- |
| Minor | Prompt packing | Design D8 requires a retrieval token budget (drop oldest hits; never drop the user turn). `assembleRetrieval` concatenates all above-threshold hits with **no** size cap. Tool results are capped at 2048 chars; retrieved text is not. Product ingest uses 512×4 so the demo fixture is small, but the port accepts arbitrary `hit.text`. Contradicts `backend-standards.md` “bound all untrusted text before it enters prompts.” | `assemble-retrieval.ts`; `in-memory-retrieval.ts` stores caller embeddings/text as-is; no test for oversized hits | **code** + **tests**: cap assembled retrieved chars (and reject/truncate ingest chunks); **OpenSpec**: put the cap in `knowledge-retrieval` so D8 is not design-only |
| Minor | Retrieval errors | `retrieveForTurn` swallows every exception and continues the turn with empty evidence. An embed/store fault is indistinguishable from “no hits,” so the model may still reply or call the allowlisted tool. Spec only covers the empty-hit packing path, not failure. | `handle-agent-turn.ts` `catch { return { block: "", sources: [] } }` | **code**: emit a typed retrieval failure (or fail the turn closed); **OpenSpec**: name the failure code; **tests**: embed/retrieve throw must not look like a successful ungrounded reply unless that is the written policy |
| Minor | Indirect injection | Jailbreak-shaped chunks are labeled untrusted and cannot expand the allowlist (mocked). A live model can still propose **allowlisted** `demo.normalize_text` after reading retrieved instructions. Spec line “MUST NOT execute tools as a consequence of retrieved claims” is only tested for non-allowlisted names. Quality eval does not prove live-model resistance. | `document-injection-does-not-expand-allowlist`; product allowlist still executes normalize after retrieve | **OpenSpec**: tighten to “must not expand allowlist / must not execute non-allowlisted tools”; or **code** skip tool hops when the only new context is retrieved text if that is the intended policy |
| Minor | Delimiter / role confusion | Retrieved `text` is interpolated raw. A chunk containing `UNTRUSTED_USER_TEXT:` or fake policy fences can blur blocks. Isolation is asserted on packing labels and allowlist, not on `messages[0].role === system` excluding chunk text. `LlmMessage` has no dedicated retrieved role; hits share the `user` message with the utterance. | `assemble-retrieval.ts`; `buildMessages` concatenates user + retrieved; FakeLlm records `input` not the message list | **tests**: assert system message equals prompt bytes and excludes fixture/jailbreak text; **code**: escape or fence locators/text |
| Question | Tenancy / ACL | Ingest `sensitivity` is not stored or filtered. All sessions share one in-process corpus. Acceptable for a public demo fixture; unsafe if this store is reused for customer docs. | `IngestRequest` vs `InMemoryRetrieval` stored fields | **docs** / later **OpenSpec**: mark shared public corpus + no ACL as an explicit residual |
| Question | Query PII on spans | Retrieval spans attach `argumentsRedacted.query = redactSecrets(userText)` (full utterance minus secret shapes). Default logging adapter does **not** persist that field (good). A future collecting adapter would log caller speech. | `retrieveForTurn`; `logging-observability.ts` | **docs**: default adapter contract; hash or bound query if a retaining tracer is added |

Refuted (not findings): no knowledge HTTP ingest surface (404 tests); no new tools, MCP client, or high-risk/HITL-required actions; vendor SDKs still banned in core/manifests; retrieved text is not merged into the system prompt string; retrieval is not a hop; empty retrieval packs no chunk bodies; fixture/eval PII hygiene holds; voice adapter still does not import the retrieval port.

### Verdict

**PASS WITH GAPS**

No Blocker or Major on the **current** trust boundary (no public document ingest, `read`-only demo tool, fixture-only corpus). Gaps are real: unbounded assemble path, fail-open retrieve, and unproven live-model behavior on retrieved jailbreaks. `/verify` quality PASS does not close those.

Archiving advisable? **Yes**, for this foundation increment, if residuals stay in the archive summary and are not sold as a production KB.

### Recommended next steps (before archive)

1. Optional: add an assembled-context byte cap and a retrieve-throw test (new `/apply` after OpenSpec update if you want them in this change).
2. Keep `/adversarial-review` residuals in the archive note: no ACL, fail-open retrieve, mocked-only injection.
3. Re-review in a **fresh session** if independence must be strict.
4. Do **not** treat this as approval to index customer or PII documents.
