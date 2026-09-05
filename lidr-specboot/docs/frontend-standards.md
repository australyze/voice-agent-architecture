---
description: Frontend standards for optional operator, HITL, evaluation, and observability UIs in AI agent systems. Does not apply when the product has no user interface.
globs: ["frontend/src/**/*.{ts,tsx}", "apps/web/**/*.{ts,tsx}", "apps/ui/**/*.{ts,tsx}"]
alwaysApply: false
---

# Frontend Standards for AI Agent Systems

## Applicability

This document applies **only when the system includes a user interface**.

Voice-first and headless agent systems often have no product UI. In those cases, skip this file. Do not add a frontend to satisfy this document.

Typical justified UIs:

- Operator console (live sessions, barge-in, transfer, take over)
- Human-in-the-loop approval queues
- Conversation replay and annotation
- Evaluation review (pass/fail, diffs, dataset labels)
- Prompt / agent version inspection
- Observability dashboards that the team owns (if not fully delegated to an observability vendor UI)

The frontend is an adapter to the same application APIs as any other client. It is not the agent runtime and must not embed LLM keys, tool credentials, or voice-provider secrets.

## Technology classification

- **Use-case dependent**: any product or operator UI
- Prefer **TypeScript** and a current React (or equivalent) stack chosen by the implementing project
- Do not treat Create React App, Bootstrap, or a specific E2E runner as methodology defaults
- Talk to the backend through the contracts in [api-spec.yml](./api-spec.yml)

## Architecture

- UI → HTTP/WebSocket client → application API
- No direct calls to Vapi, LLM providers, vector stores, or MCP servers from the browser
- Session, tool, retrieval, and eval state are read from product APIs, not reconstructed from vendor dashboards
- Keep agent policy and confirmation rules on the server. The UI only displays and submits decisions

Suggested structure when a UI exists:

```
web/
  src/
    pages/ or routes/
    features/            # session, approval, eval, traces
    components/          # reusable presentational components
    api/                 # typed client generated or hand-written from OpenAPI
    state/               # local or store state for the UI only
```

## Coding standards

- Strict TypeScript. Ban `any`
- Functional components and hooks when using React
- PascalCase components; camelCase functions and variables
- Typed props and API responses
- English-only names, comments, and user-facing copy in default locale files
- Handle loading, empty, error, and stale-session states explicitly
- Accessibility: semantic HTML, keyboard access, labels on interactive controls

## HITL and operator UX

- High-risk actions show the proposed tool name, arguments, risk class, and source session
- Approval and rejection are explicit API calls with actor identity
- Do not auto-approve from the UI
- Live voice operator views must distinguish media state from business session state ([backend-standards.md](./backend-standards.md))
- Never display raw secrets, provider tokens, or unredacted PII beyond what the API permits

## State and data

- Server is the source of truth for sessions, approvals, and eval runs
- Optimistic UI is allowed only when the API acknowledges the command
- Poll or subscribe through product APIs; do not subscribe to vendor webhooks in the browser

## Testing

When a UI exists:

- Unit/component tests for rendering and interaction
- Contract tests or generated types against OpenAPI
- E2E for operator/HITL workflows that can regress (approval, replay, takeover)

When no UI exists, OpenSpec E2E browser steps are **not applicable**.

E2E tool choice (Playwright, Cypress, or MCP browser tools) is a project decision. The methodology only requires that the agent execute the tests, restore fixtures, and record a report.

## Performance

- Do not fetch full traces or audio on list pages
- Paginate sessions, evals, and spans
- Lazy-load replay audio and large payloads

## What this document is not

- Not a mandate to build a marketing site or end-user chat widget
- Not a CSS framework standard
- Not a place to document Vapi widget snippets or vendor-specific frontend SDKs (those belong in project adapter notes)
