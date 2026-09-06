## Why

The runtime already owns `wom-customer-service-agent` and a Vapi inbound adapter, but an interviewer can only exercise them through tests or HTTP. There is no product UI, so the portfolio demo cannot show a real browser voice conversation, live transcript, or call lifecycle without implying that Vapi or React is the agent kernel.

## What Changes

- Add the first product web application: a WOM-inspired **AI Demo** interface named **WOM Customer Service AI**, clearly labeled as a prototype (not an official WOM product).
- Let an interviewer start, watch, and end a **real** browser voice call through a small frontend media-client abstraction implemented with the official Vapi Web SDK. Agent reasoning and `wom.*` tools stay on the existing backend.
- Drive UI from an explicit, deterministic call state machine (`idle`, `connecting`, `active`, `ending`, `completed`, `error`) plus a normalized transcript. Suggested prompts are instructional only and MUST NOT start a call.
- Show lightweight, human-readable tool activity only when the media client can honestly observe it. Otherwise show a deferred-trace placeholder for HU #011 — never a fabricated execution report.
- After adversarial review: honest microphone consent (provider processes audio; this app does not persist it); connecting timeout; bounded transcript; status that does not claim a verified backend owner; document that the Vapi public key must stay origin-restricted and unpublished.
- Document public frontend env vars (Vapi public key, assistant id, optional public API base). Never expose inbound secrets, provider private keys, or database credentials.
- Preserve HU #001 / #002 / #009: no new inbound webhook, no agent/prompt/tool/RAG changes, default `VOICE_SESSION_OWNER` remains `runtime-demo` for existing tests. Interview runbook requires `wom-customer-service-agent`.

## Non-goals

- New agent, prompt version, tools, RAG, orchestration, MCP, or memory.
- Moving the AI Agent Runtime or customer-service tools into React or into Vapi client-side tools.
- A second `POST /adapters/voice/inbound` (or any parallel Server URL) for the frontend.
- Persistence, call history, durable transcripts, full traces, eval dashboard (HU #011).
- Public deploy, production hosting, real WOM APIs, customer auth, phone numbers, WhatsApp, SMS (HU #012 / later).
- Cloning the WOM marketing website.
- Using Vapi CLI as the interviewer runtime (CLI remains an optional local webhook tunnel).
- Redux or another global store unless the new app has no simpler alternative.
- Treating localStorage as the transcript source of truth.

## Change types

`ui` | `voice` | `code`

Not in this change: `agent`, `tools`, `rag`, `api` (no new product HTTP family; inbound contract unchanged).

## Capabilities

### New Capabilities

- `wom-voice-demo`: Interviewer-facing demo web UI — branding and honesty, agent status and capabilities, suggested prompts, call lifecycle, live transcript, safe errors, secret hygiene, and mocked-SDK tests.

### Modified Capabilities

- `voice-channel-adapter`: The voice adapter family MAY include a browser media client for live call media. That client MUST NOT own prompts, tools, or inbound Server URL handling. Existing `POST /adapters/voice/inbound` remains the only server event ingress.
- `voice-interaction`: Frontend call/media UI state MUST stay distinct from runtime business session state. Ending a UI call MUST NOT assume the backend has finished asynchronous end-of-call processing.

## Impact

- **Code:** New `web/` (or equivalent) React + TypeScript app using shadcn/ui; isolated media-client module; no imports of the runtime domain into React and no Vapi types in `src/domain` or `src/application`.
- **APIs:** No new backend routes. Browser talks to the voice provider for media; the provider continues to POST to the existing inbound adapter. Canonical `lidr-specboot/docs/api-spec.yml` `/sessions` remains unimplemented.
- **Dependencies:** Frontend may add React, Vite (or the smallest toolchain compatible with this repo), Tailwind/shadcn, and `@vapi-ai/web`. Automated tests MUST mock the SDK. Root backend `package.json` stays the runtime unless a documented workspace script is added.
- **Data:** No PostgreSQL migrations. Transcript is ephemeral in the browser for this HU.
- **Eval / security:** No new agent quality-gate member. UI/state-machine tests and secret-hygiene checks are required. Live Vapi is manual smoke only. Adversarial review still applies at archive because a public key now ships to the browser.
