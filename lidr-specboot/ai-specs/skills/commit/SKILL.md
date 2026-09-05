---
name: commit
description: Use when the user runs /commit, asks to commit, push, or open a PR after a verified OpenSpec change. Do not use to implement features, skip verify, or force-push.
author: LIDR.co
version: 2.0.0
---

# commit

Create a focused English commit and, unless the user forbids it, push and open/update a PR.

**Agent:** parent session (not a specialist designer)

## When not to use

- Unverified `/apply` with failing gates
- User asked description-only / no git / dry run — then output message only, no `git`/`gh`
- Secrets, `.env`, or eval fixtures with raw PII in the diff

## Inputs

- Optional `$ARGUMENTS`: ticket ids / change names to **scope** the commit
- Explicit no-git flags: `no PR`, `only description`, `don't touch git`, `dry run`

## Steps

0. If no-git: inspect, list would-be staged files, print message, **stop**.
1. `git status` / `git diff` (and staged). Feature branch if needed.
2. Scope: empty args → all relevant files; args → only matching paths/hunks. Never commit unrelated work.
3. Message in English (`docs/base-standards.md`): imperative subject; body = why. Optional ticket prefix. No ATS/recruiting examples.
4. Commit, `git push` (`-u` if new). No `--force` unless the user explicitly asks.
5. `gh pr create` or update: title aligned with commit; link change/ticket; note eval/verify if relevant.
6. Report files, scope, PR URL.

## Outputs

- Commit and PR URL, or copy-paste message in no-git mode

## Quality gates

- No secrets
- English-only message
- Other dirty files left unstaged when scoped

## Documents

- `docs/base-standards.md` (language)
- Git notes in `docs/backend-standards.md` / `docs/development_guide.md` if present

## OpenSpec

Phase: `/commit` after `/verify` and `/adversarial-review` when those ran.

## Combines with

- After: `verify-ai-implementation`, `adversarial-review`
- Isolation: `using-git-worktrees`

## Verification

| Check | Pass |
| --- | --- |
| Activates on `/commit` | One commit + PR (unless no-git) |
| Scoped args | Unrelated files unstaged |
| Avoids | Force-push; Candidate/ATS sample subjects |
