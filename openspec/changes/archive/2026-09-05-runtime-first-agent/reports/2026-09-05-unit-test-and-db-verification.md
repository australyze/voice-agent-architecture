# Verification Report - Unit Tests and Database

- Date: 2026-09-05
- Change: runtime-first-agent
- Agent: evaluation-engineer
- Gate: `/verify` (`openspec`) — post-remediation re-run
- Change types: code | tools | agent | voice

## Commands executed

- `npx vitest run src/domain/agent.test.ts src/adapters/tools/native-tool-port.test.ts src/application/handle-agent-turn.test.ts src/application/handle-voice-turn.test.ts src/architecture.test.ts src/package-vendors.test.ts src/adapters/persistence/postgres-persistence.test.ts src/adapters/persistence/compose-bind.test.ts src/adapters/llm/http-llm.test.ts src/adapters/observability/logging-observability.test.ts src/secrets-hygiene.test.ts`
- `npx vitest run` (full regression)
- `docker compose ps`

## Results

- Targeted: 42 passed, 0 failed, 0 skipped (11 files)
- Required suite: 120 passed, 0 failed, 0 skipped (29 files)
- Runtime: targeted ~5.5s; full ~7.9s

## Database state

- Pre: Compose service `postgres` (`pgvector/pgvector:pg16`) **healthy**, bind `127.0.0.1:5433->5432`
- Post: unchanged (healthy, same bind)
- Persistence ping through the port: **pass** (`should_ping_through_the_persistence_port_when_compose_is_available`)
- Restored: Yes (no schema or row mutations in this gate)
- New Session / ConversationTurn / ToolCall tables or domain-row mutations: **none**

## Tool calling

`src/adapters/tools/native-tool-port.test.ts` plus eval cases:

| Check | Result |
| --- | --- |
| Valid `demo.normalize_text` | pass (`hello world`) |
| Extra properties never execute | pass |
| Missing / wrong-type `text` never execute | pass |
| Unknown tool → `tool_denied` | pass |
| Over-budget → `tool_timeout` | pass |
| HITL / `awaiting_approval` | N/A — catalog is `read` only |

## Outcome

- Status: PASS
- Blocking issues: none
