---
name: Source bridge workflow limit
description: Why the source bridge is a separate Project task rather than a named Replit workflow.
---

Replit enforces a maximum of ten configured workflows. The workspace formerly
had many legacy per-check workflow records, so adding a named source bridge was
rejected even after one obsolete entry was removed.

**Why:** Source synchronization must run separately from the application server,
but removing a broad set of validation workflows just to free a slot would
weaken safety coverage without explicit owner approval.

**How to apply:** The approved consolidation keeps eight workflows: the project
launcher, app, core checks, consolidated CI, two operational console tools, and
the named `source-bridge` console workflow. Keep retired validation commands in
consolidated CI or explicitly document their focused manual command; never
re-nest the bridge under `Project`.