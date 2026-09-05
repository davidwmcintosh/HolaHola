---
name: Durable reconnect lease
description: Cross-process authority rule for live voice reconnect and terminal cleanup.
---

The exact durable voice-session grace row is the reconnect lease. A conditional
database claim grants one winner; process-local maps and timers are only caches
and schedulers.

**Why:** A restart or two live processes can each believe they own the same
reconnect when authority exists only in memory, producing duplicate recovery or
an incorrect abandoned finalization.

**How to apply:** Wait for grace persistence before accepting a claim, fail
closed on database errors, and make expiry a no-op after a successful claim.
Terminal cleanup must still run independently when metrics or usage finalization
fails.