---
name: design-voice-agent
description: Use when the change includes voice or telephony: STT/TTS ports, latency, turn-taking, silence, barge-in, call vs business state, transfer, termination, spoken confirmation, or voice fixtures. Do not use for Vapi-only SDK snippets as architecture, or for RAG/tool kernels.
author: LIDR.co
version: 1.0.0
---

# design-voice-agent

Voice is an **interaction adapter**. Business state and tools stay in the core. Do not hardcode a provider.

**Agent:** `voice-ai-engineer`

## When not to use

- Chat/batch only
- Tool schema without spoken UX → `design-tool`
- System ports without media → `design-ai-system`

## Inputs

- Channel = voice; OpenSpec change; latency/HITL from `design-ai-system`

## Steps

1. Load `docs/backend-standards.md` (Voice AI) and `docs/data-model.md` (Session media vs business, CallState, ConversationTurn).
2. Map media events to session commands via ingress port — adapter-specific payloads stay in project adapter notes, not this skill.
3. Keep `mediaStatus` ≠ `businessStatus`.
4. Budgets: time-to-first-audio, tool round-trip (tighter than chat).
5. Turn-taking, silence timeouts, barge-in: committed vs cancelled utterances.
6. Transfer: destination, reason, context packet. Terminate after wrap-up.
7. Confirm consequential tools **before** execution; spoken recovery on tool failure; never speak unverified success.
8. Write conversation fixtures for `create-evals` / `verify-ai-implementation` (not live paid calls by default).

## Outputs

- Spec: states, interruption policy, confirmation, transfer, fixtures
- Adapter boundary described as ports (transcribe / synthesize / call-control)

## Quality gates

- No vendor object as `AgentVersion`
- Interruption + confirmation + failure recovery specified
- Voice eval step in `tasks.md` when this change type applies

## Documents

- `docs/base-standards.md` (Vapi as adapter)
- `docs/backend-standards.md`, `docs/data-model.md`, `docs/api-spec.yml` (ingress)
- `docs/openspec-tasks-mandatory-steps.md`

## OpenSpec

During `/ff` and `/apply` for voice adapters.

## Combines with

- `design-agent`, `design-tool`, `create-evals`
- Not a Vapi skill; project adapter docs hold provider fields

## Verification

| Check | Pass |
| --- | --- |
| “Confirm booking on the call” | Spoken confirm + business state vs media |
| Avoids | Embedding vendor webhook field names in domain specs |
