# Final summary — evaluation-public-demo (HU #012)

## 1. Implementation summary

Built deterministic session call evaluation (four dimensions, evidence refs), persist-on-terminal + optional recompute, demo public token auth, evaluation UI in the existing WOM web demo, deploy docs/config (`render.yaml`, `web/vercel.json`), and documentation. Did **not** merge with offline quality-gate `EvaluationRun` HTTP.

## 2. Evaluation design

- Contract: `SessionCallEvaluation` on `SessionReport.evaluation`
- Dimensions: `goal_achieved`, `tool_selection`, `grounded_answer`, `policy_compliance`
- Engine: `scoreSessionCall` (pure, offline)
- Persist: `sessions.evaluation` jsonb; score on `call_ended`; `?recompute=true` refreshes

## 3. Deployment

- Documented Vercel + Render + Supabase Cloud; env **names** only
- Live deploy **blocked** in this apply session (no host credentials)

## 4. Important files

| Path | Purpose |
| --- | --- |
| `src/domain/session-call-evaluation.ts` | Evaluation value object |
| `src/application/score-session-call.ts` | Deterministic scorer |
| `src/application/ensure-session-evaluation.ts` | Persist / recompute helpers |
| `supabase/migrations/20260906140000_session_call_evaluation.sql` | JSON column |
| `web/src/components/agent/CallSummary.tsx` | Evaluation view |
| `docs/evaluation-call.md` / `docs/public-demo-deploy.md` | Docs |

## 5. Tests

- Full vitest: 307 passed
- Web vitest: 23 passed
- Eval gate regression: PASS
- Root typecheck: pre-existing failures remain (not introduced by scorer files)
- Public E2E: blocked

## 6. Known limitations

- Live public deploy + Vapi Server URL manual step still required for AC-06
- No visual trace explorer / full call-history browser
- No LLM-as-judge
- Grounding uses token overlap (paraphrase → partial)

## 7. Interview demo procedure

See `docs/public-demo-deploy.md` § Interview demo procedure.

## Methodology note

`lidr-specboot/docs/` was not modified.

## Next

- Deploy with Render/Vercel/Supabase credentials
- Run `/adversarial-review` before archive
- Then `/opsx-archive`
