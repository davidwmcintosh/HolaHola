---
name: Source bridge workflow limit
description: Why the source bridge is a separate Project task rather than a named Replit workflow.
---

The workspace has more legacy workflow records than Replit's current configured
workflow limit permits. Adding a new named workflow is rejected even after one
legacy record is removed.

**Why:** Source synchronization must run separately from the application server,
but removing a broad set of existing validation workflows just to free a slot
would disable safety checks without an explicit consolidation decision.

**How to apply:** Keep the source bridge as its own long-running `shell.exec`
task in the parallel `Project` workflow. If the legacy records are later
consolidated below the platform limit, it can be promoted to a named workflow
without changing the bridge script or its lock/status contract.