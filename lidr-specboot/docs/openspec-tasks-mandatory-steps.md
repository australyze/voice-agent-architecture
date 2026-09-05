---
description: Enforce mandatory OpenSpec tasks.md steps with gates selected by change type (code, API, tools, agents, RAG, voice, UI).
alwaysApply: true
---

# OpenSpec Tasks: Mandatory Steps Enforcement

When creating or updating `tasks.md` artifacts in OpenSpec changes, you MUST:

## 1. Read openspec/config.yaml first

**BEFORE** creating or updating any `tasks.md` file, read `openspec/config.yaml` (or `openspec/config.yml`) for:

- Project-specific mandatory steps
- Branch naming conventions
- Task structure requirements
- Testing, evaluation, and documentation requirements

If the file does not exist yet, follow this document and note the gap in the change.

## 2. Universal steps (every implementation change)

All implementation tasks MUST include these steps in order:

### Step 0: Create feature branch (MUST BE FIRST)

- **Branch naming**: `feature/[ticket-id]` or `feature/[change-name]`
- Suffix with `-backend`, `-frontend`, `-eval`, or similar only when the project convention requires it
- Create and switch to the branch before any code changes

### Always include, at the end of the implementation body

- **Review and update tests and evaluation fixtures** (MANDATORY)
- **Run the applicable verification gate and write a report** (MANDATORY — AGENT MUST EXECUTE)
- **Update technical documentation** (MANDATORY) — see [documentation-standards.md](./documentation-standards.md)

Do not mark these complete without evidence in `openspec/changes/<change-name>/reports/` (or `specs/<change-name>/reports/` if that is the project layout).

## 3. Select gates by change type

Include **only the gates that apply**. Omit Playwright/UI E2E when there is no frontend. Omit curl when there is no HTTP surface. Never omit evaluation when prompts, tools, RAG, or agent policy changed.

| Change touches | Mandatory gate (agent executes) |
| --- | --- |
| Deterministic domain/application code | Unit tests |
| Persistence / migrations | Unit tests + DB state verification |
| HTTP / OpenAPI | Contract tests (curl or generated client) against [api-spec.yml](./api-spec.yml) |
| Tool schemas or executors | Tool calling tests (valid, invalid, timeout, deny) |
| Prompts, agent policy, model routing | Agent behavior eval + regression fixtures |
| RAG ingestion or retrieval | Retrieval evaluation (and generation eval if answers change) |
| Voice session flow, confirmation, barge-in | Voice conversation evaluation (fixtures; not live paid calls in CI unless explicitly configured) |
| Operator / HITL UI | E2E with the project's browser tool |
| Any of the above in production path | Observability fields still emitted (trace smoke or assertion) |

Adversarial tests are mandatory when the change expands tools, prompt trust boundaries, or retrieval of untrusted documents.

## 4. Agent executes verification — never the user

The coding agent MUST run the selected gates. **NEVER delegate testing or evaluation to the user** to mark `tasks.md` complete.

### Unit tests and database state (when code or persistence changes)

1. Prepare the environment (services, fakes; no paid APIs in unit tests)
2. Capture pre-test DB indicators if persistence is involved
3. Run targeted tests, then the required suite
4. Verify DB state and restore mutations
5. Write `YYYY-MM-DD-unit-test-and-db-verification.md` under the change `reports/` folder
6. Mark complete only after the report exists

**Report template:**

```markdown
# Verification Report - Unit Tests and Database

- Date: YYYY-MM-DD
- Change: <change-name>
- Agent: <agent-name>
- Change types: <code | api | tools | agent | rag | voice | ui>

## Commands executed
- `<command>`

## Results
- Targeted: X passed, Y failed, Z skipped
- Required suite: X passed, Y failed, Z skipped
- Runtime: <duration>

## Database state
- Pre: <metrics>
- Post: <metrics>
- Restored: Yes/No

## Outcome
- Status: PASS/FAIL
- Blocking issues: <none or list>
```

### Contract tests (when HTTP changes)

- Start the API if needed
- Exercise GET/POST/PUT/PATCH/DELETE as applicable
- Restore DB after mutations
- Assert status codes and the error envelope in [api-spec.yml](./api-spec.yml)
- Document commands and responses in the report
- This replaces a blanket "every change needs curl" rule

### Tool calling tests (when tools change)

- Invalid JSON / extra fields never execute
- Allowlisted vs denied tools
- Timeout and structured error mapping
- HITL path returns `awaiting_approval` and does not execute

### Agent / prompt evaluation (when behavior changes)

- Run the project eval runner (Promptfoo, DeepEval, custom, or fixtures)
- Record dataset version, prompt version, model version, scores
- Assert thresholds, not exact prose, unless the fixture is deterministic
- Save `YYYY-MM-DD-evaluation.md` in `reports/`

### RAG evaluation (when retrieval changes)

- Measure retrieval metrics on a frozen set (recall@k, citation precision, or project equivalent)
- Include stale-document or filter cases if those policies exist
- Do not treat a passing unit test of the vector client as RAG evaluation

### Voice conversation evaluation (when voice flow changes)

- Use scripted conversation fixtures (transcripts + expected state/tool/confirmation)
- Cover interruption, silence timeout, tool failure recovery, and confirmation before consequential actions
- Do not require live telephony in the default gate

### UI E2E (only if frontend changed)

- Use Playwright MCP or the project's E2E runner
- Cover the operator/HITL workflow, not unrelated pages
- Restore fixtures
- If [frontend-standards.md](./frontend-standards.md) does not apply, skip this gate

## 5. Verification checklist

Before finalizing `tasks.md`:

- [ ] Step 0 is first
- [ ] Change types are explicit so gates can be checked
- [ ] Each applicable gate from the table is present and marked "(MANDATORY)" or "(MANDATORY - AGENT MUST EXECUTE)"
- [ ] Inapplicable gates are omitted with a one-line reason (e.g. "No UI in this change")
- [ ] Reports path and filename pattern are specified
- [ ] Documentation update step is present
- [ ] Evaluation step is present if prompts, tools, RAG, or agent policy changed

## 6. When this applies

- Creating `tasks.md` via `/opsx:ff`, `openspec-ff-change`, `/opsx:continue`, or equivalents
- Updating existing `tasks.md`
- Implementing via `/opsx:apply` — the agent must execute the listed gates

## 7. Example structure

```markdown
## 0. Setup: Create Feature Branch (MANDATORY - FIRST STEP)

- [ ] 0.1 Create feature branch `feature/session-hitl` from main
- [ ] 0.2 Verify current branch

## 1. Spec and contracts
...

## 2. Implementation (TDD)
...

## 3. Review and update tests and eval fixtures (MANDATORY)

## 4. Run verification gates (MANDATORY - AGENT MUST EXECUTE)

- [ ] 4.1 Unit tests + DB report (code/persistence)
- [ ] 4.2 Contract tests (API)
- [ ] 4.3 Tool calling tests (tools)
- [ ] 4.4 Evaluation report (agent/prompt) — `reports/YYYY-MM-DD-evaluation.md`
- [ ] 4.5 Skip UI E2E — no frontend in this change

## 5. Update technical documentation (MANDATORY)
```

## 8. Agent execution requirements

When applying tasks:

1. Execute all listed gates; start services if needed
2. Mark `[x]` only after tests/evals pass, cleanup is done, and reports exist
3. Never ask the user to run curl, eval, or E2E in place of the agent
4. Document commands, scores, and restorations

## Failure to follow

If `tasks.md` omits applicable evaluation or marks work complete without agent-executed evidence, the change is incomplete. Read `openspec/config.yaml` first, then this file.
