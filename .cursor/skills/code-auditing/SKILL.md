---
name: code-auditing
description: Use when the user asks for a systematic code quality, dead-code, dependency, or pre-release audit across a module or repo. Do not use as a substitute for /adversarial-review before archive, or for a single-line bugfix.
author: LIDR.co
version: 2.0.0
---

# code-auditing

Six-phase quality audit. Load `references/audit-methodology.md` and `references/dead-code-methodology.md` when needed.

## When not to use

- `/adversarial-review` (use that skill; this one may **feed** exploitable findings)
- Implementing the OpenSpec change (`implement-spec`)
- Performance of a live call without traces → `analyze-agent-failure` or `instrument-ai-system`

## Inputs

- Path or whole repo
- Optional focus: security, performance, types, dead code, AI runtime

## Steps

0. Config, stack, linters, baseline tests. Load official docs for core libraries.
1. Discover files; group by module.
2. Per file: smells, dead code, missing errors, complexity, duplication.
3. Library usage vs official patterns.
4. Cross-file patterns.
5. Custom code vs mature libraries (health check).
6. Report: executive summary, priorities, action plan.

**Also scan AI surfaces** (skip if no LLM/tools/retrieval):

- Vendor SDK types in domain
- Untraced model/tool/retrieval calls
- Tool schemas allowing extra properties
- Prompts/secrets in source or fixtures
- Dev MCP servers referenced from runtime

Priorities: Critical / High / Medium / Low / Quick wins.

Dead code: `knip` (TS) / `deadcode` (Python); verify dynamic imports and entrypoints.

## Outputs

- Report (project root or change `reports/`) + console summary
- Line-referenced findings

## Quality gates

- Baseline linter/tests recorded
- Tool dead-code hits verified before reporting
- AI findings mapped to `docs/backend-standards.md` ports — not a new rulebook

## Documents

- Skill `references/*`
- `docs/backend-standards.md` for hexagonal / tool / observability checks
- `docs/base-standards.md`

## OpenSpec

Ad hoc or pre-release. Does not mark `/verify` PASS.

## Combines with

- `adversarial-review` for exploitability
- `instrument-ai-system` if traces are missing

## Verification

| Check | Pass |
| --- | --- |
| Activates on “audit the adapters” | Phased report with AI categories if LLM code exists |
| Avoids | Rubber-stamp archive; rewriting architecture standards |
