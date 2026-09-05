# Verification Report - Adversarial remediations

- Date: 2026-09-05
- Change: runtime-first-agent
- Gate: apply §11 after adversarial FAIL
- Quality: unit/contract/tool/agent/voice re-run **PASS**
- Security: **not this gate** — run a new independent `/adversarial-review` before archive

## Commands executed

- `npx vitest run` → 120 passed (29 files)
- `npx tsc --noEmit` → pass
- Targeted remediations + evals: `eval/runtime-demo`, `eval/voice`, inbound HTTP, `HttpLlm`, `handleAgentTurn`, secrets-hygiene → 42 passed (7 files)

Paid LLM and live telephony were **not** invoked.

## What changed

| Finding | Fix |
| --- | --- |
| HTTP LLM collapsed policy + user into one `user` message | Adapter posts `request.messages`; system vs untrusted roles |
| Fetch not aborted / unbounded body | `AbortSignal` at `LLM_TIMEOUT_MS`; 64 KiB body cap; `replyText` ≤ 2048 |
| Default `MemoryObservability` retained tool `normalizedText` | `LoggingObservability` is process default; tool spans emit `{ ok: true }` |
| Static-secret inbound replay | `VOICE_STALE` on `occurredAt` skew; `VOICE_RATE_LIMITED` per secret hash |
| Named turn states missing | Request-scoped `receiving` / `reasoning` / `awaiting_tool` / `completed` / `failed` |

## Eval notes

Voice suite gained `stale-occurred-at`. Success cases stamp `occurredAt` to now so freshness does not flake.

## Still required

Independent `/adversarial-review` (different session from implementer). Do not treat this report as a security PASS.
