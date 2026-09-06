# wom-voice-demo Specification

## Purpose

Gives interviewers a branded, honest demonstration web interface to start and end a live browser voice conversation with the existing WOM customer-service agent, without treating the UI as the agent runtime.

## Requirements

### Requirement: Demo web application exists as a separate frontend

The repository MUST include a functional demonstration web application that is separate from the AI Agent Runtime. The application MUST NOT embed agent prompts, tool executors, mock directory data, or inbound Server URL handling. Technical identifiers and documentation MUST remain English. Interviewer-visible chrome MUST be Spanish, including a prototype / AI Demo label and the product name WOM Customer Service AI.

#### Scenario: Main screen orients the interviewer

- **WHEN** a user opens the application in idle state
- **THEN** the screen shows the product name, an AI Demo or Prototype indicator, a Demo Environment indicator, language Español, the three capabilities: data usage, bill status, and service status, and a status that does not claim the backend session owner is verified

#### Scenario: Frontend does not contain the runtime

- **WHEN** a reviewer inspects the demonstration web application sources
- **THEN** those sources do not define or execute the customer-service tools and do not host the agent-turn loop

### Requirement: Visual identity is WOM-inspired and not official

The interface MUST use a tokenized palette inspired by WOM Chile (deep purple primary, violet secondary, magenta or fuchsia accent, white and light lavender surfaces, dark text on light surfaces, light text on dark purple). Colors MUST NOT be scattered as unexplained raw values in presentation components. The interface MUST NOT reproduce WOM marketing navigation, product catalog, pricing, or ecommerce. The interface MUST NOT claim to be an official WOM production service.

#### Scenario: Demo honesty is visible

- **WHEN** a user opens the application
- **THEN** a persistent indicator states that the experience is a demonstration or prototype and does not present the app as official WOM production

#### Scenario: Tokens drive surfaces

- **WHEN** a reviewer inspects the demonstration theme
- **THEN** primary, accent, surface, and text colors are defined as named tokens or equivalent theme variables rather than ad-hoc unrelated hex values in each card

### Requirement: Suggested prompts do not start a call

The idle screen MUST show at least three suggested Spanish conversation examples covering usage, billing, and service status. Activating a suggestion MUST NOT start a voice call. It MAY only update instructional hint text.

#### Scenario: Suggestion is instructional

- **WHEN** the user activates the usage suggestion while idle
- **THEN** no call is started and the start-conversation action remains available

### Requirement: Deterministic call lifecycle

The demonstration UI MUST represent exactly these call states: `idle`, `connecting`, `active`, `ending`, `completed`, and `error`. Transitions MUST be driven by the media-client abstraction, not by a generative model. Duplicate start MUST be disabled while connecting or active. Ending MUST request the media client to stop, enter `ending`, and move to `completed` only after the client reports the call has ended.

#### Scenario: Idle shows start

- **WHEN** the application is in `idle` and the media client is configured
- **THEN** a primary start-conversation control is available and enabled

#### Scenario: Connecting gives feedback

- **WHEN** the user activates start
- **THEN** the UI enters `connecting`, shows that the microphone or call is initializing, and disables a second start action

#### Scenario: Connecting timeout returns to a retryable error

- **WHEN** the user activates start and the media client does not report call-start within 8 seconds
- **THEN** the UI enters `error`, shows the safe configuration message, and the start-conversation control is available again

#### Scenario: Active shows live call

- **WHEN** the media client reports the call has started
- **THEN** the UI is `active` and shows a live indicator, elapsed time, agent identity WOM Customer Service AI, a simple voice-activity cue, the transcript region, and an end-conversation control

#### Scenario: End waits for call-end

- **WHEN** the user activates end during `active`
- **THEN** the UI enters `ending` and MUST NOT treat the conversation as completed until the media client reports the call has ended

#### Scenario: Completed shows a client-side summary

- **WHEN** the media client reports the call has ended after a started call
- **THEN** the UI is `completed` and shows that the conversation finished, duration if known, visible turn or message count if known, and a placeholder for later traceability that states detailed execution data is not available yet

### Requirement: Live transcript is normalized and ephemeral

During an active call the UI MUST display conversation messages as user versus assistant with optional timestamps. The UI MUST consume a normalized message shape (`id`, `role` user or assistant, `text`, optional `timestamp`) and MUST NOT pass raw provider message objects through presentation components. The browser MUST NOT persist the transcript in localStorage or equivalent as the source of truth.

#### Scenario: Transcript updates during the call

- **WHEN** the media client emits a user or assistant utterance during `active`
- **THEN** the transcript region shows that speaker and text without exposing a vendor-native payload to the presenter

#### Scenario: Transcript is not durable storage

- **WHEN** a call completes
- **THEN** the visible summary MAY use in-memory session data and MUST NOT require a persisted backend transcript

#### Scenario: Transcript is bounded and not persisted locally

- **WHEN** the media client emits more than 50 final utterances or a single utterance longer than 2048 characters
- **THEN** the UI keeps at most 50 messages, truncates overlong text, and the frontend sources MUST NOT call `localStorage` or `sessionStorage`

### Requirement: Tool activity is honest

If the media client exposes that a backend tool ran, the UI MUST show a short human-readable Spanish label (usage → consulting consumption; bill → consulting account status; service → consulting service status) and MUST NOT show raw tool names on the main demonstration surface. If the media client cannot observe server tool execution, the UI MUST omit a fake live tool row and MAY only point to the deferred traceability placeholder.

#### Scenario: Observed tool is labeled

- **WHEN** the media client reports a usage-tool activity whose event type is exactly `function-call` or `tool-calls` during `active`
- **THEN** the UI shows a consumption consultation label and does not present the internal tool identifier as the primary text

#### Scenario: Unobserved tools are not invented

- **WHEN** the media client provides no tool-activity signal
- **THEN** the UI does not display a fabricated tool-success row

### Requirement: Errors are safe

If the media client cannot start or the call fails, the UI MUST enter `error` and show a user-friendly Spanish message that the conversation could not start or continue and that the user should check demo configuration. The UI MUST NOT display stack traces, API keys, inbound secrets, or raw provider payloads.

#### Scenario: Start failure is friendly

- **WHEN** start fails because configuration is missing or the media client rejects the start
- **THEN** the UI is `error` and the visible message contains no secret and no stack trace

### Requirement: Accessibility and responsive layout

Primary controls MUST be semantic, keyboard accessible, and have visible focus. Icon-only controls MUST have accessible names. Status changes MUST be exposed to assistive technology where practical. The layout MUST remain usable from a mobile-sized viewport through desktop, with desktop as the primary interview presentation.

#### Scenario: Start is operable without color alone

- **WHEN** a keyboard user reaches the start control in `idle`
- **THEN** the control is focusable, has an accessible name, and is understandable without relying only on color

### Requirement: Secret hygiene for the browser bundle

The demonstration frontend MAY be configured with a voice-provider public key, an assistant identifier, and an optional public backend base URL. The frontend MUST NOT contain or document as client variables the inbound shared secret, voice-provider private or server API key, database URL, or service-role credentials.

#### Scenario: Example env lists only public client values

- **WHEN** a reviewer inspects the documented frontend environment example
- **THEN** it includes placeholders for the public key and assistant identifier and does not include the inbound secret or a private API key

#### Scenario: Automated tests do not place live calls

- **WHEN** the frontend automated suite runs
- **THEN** it uses a test double for the media client and does not contact a paid voice provider or require a microphone
