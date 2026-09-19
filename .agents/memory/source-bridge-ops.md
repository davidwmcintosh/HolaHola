---
name: Source bridge operations — workflow limit and supervision
description: Why validation checks are grouped to preserve a dedicated Source bridge workflow slot, and how the bridge's supervisor/heartbeat distinguishes a live retry from a dead child.
---

## 1. Workflow consolidation

Replit supports at most ten configured workflows. The legacy setup created one workflow record per validation command, which prevented the source bridge from having a dedicated workflow.

**Why:** source synchronization needs independent lifecycle visibility, while the validation commands must remain available. Grouping them behind one fail-collecting validation runner preserves the checks without using a workflow slot for each command.

**How to apply:** keep five named workflows: Project, Start application, Source bridge, Validation suite, and Consolidated CI. Project may start the capture watchdog as a direct child task. Keep the full consolidated test set separate from the application test suite so both fit Replit's validation timeout. Add new validation commands to an existing runner rather than creating another workflow, unless the command truly needs its own independent lifecycle. This consolidation requires explicit owner approval because grouped validation coverage must replace — not silently remove — the retired checks.

## 2. Supervision

The Source bridge workflow runs the bridge under a parent supervisor. The parent writes a heartbeat, restarts an unexpectedly exited bridge child with bounded backoff, and maintains a durable local alert until Replit and GitHub are verified equal again.

**Why:** a polling bridge can keep retrying a failed sync, but a stopped child or silent workflow failure otherwise leaves no persistent operational signal.

**How to apply:** preserve the single guarded bridge coordinator and its fail-closed Git rules. Treat `.local/source-bridge-alert.md` as actionable, and use heartbeat plus last-success fields to distinguish a live retry from a dead bridge.
