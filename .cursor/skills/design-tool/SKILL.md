---
name: design-tool
description: Use when adding or changing a product-agent tool: JSON Schema, risk class, auth, timeouts, retries, idempotency, HTTP/MCP/workflow backing, or tool safety. Do not use for choosing agent vs n8n, or for Cursor/dev MCP setup.
author: LIDR.co
version: 1.0.0
---

# design-tool

Contract for one runtime capability. **Runtime MCP ≠ development MCP.**

**Agent:** `ai-engineer` (architect sets risk/HITL)

## When not to use

- IDE/Cursor MCP servers → not this skill; never register them as product tools
- Whole agent state → `design-agent`
- Voice confirmation UX → `design-voice-agent` (this skill still owns schema)

## Inputs

- Tool name, job, side effects, target system
- OpenSpec change

## Steps

1. Load `docs/backend-standards.md` (tool calling, MCP) and `docs/api-spec.yml` (invoke/approvals if HTTP).
2. Namespaced name (`domain.action`). `source`: `native` | `mcp` | `http` | `workflow`.
3. JSON Schema; `additionalProperties: false` unless explicitly open.
4. `riskClass`: `read` | `write` | `irreversible` | `external_comm`. HITL if required by policy.
5. Timeout, bounded result payload, structured `{ ok, code, message }` errors.
6. Idempotency key if retries + side effects.
7. Auth: least privilege, secrets not in schema or traces.
8. If MCP **runtime**: allowlist tool names anyway; timeouts; audit as `ToolCall`.
9. Tests: valid execute; invalid never execute; deny; timeout.

## Outputs

- Schema + risk + timeout + idempotency + test list in OpenSpec
- Catalog fields aligned with `docs/data-model.md` `Tool`

## Quality gates

- Parse failure does not execute
- Dev MCP credentials not used
- Extra properties rejected by default

## Documents

- `docs/backend-standards.md`, `docs/data-model.md`, `docs/api-spec.yml`, `docs/base-standards.md` (dual MCP)

## OpenSpec

`/ff` and `/apply` for tools change type. Gate: tool-calling tests in `openspec-tasks-mandatory-steps.md`.

## Combines with

- `design-agent` (allowlist)
- `instrument-ai-system` (args/result on span)
- `adversarial-review` (abuse)

## Verification

| Check | Pass |
| --- | --- |
| “MCP fetch URL tool” | Runtime allowlist + SSRF notes; not Cursor MCP |
| Avoids | Vendor tool JSON as domain; open schemas “for flexibility” |
