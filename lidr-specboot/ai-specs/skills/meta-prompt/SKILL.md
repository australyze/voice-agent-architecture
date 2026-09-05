---
name: meta-prompt
description: Use when the user asks to rewrite, tighten, or structure a prompt for a coding agent, Cursor command, or human-to-model instruction in this repo. Do not use for versioned product-agent prompts, system policy, or context packing of a production session.
author: LIDR.co
version: 2.0.0
---

# meta-prompt

Rewrite the given **coding-agent** prompt for clarity: role, objective, constraints, output shape. Do not expand scope.

## When not to use

- Product agent instructions, prompt versions, or RAG context → `design-prompt`
- Designing tools or MCP → `design-tool`
- OpenSpec design → `design-ai-system`

## Inputs

- Original prompt (arguments or chat)

## Steps

1. Restate the objective in one sentence.
2. Add role, constraints, and explicit non-goals.
3. Specify output format.
4. Keep only what the original asked. No extra features.
5. Return the rewritten prompt only (plus a one-line note of what changed).

## Outputs

- Rewritten prompt in a copy-pasteable block

## Quality gates

- No vendor API invention
- No silent switch into `design-prompt`

## Documents

- None required. If the prompt is about this methodology, keep terms consistent with `docs/base-standards.md`.

## OpenSpec

Not an OpenSpec phase.

## Combines with

- `writing-skills` when the user is authoring a SKILL.md
- Never as a substitute for `design-prompt`

## Verification

| Check | Pass |
| --- | --- |
| “Rewrite this Cursor prompt” | Structured coding prompt |
| “Version the billing agent system prompt” | Defers to `design-prompt` |
