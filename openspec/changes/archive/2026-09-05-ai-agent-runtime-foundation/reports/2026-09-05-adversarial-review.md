## Adversarial review

**Scope**: OpenSpec change `ai-agent-runtime-foundation` (code + api), after the first-review remediations (Compose loopback, default listen host, broader redaction, `.env.*` ignore, health-auth exception in specs). Surfaces: fail-closed config, health HTTP, persistence ping, structured logs, unused provider ports. No product agent, tools, RAG, voice, or UI.

**Sources**: Proposal, design, delta specs (`application-runtime`, `health-checks`, `persistence-port`, `provider-ports`), `tasks.md`; `lidr-specboot/docs/base-standards.md` and `backend-standards.md` (Security, MCP); working tree `src/`, `docker-compose.yml`, `.gitignore`, `.env.example`, `README.md`, `docs/architecture.md`, `openapi/health.yaml`. Prior FAIL review in this file’s previous revision. No PR. **No merge-base `git diff`**: branch `feature/ai-agent-runtime-foundation` has zero commits (entire tree untracked). Implementation was reviewed as the current working tree, not an author’s summary. `/verify` PASS was not treated as a security PASS.

**Independence**: This pass ran in the conversation that executed `/verify` (evaluation reports only). It did not author the remediations. That is stronger than the first review (same session as `/apply`) and weaker than a fully separate reviewer session.

### Spec and task alignment

Acceptance in scope: fail-closed config; secrets not in source; `.env` / `.env.*` except `.env.example` ignored; canonical error envelope without secrets/stack; redaction of Postgres URLs, bearer tokens, `sk-` keys, and `*_API_KEY=` assignments; default HTTP listen `127.0.0.1`; Compose Postgres on loopback; live ≠ ready; persistence through a port; no AI-provider SDK in core; no product tools or irreversible actions; health unauthenticated by written exception.

Non-goals: agent, Vapi, RAG, runtime MCP, HITL product API, session tables.

AI surfaces: **no prompts, no tools, no retrieval, no transcripts**. Prompt injection, tool-schema abuse, irreversible execution, and runtime MCP mix-up are not present as executable product features. Dual MCP is documentation-only.

Prior FAIL (Compose published on all interfaces) is **refuted** by `docker-compose.yml` `127.0.0.1:5433:5432`, `compose-bind.test.ts`, README local-only warning, and the persistence-port spec. Prior Minors on listen host, health-auth exception, redaction shapes, and `.env.*` are **refuted** against the updated specs and tests (abuse/negative cases exist for those controls, not only happy path).

### Findings

| Severity | Area | Finding | Evidence | Suggested fix |
| --- | --- | --- | --- | --- |
| Minor | Future tools | HITL remains reserved policy. `ToolRiskClass` exists but `ToolExecuteRequest` / `ToolPort.authorizeAndExecute` do not require a risk class or `awaiting_approval`. Nothing in types stops the next change from executing `irreversible` / `external_comm` without confirmation. Acceptable for this slice (no product tools). | `src/domain/ports/tool-port.ts`; `docs/architecture.md` “reserved”; provider-ports spec scenario is forward-looking only. | **OpenSpec + code** (first tool change): put risk class and deny/HITL on the port and tests. Do not treat this review as enforcement. |
| Question | HTTP | `LISTEN_HOST=0.0.0.0` or `::` is still a valid opt-in; probes stay unauthenticated. Spec and README document `0.0.0.0` for a controlled orchestrator network. `::` is accepted by the host regex and is not called out next to `0.0.0.0`. Default listen remains loopback (tested). | `src/application/load-config.ts` `LISTEN_HOST_PATTERN`; design D5; `docs/architecture.md`. | **docs** (optional): mention IPv6 any-address (`::`) beside `0.0.0.0`. First public bind change should keep the health exception explicit. |
| Question | Logging | Redaction matches the specified shapes only. `password=`, `Basic`, `AKIA…`, PEM blocks, and tokens without `Bearer` / `sk-` / `*_API_KEY=` are not stripped. No such secrets are required to boot today. | `src/domain/redact.ts` vs application-runtime “Common secret shapes”; hygiene test only on `.env.example`. | **code + tests** when LLM/voice secrets enter the process: extend patterns; do not assume this helper is a general secret scanner. |
| Question | Process | No commits and no merge-base diff. Hygiene “committed repository has no secrets” cannot be proven from `git ls-files`. Working-tree review is still possible. | `git status`: `No commits yet on feature/ai-agent-runtime-foundation`. | Human: first commit should not add `.env`; optional second-session review if archive is high-stakes. |

Refuted (no open finding): all-interfaces Compose publish; default HTTP bind `0.0.0.0`; unspecified health auth vs methodology; `.gitignore` only `.env`; product LLM/voice adapter on default start; domain/application vendor or `pg` imports (architecture test); raw `pg` errors on the mapped HTTP path used by the adapter; unexpected HTTP errors leaking stack/secrets; runtime MCP wired into the process; side-effecting product tools.

### Verdict

**PASS WITH GAPS**

No Blocker or Major. Archive is **advisable** on security for this change. Residual items are reserved HITL (next tool change), opt-in all-interface listen, redaction scope, and uncommitted git history.

Quality `/verify` PASS does not change this verdict.

### Recommended next steps (before archive)

1. Archive may proceed. Do not treat reserved HITL text as a control.
2. Optional: first commit without `.env`; note `::` in listen-host docs.
3. On the first tool or prompt change: enforce risk class / HITL in the port and re-run `/adversarial-review` in a session that did not implement that change.
4. No product patch in this review pass.
