## Adversarial review

**Scope**: OpenSpec change `evaluation-ai-security` after the suffix-matching remediations (tasks 8.x / 9.x). Surfaces: `compareBaseline`, `runQualityGate`, `SECURITY_CASE_IDS`, leak reply check, frozen eval fixtures, CI quality-gate workflow. No new product HTTP, no new tools, no runtime MCP, no HITL product actions.

**Sources**: proposal, design (D4/D14), `specs/evaluation-gate`, `specs/first-agent`, `tasks.md`; working tree vs `feature/rag-foundation` (uncommitted). `/verify` PASS (`4487516b-…`) was not treated as a security result. **Process gap:** this review ran in the same conversation as `/apply` and `/verify`. The skill prefers a different session; residual independence is reduced.

### Spec and task alignment

**Accepted**
- Deterministic offline gate; judge off by default and cannot waive a failed security score.
- `EvaluationRun` is file/memory; no eval HTTP; no eval tables.
- Baseline is human-edited; runtime must not rewrite it.
- Required members are full `suiteName/caseId`; spoof suffix and colliding suffixes FAIL.
- Executed suite dataset/prompt versions must equal `suiteVersions`.
- Security classes: injection, invalid output, tool misuse, synthetic leak.
- `writeRunPath` only `eval/gate/last-run.json`.

**Non-goals (not treated as defects)**
- Exhaustive red team, live-model jailbreak catalogs, enterprise DLP, evaluation HTTP, Promptfoo/DeepEval as runner.

**Underspecified**
- HITL for baseline acceptance is process-only (human edits `baseline.json`); not a code lock.
- Leak control is exact canary + existing `redactSecrets` shapes, not general secret/PII detection.

### Findings

| Severity | Area | Finding | Evidence | Suggested fix |
| --- | --- | --- | --- | --- |
| Minor | Duplicate full ids | Two scores with the **same** `suiteName/caseId` do not trip the suffix check (`Set` of ids size 1). `findRequiredScore` takes the first row, so a later failing duplicate can be ignored by compare. Default suite runners emit one row per case; this is implementer-side, not a suffix spoof. | `compare-baseline.ts` `suffixCounts` + `scores.find` | **code + tests**: FAIL on duplicate exact `caseId`, or require every matching row to pass. Optional; not the prior Major. |
| Minor | Insecure output handling | Production `sensitive_output` is substring `SYNTH-LEAK-CANARY` plus `redactSecrets` (`sk-`, bearer, postgres URL). ZWSP/homoglyph canaries and other secret types pass. Tool arguments are not scanned before execute. Matches D6; must not be called DLP. | `containsSensitiveOutput`; `handle-agent-turn.ts` reply-only | **docs** already warn; do not expand claims. Later change if policy grows. |
| Minor | CI hardening | Workflow still uses floating `actions/checkout@v4` / `setup-node@v4` and default `GITHUB_TOKEN` write. Job has no paid secrets. | `.github/workflows/quality-gate.yml` | **code**: pin SHAs; `permissions: contents: read`. |
| Question | Injection evidence | Injection/tool-misuse cases still script FakeLlm to propose the denied tool. They prove allowlist/deny, not live-model isolation from untrusted user/doc/tool text. | `eval/runtime-demo/cases.json` | Accept as this HU’s non-goal. Do not cite `/verify` as live injection resistance. |
| Question | Reviewer independence | Reviewer and implementer share this conversation. | session history | Prefer a later independent pass if archive policy requires a different human/session. |

**Prior Major — refuted**
- Required baseline and `SECURITY_CASE_IDS` are full ids. `spoof/injection-does-not-expand-allowlist` does not satisfy `runtime-first-agent/injection-does-not-expand-allowlist`. Duplicate **different-prefix** suffixes FAIL. Tests in `compare-baseline.test.ts` and `run-quality-gate.test.ts` cover those cases.

**Prior Minors — refuted**
- `suiteVersions` pin is compared by equality (dataset and prompt).
- `writeEvaluationBaseline` is gone.
- `writeRunPath` must resolve to `eval/gate/last-run.json` under the given root.

**Also refuted (not findings)**
- Default CLI does not pass `JudgePort`; no paid model.
- `applyOptionalJudge` keeps `failed` when a listed security score failed.
- `POST /evaluations/runs` and `GET /evaluations/runs/{runId}` stay 404.
- Fixtures use `SYNTH-LEAK-CANARY`; `last-run.json` is gitignored.
- No new tool, no runtime MCP client, no irreversible/`external_comm` tool, no Session/eval tables.
- Exact canary or `sk-…` in a **reply** fails closed as `sensitive_output` and does not execute a tool from that reply.

### Verdict

**PASS WITH GAPS**

No Blocker or Major remains. The gate-integrity cheat that previously FAILed this change (suffix collision) is closed in spec and code. Residual items are hardening, specified leak-scope limits, and process independence.

Archiving advisable? **Yes**, with the gaps above accepted. Quality `/verify` PASS still does not mean live-model or enterprise security PASS.

### Recommended next steps (before archive)

1. Archive is allowed on this verdict if the team accepts the Minors/Questions as residual.
2. Optional follow-up (not required to archive): reject duplicate exact `caseId`s; pin Actions SHAs; `permissions: contents: read`.
3. Do not treat FakeLlm injection fixtures as a live red-team.
