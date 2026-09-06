## Context

See `proposal.md` for motivation. The implementing repo already has a hexagonal TypeScript runtime (`src/`), Vapi inbound at `POST /adapters/voice/inbound`, and `wom-customer-service-agent`. There is no `web/` or React app. Root `package.json` is the Fastify runtime. Default `VOICE_SESSION_OWNER` is `runtime-demo`.

`lidr-specboot/docs/frontend-standards.md` now applies because a UI is in scope. It says the browser must not hold voice-provider **secrets** and generally must not call vendors directly. This change **mandates** a browser media SDK for live audio (stakeholder HU #010). That is a media-adapter exception, not permission to put the agent kernel in React.

`lidr-specboot/docs/data-model.md`: `mediaStatus` ≠ `businessStatus`. This HU tracks media/UI state in the browser only. It does not materialize Session / ConversationTurn tables (HU #011).

Assumptions recorded from enrichment (not reopened):

- Interviewer-visible copy is Spanish; technical artifacts stay English.
- A one-line microphone / demo disclaimer appears near start.
- Live tool rows appear only when the media client can observe them; otherwise the HU #011 placeholder is enough.
- Automated tests keep inbound default `runtime-demo`. Interview runbook sets `VOICE_SESSION_OWNER=wom-customer-service-agent`.
- Vapi assistant id + public key + Server URL tunnel are operator setup, not a new backend contract.

## Goals / Non-Goals

**Goals:**

- Smallest clean React application beside the existing runtime (`web/`), not a second backend architecture.
- Deterministic UI call state machine + normalized transcript.
- Isolate the voice-provider web SDK behind a frontend port so presentation components never subscribe to vendor events directly.
- Keep domain and application free of vendor SDK types (`base-standards.md`).

**Non-Goals:**

- New domain ports, Session persistence, or inbound HTTP families (see proposal Non-goals).
- Changing WOM prompt, tools, or the quality-gate required suite list.
- Designing the HU #011 observability dashboard.

## Decisions

### D1 — Deterministic UI over an existing agent (not a new agent)

**Decision:** Topology stays **one session owner**. Interview path uses `wom-customer-service-agent`. This increment is a typed UI + media client. No new LLM loop, supervisor, or browser tools for usage / bill / service.

**Why:** Spoken reasoning already exists and is eval-gated. Call buttons and transcript layout are fully specified (`base-standards.md`: deterministic when possible).

**Alternatives:** Embed a second assistant in the Web SDK with client tools. Rejected: splits the kernel and breaks HU #009 grounding.

**HITL / risk:** Existing `wom.*` tools remain `read`. No HITL. No write / irreversible / external_comm tools.

**Budgets:** Unchanged (`maxToolHops = 1`, `VOICE_TIMEOUT_MS`). UI adds connecting/ending feedback only.

**Change types:** `ui` | `voice` | `code`. Not `agent`, `tools`, `rag`, `api`.

### D2 — `web/` Vite + React + TypeScript + shadcn/ui

**Decision:** Create `web/` as its own package (own `package.json`, Vitest, TypeScript). Vite is the default bundler because the stakeholder already specified `VITE_`-style public env. Use shadcn/ui + Tailwind. Root runtime package remains the backend. Document `npm run dev` from `web/` (and an optional root script that delegates).

**Why:** No frontend exists; `lidr-specboot/docs/development_guide.md` already suggests optional `web/`. Do not fold React into `src/adapters/http`.

**Alternatives:** Next.js app router; CRA; embed UI in Fastify static. Rejected: extra SSR/hosting for a demo SPA; CRA is not a methodology default; serving UI from the runtime couples deploys.

### D3 — Frontend VoiceMediaClient port; Vapi Web SDK is the first adapter

**Decision:**

```text
React UI
  → useVoiceAgent (or equivalent hook)
    → VoiceMediaClient port (start, stop, subscribe)
      → Vapi Web SDK adapter (@vapi-ai/web)
```

Inspect **installed** SDK types at apply time. Do not assume a frozen constructor API in this design. UI consumes:

- `startCall()` / `endCall()`
- `callState`
- normalized `ConversationMessage[]`
- `durationSeconds`
- `error` (safe message)
- optional `toolActivity` (human label or none)

Normalize provider events inside the adapter. Presentation never imports `@vapi-ai/web`.

**Why:** Matches hexagonal direction on the frontend. Satisfies the mandated Web SDK without scattering `vapi.on` in cards.

**Alternatives:** Vapi CLI as runtime; raw SDK in every component. Rejected: CLI is a tunnel tool; scattered SDK calls break tests and vendor swap.

**Methodology exception:** `frontend-standards.md` “no direct vendor calls from the browser” is relaxed **only** for this media-client adapter. LLM keys, tool credentials, inbound secret, and private voice API keys stay off the browser. Server events still terminate at `POST /adapters/voice/inbound`.

### D4 — Tokenized WOM-inspired theme

**Decision:** CSS variables / theme tokens conceptually equivalent to `--wom-primary`, `--wom-primary-foreground`, `--wom-secondary`, `--wom-accent`, `--wom-background`, `--wom-surface`, `--wom-muted`, `--wom-text`. Magenta/fuchsia for the primary CTA. White cards on purple accents. Active call MAY use a dark-purple hero. Document that values are a visual approximation, not official WOM brand guidelines.

**Why:** Stakeholder visual direction + avoid hex soup.

**Alternatives:** Copy the public WOM site component-for-component. Rejected: proposal non-goal.

### D5 — Public env only; distinct names from server secrets

**Decision:** Frontend example env (Vite prefix if Vite is used):

- public voice key
- assistant identifier
- optional public API base URL (unused for agent turns in this HU unless health/status is shown later)

Do **not** reuse `VOICE_PROVIDER_API_KEY`, `VOICE_INBOUND_SECRET`, `DATABASE_URL`, or `DEMO_ORCHESTRATE_SECRET` in client code. `.gitignore` already ignores `.env` / `.env.*` except `.env.example`. Add `web/.env.example`. Root `.env.example` documents interview `VOICE_SESSION_OWNER=wom-customer-service-agent` and that Server URL still points at inbound.

**Why:** Name collision with the server provider key would leak a private credential into the bundle.

### D6 — State: React local/hook state, no Redux

**Decision:** Call machine and transcript live in one hook/module. No Redux/Zustand unless apply proves a cross-route need (this HU is a single page).

**Why:** Single interview surface.

### D7 — Tests: mock the media client; no live vendor in CI

**Decision:**

- Component tests: idle, connecting, active, ending, completed, error; prompts; transcript; end control; redacted error.
- Adapter/hook tests: start/end invoked; call-start → active; call-end → completed; transcript normalization; error normalization.
- Secret-hygiene test: frontend source and example env must not contain inbound-secret or private-key names as shipped client values.
- Voice fixtures: scripted state-machine cases (not paid audio). Existing WOM agent eval suite remains the generative gate and is **regression-run**, not extended.
- Live browser call is **manual smoke** only (Definition of Done), not a CI gate.

**Why:** `openspec-tasks-mandatory-steps.md`: voice eval uses fixtures; UI needs an executed UI gate. Project has no Playwright yet — Testing Library full-page flows with a mocked client **are** the UI E2E for this increment. Do not add Playwright unless component tests cannot cover the state machine.

**Alternatives:** Require live Vapi in CI. Rejected: credits, mic, flake.

### D8 — Docs, not a second inbound mapper

**Decision:** Update `docs/architecture.md`, `docs/agents/wom-customer-service-agent.md`, `docs/adapters/vapi-inbound.md`, and add `docs/adapters/vapi-web-demo.md` (or equivalent) for public key, assistant id, tunnel/Server URL, and interview procedure. Do not invent a new inbound JSON family.

**Why:** Vendor field names stay in project adapter notes (`documentation-standards.md`).

## Risks / Trade-offs

- [Browser public key] → Only the public key; never the inbound secret. Adversarial review still required before archive.
- [frontend-standards vs Web SDK] → Documented exception (D3). Core remains vendor-free.
- [Tool activity may be invisible] → Honest omission + HU #011 placeholder; do not fake traces.
- [Wrong session owner] → Interview runbook; default stays `runtime-demo` so HU #002 tests stay green.
- [Connecting hangs] → After 8s without `call-start`, move to `error` and allow retry; ignore late `call-start` after that timeout.
- [Interviewer audio] → Disclose that the voice provider processes microphone audio; this app does not persist it.
- [Public key] → Document origin allowlisting; do not publish interview keys (HU #012 must re-open this).

## Migration Plan

1. Add `web/` without changing inbound routes.
2. Ship example env placeholders only.
3. Operators configure a Vapi assistant whose Server URL hits existing inbound (tunnel for local).
4. Rollback: remove or do not start `web/`; runtime behavior unchanged.

No database migration.

## Open Questions

None that change specs or tasks. SDK constructor/event names are resolved at apply by reading installed types.
