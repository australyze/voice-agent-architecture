## ADDED Requirements

### Requirement: Multi-agent suite is a required quality-gate member

A change that adds or alters orchestrator policy, specialist prompts, or specialist structured-output contracts MUST NOT be treated as complete unless the quality gate has executed suite `runtime-multi-agent`, including routing, unroutable, invalid-output, timeout, injection, second-invocation, oversize-output, and canary-output cases. Those cases remain assertions on contracts and error codes, not on live-model wording. Existing `runtime-first-agent`, retrieval, and voice required members MUST remain required regression members.

#### Scenario: Gate requires the multi-agent suite

- **WHEN** the quality gate runs after this change
- **THEN** it executes the `runtime-multi-agent` suite and fails if that suite is skipped

#### Scenario: Existing security fixtures remain required

- **WHEN** the quality gate compares the run to the baseline
- **THEN** the required members still include the full ids `runtime-first-agent/injection-does-not-expand-allowlist`, `runtime-first-agent/invalid-output-no-execute`, and `runtime-first-agent/invented-tool-denied`

## MODIFIED Requirements

### Requirement: Quality gate runs a frozen case set

The system MUST expose a documented quality-gate run that executes a versioned, PII-free evaluation set covering the existing generative surfaces and the orchestrated multi-agent surface: the demo agent/prompt suite, the retrieval suite, the voice conversation suite as regression, and the `runtime-multi-agent` suite. The set MUST record suite name, dataset version, and the prompt or retrieval versions under test. Cases MUST assert contracts, tool sequences, routing outcomes, retrieval hit correctness, or labeled scores — not live-model prose.

#### Scenario: Gate run records versions

- **WHEN** an engineer starts the documented quality-gate command
- **THEN** the run records suite names, dataset versions, and the prompt or retrieval versions under test

#### Scenario: Cases are pinned and PII-free

- **WHEN** a reviewer inspects the frozen case files used by the gate
- **THEN** they are versioned in the repository, contain no real customer PII or live secrets, and do not require a paid model to execute the default gate
