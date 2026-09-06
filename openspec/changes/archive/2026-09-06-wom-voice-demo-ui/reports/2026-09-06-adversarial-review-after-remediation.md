# Adversarial review (after remediations)

**Scope**: OpenSpec change `wom-voice-demo-ui` (HU #010), post section-8 remediations. Browser media UI + Vapi Web SDK. No new inbound HTTP family, no new agent/prompt/tools.

**Sources**: `proposal.md`, `design.md`, `specs/{wom-voice-demo,voice-channel-adapter,voice-interaction}/spec.md`, `tasks.md`; `lidr-specboot/docs/base-standards.md`, `backend-standards.md` (Security), `frontend-standards.md`; working tree vs `feature/wom-customer-service-agent` (`3d01c64`); `web/src`, `src/demo-web-isolation.test.ts`, `src/adapters/http/create-server.ts`. `/verify` quality PASS was **not** treated as a security PASS.

**Independence**: Same conversation as `/apply` and `/verify`. Residual risk is slightly under-challenged; a later session should re-read this report against the same files.

### Spec and task alignment

Accepted this increment (evidence, not praise):

- Separate `web/` SPA; isolation tests keep domain/application free of React/`@vapi-ai/web` and keep `web/` free of WOM executors, prompts, and `handleAgentTurn`.
- Media client `start` is `sdk.start(assistantId)` only (`create-vapi-client.ts` + test). No client-registered WOM tools.
- `create-server.ts` still has a single `POST /adapters/voice/inbound`. No frontend webhook route. Runtime files vs merge base are scripts + `.env.example` comments only.
- `web/.env.example` lists public key, assistant id, unused public API base. Hygiene tests forbid inbound secret, `DATABASE_URL`, and `sk-` patterns.
- Transcript is React text (`ConversationTranscript`), not `dangerouslySetInnerHTML`. Sources do not call `localStorage` / `sessionStorage`.
- Errors always become `SAFE_CALL_ERROR`.
- Demo / Prototype / Demo Environment badges are present.
- Existing `wom.*` tools remain `read`; no HITL expansion; no runtime MCP.
- Remediations present: provider-audio consent, 8s connecting timeout, 2048/50 bounds, exact `function-call`|`tool-calls`, AgentCard does not claim a verified owner, docs cover origin allowlist and unpublished keys.

Non-goals hold: no parallel webhook, no persistence, no public deploy.

Underspecified (operator-owned): Vapi dashboard origin restriction is documented, not enforceable in this repo.

### Findings

| Severity | Area | Finding | Evidence | Suggested fix |
| --- | --- | --- | --- | --- |
| Minor | Secret / cost | Vite public key + assistant id are enough for anyone who can load the running demo (or DevTools) to start calls and burn vendor credits. Fine for a locked interview laptop; unsafe if the same env is hosted. | `clientFromEnv`; `web/.env.example`; docs already warn; HU #012 is a non-goal | **docs / HU #012**: keep origin allowlist; do not archive as a public host. Rotate interview keys after the session. |
| Minor | Tests | Secret hygiene scans sources and `.env.example`, not a production `web/dist` bundle. A future build-time leak would not fail this suite. | `web/src/secret-hygiene.test.ts` | **tests** (later): optional built-bundle scan if CI starts publishing `dist/` |
| Minor | Insecure output handling | A Vapi `function-call` / `tool-calls` event whose name maps to a WOM tool still shows a Spanish “consulting…” row without server confirmation. Display-only spoof, not execution. | `normalize.ts`; `labels.ts` | **code** (later): omit live tool rows unless HU #011 can corroborate, or keep as honest “provider reported” |
| Question | Independence | This review is not a different session from the implementer. | This chat | Re-read the report in a fresh session before treating archive as independently blessed |
| Question | Config surface | `VITE_PUBLIC_API_BASE_URL` is documented and typed but unused. A later fetch to that value without an allowlist would be a new egress. | `web/.env.example`; no `fetch` of the var in `web/src` | **code**: leave unused, or remove until a product API exists |

Closed vs prior review (not residual if evidence holds):

- Consent no longer claims “audio is not saved in this HU” as if the provider never sees it.
- Connecting hang now times out at 8s to a retryable error.
- Transcript length/count is bounded; storage APIs are tested-absent.
- AgentCard no longer shows unqualified **Ready**.
- Google Fonts CDN import removed.

No Blocker. No new prompt-injection surface in the UI (transcripts are display-only; inbound packing is unchanged). No private inbound/LLM/DB credentials in frontend sources. No client execution of customer-service tools. No irreversible / `external_comm` tools added.

### Verdict

**PASS WITH GAPS**

Archiving is advisable for this increment **only** as a **local interview demo**, with live Vapi smoke still SKIP until credentials exist. Do not archive as a public or shared-host deployment; HU #012 must re-open the public-key finding as Major.

### Recommended next steps (before archive)

1. Accept the public-key residual for a locked local demo, or rotate/restrict the key in the Vapi dashboard before any shared laptop use.
2. Do not claim a completed live Vapi smoke until `web/.env` exists and the runbook is executed.
3. `/opsx-archive` may proceed on this verdict for a **local demo** only.
