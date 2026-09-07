# Adversarial checklist (independent re-review)

- Date: 2026-09-06
- Change: `vapi-custom-tool-invocation`
- Pass: independent `/adversarial-review` after remediation-2
- Primary report: `reports/2026-09-06-adversarial-review.md`
- Verdict: **PASS WITH GAPS** (0 Blocker / 0 Major)

Cases covered (assume fail until evidence):

1. **Auth bypass** — missing/wrong `x-voice-inbound-secret` never executes tools; secret not echoed. **Refuted.**
2. **Allowlist escape** — invented names and `demo.*` denied; no registry body run; channel port isolated from `dependencies.tools`. **Refuted.**
3. **Schema injection** — extra fields / oversized body rejected; no tool execution. **Refuted.**
4. **Persistence disclosure** — deny/invalid attacker fields must not appear in session report `toolCalls` **or** `trace` metadata. **Refuted** (`argumentsRedacted: {}` + full-report test).
5. **Audit reconstructability** — production Supabase session reports must surface `invocationSource: vapi_custom_tool`. **Refuted** (hydrate + mocked adapter test).
6. **Dual-brain** — with `VOICE_REASONING_OWNER=vapi`, inbound transcript does not run agent turn; tools route never receives `runAgent`. **Refuted** when configured; **residual Minor** if left at default `runtime`.
7. **Fail-closed** — timeout/failure never returns canned success usage/bill/incident payloads. **Refuted.**
8. **Secret hygiene** — no service-role or inbound secret in `web/` / Vite env; examples are empty keys only. **Refuted.**
9. **Replay / DoS** — residual Minor: no toolCallId idempotency/freshness on tools route; hanging work may continue after hard-timeout response.
10. **Spoken honesty** — Question: channel prompt residual after normalized tool failure (operator DoD).

Targeted suite re-run: 4 files / 23 tests passed (does not alone grant security PASS).
