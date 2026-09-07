## Purpose

Defines deterministic, explainable post-call evaluation of a completed voice demonstration session using only persisted HU #011 evidence, without an LLM judge and without replacing the offline quality-gate EvaluationRun suites.

## ADDED Requirements

### Requirement: Session call evaluation covers four explainable dimensions

The system MUST produce a session call-evaluation result for a terminal Session (`completed` or `failed`) that includes exactly these dimension identifiers: `goal_achieved`, `tool_selection`, `grounded_answer`, and `policy_compliance`. Each dimension MUST carry a verdict of `met`, `partial`, or `unmet` (UI labels MAY map these to Spanish Cumplido / Parcial / No cumplido) and MUST include one or more evidence references that point at persisted transcript turns, tool calls, execution events, or session status fields that actually exist on that Session. The result MUST include an overall status derived from the dimensions, a scorer version identifier, and an evaluated-at timestamp. The evaluation MUST NOT invent evidence rows, tool results, or transcript text that are absent from persistence.

#### Scenario: Happy-path tool-backed call is scored

- **WHEN** a terminal session has one successful allowlisted demo tool call and a final assistant turn whose text contains values present in that tool result
- **THEN** the evaluation includes all four dimensions with evidence refs to those tool and turn records and an overall status that is not an error of missing input

#### Scenario: Evidence never fabricated

- **WHEN** a terminal session has zero tool calls
- **THEN** dimensions that require tool evidence reference the empty tool-call set or session metrics and do not invent a tool-call id or result

### Requirement: Scoring is deterministic and offline-testable

Session call evaluation MUST be a pure deterministic function of the SessionReport (or equivalent persisted snapshot): transcript, toolCalls, trace, status, and metrics. It MUST NOT call a paid or live LLM, MUST NOT require network access, and MUST be idempotent for the same input and scorer version. Goal and tool dimensions MUST be decided from structured toolCalls (name, status, result) and grounding of the final assistant turn against tool output — NOT from exact matching of noisy ASR user phrases to canned scenario strings. Policy compliance MAY inspect transcript text with lax thresholds for Spanish interaction cues, forbidden real-WOM-system claims, secret-shaped substrings, and unbounded execution signals.

#### Scenario: Unit test without network

- **WHEN** the scorer is invoked in automated tests with an in-memory SessionReport fixture and no network
- **THEN** it returns a stable evaluation result for that fixture

#### Scenario: Failed tool yields unmet or partial tool and goal dimensions

- **WHEN** a terminal session’s only relevant tool call has status failed, timed_out, or denied
- **THEN** `tool_selection` and/or `goal_achieved` are not `met`, and evidence references that failed tool call

#### Scenario: Error session is scored without crashing

- **WHEN** a session ends with business status `failed`
- **THEN** the scorer returns an evaluation result with evidence referencing that status and does not throw

### Requirement: Evaluation is distinct from the offline quality gate

Session call evaluation MUST NOT replace, merge into, or require the quality-gate `EvaluationRun` HTTP resources. Canonical `POST /evaluations/runs` and suite-run APIs MUST remain unimplemented unless a separate change opens them. Offline `eval/` suites and `npm run test:eval-gate` remain regression surfaces for generative/policy fixtures and MUST NOT be treated as the interviewer-facing per-call score.

#### Scenario: Suite evaluation HTTP stays unimplemented

- **WHEN** a client calls `POST /evaluations/runs` or `GET /evaluations/runs/{runId}`
- **THEN** the response remains 404 (or the project’s existing unimplemented behavior) and session call evaluation still works via the session report

### Requirement: Persist on terminal status with optional recompute

When a Session first reaches a terminal business status, the system MUST compute and persist the call-evaluation result as the source of truth on that Session. A subsequent read of `GET /sessions/{sessionId}` without a recompute signal MUST return the persisted evaluation when present. When an **operator-authenticated** client requests recompute (explicit query flag), the system MUST re-run the current scorer version over the current persisted evidence, MAY update the persisted evaluation, and MUST return the recomputed result. Recompute and lazy evaluation writes MUST NOT be available to `DEMO_PUBLIC_TOKEN`. Recompute MUST remain deterministic and MUST NOT fabricate evidence.

#### Scenario: Default read returns persisted evaluation

- **WHEN** an authenticated client requests session detail for a terminal session that already has a stored evaluation and does not request recompute
- **THEN** the response `evaluation` equals the stored result

#### Scenario: Recompute refreshes with current scorer

- **WHEN** an operator-authenticated client requests session detail with recompute enabled for a terminal session
- **THEN** the response `evaluation` is produced by the current scorer version from current persisted rows and is attributable with an evaluated-at timestamp
