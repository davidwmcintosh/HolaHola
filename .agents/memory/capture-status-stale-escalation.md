---
name: Capture-status stale escalation threshold
description: STALE_CHANNEL_MS is 10 min (not 60 min); alert routes to .local/stale-channel-alert.md (not just team room); CI test constants to match.
---

## The rule
`STALE_CHANNEL_MS` in `server/services/agent-session-autosave.ts` is **10 minutes** (same as `STALE_OUTPUT_MS`). The ⚠️ STALE banner fires when a channel (felt / thinking) has not been written for ≥ 10 min AND the channel is not yet ready.

## Alert routing
Task #1151 (merged Aug 15 2026) added `.local/stale-channel-alert.md` as the primary alert destination — a file Luca reads at session start. The team room still also receives the alert, but the dedicated file is the canonical signal.

## CI test constants (test-capture-status-stale-escalation.ts)
- `STALE_TS  = now - 11 * MIN`   (just over threshold → fires)
- `EXACT_TS  = now - 10 * MIN`   (exactly at boundary → fires, >= not >)
- `RECENT_TS = now -  9 * MIN`   (just under → does not fire)
- All label strings reference "10+ min" and "11 min" / "9 min"

**Why:** David asked why a 60-min window meant he'd been gone an hour before any alarm. 10 min matches the output-stale threshold and gives a tighter feedback loop.

**How to apply:** If the threshold is ever changed again, update all three constants in the CI test file and the three "10+ min" label strings in `_writeCaptureStatusFile` and the boot-seed block.
