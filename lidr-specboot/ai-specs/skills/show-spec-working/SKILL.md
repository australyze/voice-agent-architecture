---
name: show-spec-working
description: Use when the user asks to show, demo, walk through, or prove a spec, ticket, or feature working live. Do not use for architecture design, eval reports without execution, or a requirements summary presented as a demo.
author: LIDR.co
version: 2.0.0
---

# show-spec-working

Demonstrate the spec with real commands or a running path. Never end on analysis only.

## When not to use

- User asked `/verify` scores only → `verify-ai-implementation`
- User asked “how it works” conceptually → `explain`
- Blocked environment: report exact blocker, do not fake a demo

## Inputs

Ticket id, change name, route, endpoint, session/tool name — or current OpenSpec change.

## Steps

1. Resolve spec and **modality** (can be several):
   - `ui` — operator/HITL frontend exists
   - `http` — REST contracts
   - `tool` — tool invoke + validation
   - `voice` — conversation fixture / adapter (not live paid calls unless configured)
   - `retrieval` — knowledge query, hits + locators
2. List scenarios from acceptance criteria.
3. **Anti-report:** do not finish after summarizing requirements.
4. Execute:
   - UI: browser MCP; read tool descriptors first
   - HTTP: real `curl`; restore data after mutations
   - Tool: invalid args must **not** execute; valid path as specified
   - Voice: run scripted fixture or recorded transcript path from the spec
   - Retrieval: query port; show scores and source ids
5. Mask secrets. Keep the browser open unless asked to close.

## Outputs

```markdown
Spec demo completed for: <change>
Walkthrough: <modality + steps/results>
Data restore: restored | not needed | failed
Next: continue or ask to close browser
```

## Quality gates

- Each listed scenario pass/fail with evidence
- Mutations restored
- No vendor dashboard as a substitute for product contracts

## Documents

- Current OpenSpec change
- `docs/api-spec.yml` for HTTP
- `docs/frontend-standards.md` if UI

## OpenSpec

Optional after `/verify`. Not a replacement for eval reports.

## Combines with

- `verify-ai-implementation` (scores vs live demo)
- Do not mix with `adversarial-review` in the same breath unless asked

## Verification

| Check | Pass |
| --- | --- |
| “show me booking” | Executes HTTP/tool/voice path from spec |
| Avoids | Chat-only walkthrough labeled “demo complete” |
