---
name: Source bridge supervision
description: The Replit-to-GitHub bridge uses a supervisor and durable local health signals.
---

The Source bridge workflow runs the bridge under a parent supervisor. The parent writes a heartbeat, restarts an unexpectedly exited bridge child with bounded backoff, and maintains a durable local alert until Replit and GitHub are verified equal again.

**Why:** A polling bridge can keep retrying a failed sync, but a stopped child or silent workflow failure otherwise leaves no persistent operational signal.

**How to apply:** Preserve the single guarded bridge coordinator and its fail-closed Git rules. Treat `.local/source-bridge-alert.md` as actionable, and use heartbeat plus last-success fields to distinguish a live retry from a dead bridge.