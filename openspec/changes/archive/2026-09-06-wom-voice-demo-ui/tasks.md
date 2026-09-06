# Tasks: wom-voice-demo-ui

Change types: **ui**, **voice**, **code**.

Not in this change: **agent** (no prompt/policy change), **tools** (no schema/executor change), **rag**, **api** (no new HTTP family; inbound is a regression surface only).

Reports: `openspec/changes/wom-voice-demo-ui/reports/`.

## 0. Setup: Create Feature Branch (MANDATORY - FIRST STEP)

- [x] 0.1 Create and switch to branch `feature/wom-voice-demo-ui` from the default branch and verify with `git branch --show-current`

## 1. Frontend scaffold and theme (TDD)

- [x] 1.1 Add `web/` Vite + React + TypeScript package (own `package.json`, strict TS, Vitest + Testing Library) and verify `web` typecheck/test scripts run on an empty passing suite
- [x] 1.2 Add shadcn/ui + Tailwind and tokenized WOM-inspired theme variables; write a failing test that idle chrome includes product name WOM Customer Service AI plus Demo/Prototype labeling; implement the shell and verify it
- [x] 1.3 Add `web/.env.example` with public key, assistant id, and optional public API base only; write a failing secret-hygiene test that frontend example env and client source do not ship inbound secret, private/server API key, or `DATABASE_URL`; verify it

## 2. Voice media client abstraction (TDD)

- [x] 2.1 Write failing hook/adapter tests with a mocked media client: `startCall` invokes start; `endCall` invokes stop; call-start → `active`; call-end → `completed`; connecting then error stays safe (no secrets); transcript events normalize to `{ id, role, text, timestamp? }`
- [x] 2.2 Implement `VoiceMediaClient` + `useVoiceAgent` wrapping `@vapi-ai/web` using **installed SDK types**; presentation files MUST NOT import the SDK; verify those tests pass without network or microphone
- [x] 2.3 Write a failing test that a usage-tool activity maps to a Spanish consumption label and that missing tool signals produce no fabricated tool-success row; implement mapping and verify it

## 3. Call lifecycle UI (TDD)

- [x] 3.1 Write failing page tests for `idle` (start enabled, three suggested prompts, capabilities) and that activating a prompt does not call `startCall`
- [x] 3.2 Write failing tests for `connecting` (init feedback, start disabled), `active` (LIVE, elapsed time, agent identity, voice-activity cue, transcript, end control), `ending` (not completed until call-end), `completed` (duration, visible turn count, traceability placeholder stating traces are not available yet), and `error` (friendly Spanish, no stack/key)
- [x] 3.3 Implement the single-page demo UI and verify those tests pass; keyboard focus and accessible names on start/end must be covered

## 4. Runtime isolation and interview config (no new inbound)

- [x] 4.1 Write a failing architecture test that `src/domain` and `src/application` still do not import `@vapi-ai/web` or React, and that `web/` does not import WOM tool executors or prompt files; verify it
- [x] 4.2 Update root `.env.example` comments for interview `VOICE_SESSION_OWNER=wom-customer-service-agent` without changing the default used by existing tests; verify `loadConfig` default remains `runtime-demo`
- [x] 4.3 Confirm no new HTTP route was added for a frontend webhook (grep/OpenAPI fragment) and that `POST /adapters/voice/inbound` remains the only voice server ingress

## 5. Review and update tests and eval fixtures (MANDATORY)

- [x] 5.1 Review web component, hook, and secret-hygiene tests against every scenario in `specs/wom-voice-demo/spec.md`, `specs/voice-channel-adapter/spec.md`, and `specs/voice-interaction/spec.md`; add any missing case
- [x] 5.2 Confirm no new agent/prompt/tool fixtures were required; do not add a quality-gate suite member for this UI
- [x] 5.3 Confirm automated web tests use media-client doubles only (no paid voice provider, no microphone)

## 6. Run verification gates (MANDATORY - AGENT MUST EXECUTE)

- [x] 6.1 Unit tests + database state (MANDATORY - AGENT MUST EXECUTE): run root `npm run typecheck` and `npm test`, plus web typecheck and web tests; ping persistence; confirm no new Session/Conversation/ToolCall tables; write `openspec/changes/wom-voice-demo-ui/reports/YYYY-MM-DD-unit-test-and-db-verification.md`
- [x] 6.2 Contract tests (MANDATORY - AGENT MUST EXECUTE): regression only — `GET /health/live`, `GET /health/ready`, `GET /health/voice`, `POST /adapters/voice/inbound` (default `runtime-demo`, plus one WOM-owner mocked turn, unauthenticated); assert canonical error envelope; write `openspec/changes/wom-voice-demo-ui/reports/YYYY-MM-DD-contract-tests.md`
- [x] 6.3 Skip tool calling as a new gate — no tool schema or executor change; note in the unit report
- [x] 6.4 Skip new agent/prompt evaluation — no prompt or policy change; run existing required quality gate (`npm run test:eval-gate`) as regression and write `openspec/changes/wom-voice-demo-ui/reports/YYYY-MM-DD-evaluation.md` recording suite versions and that no new generative suite was added
- [x] 6.5 Skip RAG evaluation as a new suite — no corpus change; mention `eval/knowledge/` only if the quality gate already requires it
- [x] 6.6 Voice conversation evaluation (MANDATORY - AGENT MUST EXECUTE): scripted UI call-state fixtures (idle → connecting → active → ending → completed, plus error); no live telephony; record in the evaluation report
- [x] 6.7 UI E2E (MANDATORY - AGENT MUST EXECUTE): Testing Library full-page flows with mocked media client covering idle, start, transcript, end, completed, error; this increment does not add Playwright; record commands and results in `openspec/changes/wom-voice-demo-ui/reports/YYYY-MM-DD-ui-e2e.md`
- [x] 6.8 Observability smoke (MANDATORY - AGENT MUST EXECUTE): assert an existing inbound mocked turn still emits reconstructable spans (`traceId`, agent/prompt identity); no new UI trace pipeline; record in the unit or contract report
- [x] 6.9 Secret-hygiene / adversarial quality (MANDATORY - AGENT MUST EXECUTE): frontend bundle/example env has no private secrets; errors redact internals; independent `/adversarial-review` remains after `/verify` before archive
- [x] 6.10 Live Vapi browser smoke: if public key + assistant id are available in a gitignored env, the agent records a manual procedure result (mic permission, one tool-backed Spanish turn, end → completed) in the UI report; if credentials are absent, record SKIP — not a CI failure, still required for human Definition of Done

## 7. Update technical documentation (MANDATORY)

- [x] 7.1 Add `docs/adapters/vapi-web-demo.md` covering React → VoiceMediaClient → Web SDK, public env names, Server URL still inbound, tunnel/CLI as optional local tooling, interview runbook, and HU #011 / #012 deferrals
- [x] 7.2 Update `docs/architecture.md` and `docs/agents/wom-customer-service-agent.md` so HU #010 is the shipped demo UI, not deferred, and Vapi remains an interaction adapter
- [x] 7.3 Update `docs/adapters/vapi-inbound.md` so browser media and Server URL stay distinct; confirm `lidr-specboot/docs/` needs no methodology rewrite

## 8. Adversarial remediations (TDD)

- [x] 8.1 Write failing tests for honest microphone consent, connecting timeout (8s → error + retry), bounded transcript (2048/50), exact tool-event types only, AgentCard status that does not claim a verified backend, and no `localStorage`/`sessionStorage` in `web/src`
- [x] 8.2 Implement those behaviors and verify the new tests pass
- [x] 8.3 Update `docs/adapters/vapi-web-demo.md` for provider audio processing, Vapi origin allowlisting, and unpublished public keys
- [x] 8.4 Review tests against the updated `wom-voice-demo` scenarios (MANDATORY)
- [x] 8.5 Run web tests + targeted isolation/hygiene and write `openspec/changes/wom-voice-demo-ui/reports/2026-09-06-adversarial-remediation.md` (MANDATORY - AGENT MUST EXECUTE)
- [x] 8.6 Live Vapi smoke remains SKIP unless `web/.env` credentials exist; record that in the remediation report
