## Why

HU #003 shipped a working tool hop, but execution is a closed catalog inside one native adapter and the agent still hardcodes `demo.normalize_text`. AI Engineers cannot add a tool through a shared contract, distinguish invalid arguments from denials, or keep a Runtime MCP source off the boot path. HU #004 needs that extensible, safe tool runtime now, before any business catalog or live MCP client.

## What Changes

- Introduce an in-process **tool registry** (register, resolve, list) that owns catalog metadata aligned with `lidr-specboot/docs/data-model.md` `Tool`: name, risk class, closed schema, timeout, `source`, status.
- Keep **one product example tool** (`demo.normalize_text`, `riskClass` `read`, `source` `native`). Register a **second native test-only tool** so extensibility is proven without changing agent policy code or growing a product catalog.
- Validate arguments **and** success payloads against closed schemas. Invalid input MUST NOT execute. Distinct typed code `tool_invalid_args` (invalid I/O) vs `tool_denied` (unknown, disabled, not allowlisted, or disallowed source).
- Execute only after agent allowlist + registry resolve + schema + timeout. Thrown errors map to `tool_failed` and MUST NOT crash the process.
- **BREAKING** for callers that treated schema-invalid arguments as `tool_denied`: those attempts now return `tool_invalid_args`.
- Agent `runtime-demo` allowlists tools from `AgentVersion` policy (still only `demo.normalize_text` on the product path). The agent MUST NOT compare a hardcoded implementation name to decide execution.
- Prepare the **MCP source frontier**: catalog `source` MAY be `mcp`, but this increment MUST NOT start an MCP client, add an MCP package, or execute `source = mcp` tools. Development MCP remains unreachable. Default local start and CI stay MCP-free.
- Expand tool traces to include `source` and validation outcome. No new public HTTP tool invoke API (`lidr-specboot/docs/api-spec.yml` `/tools/{toolName}/invoke` stays unimplemented).

## Non-goals

- Large or business-facing tool catalog (booking, billing, CRM, payments, messaging).
- Tools with `write`, `irreversible`, or `external_comm` risk; HITL approval queues; operator UI.
- Productive third-party integrations or vendor SDKs in the core.
- Runtime MCP as a mandatory library, process, or executed tool source.
- Development MCP (Cursor/IDE) registered as product tools.
- New chat channel, Session/Conversation/ToolCall tables, RAG, multi-agent handoffs.
- Prompt rewrite except the minimum needed so allowlist is policy-driven, not a hardcoded tool name in application logic.
- Implementing canonical product HTTP `invokeTool`.

## Change types

`code` | `tools` | `agent`

Not in this change: `api` (no new routes; inbound voice is regression only), `rag`, `voice` (no media/turn-taking change), `ui`.

## Capabilities

### New Capabilities

- _(none)_ — registry, validation, and MCP frontier extend the existing tool capability rather than a parallel catalog spec.

### Modified Capabilities

- `tool-execution`: Registry/resolve, closed input/output schemas, distinct invalid-args vs deny, contained failures, one product example plus one test-only native tool, MCP source reserved and never executed, no MCP boot dependency.
- `first-agent`: Product allowlist stays `demo.normalize_text` only; resolution uses agent policy + registry, not a hardcoded tool implementation check.
- `provider-ports`: Tool adapters may be native or a future MCP source behind the same port; this change MUST NOT ship a runtime MCP client or require MCP to start.
- `application-runtime`: Default composition wires the native registry only; process start MUST succeed with zero MCP servers.

## Impact

- **Code:** `src/domain` / `src/application` gain registry and validation contracts; `src/adapters/tools` stops being a single-function executor; `handle-agent-turn` drops the hardcoded `DEMO_NORMALIZE_TEXT` equality check; architecture/package tests assert no MCP SDK.
- **APIs:** No new HTTP routes. Existing health and inbound voice remain regression surfaces. Canonical `invokeTool` is not implemented.
- **Dependencies:** No MCP, LangGraph, or vendor tool SDK packages. TypeScript/Zod (or equivalent already in repo) for schemas.
- **Data:** In-process catalog only. No PostgreSQL `Tool` / `ToolCall` migrations.
- **Eval / security:** Frozen tool/agent cases for register-and-invoke, invalid args, deny, timeout, contained throw, MCP-source rejected, injection does not expand allowlist. Adversarial review remains after `/verify` because the trust boundary around tools expands.
