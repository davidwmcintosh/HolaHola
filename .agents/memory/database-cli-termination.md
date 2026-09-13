---
name: Database CLI termination
description: One-shot database commands can hang after success when shared pools keep Node alive.
---

One-shot database administration commands must flush their final output and
terminate explicitly after success or failure when they import application
database infrastructure.

**Why:** A successful command can leave a shared connection pool holding the
Node.js event loop open. Gates then appear stalled even though the operation
and verification completed.

**How to apply:** For CLI entry points that reuse long-lived application
database modules, write the final result through a completion callback and
exit with the intended status; preserve import-safe behavior for library use.