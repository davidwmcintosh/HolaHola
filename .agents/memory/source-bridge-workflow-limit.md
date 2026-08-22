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

**How to apply:** Keep five named workflows: Project, Start application, Source
bridge, Validation suite, and Consolidated CI. Project may start the capture
watchdog as a direct child task. Keep the full consolidated test set separate
from the application test suite so both fit Replit's validation timeout. Add
new validation commands to an existing runner rather than creating another
workflow, unless the command truly needs its own independent lifecycle. This
consolidation requires explicit owner approval because grouped validation
coverage must replace—not silently remove—the retired checks.
