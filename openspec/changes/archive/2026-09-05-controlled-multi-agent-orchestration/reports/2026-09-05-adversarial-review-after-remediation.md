## Adversarial review

**Scope**: OpenSpec change `controlled-multi-agent-orchestration` after the post-FAIL remediations (auth, bounds, fail-closed output, step budget). Working tree vs `main` on `feature/controlled-multi-agent-orchestration`. Review limited to the multi-agent slice (orchestrator, specialists, `POST /demo/orchestrate`, prompts, eval suite), not a re-audit of archived observability/eval-gate history that landed via merge.

**Sources**: change `proposal.md`, `design.md`, `tasks.md`, `specs/**`; `lidr-specboot/docs/base-standards.md` and `backend-standards.md` (Security, tools, MCP, HITL); `demo-orchestrate.ts`, `create-server.ts`, `handle-orchestrated-turn.ts`, `orchestration.ts`, `http-llm.ts`, `map-error.ts`, specialist prompts, `eval/runtime-multi-agent/cases.json`, `orchestrate.test.ts`. `/verify` quality PASS was not treated as a security PASS.

**Independence**: This review ran in the **same conversation** that implemented remediations and ran `/verify`. That weakens independence. A fresh-session re-review is preferred if archive policy requires a different author session.

### Spec and task alignment

Acceptance: closed-intent routing to one of two specialists; common structured contract; orchestrator owns flow; `maxSpecialistInvocations = 1` / `maxSteps = 4`; fail-closed errors including oversize and `sensitive_output`; demo HTTP with secret-when-configured, 16 KiB body, rate limit, `userText` bounds; voice inbound stays on `runtime-demo`; HTTP MUST NOT accept `consumedInvocations` or `packedContext`.

Non-goals: swarms, peer messaging, production multi-agent, session CRUD, new tools/RAG/HITL/voice media.

HITL: none specified; specialists remain generation-only with empty allowlists. Prior underspecification of demo-route auth is now in spec § Demo HTTP is authenticated and bounded.

### Prior majors (refuted)

| Prior finding | Why it no longer blocks |
| --- | --- |
| Unauthenticated generative ingress / token spend | Secret required when configured (401, no LLM). HTTP LLM with no secret is `orchestration_config` 503. 16 KiB `bodyLimit`, inbound-style rate limiter, empty/`userText` rejected before the model. Tests cover 401, 413, empty text, 503. |
| Unbounded / unredacted specialist output | Fields capped at 2048; `containsSensitiveOutput` → `sensitive_output`. Eval cases `specialist-oversize-output-fail-closed` and `specialist-canary-output-fail-closed`. |

### Findings

| Severity | Area | Finding | Evidence | Suggested fix |
| --- | --- | --- | --- | --- |
| Minor | AuthZ vs docs | `backend-standards.md` requires authorization on every HTTP route. Spec and design still allow **unauthenticated** `POST /demo/orchestrate` when LLM mode is `fake` and no secret is set (rate-limited as `anonymous`). Exposed `LISTEN_HOST=0.0.0.0` then offers an open demo route. No paid-token path. | `authenticateDemoOrchestrate` returns when `secret` is unset and `llmMode === "fake"`; design §7b | **docs/OpenSpec** (already stated) or **code**: require a secret whenever the process listens off loopback |
| Minor | Error envelope | Fastify 413 on this route still maps to `VOICE_PAYLOAD_INVALID`, not an orchestration code. Status 413 is tested; the code is voice-shaped. | `map-error.ts` `isClientProtocolError`; `orchestrate.test.ts` asserts status only | **code/tests**: map demo 413 to `payload_invalid` or document the shared client-protocol code |
| Minor | Spec vs live LLM | `HttpLlm.completeStructured` throws agent `invalid_output` on non-JSON. Orchestration maps any non-timeout/non-`llm_provider` throw to `specialist_failed` (500), not `invalid_output` (400). Still fail-closed. Fake path never hits this. | `http-llm.ts` L55–57; `mapSpecialistInvokeError` | **code**: treat `invalid_output` on the thrown error as `invalid_output` |
| Minor | Test gaps | Rate limit (`429` `rate_limited`) and wrong-secret (vs missing-secret) 401 are specified/implemented but not asserted on the demo route. | `create-server.ts` limiter; no orchestrate 429 / mismatch test | **tests**: limiter `max=1` second request; header mismatch |
| Minor | Secret reuse | Demo secret falls back to `VOICE_INBOUND_SECRET`. A leaked demo header is also the voice inbound credential. Standards ask for separate secrets. Dedicated `DEMO_ORCHESTRATE_SECRET` exists but is optional. | `resolveDemoOrchestrateSecret` | **ops/docs**: set a distinct demo secret in any shared host |
| Question | Test hooks | `consumedInvocations`, `consumedSteps`, and `packedContext` remain on the use-case input. HTTP `.strict()` rejects the first two field names and `packedContext`. A later thin mapping would re-open budget/packet injection. | `OrchestratedTurnInput`; `demo-orchestrate.ts` schema | Keep hooks off the public route |
| Question | Process | Review is not a fresh session from the implementer. | This chat ran `/opsx-apply` remediations and `/verify` | Re-run `/adversarial-review` in a new session if independence is mandatory |

### Surfaces considered (no additional finding)

- **Routing / swarm**: closed intent table; user text cannot pick the specialist or fan out. Unroutable calls no LLM.
- **Tool abuse / MCP**: no `ToolPort` / `RetrievalPort` on the use case. Empty allowlists. No runtime MCP expansion. Dual MCP unchanged.
- **HITL / irreversible tools**: no `write` / `irreversible` / `external_comm`.
- **Peer agents**: one consume per request; HTTP does not pass invocation/step hooks.
- **Prompt isolation**: `messages` keep policy on `system`; `input` is the packet only. `HttpLlm` prefers `messages`.
- **Voice boundary**: `handle-voice-turn.ts` does not import the orchestrator.
- **Default traces**: handoff emit stays `{ toAgentId, reason, intent }`. HTTP `sessionId` must be a UUID when provided.
- **Fixtures**: new oversize/canary cases use the synthetic canary, not live secrets. Hygiene tests still apply.
- **Secrets in repo**: `.env.example` adds empty `DEMO_ORCHESTRATE_SECRET=`. No credential files.

### Verdict

**PASS WITH GAPS**

Prior Majors are refuted by code and tests. Remaining items are residual policy exceptions, error-code mapping, and test/process gaps. None are Blocker or Major.

**Archiving advisable?** Yes, on this technical verdict. Prefer a fresh-session re-review if the team treats same-session review as non-independent. Quality PASS remains distinct from this verdict.

### Recommended next steps (before archive)

1. Optional hardening (same change or follow-up): require a secret off loopback; map HttpLlm parse failures to `invalid_output`; add 429 and wrong-secret tests; prefer `DEMO_ORCHESTRATE_SECRET` over the voice secret.
2. `/opsx-archive` is allowed under PASS WITH GAPS. Do not treat `/verify` as a substitute for this review.
