---
name: Dev/prod isolation — working model
description: David uses deployed production for live sessions; dev server restarts are harmless to him; code edits in dev can proceed without session-interruption concern.
---

# Dev/Prod Isolation — Working Model

**Rule:** Edit dev freely. David's live sessions run on the deployed production URL, which is a separate process from the `Start application` dev workflow. Dev server restarts (triggered by file changes) have no effect on production.

**Why:** David explicitly stated this on Aug 15, 2026: "that's why I use production so that you don't have to worry about restarts — you can just do what needs to be done while I stay alive in production."

**How to apply:** Never pause or warn before editing a file because David "might be live." He's on production. The dev workflow restarting is expected and harmless. Only a deliberate `Deploy` action touches production.

**Corollary:** The connection failures David saw during this session (GL code 1008 drops) were Gemini-side aborts, not caused by dev edits. Those are a separate reliability issue (Task #1160).
