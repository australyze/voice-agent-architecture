## Why

HU #011 persists reconstructable session reports with `evaluation: null`. An interviewer still cannot see whether a completed WOM demo call met goal, tool, grounding, and policy dimensions, and the demo is not reachable outside the candidate’s laptop. Without a deterministic post-call scorer wired to that reserved field and a public Vercel + Render + Supabase deployment, the portfolio demo cannot prove evaluation and end-to-end voice in one interview.

## What Changes

- Treat **post-call scoring as a deterministic workflow** (typed rules over persisted transcript, tool calls, status, and trace). It is **not** a new product agent, not LLM-as-judge, and not a second evaluation architecture beside the existing offline quality gate (`eval/gate`).
- Define a **session call-evaluation contract** that populates `SessionReport.evaluation` (today reserved null) with four dimensions: `goal_achieved`, `tool_selection`, `grounded_answer`, `policy_compliance`; overall status; evidence references into persisted rows; evaluation attribution (when scored, scorer version).
- **Persist once** when a session reaches a terminal business status (`completed` or `failed`), as source of truth. Support **optional recompute on read** (`GET /sessions/{sessionId}?recompute=true` and/or a UI “Re-evaluar” action) so demo scoring rules can change between interviews without migrating rows. Without recompute, return the persisted evaluation.
- Score from **structured artifacts** (toolCalls status/name/result + final assistant turn grounding), not ASR transcript matching for goal/tool. Use user/assistant text only for **policy** checks with **lax** thresholds. Matrix: correct tool ∧ success ∧ grounded → Cumplido; correct tool ∧ success ∧ weak grounding → Parcial; missing/wrong tool or failed tool → No cumplido (per dimension rules in design).
- Extend session read auth: keep existing demo-operator secret header; add a dedicated **read-only demo token** (`DEMO_PUBLIC_TOKEN`) usable for report/evaluation reads. Browser UX: one-line passcode fed from env (never commit secrets).
- Extend the HU #010/#011 web surface to **render evaluation results** on the completed-call report (Spanish interviewer copy + English dimension ids; verdicts Cumplido / Parcial / No cumplido). Reuse WOM-inspired identity and shadcn/ui; no second frontend.
- **Publicly deploy** the demo: frontend on **Vercel**, backend on **Render** (HTTPS free tier default), Postgres on **Supabase Cloud** (same schema as HU #011). Document env vars in `.env.example` only. Point the Vapi assistant **Server URL** at the deployed backend (manual dashboard step verified in DoD; optional scoped script; never mutate Vapi from CI).
- Document evaluation design, deployment, interview demo procedure, and secret hygiene. Verify typecheck, full tests, and a live end-to-end public voice flow that leaves a SessionReport with a non-null evaluation.

Recorded decisions (from `/enrich-us` Q1–Q6; not reopened here):

1. Persist-on-complete + optional recompute on read; persisted is source of truth.
2. Backend host default: Render; DB: Supabase Cloud; frontend: Vercel; HTTPS public URL required.
3. Auth: existing secret and/or dedicated read-only demo token + UI passcode; no multi-tenant IAM.
4. UI copy: Spanish for interviewer-facing labels; English canonical dimension ids.
5. Goal scoring ignores ASR phrase matching; uses tools + grounding.
6. Vapi Server URL update is in-scope DoD (manual verified; optional script; not CI).

## Non-goals

- Replacing or merging with the offline **quality gate** (`EvaluationRun` suites, Promptfoo/DeepEval, LLM judge).
- New agent prompt, tool schemas, allowlist, RAG corpus, or spoken UX (barge-in, confirmation, STT/TTS).
- Canonical product `POST /evaluations/runs` / suite-run HTTP from `api-spec.yml` (stays unimplemented).
- Multi-tenant auth, HITL approval queues, full call-history browser, BI, warehouses.
- Claiming to be an official WOM production product or accessing real WOM systems / real PII.
- Backend on Vercel serverless as the default path; Kubernetes; Redis; second database; Langfuse as system of record.
- Automating Vapi assistant mutation from CI; committing secrets or service-role keys to the browser or git.
- Exact transcript phrase matching for scenario routing (agent already owns intent).

## Change types

`code`, `api`, `ui`

Not in this change: `tools` (no schema/executor/allowlist change), `agent` (no prompt/policy change), `rag`, `voice` as media/turn-taking (inbound persist path already exists; Server URL config is operational). Deployment verification is in tasks/docs.

## Capabilities

### New Capabilities

- `session-call-evaluation`: Deterministic, explainable per-session evaluation over HU #011 persisted evidence; four dimensions; overall status; evidence refs; persist-on-terminal + optional recompute; no LLM judge; distinct from offline quality-gate `EvaluationRun`.
- `public-demo-deployment`: Public interviewer-reachable demo: Vercel frontend, Render backend HTTPS, Supabase Cloud persistence, documented env/secret hygiene, Vapi Server URL pointed at deployed backend, verified end-to-end voice → report → evaluation.

### Modified Capabilities

- `session-persistence`: `SessionReport.evaluation` is no longer permanently null; terminal sessions carry a persisted evaluation object; detail GET supports optional recompute; read auth accepts demo-operator secret or dedicated read-only demo token; metrics remain free of inventing evaluation scores outside this contract.
- `wom-voice-demo`: Completed-call UI shows evaluation dimensions, verdicts, and evidence summaries in Spanish interviewer copy with English dimension ids; passcode/token for report fetch; still no service-role in the browser; still not a second frontend architecture.

## Impact

- **Code:** Domain evaluation result type for sessions (not suite `EvaluationRun`); deterministic scorer in application; persist evaluation on session end; `GET /sessions/:id` returns evaluation; optional `recompute` query; memory/postgres/supabase adapters store the evaluation payload; web CallSummary/report view + i18n-lite labels; deploy docs and `.env.example` names.
- **APIs:** Additive fill of `evaluation` on session report; optional query flag; auth header accepts second token for reads. Not a break of list/detail shape beyond replacing null with an object when scored.
- **Dependencies:** No new evaluation-vendor packages. No Supabase/Vapi SDKs in domain. No secrets in `web/` beyond public Vapi key and demo read token / passcode as already patterned.
- **Data:** Prefer JSON column or bounded child row on Session for the evaluation result (design decides smallest migration). Do not invent a parallel call-store.
- **Eval / security:** Deterministic unit tests for scorer edge cases (no tools, failed tools, error sessions). Contract tests for evaluation payload and auth. UI component tests. Existing `test:eval-gate` as regression only (no new agent suite unless generative path changes — it must not). Independent `/adversarial-review` before archive (secret hygiene, public deploy leakage, token scope).
