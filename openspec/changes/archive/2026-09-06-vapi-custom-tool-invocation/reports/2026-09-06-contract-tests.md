# Verification Report - Contract Tests

- Date: 2026-09-06
- Change: `vapi-custom-tool-invocation`
- Agent: evaluation-engineer
- Phase: `/verify` (post-adversarial remediation-2)

## Surface

`POST /adapters/voice/tools` documented in `openapi/health.yaml`.

Auth header: `x-voice-inbound-secret` (`VOICE_INBOUND_SECRET`).
Error envelope: VoiceBoundaryError → canonical `success: false` via `mapErrorToEnvelope`.

## Commands executed

```text
npx vitest run src/adapters/http/voice-tools.test.ts
```

(Also included in combined verify gate: 58/58.)

## Results

- **7 passed**, 0 failed, 0 skipped
- Runtime: ~2.0s (standalone)
- Runner: Fastify `inject` (no live HTTP server / paid Vapi)

| Case | Expected | Observed |
| --- | --- | --- |
| Missing `x-voice-inbound-secret` | 401 | PASS |
| Wrong secret (no secret echo) | 401; body must not contain submitted secret | PASS (remediation-1) |
| Oversized body | 413; no secret leak | PASS (remediation-1) |
| Valid WOM tool (`wom.get_customer_usage`) | 200 + `{ results: [{ toolCallId, result }] }` | PASS |
| Deny outside allowlist (`demo.normalize_text`) | 200 with failure string result | PASS |
| Invalid payload (`assistant-request`) | 400 | PASS |
| Dual-brain: `VOICE_REASONING_OWNER=vapi` inbound transcript | 200 empty message; no agent turn | PASS |

## Outcome

- Status: **PASS**
- Blocking issues: none
