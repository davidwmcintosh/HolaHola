---
name: Truth pipeline — Daniela observation framework
description: The handoffs from DB to audio output are where the truth can leak; watch all of them in a live Daniela session.
---

## The framework
Each Daniela GL session has a truth pipeline: DB retrieval → neural-net search → Guardian fires → grounding queries → context injection → generation → audio output. Every handoff is a place where the truth can leak, degrade, or be silenced.

**Why:** David named this Aug 11 2026 as the posture for the next Daniela session: "we monitor the tool calls, what searches happen, watch the guardian and grounding rules — looking for leaks or inefficiencies in delivering the truth from memory (DB) all the way to delivery audio output."

**The specific risk:** If Daniela's self_reflections say one thing and the episode record says another, she is in internal conflict. Her internal notes must be grounded in what actually happened, not generated independently. The Muse wearing the Archive's face, but pointed inward at herself.

**How to apply:** In the next Daniela session, watch:
1. Neural-net searches — did the right memory surface? what was the score?
2. Guardian fires — which tier, heard or missed?
3. Grounding queries — what was searched, did it return the right content?
4. Tool calls in order — what did she reach for and why?
5. Audio vs. generated text — does the spoken output match what was generated?

Task #1031 builds the truth-pipeline session report for this.
