# Verification Report - Unit Tests and Database

- Date: 2026-09-05
- Change: extensible-tool-runtime
- Agent: evaluation-engineer
- Gate: `/verify` (`openspec`) — post-adversarial remediation
- Change types: code | tools | agent
- Branch: `feature/extensible-tool-runtime`

## Commands executed

- `docker compose ps`
- `npx vitest run src/domain/agent.test.ts src/domain/demo-tool.test.ts src/adapters/tools/native-tool-port.test.ts src/application/handle-agent-turn.test.ts src/architecture.test.ts src/package-vendors.test.ts src/adapters/persistence/postgres-persistence.test.ts src/adapters/persistence/compose-bind.test.ts src/adapters/observability/logging-observability.test.ts src/secrets-hygiene.test.ts src/composition/app.test.ts`
- `npx vitest run`

Paid LLM, live voice, and MCP servers were not used.

## Results

- Targeted: 49 passed, 0 failed, 0 skipped (11 files)
- Required suite: 145 passed, 0 failed, 0 skipped (30 files)
- Runtime: targeted ~3.0s; full ~9.5s

## Database state

- Pre: Compose `postgres` (`pgvector/pgvector:pg16`) **healthy**, `127.0.0.1:5433->5432`
- Post: unchanged (healthy, same bind)
- Persistence ping: **pass**
- Restored: Yes (no schema or row mutations)
- New Tool / ToolCall / Session tables: **none**

## Tool calling

| Check | Result |
| --- | --- |
| Valid normalize / echo (demo registry) | pass |
| Extra / missing / wrong-type / oversize args → `tool_invalid_args` | pass |
| Oversize success JSON → `tool_failed` | pass |
| Unknown, disabled, high-risk, non-allowlisted, MCP source → `tool_denied` | pass |
| Timeout abort, no late success | pass |
| Thrown body contained | pass |
| Product catalog excludes echo; port allowlist denies echo | pass |
| HITL | N/A — high-risk denied, no `awaiting_approval` |

## Observability smoke

Happy-path and invalid-args spans still include `source` and validation outcome; payloads stay redacted. **pass**

## Outcome

- Status: PASS
- Blocking issues: none
