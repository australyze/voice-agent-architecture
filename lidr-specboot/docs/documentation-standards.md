---
description: Standards for technical documentation, agent specs, prompt versions, and feedback-driven updates to AI engineering rules.
globs:
alwaysApply: true
---

# Documentation and AI Specs Standards

## Introduction

Technical documentation describes how the system is structured, runs, and is evaluated. AI specs describe how coding agents must plan, implement, and update this repository.

All of it is English-only.

## General rules

- ALWAYS WRITE IN ENGLISH, including comments and any explanation in files. This applies to creating and updating documentation and to in-code comments.
- Specs precede code. If behavior changes, update the spec in the same change.
- Do not invent vendor-specific API fields, SDK flags, or product capabilities. Document the architectural contract here; put versioned vendor details in project adapter docs.
- Prompt files, tool schemas, and evaluation datasets are documentation-grade artifacts. Treat them with the same review bar as OpenAPI.

## Living document inventory

Before a commit, or when asked to document a change, review which of these must move:

| Artifact | Update when |
| --- | --- |
| [base-standards.md](./base-standards.md) | Methodology or cross-cutting principles change |
| [backend-standards.md](./backend-standards.md) | Architecture, agent, RAG, voice, eval, or security practice changes |
| [frontend-standards.md](./frontend-standards.md) | A UI exists and its conventions change |
| [data-model.md](./data-model.md) | Domain entities, invariants, or relationships change |
| [api-spec.yml](./api-spec.yml) | HTTP/webhook contracts change |
| [development_guide.md](./development_guide.md) | Setup, layout, or default toolchain changes |
| [openspec-tasks-mandatory-steps.md](./openspec-tasks-mandatory-steps.md) | Definition of done / gates change |
| Agent / tool / prompt version docs in the implementing project | Policy, tools, or prompts change |
| Evaluation suite descriptions and datasets | Fixtures, metrics, or thresholds change |
| Observability runbooks | Trace fields, alerts, or redaction rules change |

When updating documentation:

1. Review the code and spec change
2. Identify affected files from the table
3. Update each file in English, preserving structure unless the structure itself is the change
4. Keep links and terminology consistent across `docs/`
5. Report which files changed and why

## Contracts are broader than HTTP

The following are first-class contracts and must be versioned:

- OpenAPI paths and schemas
- Tool JSON Schemas
- Prompt id + version
- Agent version (allowed tools, budgets, HITL policy)
- Embedding model + chunker version for a corpus
- Evaluation dataset + metric thresholds

A prompt-only change still requires documentation and evaluation updates.

## AI specs (coding-agent rules)

This process applies after interactions where the user gives explicit or implicit feedback, corrections, or preferences. The coding agent must look for learning opportunities that improve *these* methodology docs — not silently rewrite product behavior.

### Required process

1. Connect the insight to a specific file and section
2. Propose the change; do not apply rule edits without explicit approval
3. After approval, apply the minimal patch and confirm what changed

### Anti-patterns

- **Skipping approval**: changing rules without review
- **Unlinked proposals**: rule changes not tied to feedback
- **Imprecise modifications**: not naming the file and section
- **Unaddressed feedback**: ignoring methodology-relevant corrections
- **Scope creep**: updating unrelated rules in the same pass
- **Unprompted rule changes**: editing standards with no triggering insight
- **Missing confirmation**: not telling the user after an approved rule update
