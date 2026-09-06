## Context

See `proposal.md` for motivation. Observed constraints that shape this design:

- HU #011 already persists `sessions`, `conversation_turns`, `tool_calls`, `execution_events` and exposes `GET /sessions` / `GET /sessions/:sessionId` with `SessionReport.evaluation: null` reserved for this change.
- Offline quality gate (`eval/gate`, domain `EvaluationRun`) is suite-oriented CI evidence — not per-call interviewer scoring. Canonical `/evaluations/runs` stays 404.
- Web demo (`web/`) already fetches a thin session report after hang-up; `CallSummary` does not yet render evaluation dimensions.
- No `vercel.json`, no Render blueprint, no public HTTPS backend today; Compose Postgres is local-only; docs already defer public deploy to HU #012.
- Hexagonal ports: domain must not import Vapi, Supabase, or evaluation vendors (`lidr-specboot/docs/base-standards.md`).

## Goals / Non-Goals

**Goals:**

- Smallest deterministic scorer that fills `SessionReport.evaluation` from persisted evidence.
- Persist-on-terminal + optional recompute without a second history architecture.
- Interviewer-visible evaluation in the existing web app (Spanish UX labels).
- Documented and verified public deploy: Vercel + Render + Supabase Cloud + Vapi Server URL.

**Non-Goals (design-level):**

- Merging call scores into quality-gate `EvaluationRun` tables or HTTP.
- New agent topology, tools, RAG, or voice media policy.
- Multi-tenant IAM or call-history browser beyond the completed call.
- Backend-on-Vercel as the recommended path.

## Decisions

### D1 — Deterministic workflow, not a product agent

**Decision:** Post-call scoring is an application pure function + persist/read use cases. No LLM judge, no new specialist agent.

**Why:** Path is fully specified (structured toolCalls + grounding + policy heuristics). Matches `design-ai-system` / agent-vs-workflow: prefer typed workflow.

**Alternative:** LLM-as-judge over transcript — rejected (nondeterministic, paid, fails AC “no real LLM”).

### D2 — Topology and ports

**Decision:** Keep single session owner (`wom-customer-service-agent`). No multi-agent change.

| Port / surface | This change |
| --- | --- |
| Application scorer | New pure function consuming SessionReport-shaped input |
| `PersistencePort` | Additive save/load of evaluation payload on session |
| HTTP sessions API | Return evaluation; optional `recompute=true`; accept `DEMO_PUBLIC_TOKEN` |
| LLM / Tool / Speech / Observability contracts | Unchanged |
| Offline eval gate | Regression only |

**HITL / risk:** Demo tools remain simulated read-class. Evaluation itself is read-only analysis. No new irreversible tools. Public token is read-scoped.

**Budgets:** Scorer MUST finish well under typical API latency (target &lt; 50ms in-process on demo-sized transcripts). No token budget (no model call).

### D3 — Evaluation contract vs suite EvaluationRun

**Decision:** Introduce a **session call-evaluation** value object on the report (e.g. dimensions, overallStatus, evidence[], scorerVersion, evaluatedAt). Do **not** overload domain `EvaluationRun` (suite/gate). Do **not** open `/evaluations/runs`.

**Why:** Avoid conflating CI suite runs with per-call demo scores; reserved report field already exists.

**Alternative:** Materialize full EvaluationRun + EvaluationScore rows per call — rejected as heavier than needed for portfolio demo and collides with gate semantics.

### D4 — Persist JSON on `sessions` (smallest migration)

**Decision:** Add nullable `evaluation jsonb` (and optionally `evaluation_scorer_version` / `evaluated_at` columns, or nest those inside JSON) on `sessions`. Memory adapter mirrors the field. Same SQL technology; apply via new Supabase migration file.

**Why:** Round-trip without a parallel store; matches “no second persistence architecture.”

**Alternative:** Child table `session_evaluations` — acceptable if JSON becomes awkward; default to JSON column for speed of apply.

### D5 — When to score

**Decision:** On transition to terminal `businessStatus` (`completed` | `failed`), after history rows for that call are available, compute and upsert evaluation. Idempotent: recomputing the same scorer version on the same snapshot yields the same logical result. Reads without `recompute` return stored JSON. `recompute=true` recomputes with current scorer, updates store, returns fresh result.

**Why:** Q1 — attributability + cheap demo rule updates.

**Alternative:** Score only on read — rejected as sole mode (loses durable attribution). Score only on write with no recompute — rejected for interview iteration.

### D6 — Dimension rules (structured-first)

**Decision:** Canonical ids: `goal_achieved`, `tool_selection`, `grounded_answer`, `policy_compliance`. Verdicts: `met` | `partial` | `unmet`.

Approximate matrix (exact predicates in unit tests):

| Signal | Source |
| --- | --- |
| Expected demo tools | Allowlisted names already used by WOM agent: `get_customer_usage`, `get_bill_status`, `check_service_status` |
| Tool correct | At least one succeeded call to a recognized demo tool (intent not re-inferred from ASR) |
| Tool failed | failed / timed_out / denied → tool_selection / goal not `met` |
| Grounded | Final assistant turn text contains distinctive string tokens from the succeeded tool `result` (normalized); if tool ok but no overlap → `partial` |
| Goal | `met` iff correct tool ∧ success ∧ grounded `met`; `partial` if tool ok + weak grounding; else `unmet` |
| Policy | Lax checks: Spanish-ish cues OR absence of hard English-only policy breach; forbid claims of live WOM production access; redact/flag secret-shaped substrings; session not unbounded (error flood) |

No exact user-utterance scenario phrases.

**Alternative:** Classify user intent with embeddings — rejected (nondeterministic / network).

### D7 — Auth: operator secret + DEMO_PUBLIC_TOKEN

**Decision:** Session GETs accept `x-demo-orchestrate-secret` (operator) **or** `x-demo-public-token` (`DEMO_PUBLIC_TOKEN`). No dual-accept of the public token on the operator header. Public token is read-only: no recompute, no lazy evaluation write, and `GET /sessions` requires `externalChannelId`. Public token MUST differ from inbound/operator secrets. Inbound write auth remains `VOICE_INBOUND_SECRET`. Web interview path: on-screen passcode only — do not bake read or write tokens into `VITE_*`.

**Why:** Q3 — interviewer-friendly without multi-tenant IAM; adversarial remediations close confused-deputy / IDOR / mutating “read-only” token.

**Alternative:** Open GETs on public internet — rejected (enumeration of transcripts even if synthetic). Dual-accept public token on operator header — rejected after adversarial review.

### D8 — UI: extend CallSummary, i18n-lite Spanish

**Decision:** Extend existing completed-call surface to render evaluation dimensions (English id + Spanish subtitle + Spanish verdict). Single labels module. Re-evaluar / `?recompute=true` is operator-only (not wired on the public interview UI). No new app shell or design system.

**Why:** Q4 + reuse HU #010/#011 architecture.

### D9 — Deploy topology

**Decision:**

| Layer | Host |
| --- | --- |
| Frontend | Vercel (`web/` Vite build) |
| Backend | Render Web Service (Node `npm start`), HTTPS |
| DB | Supabase Cloud (existing migrations + evaluation column) |
| Voice media / Server URL | Vapi dashboard → `https://<render>/adapters/voice/inbound` |

Document env names in `.env.example`. Optional `render.yaml` / Vercel project notes in `docs/`. Manual Vapi Server URL update in DoD; optional script; never CI mutation.

**Why:** Q2 — long-running process preferred over serverless cold-start dropping early events; Supabase already narrative of #011.

**Alternative:** Fly.io / Railway — documented alternatives. Backend on Vercel — rejected as default.

### D10 — Change types and gates

**Change types:** `code`, `api`, `ui` (not `agent`/`tools`/`rag`/`voice`-media).

**Gates for tasks.md:** unit (scorer + persistence round-trip), contract (session GET evaluation + auth token), DB verification (evaluation column), UI component tests, secret hygiene, docs, deployed E2E verification report, existing `test:eval-gate` as regression only, `/adversarial-review` before archive.

### D11 — Evidence reference shape

**Decision:** Evidence entries are structured refs: `{ kind: 'tool_call' \| 'turn' \| 'event' \| 'session', id?: string, field?: string, note: string }` where `id` MUST match a persisted row when kind is tool/turn/event. Notes are English technical strings; UI maps dimension copy to Spanish.

**Why:** Explainability AC without dumping full payloads twice.

## Risks / Trade-offs

- [Grounding false partial on paraphrase] → Mitigation: token overlap on distinctive tool fields (numbers, status enums); document limitation; partial is acceptable.
- [Policy false positives on ASR garbage] → Mitigation: lax thresholds; policy fails hard only on clear secret patterns / explicit forbidden claims.
- [Render cold start drops first webhook] → Mitigation: document warm-up ping before interview; prefer always-on if budget allows later.
- [Public demo token leak] → Mitigation: dedicated non-production value; rotate in host dashboards; no service-role in browser; mock data only.
- [Confusion with quality gate] → Mitigation: naming (`session call evaluation` vs `EvaluationRun`); specs forbid merging HTTP.
- [Vapi Server URL still points at localhost] → Mitigation: DoD checklist + E2E proof via hosted SessionReport.

## Migration Plan

1. Add migration for `sessions.evaluation` (jsonb) (+ indexes none required).
2. Deploy backend to Render with Supabase env; run migrations.
3. Deploy frontend to Vercel with public env pointing at Render.
4. Update Vapi Server URL manually; smoke inbound.
5. Rollback: leave column nullable; old backends ignore JSON; frontend feature-detects null evaluation.

## Open Questions

None material — Q1–Q6 resolved. Deferrable polish only: exact header name for demo token (`x-demo-orchestrate-secret` dual-accept vs distinct header) — implementers pick one, document in `.env.example`, cover with contract tests.
