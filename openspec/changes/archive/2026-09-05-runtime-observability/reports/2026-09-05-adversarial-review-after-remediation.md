## Adversarial review

**Scope**: `runtime-observability` after adversarial remediations (queryHash, composed `requestId` redaction, `occurredAt`). Working tree on `feature/runtime-observability`.

**Sources**: Updated OpenSpec specs/design/tasks; `handle-agent-turn.ts` retrieve emit; `handle-voice-turn.ts` finish logs; `logging-observability.ts`; `redact.ts`; composed logger test; `createRuntime` default `JsonLogger`. `/verify` PASS was not treated as a security PASS.

**Independence**: Same conversation as implement/`/apply`. Weaker than a fresh session.

### Spec and task alignment

Acceptance unchanged: reconstructable `traceId`, metadata-only default emit, no vendor SDK. Deltas now require no raw query on the port, composed secret-shaped `requestId` redaction, and ISO `occurredAt` on `voice.turn`. Those three are implemented and tested. Spec still requires caller `requestId` / `interactionId` on records when present (so they cannot be removed without a spec change).

### Prior findings (re-check)

| Prior | Status |
| --- | --- |
| Raw/redacted query text on retrieval spans | **Refuted** — `argumentsRedacted.queryHash` only; tests assert utterance absent |
| No composed `sk-` `requestId` test | **Refuted** — `should_redact_secret_shaped_request_id_on_composed_json_logger_path` |
| Voice logs missing timestamp | **Refuted** — `occurredAt: turn.occurredAt.toISOString()` |

### Findings

| Severity | Area | Finding | Evidence | Suggested fix |
| --- | --- | --- | --- | --- |
| Minor | Redaction catalog | `redactSecrets` still only matches postgres URLs, Bearer, `sk-`, and `*_API_KEY=`. A caller `requestId` such as `AKIA…`, `ghp_…`, or a raw JWT without `Bearer ` is still copied onto `voice.turn` and every span, then written if it survives JsonLogger. Spec only required secret-shaped ids; `sk-` is proven. Other shapes are not. | `redact.ts`; `handle-voice-turn.ts` copy-through; composed test covers `sk-proj-` only | **code/tests** (follow-up): widen patterns or hash caller correlation ids; keep join key as `traceId` |
| Question | Process | Review is still not a different session from the implementer. | This chat | Optional fresh-session re-review |
| Question | Hash | `queryHash` is unsalted SHA-256 truncated to 16 hex. It does not restore speech. It can confirm a guessed phrase. Default adapter does not log `argumentsRedacted` at all. | `hashQueryForLog`; `LoggingObservability` field allowlist | Accept, or salt/HMAC if confirmation risk matters later |

### Surfaces considered (no additional finding)

- No new tools, prompts, MCP, HITL, or trace-query API
- Default emit still drops payloads; process default logger is `JsonLogger`
- `traceId` remains server-generated
- JSON stringify mitigates log-line injection
- Collecting/vendor adapter still out of scope and still needs its own review

### Verdict

**PASS WITH GAPS**

No Blocker or Major. The three remediations hold on the default path. Residual: incomplete secret-shape catalog for caller correlation ids, and same-session independence.

Archiving advisable: **Yes**.

### Recommended next steps (before archive)

1. Archive is acceptable. Optional follow-up: widen `redactSecrets` or hash `requestId` / `interactionId`.
2. Fresh-session `/adversarial-review` only if policy requires stricter independence.
3. Do not ship a collecting/vendor observability adapter without a new review.
