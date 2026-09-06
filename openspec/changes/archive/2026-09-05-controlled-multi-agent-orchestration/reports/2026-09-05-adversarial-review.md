## Adversarial review

**Scope**: OpenSpec change `controlled-multi-agent-orchestration` (HU #008). Working-tree plus committed merge vs `main` on `feature/controlled-multi-agent-orchestration`. Review limited to the multi-agent slice (orchestrator, specialists, `POST /demo/orchestrate`, eval suite), not a re-audit of archived observability/eval-gate history that landed via merge.

**Sources**: `openspec/changes/controlled-multi-agent-orchestration/{proposal,design,tasks,specs/**}`; `lidr-specboot/docs/base-standards.md` and `backend-standards.md` (Security, tools, MCP, HITL); `src/application/handle-orchestrated-turn.ts`, `src/domain/orchestration.ts`, `src/adapters/http/create-server.ts`, `src/application/map-error.ts`, `src/adapters/llm/http-llm.ts`, `eval/runtime-multi-agent/cases.json`. `/verify` quality PASS was not treated as a security PASS.

**Independence**: This review ran in the same conversation that implemented and verified the change. That weakens independence. A fresh-session re-review is preferred before treating the verdict as fully independent.

### Spec and task alignment

Acceptance: closed-intent routing to one of two specialists; common structured contract; orchestrator owns flow; `maxSpecialistInvocations = 1` / `maxSteps = 4`; fail-closed errors; reproducible tests; voice inbound stays on `runtime-demo`.

Non-goals: swarms, peer messaging, production multi-agent, session CRUD, new tools/RAG/HITL/voice media.

HITL: none specified; specialists are generation-only with empty allowlists. Underspecified: whether `POST /demo/orchestrate` inherits inbound authentication, body limits, and rate limits. `backend-standards.md` requires authorization on every HTTP route; the change treats the route as an engineer demo.

### Findings

| Severity | Area | Finding | Evidence | Suggested fix |
| --- | --- | --- | --- | --- |
| Major | AuthZ / cost / DoS | New generative HTTP route is unauthenticated, unrate-limited, and uses Fastify’s default ~1 MiB body limit, while the only other LLM-triggering route (`POST /adapters/voice/inbound`) requires a shared secret when configured, a rate limiter, and a 16 KiB `bodyLimit`. When `LLM_*` HTTP mode is on and `LISTEN_HOST=0.0.0.0` (documented), anyone who can reach the port can spend tokens or flood the model. Empty `userText` with a valid `intent` still calls the LLM. | `create-server.ts` `POST /demo/orchestrate` (no `authenticateInbound`, no limiter, no `bodyLimit`); voice route at L122–128; `inbound.ts` `INBOUND_BODY_LIMIT_BYTES = 16 * 1024`; README `LISTEN_HOST`; `handleOrchestratedTurn` does not reject empty text | **code**: reuse inbound secret (or a dedicated demo secret), rate limit, and a tight `bodyLimit`; reject empty/oversize `userText`. **OpenSpec**: state the auth/budget contract. **tests**: unauthenticated 401 when secret is set; oversized body 413 |
| Major | Insecure output handling | Specialist schemas are `.strict()` but have no max length. `runtime-demo` caps `replyText` at 2048 and fails `sensitive_output` on canary/secret shapes. Orchestrated success returns unbounded `replyText` / `normalizedText` / `label` to the client. `HttpLlm` only caps the provider body at 64 KiB, so a configured model can still echo secrets or dump tens of KB. | `handle-orchestrated-turn.ts` zod `min(1)` only; `handle-agent-turn.ts` `MAX_REPLY_TEXT_CHARS` + `containsSensitiveOutput`; `http-llm.ts` `MAX_LLM_RESPONSE_BYTES`; no orchestrate leak/oversize test | **code**: apply the same reply bound and sensitive-output fail-closed. **tests**: oversize job field → `invalid_output`; canary/`sk-` in specialist output does not succeed |
| Minor | Spec vs code | `maxSteps = 4` is declared and tested as a constant; the use case never increments or enforces a step counter. Today the path is linear, so the budget is not exploitable, but the spec’s “MUST enforce” is not implemented. `specialist_failed` is specified and mapped to HTTP 500 but never produced. | `orchestration.ts` `MAX_ORCHESTRATION_STEPS`; `handle-orchestrated-turn.ts` has no step budget; `ORCHESTRATION_ERROR_CODES.SPECIALIST_FAILED` unused | **code** or **OpenSpec**: enforce a step counter, or reword the requirement to “linear four-state machine” |
| Minor | Prompt isolation | `messages` keep policy on `system` and the packet on `user` (tested). `input` still concatenates `prompt.content + packet`. `HttpLlm` prefers `messages` when present; any adapter that sends `input` only would merge untrusted text with policy. | `packSpecialistContext`; `http-llm.ts` `outbound = messages ?? [{ role: user, content: input }]` | **code**: stop sending concatenated `input`, or send a non-policy placeholder |
| Minor | Untrusted correlation | HTTP accepts caller `sessionId` as any string and copies it onto spans. No format check. Not IDOR (no session store) but it can pollute traces the same way inbound `requestId` can. | `create-server.ts` `typeof body.sessionId === "string"`; `correlationFields` | **code**: generate `sessionId` server-side or validate UUID; **docs**: join by `traceId` |
| Question | Test hook | `consumedInvocations` and `packedContext` are on the use-case input. HTTP does not map them today (good). A later “thin” HTTP mapping would let a client pre-trip the budget or inject extra packet text. | `OrchestratedTurnInput`; eval case `second-invocation-denied` uses `consumedInvocations: 1` | Keep hooks test-only; do not bind them on the public route |
| Question | Process | Review is not a fresh session from the implementer. | This chat ran `/opsx-apply` and `/verify` | Re-run `/adversarial-review` in a new session if archive policy requires independence |

### Surfaces considered (no additional finding)

- **Routing / swarm**: intent is a closed table; user text cannot pick the specialist or fan out. Unroutable calls no LLM. Refuted.
- **Tool abuse / MCP**: `HandleOrchestratedTurnDependencies` has no `ToolPort` / `RetrievalPort`. Specialists have empty allowlists. No runtime MCP expansion. Dual MCP unchanged.
- **HITL / irreversible tools**: no `write` / `irreversible` / `external_comm`. Generation only.
- **Peer agents**: no specialist→specialist call; budget consume is once per request. HTTP does not pass `consumedInvocations`.
- **Voice boundary**: `handle-voice-turn.ts` does not import the orchestrator; inbound still uses `handleAgentTurn`.
- **Default traces**: handoff emit stores `{ toAgentId, reason, intent }` only, not `userText`. Logging adapter still omits payloads.
- **Fixtures**: `eval/runtime-multi-agent` has no real PII/live secrets (`eval/gate/hygiene.test.ts`). Injection case is fake-scripted; the real control is the missing tool port, not model obedience.
- **Secrets in repo**: no new credential files; `package-vendors` still forbids Langfuse/LangChain/official LLM SDKs.

### Verdict

**FAIL**

One Major on unauthenticated, unbounded, unrate-limited generative ingress; one Major on unbounded/unredacted specialist output versus the existing `runtime-demo` fail-closed bounds. Either blocks archive.

### Recommended next steps (before archive)

1. Do **not** run `/opsx-archive` on this verdict.
2. Update OpenSpec (auth, body/rate limits, reply bounds, sensitive-output) then implement in a **new** `/opsx-apply` pass — do not patch silently in this review.
3. Add tests: 401 without demo/inbound secret; 413 on oversize body; specialist oversize/canary fail-closed.
4. Re-run `/verify` and a fresh-session `/adversarial-review`.
