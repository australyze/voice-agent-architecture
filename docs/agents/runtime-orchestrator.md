# runtime-orchestrator

Deterministic session owner for the **demo** multi-agent path. It does not call a model. Voice inbound still uses `runtime-demo` via `handleAgentTurn`.

## Catalog

| Identity | Role | Tools |
| --- | --- | --- |
| `runtime-orchestrator` | Owner | none (`maxToolHops` 0) |
| `demo-normalize` | Specialist | none |
| `demo-classify` | Specialist | none |

## Request

`POST /demo/orchestrate`

When `DEMO_ORCHESTRATE_SECRET` or `VOICE_INBOUND_SECRET` is set, send header `x-demo-orchestrate-secret`. HTTP LLM mode without a secret returns `orchestration_config` (503).

```json
{ "userText": "Hello World", "intent": "normalize", "locale": "en" }
```

Closed `intent` values: `normalize` | `classify`. Missing or unknown intent returns the canonical error envelope with `unroutable` and does not call a model.

Success includes `sessionId`, `intent`, `specialistId`, `replyText`, and either `normalizedText` or `label`. Do not send `consumedInvocations` or `packedContext` on HTTP.

## Limits and errors

- `maxSpecialistInvocations` = 1
- `maxSteps` = 4 (`receiving` → `routing` → `awaiting_specialist` → `completed` | `failed`)
- Body limit 16 KiB; `userText` 1–4096 characters; specialist `replyText` / job fields max 2048 characters
- Caller `sessionId` must be a UUID when provided
- Codes: `unroutable`, `invalid_output`, `llm_timeout`, `llm_provider`, `budget_exceeded`, `specialist_failed`, `sensitive_output`, `unauthorized`, `orchestration_config`, `rate_limited`, `payload_invalid`, `session_invalid`

Canonical `POST /sessions` and `POST /sessions/{sessionId}/turns` stay unimplemented.

## Prompts

Versioned artifacts `prompts/demo-normalize/v1.md` and `prompts/demo-classify/v1.md`. User text and the orchestrator packet are packed as `UNTRUSTED_ORCHESTRATOR_PACKET` on the user role.

## Traces

One `traceId` across `http.demo.orchestrate`, `orchestration.turn`, `orchestration.route`, `orchestration.handoff`, and specialist `llm` spans.

## Eval

Frozen suite `eval/runtime-multi-agent` is a required quality-gate member. See [evaluation-gate.md](../evaluation-gate.md).
