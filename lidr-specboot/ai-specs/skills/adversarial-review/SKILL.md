---
name: adversarial-review
description: Use when the user runs /adversarial-review or asks for a red-team, devil's advocate, or independent review before archiving an OpenSpec change. Use after implementation, in a different session from the author when possible. Do not use to implement fixes or to replace /verify quality eval.
author: LIDR.co
version: 2.0.0
---

# adversarial-review

Independent review: assume gaps until evidence refutes them. Procedure for `security-reviewer`. Do not prescribe model or IDE.

## When not to use

- Same session that just implemented, if the user can start a fresh one
- Replacing `verify-ai-implementation` (quality scores)
- Quietly patching code in this pass

## Inputs

Ticket, change name, endpoints, PR URL (`owner/repo#n`), or infer active OpenSpec change. Order: explicit name → PR → current work.

## Steps

1. **Spec first.** Read OpenSpec proposal, design, specs, scenarios, `tasks.md`. List acceptance and non-goals. Note underspecified security/HITL.
2. **Implementation.** PR diff if given; else `git diff` vs merge base.
3. **Refute.** For each criterion, how it still fails (injection, extra tool args, replay, IDOR, empty retrieval, barge-in double-effect). Check tests prove the criterion, not only happy path. Spec vs code mismatch is a finding.
4. **AI surfaces (always consider when present):**
   - Prompt injection via user, retrieved docs, tool results, transcripts
   - Tool abuse, missing schema `additionalProperties: false`, side effects on parse failure
   - Dev MCP vs runtime MCP mix-up
   - Irreversible / `external_comm` without HITL
   - Secrets in prompts, traces, fixtures, UI
   - Agent boundary violations (unbounded hops, shared mutable policy)
5. Severity: Blocker / Major / Minor / Question. Map fix to code / tests / OpenSpec / docs.
6. Verdict: `PASS` | `PASS WITH GAPS` | `FAIL` (FAIL if any Blocker or Major). Archiving advisable? Yes only on PASS / PASS WITH GAPS.

## Outputs

```markdown
## Adversarial review
**Scope**: ...
**Sources**: ...
### Spec and task alignment
### Findings
| Severity | Area | Finding | Evidence | Suggested fix |
### Verdict
### Recommended next steps (before archive)
```

## Quality gates

- Specs read before the diff
- Abuse cases for new tools/prompts
- No praise unless it mitigates a named risk

## Documents

- `docs/base-standards.md`, `docs/backend-standards.md` (Security, tools, MCP)
- OpenSpec change + diff
- `docs/data-model.md` (Approval, ToolCall) when tools/HITL exist

## OpenSpec

After `/verify`, **before** `/archive`. FAIL blocks archive.

## Combines with

- After: `verify-ai-implementation`
- Optional: `code-auditing` only for exploitable issues
- Next on FAIL: spec update then `implement-spec` in a **new** pass

## Verification

| Check | Pass |
| --- | --- |
| Activates on `/adversarial-review` | Verdict + table |
| Missing diff | States blocker, does not rubber-stamp |
| Avoids | Implementing the patch; using eval PASS as security PASS |
