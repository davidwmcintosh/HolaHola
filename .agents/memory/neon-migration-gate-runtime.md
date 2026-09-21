---
name: Neon migration gate runtime
description: How to run the full disposable Neon migration gate without losing its terminal result or cleanup.
---

The full migration gate can take substantially longer than the five-minute
foreground shell limit. Run it as a monitored background process and accept
promotion only after its own terminal `READY_TO_PROMOTE` result.

**Why:** A foreground run was killed by the shell timeout after its focused
checks passed but before the full CI groups and branch cleanup completed. The
interrupted run left its disposable branch behind and could not authorize
promotion.

**How to apply:** Start `npm run db:branch -- gate` in the background, monitor
for `READY_TO_PROMOTE` or `[gate] FAILED`, and confirm the disposable branch was
deleted. If a process is interrupted, list Neon branches and delete only the
exact orphaned test branch before retrying.

**Monitor pattern precision:** the gate's own `npm run test:ci` matrix includes
resilience tests that deliberately simulate and log a failure (e.g. a compartment
fetch logging `Failed to fetch ... : Error: DB connection lost` before asserting
graceful handling) — a broad `Error:` watch pattern false-fires on this expected,
passing test output long before the gate actually finishes. Anchor the pattern to
the gate's own literal terminal lines instead: `\[gate\] READY_TO_PROMOTE|\[gate\] FAILED:`.
