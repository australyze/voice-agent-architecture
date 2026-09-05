---
name: design-prompt
description: Use when creating or changing a versioned product-agent prompt, context packing, untrusted-text isolation, or structured-output contract. Do not use to rewrite Cursor/coding-agent prompts or to design retrieval pipelines.
author: LIDR.co
version: 1.0.0
---

# design-prompt

Prompts are **versioned contracts** (`prompt_id` + `version`). Provider-agnostic.

**Agent:** `ai-engineer` (architect reviews policy)

## When not to use

- Coding-agent / Cursor prompt rewrite → `meta-prompt`
- Chunking/embeddings → `design-rag-pipeline`
- Tool JSON Schema → `design-tool` (prompt may *describe* when to call)

## Inputs

- Job of the agent, token budgets, whether facts must be grounded
- OpenSpec change

## Steps

1. Load `docs/backend-standards.md` (prompt/context) and `docs/data-model.md` (`PromptVersion`).
2. Split roles/blocks: policy, developer, retrieved context, tool results, user. Never concatenate untrusted text as policy.
3. Token budgets per section; truncation must not drop the newest user turn.
4. Structured output for anything the runtime parses (schema in spec, not a vendor demo).
5. New text = new version + hash. Sessions store the version used.
6. Require `create-evals` fixtures for the new version (A/B on frozen set).
7. Fallbacks stay in `design-agent` (this skill only notes if the prompt must support refuse/defer).

## Outputs

- Prompt version artifact locator + hash
- Context packing rules
- Structured-output schema reference
- Eval cases listed

## Quality gates

- Untrusted retrieval/user/tool text cannot override policy by concatenation
- No anonymous prompt strings as production source of truth
- Prompt change updates evals in the same OpenSpec change

## Documents

- `docs/backend-standards.md`, `docs/data-model.md`, `docs/documentation-standards.md`

## OpenSpec

Contract change: `/ff` then `/apply` with eval gate.

## Combines with

- `design-agent`, `create-evals`, `instrument-ai-system` (log prompt version)
- Not `meta-prompt`

## Verification

| Check | Pass |
| --- | --- |
| “Soften the closer” | New version + eval cases, not inlined only in code |
| Avoids | Vendor playground dump as canon |
