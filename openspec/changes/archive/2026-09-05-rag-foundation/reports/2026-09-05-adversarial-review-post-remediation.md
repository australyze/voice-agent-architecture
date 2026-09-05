## Adversarial review

**Scope**: OpenSpec change `rag-foundation` (HU #005), **after** section 8 remediations and a second `/verify`. Ingest → retrieve → assemble → generate-with-sources on `runtime-demo`. Working tree on `feature/rag-foundation` vs merge-base `6c092b2` (`feature/extensible-tool-runtime`); implementation still uncommitted.

**Sources**: `openspec/changes/rag-foundation/{proposal,design,tasks,specs/*}`; prior `2026-09-05-adversarial-review.md`; remediations in `assemble-retrieval.ts`, `in-memory-retrieval.ts`, `handle-agent-turn.ts`, `agent.ts`, `docs/knowledge.md`; `/verify` reports (quality only — not treated as security evidence).

**Independence**: This re-review ran in the **same conversation** that implemented remediations and `/verify`. That still weakens independence. Do not treat this file as a substitute for a reviewer who never wrote the patch.

### Spec and task alignment

Acceptance (must hold): one example document ingestible and retrievable; context assembled **before** generation; sources identifiable; store interchangeable; retrieval not a tool; retrieved text untrusted and must not expand the allowlist; threshold drops weak hits; knowledge HTTP unimplemented; no new high-risk tools; default start offline from paid embed/vector vendors.

Non-goals: production KB/ACL, Graph RAG, multi-agent RAG, knowledge HTTP, retrieval-driven side effects as a product feature, PII corpus, spoken citations.

Prior gaps (unbounded assemble, fail-open retrieve, underspecified tool-after-retrieve, unfenced chunk text, undocumented ACL/logger residuals) were written into specs D14 / `knowledge-retrieval` / `first-agent` / `application-runtime` and implemented. Proposal recorded assumption 6 (“retrieved claims MUST NOT execute tools”) is now **narrowed** by D14 to non-allowlisted tools; allowlisted `read` hops remain. That is a spec change, not an unstated exception.

### Findings

| Severity | Area | Finding | Evidence | Suggested fix |
| --- | --- | --- | --- | --- |
| Question | Tenancy / ACL | Ingest `sensitivity` is still not stored or filtered. All turns on a server instance share one in-process corpus. Documented as residual; still unsafe if this store is reused for customer docs. | `InMemoryRetrieval` stored fields; `docs/knowledge.md` | Keep residual in archive. Later **OpenSpec** + **code** if a second tenant or private corpus appears |
| Question | Live-model injection | Fencing, system-role equality, and allowlist tests are mocked. A live model can still follow retrieved instructions and propose `demo.normalize_text`. Now **specified** (D14), not a spec/code mismatch. | FakeLlm scripts; no live-model gate | Accept for this increment; do not claim production jailbreak resistance |
| Question | Query on spans | Success spans still attach `argumentsRedacted.query = redactSecrets(userText)`. Default `LoggingObservability` still drops that field. A future retaining tracer would log caller speech. | `retrieveForTurn`; `logging-observability.ts` | **docs** already state this; hash/bound query if a collecting adapter is added |
| Question | Hit metadata interpolation | Chunk **text** is fenced and `UNTRUSTED_*` escaped. `documentId`, `chunkId`, and `locator` are interpolated raw **outside** the fence. Product chunker locators are `chars:start-end` and ingest HTTP does not exist, so this is not reachable on the current surface. A later ingest API or hostile retrieve adapter could reopen delimiter confusion. | `formatHit` in `assemble-retrieval.ts` | Later **code**: escape metadata; **tests** when ingest is public |

Closed from the first review (not re-filed): assemble cap 2048 with lowest-rank drop; ingest reject >512; `retrieval_failed` fail-closed (no `completeStructured`); spec language for allowlisted vs non-allowlisted tools; system message equals prompt bytes; ACL and logger residuals documented.

Refuted (not findings): no knowledge HTTP ingest (404); no new tools, MCP client, or high-risk/HITL actions; vendor SDKs still banned in core/manifests; HttpLlm posts `messages` (system = prompt bytes) when the runtime supplies them; voice adapter does not import the retrieval port; voice consumer JSON is `message`/`locale`/`status` only (no `sources` leak); inbound body cap 16 KiB; fixture/eval have no PII; fail-closed messages are secret-safe (`Retrieval failed`).

### Verdict

**PASS WITH GAPS**

No Blocker or Major on the **current** trust boundary (no public document ingest, `read`-only demo tool, fixture-only corpus). Prior Minors were remediated in spec and code. Remaining items are residuals and defense-in-depth for a future ingest surface. `/verify` quality PASS still does not equal security PASS.

Archiving advisable? **Yes**, for this foundation increment, if the archive summary names: no ACL, mocked-only injection, unescaped retrieve metadata, and same-session review.

### Recommended next steps (before archive)

1. Put the residuals above in the `/opsx-archive` summary. Do not sell this as a production KB.
2. Prefer a **fresh-session** `/adversarial-review` if independence must be strict; this pass is weaker because the same conversation wrote the remediations.
3. Do **not** index customer or PII documents on this store.
4. When knowledge HTTP or a durable store ships: escape hit metadata, persist/filter sensitivity, and re-run this review.
