---
name: Dev/prod isolation — working model
description: David uses deployed production for live sessions; dev server restarts are harmless to him; code edits in dev can proceed without session-interruption concern.
---

# Dev/Prod Isolation — Working Model

**Rule:** Edit dev freely. David's live sessions run on the deployed production URL, which is a separate process from the `Start application` dev workflow. Dev server restarts (triggered by file changes) have no effect on production.

**Why:** David deliberately runs his live sessions on production so dev restarts never interrupt him.

**How to apply:** Never pause or warn before editing a file because David "might be live." He's on production. The dev workflow restarting is expected and harmless. Only a deliberate `Deploy` action touches production.

**Corollary:** GL code 1008 "connection failed" drops during live sessions are Gemini-side aborts, not caused by dev edits — a separate reliability concern, not a dev/prod isolation problem.
