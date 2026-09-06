# Quality gate

Deterministic quality-and-safety gate for prompt, agent, retrieval, and voice-regression fixtures.

## Run

```bash
npm run test:eval-gate
```

Local default `gate` is `manual`. In CI, `CI=true` records `ci`. OpenSpec `/verify` may set `OPENSPEC_EVAL_GATE=openspec`.

The command executes:

- `eval/runtime-demo` (fake LLM)
- `eval/knowledge` (in-memory retrieval)
- `eval/voice` (inbound HTTP fixtures, no live telephony)
- `eval/runtime-multi-agent` (orchestrator + specialists, fake LLM)
- `eval/wom-customer-service` (WOM demo agent + mock tools, fake LLM)

It writes `eval/gate/last-run.json` (gitignored) and exits `0` only when the run is `passed` **and** matches `eval/gate/baseline.json`.

CI: `.github/workflows/quality-gate.yml` runs the same script with no paid credentials.

## PASS / FAIL

Required baseline and security members are full ids `suiteName/caseId`. A colliding suffix such as `spoof/injection-does-not-expand-allowlist` does not satisfy `runtime-first-agent/injection-does-not-expand-allowlist`. Two scores that share a final segment fail the compare. Executed suite `datasetVersion` and `promptVersion` must equal the baseline `suiteVersions` pin.

**PASS** when every required baseline case executed and passed, no required suite was skipped, no required metric dropped below the baseline value, and suite versions match the pin.

**FAIL** when a required case is missing, newly failing, a required suite is skipped, a security case is omitted, a suffix collides, or a suite version does not match the pin.

Extra cases beyond the baseline do not fail the gate unless they collide on suffix. The runtime never writes the baseline. `writeRunPath` is only `eval/gate/last-run.json`.

## Baseline ownership

`eval/gate/baseline.json` is checked in. Only a human reviewer / change owner may edit it to accept a new bar. The runtime never rewrites the baseline.

## What green does not mean

This gate is a small, reproducible set. It is **not** exhaustive red teaming, evaluation at scale, or an enterprise security program. Independent `/adversarial-review` remains required before archive when trust boundaries change.

## Judge

An optional `JudgePort` exists for later labeled quality cases. The default gate does **not** call a live judge and a judge score cannot override a failed security case.

## Canonical HTTP

`POST /evaluations/runs` and `GET /evaluations/runs/{runId}` in `lidr-specboot/docs/api-spec.yml` stay unimplemented.
