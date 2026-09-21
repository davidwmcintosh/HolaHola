---
name: Gate 3 coding runtime — proven live
description: Gate 3 of the provider-neutral Gemini coding runtime was executed end-to-end for real (not just designed); practical gotchas for anyone re-running or extending this exact bounded-script pattern.
---

# Gate 3 coding runtime — proven live

Gate 3 (docs/superpowers/specs/2026-09-09-luca-gemini-coding-runtime-design.md +
the 2026-09-10 ownership-bootstrap-repair design) was executed end-to-end for
real on 2026-09-20: founder Ed25519 handshake returned `isolated_agent`,
luca-gemini authenticated through the credential broker, a real
gemini-3-flash-preview call produced and consumed a genuine assignment packet,
exclusive claim → execute → complete were recorded as durable Postgres rows, a
second fresh ownership proof ran before completion, and luca-claude-code (not
the assigning luca-replit) independently re-inspected the diff, reran the
test, and recorded an approved verification — all on turn 1 of 4 allowed
Gemini turns. This is no longer just a designed protocol; it has one real
evidence chain proving the full sequence works.

**Why this matters:** prior work in this area (see
credential-rotation-recovery-authority.md, durable-reconnect-lease.md,
hermetic-authority-model-proof.md) established the design and unit-test
fakes. This was the first live run with a real founder approval, a real
external model call, and real cross-actor verification.

## Practical gotchas hit while building the one-off proof script

- **gemini-3-flash-preview code generation**: the default/automatic
  `thinkingConfig` combined with a low `maxOutputTokens` (e.g. 2000) can
  silently starve the actual code output — the turn completes but returns
  little or no usable text. Force `thinkingConfig: { thinkingBudget: 0 }` and
  raise `maxOutputTokens` (4096 worked) when the goal is code output, not a
  reasoning transcript.
- **node:test failures via execSync/child_process**: the failure text lands
  on stdout, not stderr. Reading `error.stderr` for diagnostics returns
  nothing useful; read `error.stdout`.
- **Scripts that call `getSharedDb()` directly** (rather than going through
  an HTTP endpoint) can hang indefinitely after their last `console.log` —
  the pooled connection keeps the Node event loop alive even after all
  logical work is done. Any one-off CLI-style script that touches the DB
  pool directly must call `process.exit(0)` explicitly on the success path,
  not just on error paths.

**How to apply:** check these three before trusting a future bounded-runtime
script's silence, hang, or empty-looking model output as a real failure.
