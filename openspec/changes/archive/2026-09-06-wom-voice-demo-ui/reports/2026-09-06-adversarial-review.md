## Adversarial review

**Scope**: OpenSpec change `wom-voice-demo-ui` (HU #010). New `web/` interviewer UI + Vapi Web SDK media client. No new inbound HTTP family, no new agent/prompt/tools.

**Sources**: `proposal.md`, `design.md`, `specs/{wom-voice-demo,voice-channel-adapter,voice-interaction}/spec.md`, `tasks.md`; `lidr-specboot/docs/base-standards.md`, `backend-standards.md` (Security), `frontend-standards.md`; implementation under `web/src`, `src/demo-web-isolation.test.ts`, inbound `create-server.ts`; working-tree vs `feature/wom-customer-service-agent` (`3d01c64`). `/verify` quality PASS was **not** treated as a security PASS.

**Independence**: This review ran in the same conversation that implemented the change. Treat residual risk as slightly under-challenged; a later session should re-read this report against the same files.

### Spec and task alignment

Accepted this increment:

- Separate `web/` SPA; no agent-turn loop or `wom.*` executors in the browser (isolation test + source grep).
- Media client is `start(assistantId)` only; no client-side WOM tools.
- Server events remain `POST /adapters/voice/inbound` only (`create-server.ts` routes unchanged).
- Browser env example is public key + assistant id + unused public API base; inbound secret / DB URL / private key are not client variables.
- Transcript rendered as React text (not `dangerouslySetInnerHTML`); no `localStorage` / `sessionStorage`.
- Errors always collapse to a fixed Spanish string (`normalizeSafeError` always returns `SAFE_CALL_ERROR`).
- Demo / Prototype / Demo Environment labeling is visible.
- Existing `wom.*` tools stay `read`; no HITL expansion; no runtime MCP.

Non-goals hold: no parallel webhook, no persistence, no public deploy.

Underspecified: Vapi dashboard origin allowlisting; third-party audio retention; connecting-state timeout (promised in design D7/risks, not in the spec).

### Findings

| Severity | Area | Finding | Evidence | Suggested fix |
| --- | --- | --- | --- | --- |
| Minor | Consent / PII | Microphone copy says audio is not saved “in this HU.” Interviewers can read that as “audio is not stored,” while Vapi still receives, transcribes, and may retain media. | `DemoApp.tsx` disclaimer; media path is Web SDK → Vapi | **docs + UI**: say the browser sends audio to the voice provider and this app does not persist it |
| Minor | Secret / cost | Vite public key + assistant id are enough for anyone who can load the bundle (or DevTools) to start calls and burn vendor credits. Fine for a locked interview laptop; unsafe if the same env is later hosted. | `clientFromEnv`; `web/.env.example`; HU #012 is a non-goal | **docs**: restrict Vapi allowed origins / do not reuse interview keys on a public host |
| Minor | Honesty | Idle card always shows **Ready** and WOM capabilities. It does not check backend health or `VOICE_SESSION_OWNER`. Default inbound owner remains `runtime-demo`. | `AgentCard.tsx`; `.env.example` default | **code + docs**: do not imply the WOM owner is bound; optional health hint |
| Minor | Availability | `start()` can hang with the start control disabled and no timeout or return-to-idle. Design listed this risk; spec has no budget. | `use-voice-agent.ts` `connecting` + disabled start | **OpenSpec + code**: connecting timeout → `error` + retry |
| Minor | Insecure output handling | Transcript and tool-activity text are unbounded. A flood or huge `transcript` string is rendered as-is (escaped, but can stall the tab). Tool labels trust any Vapi `function-call` whose name maps to a WOM tool — display-only spoof, not execution. | `normalize.ts`; `ConversationTranscript.tsx` | **code + tests**: cap message length/count; require a stronger “tool ran” signal if one exists |
| Minor | Tests | Spec forbids localStorage as SoT; code has none, but no test asserts that. Secret hygiene does not scan a production `dist/` bundle. | `web/src` grep; `secret-hygiene.test.ts` | **tests**: forbid storage APIs; optional built-bundle scan |
| Question | Supply chain | `index.css` loads Inter from Google Fonts. Not a secret leak; extra third party on a voice-demo origin. | `web/src/index.css` | **code**: self-host the font if the interview laptop should be offline-clean |
| Question | Independence | Same session as `/apply`. | This chat | Re-run review in a fresh session before treating archive as independently blessed |

No Blocker. No new prompt-injection surface in the UI (transcripts are display-only; the runtime packing path is unchanged). No private inbound/LLM/DB credentials in frontend sources. No client execution of customer-service tools. No irreversible / `external_comm` tools added.

### Verdict

**PASS WITH GAPS**

Archiving is advisable for this increment **after** the human live-smoke Definition of Done (still SKIP) and with the residuals above accepted for a local interview demo — **not** for a public host.

### Recommended next steps (before archive)

1. Accept or patch the consent sentence (docs + UI) in a **new** `/apply` if you want the Major-grade privacy wording closed; this review left it Minor because “esta HU” is technically true for the app.
2. Document Vapi origin restriction and “do not publish this public key.”
3. Do not archive claiming a completed live Vapi smoke until credentials exist and the runbook is executed.
4. `/opsx-archive` may proceed on this verdict for a **local demo** only. Public deploy (HU #012) must re-open the public-key finding as Major.
