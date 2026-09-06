# Vapi web demo (HU #010)

The interviewer UI lives in `web/`. It is a frontend adapter, not the AI Agent Runtime.

```text
React UI
  → useVoiceAgent
    → VoiceMediaClient
      → @vapi-ai/web
        → Vapi media
```

Server events still enter the existing inbound adapter:

```text
Vapi Server URL
  → POST /adapters/voice/inbound
    → Voice adapter → handleAgentTurn → wom-customer-service-agent
```

Do not register customer-service tools as client-side Vapi tools. Do not put the inbound shared secret or a private API key in the browser.

Microphone audio is sent to the voice provider so it can transcribe and synthesize speech. The provider may process or retain that audio under its own terms. This application does not persist microphone audio. Backend session history (transcript text, tools, execution events) is stored through the persistence port after inbound processing (HU #011). Live UI transcript still comes from the media client.

Restrict the Vapi public key to the demo origin in the Vapi dashboard. Do not publish interview public keys in docs, screenshots, or the repository. HU #012 reopens public-key and deployment risk if the demo is hosted more broadly.

## Public environment

Copy `web/.env.example` to `web/.env` (gitignored):

- `VITE_VAPI_PUBLIC_KEY` — Vapi public key only
- `VITE_VAPI_ASSISTANT_ID` — assistant that uses this repo’s Server URL
- `VITE_PUBLIC_API_BASE_URL` — optional backend origin for completed-call history
- `VITE_DEMO_ORCHESTRATE_SECRET` — demo-operator header for `GET /sessions`; same value as `DEMO_ORCHESTRATE_SECRET` or `VOICE_INBOUND_SECRET`. Never a hosted persistence admin key.

## Local run

```bash
npm install
npm run dev                 # runtime on PORT from root .env
npm run web:dev             # Vite demo UI
```

From `web/` the equivalent is `npm install` and `npm run dev`.

Automated tests: `npm run web:test` (mocked media client, no microphone, no paid calls).

## Interview runbook

1. Start Compose PostgreSQL if you need `/health/ready`.
2. Set root `.env` `VOICE_SESSION_OWNER=wom-customer-service-agent` and `VOICE_INBOUND_SECRET`. Keep the default `runtime-demo` for automated tests.
3. Point the Vapi assistant Server URL at `https://<tunnel>/adapters/voice/inbound` with the inbound secret header. Vapi CLI or ngrok is optional local tooling, not a frontend runtime dependency.
4. Set `web/.env` public key and assistant id.
5. Open the Vite URL. Confirm **WOM Customer Service AI**, **AI Demo**, capabilities, and the microphone-provider consent line. Restrict the public key to this origin in the Vapi dashboard.
6. Click **Hablar con WOM AI**, allow the microphone.
7. Say “¿Cuántos gigas me quedan?” then “¿Cuánto tengo que pagar este mes?”
8. Confirm spoken replies and a live transcript.
9. **Finalizar conversación** and confirm the client-side summary.
10. After hang-up, the completed card fetches history only when the media client provided a provider-independent `externalChannelId` (or session id) **and** `VITE_PUBLIC_API_BASE_URL` plus `VITE_DEMO_ORCHESTRATE_SECRET` are set. It must not call `GET /sessions?limit=1`. Full evaluation UI is HU #012.

## Deferred

- HU #012 — evaluation UI, scores, visual trace explorer, public deploy
- HU #012 — broader evaluation and public deployment
