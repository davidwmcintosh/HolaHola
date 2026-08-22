---
name: Source bridge workflow consolidation
description: Why validation checks are grouped and Source bridge remains a dedicated named workflow.
---

Replit supports at most ten configured workflows. The legacy setup created one
workflow record per validation command, which prevented the source bridge from
having a dedicated workflow.

**Why:** Source synchronization needs independent lifecycle visibility, while
the validation commands must remain available. Grouping them behind one
fail-collecting validation runner preserves the checks without using a workflow
slot for each command.

**How to apply:** Keep exactly four named workflows: Project, Start application,
Source bridge, and Validation suite. Project may start the capture watchdog as a
direct child task. Add new validation commands to the grouped runner rather than
creating another named workflow, unless the command truly needs its own
independent long-running lifecycle.