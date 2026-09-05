## Context

See `proposal.md` for motivation. Observed today: `ToolPort.authorizeAndExecute` is implemented by `NativeToolPort` with a one-entry `DEMO_TOOL_CATALOG` (`source` fixed to `"native"`). Argument validation is a single Zod schema inside that class. Invalid args return `tool_denied`. `handleAgentTurn` denies any `toolName` other than `DEMO_NORMALIZE_TEXT` before the port runs. Package and architecture tests already ban LLM/voice vendor SDKs; they do not yet mention MCP clients.

Canonical references: `lidr-specboot/docs/base-standards.md` (controlled autonomy, dual MCP, strict schemas), `backend-standards.md` (allowlist → validate → execute → record), `data-model.md` `Tool` / `ToolCall` as **in-memory catalog and attempt shapes**, not new tables.

Recorded assumptions from `/enrich-us` (not reopened here):

1. Keep `demo.normalize_text` as the only **product** example.
2. Prove extensibility with a second **test-only** native tool (`demo.echo_token`); the live `runtime-demo` allowlist does not include it.
3. MCP frontier is a reserved `source`, denied execution, and no client — not a wired stub process.

## Goals / Non-Goals

**Goals:**

- Split **catalog + policy + execute** so a new native tool is a registration + allowlist entry.
- Same `ToolPort` for all sources; this increment only **runs** `native`.
- Distinct typed failures: deny vs invalid args vs timeout vs contained throw.
- Change-type gates: **code**, **tools**, **agent**.

**Non-Goals:**

- Proposal non-goals (catalog growth, HITL, MCP client, HTTP invoke, Session tables).
- Voice media or inbound contract changes. `voice-ai-engineer` is not required.
- Durable `Tool` / `ToolCall` rows.

## Decisions

### D1 — Deterministic registry; agent only proposes

**Decision:** Registry, schema validation, allowlist, timeout, and error mapping are a typed workflow. The model still emits `type: tool` with `toolName` and `arguments`. The runtime authorizes and executes. One session owner: `runtime-demo`. `maxToolHops` stays `1`. No LangGraph. No Runtime MCP loop.

**Why:** `design-ai-system` / `base-standards.md`: deterministic when the path is fully specified; model never executes side effects.

**Alternatives:** Leave hardcoding (fails HU). Adopt MCP as the only catalog (contradicts “MCP not required”).

**Change types:** `code` | `tools` | `agent`. Not `api` | `rag` | `voice` | `ui`.

### D2 — In-process registry behind the existing tool port

**Decision:** Add a domain catalog type aligned with `data-model.md` `Tool` (name, riskClass, schemaRef or in-memory schemas, timeoutMs, source, status) plus an executor function or adapter handle. Application (or a small domain service) **registers** and **resolves**. `ToolPort.authorizeAndExecute` remains the only execute API. Composition in `createServer` builds the default registry (product + test-only native tools) and a `NativeToolPort` (or successor) that consults it. No PostgreSQL catalog.

**Why:** Ports already exist; HU is extensibility, not a new vendor. Hexagonal: core does not import MCP or HTTP tool clients.

**Alternatives:** New public `POST /tools/{name}/invoke`. Rejected: proposal non-goal; `api-spec.yml` stays unimplemented.

```text
handleAgentTurn
    │ allowlist from AgentVersion
    ▼
ToolPort.authorizeAndExecute
    │ resolve(name) → miss | disabled | wrong source → tool_denied
    │ validate args → tool_invalid_args
    │ execute + timeout + catch → ok | tool_timeout | tool_failed
    │ validate output → tool_failed if payload schema misses
    ▼
structured result + tool span (name, source, validation, redacted args)
```

### D3 — Agent allowlist is a string list, not an if-name branch

**Decision:** `handleAgentTurn` checks `decision.toolName` against the injected `runtime-demo` allowlist (still `["demo.normalize_text"]`). It MUST NOT special-case `DEMO_NORMALIZE_TEXT` as the only executable name. Tests prove a second allowlist (`["demo.echo_token"]`) succeeds on the same use case without editing the hop loop. Product composition keeps the one-name allowlist.

**Why:** DoD: add tools without modifying the agent. `design-agent`: allowlist lives on `AgentVersion`.

**Alternatives:** Keep the equality check and only refactor the adapter. Rejected: agent still coupled to one name.

### D4 — Closed input and output schemas; new error code

**Decision:** Each catalog entry carries a closed input schema and a closed output schema (`additionalProperties: false`). Validate args before the body. Validate success payload after the body; mismatch is `tool_failed` (executor produced an illegal success), not `tool_invalid_args`. Invalid args / extra properties: `tool_invalid_args`. Unknown / disabled / not allowlisted / `source !== native`: `tool_denied`. Add `TOOL_INVALID_ARGS` to `AGENT_ERROR_CODES` and safe message catalog. Voice mapping stays D8 of the prior change: `tool_timeout` → `VOICE_TIMEOUT`; `tool_invalid_args` → `VOICE_RUNTIME`.

**Why:** Current code conflates invalid args with deny. HU DoD needs rejected inputs to be observable. `design-tool`: parse failure does not execute.

**Alternatives:** Keep `tool_denied` for invalid args. Rejected: hides the contract failure.

**BREAKING:** Tests and any mapper that expected `tool_denied` for extra fields must switch to `tool_invalid_args`.

### D5 — Product example and test-only echo

**Decision:**

| Name | Role | Input | Output | Risk / source / HITL |
| --- | --- | --- | --- | --- |
| `demo.normalize_text` | Product example | `{ text: string }` | `{ normalizedText: string }` | `read` / `native` / none |
| `demo.echo_token` | Test-only extensibility | `{ token: string }` | `{ echoedToken: string }` | `read` / `native` / none |

Both timeouts ≤ 500 ms. No idempotency key (no retries, no side effects). Secrets never in schema. `demo.echo_token` may be omitted from default **product** allowlist but MUST be in the default **registry** so architecture/eval can see a second native tool.

**Why:** `design-tool` namespaced names; enrichment forbade a catalog and irreversible actions.

**Alternatives:** Only refactor `normalize_text` (cannot prove “add without changing the agent”). HTTP-backed example. Rejected.

### D6 — Contained execution

**Decision:** Wrap the executor in try/catch and `Promise.race` against `min(request.timeoutMs, catalog.timeoutMs)`. Throws → `tool_failed` with a generic message. Timeouts → `tool_timeout`. Tests inject a throwing executor and a hanging executor via registry, not by editing the product normalizer.

**Why:** DoD: errors do not break the runtime. Matches existing timeout race in `NativeToolPort`.

### D7 — MCP source reserved, never wired

**Decision:** `source` type is `native | mcp | http | workflow`. Execute path: if `source !== "native"` then `tool_denied` (no network). Tests register a fake `source: mcp` entry and assert deny + no client. `package-vendors.test.ts` / architecture tests MUST fail if an MCP client package or `src/domain` / `src/application` MCP import appears. Do not add `@modelcontextprotocol/*` or equivalent. Development MCP is not a catalog source.

**Why:** Dual MCP (`base-standards.md` §7). Ticket: prepare the frontier, MCP not a runtime dependency. Architect: do not adopt runtime MCP without a reason against a simpler port.

**Alternatives:** Ship a no-op MCP client class. Rejected: looks like a dependency and invites wiring. Document-only without a deny test. Rejected: frontier would be unenforceable.

### D8 — Traces, not tables

**Decision:** Widen tool spans with `source` and argument-validation outcome. Keep redaction (`text` / `token` redacted; never log `normalizedText` / `echoedToken`). No `ToolCall` migration. Default observability remains logging / test memory collector.

**Why:** Observability by default; prior adversarial constraint against retaining turn payloads.

### D9 — Eval fixtures extend `eval/runtime-demo/`

**Decision:** Keep Vitest + fake LLM. Add or update case ids: `invalid-schema-no-execute` (assert `tool_invalid_args`), `registered-not-allowlisted-denied` (`demo.echo_token` on `runtime-demo`), `mcp-source-denied`, plus a **deterministic unit** case `second-tool-via-registry` (test allowlist, no prompt change required). Do not add Promptfoo/DeepEval.

**Why:** `create-evals`: freeze contracts; reuse the existing runner.

### D10 — HITL and risk

**Decision:** Both shipped tools are `read`. No `Approval`. A later `write` / `irreversible` / `external_comm` or executed `source: mcp` tool is a new OpenSpec change and needs HITL or an explicit security exception.

**Budgets (unchanged unless noted):** `maxToolHops = 1`; tool timeout ≤ 500 ms; turn still inside existing voice handling timeout; no new token/cost budget.

## Risks / Trade-offs

- **[BREAKING error code for invalid args]** → Update unit, inbound, and eval assertions in the same change.
- **[Allowlist drift vs registry]** → Product allowlist stays one name; architecture test lists high-risk classes empty and asserts echo is not on `runtime-demo`.
- **[Injection / confused deputy]** → Policy allowlist + closed schemas; fixtures for extra fields and invented names. `/adversarial-review` still required before archive.
- **[MCP name in catalog without a client]** → Deny + package test so “prepared frontier” cannot silently become a live client.
- **[Fake second tool unused in voice]** → Voice path remains `normalize_text` only; prove echo in unit/eval, not live telephony.
- **[Output schema vs throw]** → Illegal success payload is `tool_failed` so callers do not treat garbage as facts.

## Migration Plan

1. Branch `feature/extensible-tool-runtime`.
2. TDD: error code, registry, schemas, echo tool, agent allowlist injection, MCP deny, package guard.
3. Update existing `tool_denied`-for-bad-args tests to `tool_invalid_args`.
4. Extend `eval/runtime-demo/` cases; run unit + tool + agent eval; write `reports/`.
5. Rollback: revert the branch; prior single-tool adapter and `tool_denied` for invalid args return.

### D11 — Adversarial remediations (post-review)

**Decision:**

- String tool arguments and string success fields are capped at **2048** characters (same as `MAX_REPLY_TEXT_CHARS`). Serialized tool-result JSON packed into the next model call is also capped at 2048 characters. Oversize args → `tool_invalid_args`. Oversize or illegal success → `tool_failed`; do not pack into the model.
- `riskClass` other than `read` → `tool_denied` and no body. No `awaiting_approval` in this increment.
- Timeout uses an abort signal (or equivalent). Late success after abort is discarded.
- Default **product** registry contains only `demo.normalize_text`. `demo.echo_token` lives in a test/demo registry. Product `NativeToolPort` is constructed with `allowedTools: RUNTIME_DEMO_ALLOWLIST`.
- `ToolRegistry.register` MUST NOT silently overwrite an existing name.
- `networkAttempts` is not used as a security proof; MCP deny tests assert the executor was not entered.

**Why:** `/adversarial-review` FAIL (2026-09-05): unbounded I/O re-entry and unused `riskClass`. Minors: product echo catalog, timeout race, disabled/high-risk tests, tool-result injection fixture.

## Open Questions

None that block this increment. Later changes may persist `Tool` / `ToolCall`, implement Runtime MCP, or add HITL for high-risk classes.
