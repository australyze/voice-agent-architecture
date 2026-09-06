## MODIFIED Requirements

### Requirement: Quality gate runs a frozen case set

The system MUST expose a documented quality-gate run that executes a versioned, PII-free evaluation set covering the existing generative surfaces plus the WOM customer-service agent: the demo agent/prompt suite, the retrieval suite, the voice conversation suite as regression, the `runtime-multi-agent` suite, and the `wom-customer-service` suite. The set MUST record suite name, dataset version, and the prompt or retrieval versions under test. Cases MUST assert contracts, tool sequences, routing outcomes, retrieval hit correctness, or labeled scores — not live-model prose.

#### Scenario: Gate run records versions

- **WHEN** an engineer starts the documented quality-gate command
- **THEN** the run records suite names, dataset versions, and the prompt or retrieval versions under test

#### Scenario: Cases are pinned and PII-free

- **WHEN** a reviewer inspects the frozen case files used by the gate
- **THEN** they are versioned in the repository, contain no real customer PII or live secrets, and do not require a paid model to execute the default gate

## ADDED Requirements

### Requirement: WOM suite is a required quality-gate member

A change that adds or alters WOM agent policy, the WOM prompt, or `wom.*` tools MUST NOT be treated as complete unless the quality gate has executed suite `wom-customer-service`, including usage, billing, service-status, tool-failure no-fabrication, unsupported-request, hop-limit, invented-tool, invalid-args, injection, and cross-allowlist cases. Those cases remain assertions on contracts, tool names, and error codes, not on live-model wording. Existing required members (`runtime-demo` / `runtime-first-agent`, retrieval, voice, `runtime-multi-agent`) MUST remain required.

#### Scenario: Gate requires the WOM suite

- **WHEN** the quality gate runs after this change
- **THEN** it executes the `wom-customer-service` suite and fails if that suite is skipped

#### Scenario: Existing security fixtures remain required

- **WHEN** the quality gate compares the run to the baseline
- **THEN** the required members still include the previously required `runtime-first-agent`, retrieval, voice, and `runtime-multi-agent` case ids
