## Why

Per-surface Vitest suites already exist (`eval/runtime-demo`, `eval/knowledge`, `eval/voice`), but a generative change can still be treated as correct because a happy path “works.” There is no single recorded `EvaluationRun`, no checked-in baseline comparison, and no documented PASS/FAIL quality gate that an AI Engineer can run locally or in CI. HU #006 needs that gate now, before more prompt, agent, or RAG work ships on demo confidence alone.

## What Changes

- Add a **deterministic quality-gate workflow** that runs the small frozen evaluation set, records suite/dataset/prompt/model versions, emits per-case scores, and produces an explicit **PASS/FAIL**.
- Persist each run as an in-process **`EvaluationRun` + `EvaluationScore`** artifact matching `lidr-specboot/docs/data-model.md` (file or memory). Do **not** add PostgreSQL eval tables or HTTP `/evaluations/runs` in this increment.
- Compare the run to a **checked-in baseline**. A missing required case, a new fail, or a metric drop is FAIL. Accepting a new baseline is a **human** action, not a model decision.
- Keep **deterministic checks first** (schema/invalid output, allowlisted tools, injection, synthetic leak canaries). **LLM-as-judge** is an optional port for labeled quality cases only; the default local/CI gate MUST pass with fakes and MUST NOT call a paid model.
- Extend agent fixtures with a **sensitive-output leak** case (synthetic canary). Existing injection, invalid-output, and tool-misuse cases remain required members of the gate.
- Document the gate: what it covers, how to run it, PASS/FAIL rules, and what green does **not** mean (not exhaustive red team, not enterprise security).

## Non-goals

- Exhaustive red teaming, jailbreak catalogs, or a continuous adversarial program (`/adversarial-review` stays independent).
- Evaluation at production scale, traffic sampling, or statistically powered A/B.
- Enterprise security framework (SIEM, SOC2 control library, full threat-model program).
- Fine-tuning, reward models, or training on customer transcripts.
- Implementing canonical HTTP `POST /evaluations/runs` / `GET /evaluations/runs/{runId}` from `lidr-specboot/docs/api-spec.yml`.
- PostgreSQL `EvaluationRun` tables or an operator evaluation UI.
- Mandating Promptfoo, DeepEval, Langfuse, LangGraph, or a new LLM vendor as the runner.
- Replacing existing per-surface Vitest suites; the gate aggregates them.
- Changing voice media, barge-in, or spoken UX (existing `eval/voice` is consumed as regression only).
- Auto-merging or auto-updating the baseline when a judge score is high.

## Change types

`code` | `tools` | `agent` | `rag`

Not in this change: `api` (canonical evaluation HTTP stays unimplemented), `voice` (no media/turn-taking change), `ui`.

## Capabilities

### New Capabilities

- `evaluation-gate`: Reproducible quality-and-safety gate for generative surfaces: frozen cases, deterministic scoring, optional judge port (off by default), `EvaluationRun` artifact, baseline comparison, documented PASS/FAIL, local/CI execution without paid APIs.

### Modified Capabilities

- `first-agent`: The `runtime-demo` eval set MUST include a synthetic sensitive-leak case and MUST be a required member of the quality gate. Existing injection, invalid-output, and tool-misuse fixtures remain mandatory.

## Impact

- **Code:** New domain shapes for `EvaluationRun` / `EvaluationScore`; application use case to run the gate and compare a baseline; optional `JudgePort` (structured score) unused on the default path; CLI or npm script that writes a run artifact. Existing `eval/*` suites stay the case runners.
- **APIs:** No new HTTP. `lidr-specboot/docs/api-spec.yml` evaluation routes remain unimplemented. Health and inbound voice stay regression-only.
- **Dependencies:** TypeScript and Vitest only. No Promptfoo, DeepEval, Langfuse, or official LLM SDKs.
- **Data:** File/in-memory run + checked-in baseline. No new Session or eval tables. Shapes follow `data-model.md` EvaluationRun / EvaluationScore.
- **Eval / security:** This change *is* the evaluation infrastructure. Basic security classes (prompt injection, invalid output, synthetic leak, tool misuse) have failing-closed cases. Independent `/adversarial-review` still required before archive because trust-boundary tests expand.
