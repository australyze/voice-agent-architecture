---
description: Core development rules and AI Engineering methodology for this repository, applicable to all AI coding agents (Claude, Cursor, Codex, Gemini, etc.).
alwaysApply: true
---

## 1. Mission

This repository is a reusable methodology for building production AI systems: conversational agents, voice agents, multi-agent systems, RAG pipelines, tool-calling workflows, and intelligent automations.

The methodology is **Voice-AI ready** without being Voice-AI exclusive. Voice, chat, batch, and workflow runtimes share the same domain, tools, retrieval, evaluation, and observability. Interaction channels are adapters.

## 2. Core Principles

- **Small tasks, one at a time**: Always work in baby steps. Never go forward more than one step.
- **Test-Driven Development**: Start with failing tests for any new deterministic functionality. For probabilistic components, start with an evaluation case that the change must pass.
- **Type Safety**: All code must be fully typed (TypeScript strict mode; Python type hints with a checker).
- **Clear Naming**: Use clear, descriptive names for variables, functions, tools, prompts, and agent states.
- **Incremental Changes**: Prefer incremental, focused changes over large, complex modifications.
- **Question Assumptions**: Always question assumptions and inferences. Treat model output as a hypothesis until validated.
- **Pattern Detection**: Detect and highlight repeated code patterns.
- **Contract-first**: Define OpenAPI, tool schemas, prompt versions, and evaluation suites before implementation.
- **Spec-driven**: Documentation and OpenSpec artifacts are the source of truth. Code follows specs, not the reverse.
- **Observability by default**: No untraced model call, tool call, or retrieval in production paths.
- **Evaluation before production**: Do not ship agent, prompt, tool, or retrieval changes without the matching evaluation gate.
- **Security by design**: Prompt injection resistance, tool allowlists, secret hygiene, and human-in-the-loop for high-risk actions.
- **Vendor independence**: Depend on ports and contracts, not on a single LLM, voice, or observability vendor.

## 3. Language Standards

- **English Only**: All technical artifacts must always use English, including:
    - Code (variables, functions, classes, comments, error messages, log messages)
    - Documentation (README, guides, API docs, agent specs, prompt files)
    - Tickets (titles, descriptions, comments)
    - Data schemas and database names
    - Configuration files and scripts
    - Git commit messages
    - Test and evaluation names

## 4. Technology Classification

Do not install or couple the whole catalog by default. Classify every dependency:

### Core (default for new systems)

- TypeScript and Node.js for orchestration, HTTP APIs, tool execution, and session control
- PostgreSQL for durable state
- pgvector for embeddings and retrieval
- Docker for local and reproducible infrastructure
- REST / OpenAPI as the external contract style
- Strong typing and automated tests

### Optional (adopt when the use case justifies it)

- Python for RAG pipelines, evaluation harnesses, and data processing
- LangChain / LangGraph for graph-style orchestration when custom orchestration would be worse
- Runtime MCP for exposing tools to agents
- Langfuse (or equivalent) for LLM observability
- Promptfoo and DeepEval (or equivalent) for prompt and agent evaluation
- n8n for deterministic business automations that should not live inside an LLM loop

### Use-case dependent (adapters, never the core)

- Vapi for Voice AI / telephony interaction
- Other speech, chat, or channel providers
- Product frontend / operator UI
- Browser E2E tooling when a UI exists

Core code must not import use-case adapters. Optional libraries stay behind ports.

## 5. Architectural Rules

- **Clean Architecture and Hexagonal Architecture**: domain and application logic have no dependency on Vapi, a specific LLM SDK, Langfuse, n8n, or a vector vendor API.
- **DDD when appropriate**: model real domain aggregates (`AgentSession`, `Conversation`, `ToolInvocation`, `KnowledgeCorpus`, `EvaluationRun`). Do not force DDD onto thin LLM SDK wrappers.
- **Provider abstraction for LLMs**: application code calls a model port (complete, stream, embed, structured output). SDKs live in adapters.
- **Vapi is an interaction layer**: speech-to-text, text-to-speech, call control, and telephony ingress. It is not the agent kernel, tool runtime, RAG engine, or source of truth for session business state.
- **Explicit agent state**: persist and name state transitions. Do not hide control flow only inside a prompt.
- **Deterministic workflows wherever possible**: if a path can be a typed state machine, it must not be left to free-form generation.
- **Controlled autonomy**: the model proposes; the runtime authorizes, validates, executes, and records.
- **Separation of reasoning and execution**: tool execution, database writes, transfers, and payments never run inside unconstrained model output.
- **Strict tool schemas**: JSON Schema (or equivalent) with validation before execution. Reject unknown fields by default.
- **Human-in-the-loop**: high-risk, irreversible, or externally visible actions require confirmation or approval.
- **Structured outputs** for anything the runtime must parse.

## 6. LLMs Are Probabilistic Components

Treat model calls as stochastic I/O, not as pure functions.

Every production model path must consider:

- hallucination management and source attribution
- uncertainty and refusal when evidence is insufficient
- context window and token budgets
- prompt versioning and model versioning
- structured outputs and schema validation
- retries with bounded attempts and idempotent tools
- fallbacks (smaller model, cached answer, deterministic rule, human handoff)
- guardrails (topic, PII, jailbreak, tool-scope)
- prompt injection resistance and tool-misuse prevention
- latency and token cost budgets
- traceability of prompts, tools, retrieval, and outcomes

Never assume bit-identical output across runs. Assert contracts, schemas, and evaluation scores, not exact prose, unless a fixture is deliberately deterministic.

## 7. Dual MCP

Distinguish two MCP uses. Do not mix servers, credentials, or trust boundaries.

1. **Development MCP** (Cursor / coding agents): access to repos, browsers, tickets, docs, and local tools while implementing software. Not part of the product runtime.
2. **Runtime MCP** (AI agents in production): tools and capabilities the product agent may call. Requires authentication, allowlists, timeouts, argument validation, and audit traces.

Development MCP must never be reachable from a production agent. Runtime MCP must never rely on an IDE session.

## 8. Specific Standards

For detailed standards, refer to:

- [Backend Standards](./backend-standards.md) — hexagonal AI systems, agents, tools, RAG, voice adapters, evaluation, observability, persistence, security
- [Frontend Standards](./frontend-standards.md) — optional operator, HITL, evaluation, and observability UIs
- [Documentation Standards](./documentation-standards.md) — technical docs, agent specs, prompt versions, and feedback-into-rules
- [Data Model](./data-model.md) — canonical domain for sessions, tools, retrieval, evaluation, and traces
- [API Spec](./api-spec.yml) — canonical HTTP contracts for product capabilities
- [Development Guide](./development_guide.md) — repository layout, stack selection, and local setup
- [OpenSpec Tasks Mandatory Steps](./openspec-tasks-mandatory-steps.md) — required checklist when creating or updating OpenSpec `tasks.md`

## 9. Project Skills

- Skills live in `ai-specs/skills`.
- When a request matches a skill, load and follow the corresponding `SKILL.md` automatically before continuing.
- Also load any referenced files in the skill folder (for example, `references/*.md`) when the skill requires them.
- Skills compose with OpenSpec. They do not replace `/ff`, `/apply`, or `/verify`.
- Do not hardcode vendor APIs in generic skills. Adapter-specific notes live in the implementing project.

## 10. Planning Model Requirement

Planning workflows must use the highest-reasoning model available in the current environment.

This requirement applies to:

- `enrich-us`
- `design-ai-system`
- `openspec-ff-change`
- `openspec-continue-change`

How to apply it:

- **Cursor**: select a high-reasoning model for the planning session. Do not create Claude-only config files unless this repository already uses them.
- **Claude Code**: if the session is not already on Opus high reasoning, self-correct by setting `"model": "claude-opus-4-7"` in `.claude/settings.json` when that workflow exists, then continue. Restore the previous model for non-planning steps.
- **Other agents**: equivalent highest-reasoning setting. Do not stop only to ask which model to use when the environment already exposes one.

## 11. Symlink Integrity and Multi-Agent Portability

- **Canonical Source**: Keep reusable artifacts in `ai-specs` as the canonical source. Agent-specific paths (such as `.claude` and `.cursor`) should reference them through symlinks when possible.
- **Update Safety**: Whenever a file is renamed, moved, or its suffix changes, verify and update all symlinks that target it before considering the change complete.
- **New Artifact Linking**: Whenever creating a new artifact that requires multi-agent exposure (for example new agents or skills in `ai-specs`), create the corresponding symlinks from the expected agent-specific reference paths.
- **External Customization Review**: Whenever customization is introduced outside `ai-specs`, evaluate whether it should be moved into `ai-specs` and replaced with symlinks from the original locations.
- **Completion Gate**: A change is incomplete if it leaves broken symlinks, stale targets, or duplicated canonical artifacts across agent-specific folders.

## 12. Mandatory OpenSpec Artifact Updates for Post-Apply Changes

When a new fix/change request appears after `opsx:apply` (or `/apply`) and before `opsx:archive` (or `/archive`), agents must treat it as a spec update first, not as an informal "fix this quickly". Documentation is the source of truth.

Required order:

1. Update the current OpenSpec change artifacts that are affected (for example: scenarios, requirements/specs, and `tasks.md`). Don't add tasks as "bugfixes" but as part of the initial design, in the proper section.
2. If artifact regeneration is needed, run the corresponding OpenSpec step (`opsx:continue`, `opsx:ff`, or equivalent) before coding.
3. Implement code only after artifacts reflect the new request.
4. Re-run verification against the updated artifacts before archiving.

Do not apply direct code-only fixes in this window without updating OpenSpec artifacts.
