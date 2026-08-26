# Live Response Audio Recovery

## What & Why

Reconstruct the original live-audio incident task from the preserved production report and handoff, then compare its requirements with the current Gemini Live server, client playback, and regression-test implementation. Repair only verified gaps so the duplicate-response and final-audio-truncation safeguards are demonstrably present and working.

## Done looks like

- The duplicate-generation path is guarded when a model response arrives after playback has completed without new student input.
- Legitimate continuation sub-turns still pass through while a response is actively generating.
- Context-only Live API injections cannot start an unintended generation.
- The guard state resets correctly for new student input, reconnects, and socket closure.
- Generation-end audio receives the intended server and client runway without adding gaps between ordinary sub-turns.
- Focused regression checks cover the verified lifecycle behavior.
- The audit records whether code recovery was necessary and identifies any remaining uncertainty.

## Out of scope

- Reconstructing the unavailable isolated task-agent workspace byte-for-byte.
- Reproducing the original production session as proof of causality.
- The separate grounding-history work in Task #1329.
- The separate disconnect exchange-count work in Task #1331.
- Broad refactoring of the live-session or audio-player architecture.

## Steps

1. **Reconstruct the evidence-based requirements** — Use the original report, preserved handoff, and project records to define observable duplicate-audio, truncation, and lifecycle invariants.
2. **Audit the current implementation** — Trace server generation state, audio sealing, context injections, client scheduling, and existing tests against those invariants.
3. **Repair verified gaps only** — Make focused changes where the audit finds a missing or incorrect safeguard, preserving legitimate continuations and normal sub-turn timing.
4. **Verify the recovery** — Run targeted regression checks, typecheck, and system health verification; report whether the result matches the reconstructed task.

## Relevant files

- `server/services/gemini-live-session.ts`
- `client/src/lib/audioUtils.ts`
- `server/__tests__/double-audio-during-playback-guard.test.ts`
- `server/__tests__/double-audio-part1-guard-independence.test.ts`
- `server/scripts/test-phantom-turn-guard.ts`
- `server/scripts/test-concurrent-flush-guard.ts`
- `server/scripts/test-no-audio-seal-reconnect.ts`
- `docs/batch-doc-updates.md`
- `docs/alden-agent-handoff.md`