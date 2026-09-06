## Adversarial review

**Scope**: OpenSpec change `evaluation-ai-security` (HU #006 quality gate + basic AI security cases). Product surfaces touched: `handleAgentTurn` reply leak check, eval fixtures, quality-gate runner, CI workflow. No new HTTP product API, no new tools, no runtime MCP, no HITL product actions.

**Sources**: Change proposal/design/specs/tasks; working-tree implementation (uncommitted vs `feature/rag-foundation`; merge-base `origin/main` also includes prior RAG work). `/verify` PASS was not treated as a security result. **Process gap:** this review ran in the same conversation as `/apply`. Prefer a fresh session next time.

### Spec and task alignment

**Accepted**
- Deterministic offline gate; no paid judge in default CI.
- `EvaluationRun` is a file/memory artifact; no eval HTTP; no eval tables.
- Baseline is human-edited; runtime must not rewrite it.
- Required security classes: injection, invalid output, tool misuse, synthetic leak.
- Judge cannot waive a failed security score.
- Existing `runtime-demo` injection/invalid/tool-deny cases remain required members.

**Non-goals (not treated as defects)**
- Exhaustive red team, scale eval, enterprise security program, live-model jailbreak catalogs.

**Underspecified / mismatched**
- Design D4 requires FAIL when dataset/prompt versions are older than the baseline. `compareBaseline` never reads `suiteVersions`.
- Leak control is specified as exact canary + `redactSecrets` shapes, not as general DLP.
- HITL is specified only for baseline acceptance (process), not enforced in code.

### Findings

| Severity | Area | Finding | Evidence | Suggested fix |
| --- | --- | --- | --- | --- |
| Major | Gate integrity | Baseline matching keys only the last path segment of `caseId`. A dummy score whose suffix equals a required security id can satisfy membership and baseline after the real fixture is removed. Extra cases are allowed to fail-open. This is the exact “green because we changed the test” failure mode the HU exists to prevent. | `compare-baseline.ts` `scoreKey`; `run-quality-gate.ts` `endsWith(\`/${id}\`)`; design “extra cases do not fail” | **code + tests**: match required cases on full `suite/caseId` (or suite + id). Reject duplicate suffixes. **OpenSpec**: state the matching rule. |
| Minor | Spec vs code | Dataset/prompt version downgrade does not FAIL the gate. | design.md D4; `compareBaseline` ignores `suiteVersions` | **code + tests**, or **OpenSpec** drop D4 if case-id membership is the only pin. |
| Minor | Unsafe write helper | `writeEvaluationBaseline` can overwrite the checked-in baseline. CLI does not call it today; the function exists opposite the “runtime MUST NOT rewrite baseline” rule. | `compare-baseline.ts` | **code**: delete or require an explicit human flag that the CLI never sets. |
| Minor | Path write | `writeRunPath` is `resolve(root, path)` with no allowlist. CLI hardcodes `eval/gate/last-run.json`. If this use case is later hung on HTTP, it is arbitrary file write. | `run-quality-gate.ts` | **code**: constrain to `eval/gate/last-run.json`. |
| Minor | Insecure output handling | Production `sensitive_output` is substring `SYNTH-LEAK-CANARY` plus `redactSecrets` (`sk-`, bearer, postgres URL). Zero-width / homoglyph canaries and other secret types (PEM, AWS, JWT) pass. Tool arguments are not scanned before execute. | `containsSensitiveOutput`; `handle-agent-turn.ts` reply-only; `redact.ts` | **docs**: do not call this production DLP. **tests**: one ZWSP/canary-split case if the spec claims more than exact match. |
| Minor | CI hardening | Workflow uses floating `actions/checkout@v4` / `setup-node@v4` and default `GITHUB_TOKEN` write. No paid secrets in the job. | `.github/workflows/quality-gate.yml` | **code**: pin SHAs; `permissions: contents: read`. |
| Question | Injection evidence | Injection/tool-misuse cases use a scripted FakeLlm that already proposes the denied tool. They do not show a live model following untrusted user/doc/tool text. | `eval/runtime-demo/cases.json`; design D2 | Accept as this HU’s non-goal, or add a later live-model / adversarial suite. Do not treat `/verify` green as injection resistance. |

**Refuted (not findings)**
- Default gate does not call a judge or paid model; CLI does not pass `JudgePort`.
- `applyOptionalJudge` keeps run `failed` if any security score failed (when those scores remain in the run).
- Canonical `/evaluations/runs` stays unimplemented (404 test).
- Fixtures use `SYNTH-LEAK-CANARY`, not live keys; `last-run.json` is gitignored.
- No new tool, no runtime MCP client, no irreversible/`external_comm` tool, no Session table.
- Reply containing the exact canary or `sk-…` fails closed as `sensitive_output` and does not execute a tool.

### Verdict

**FAIL**

One Major: baseline/membership can be satisfied by a colliding `caseId` suffix. That is a gate-integrity defect on the control this change claims to add. `/verify` PASS does not clear it.

Archiving advisable? **No** until the Major is fixed (or the spec explicitly allows suffix matching and documents the cheat).

### Recommended next steps (before archive)

1. Update OpenSpec (`evaluation-gate` spec + design D4) for exact case-id matching and whether version pins are required.
2. New `/apply` pass: compare on full `suiteName/caseId`; add a test that a spoof suffix does not satisfy the baseline; remove or fence `writeEvaluationBaseline`.
3. Re-run `/verify`, then a **new-session** `/adversarial-review`.
4. Do not archive on this review.
