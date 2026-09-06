# Session call evaluation (HU #012)

Deterministic, explainable scoring of a completed WOM demo voice **Session** using only HU #011 persisted evidence. This is **not** the offline quality gate (`EvaluationRun` / `npm run test:eval-gate`) and does **not** open canonical `POST /evaluations/runs`.

## Dimensions

Canonical ids (English, contract/code):

| Id | Interviewer subtitle (Spanish UI) |
| --- | --- |
| `goal_achieved` | ¿Se cumplió el objetivo? |
| `tool_selection` | ¿Se seleccionó la herramienta correcta? |
| `grounded_answer` | ¿La respuesta estuvo grounded en el tool? |
| `policy_compliance` | ¿Se respetaron las políticas de la demo? |

Verdicts: `met` | `partial` | `unmet` (UI: Cumplido / Parcial / No cumplido).

Overall: `passed` | `partial` | `failed`.

## Evidence

Each dimension carries evidence refs `{ kind, id?, field?, note }` pointing at persisted tool calls, turns, events, or session fields. The scorer never invents missing row ids.

## Scoring rules (summary)

- Prefer structured `toolCalls` + final assistant grounding over ASR phrase matching.
- Demo tools: `wom.get_customer_usage`, `wom.get_bill_status`, `wom.check_service_status`.
- Goal `met` when correct tool succeeded and final assistant text overlaps distinctive tool-result tokens.
- Policy uses lax Spanish cues and hard fails on secret-shaped text or claims of real WOM production systems.

Scorer version constant: `session-call-eval/1.0.0` (`src/domain/session-call-evaluation.ts`).

## Persist vs recompute

- On `call_ended` (terminal session), the runtime scores and stores JSON on `sessions.evaluation`.
- `GET /sessions/{id}` with the **operator** secret may lazy-backfill or `?recompute=true` to refresh and persist.
- `GET /sessions/{id}` with **`DEMO_PUBLIC_TOKEN`** (`x-demo-public-token` only) returns the persisted evaluation and **must not** write or recompute (403 if `recompute=true`).
- Public `GET /sessions` requires `externalChannelId` (403 if omitted).

## Auth

- Operator: `x-demo-orchestrate-secret` (`DEMO_ORCHESTRATE_SECRET` or else `VOICE_INBOUND_SECRET` on the server — never in the browser).
- Public read: `x-demo-public-token` = `DEMO_PUBLIC_TOKEN`, which MUST be distinct from inbound/operator secrets.
- Browser interview UI: passcode entry only; do not bake write or read tokens into Vite env for public demos.

## Distinction from quality gate

| Surface | Purpose |
| --- | --- |
| Session call evaluation | Interviewer-facing per-call score on demo evidence |
| `eval/gate` | CI offline suites with fakes; regression for generative paths |
