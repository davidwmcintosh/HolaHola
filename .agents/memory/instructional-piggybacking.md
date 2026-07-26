---
name: Instructional Piggybacking — design and draft
description: Design for SESSION ANCHOR injection every N turns in tool-result body; Alden draft in hand; pending Gemini approval loop
---

## What It Is

A mechanism to counteract GL system prompt attention fade in long sessions. Every N turns (likely 10-15), a brief "Session State" block is appended to the existing Archive Guardian tool-result body injection, immediately before Daniela generates her response.

**Why this works:** Tool results sit at position N in the context window — the most recent, highest-attention-weight position. The system prompt sits at position 0 and loses salience as the session grows. Instructional Piggybacking moves core behavioral directives from position 0 to position N, refreshing them at every injection point.

Gemini confirmed (July 26 2026, DB: 036309ca): "Treat the tool-result body not just as a data carrier, but as a behavioral steering wheel."

## Current Status

- SHIPPED — July 26 2026. Typecheck clean.
- Alden Gemini draft → REWRITTEN by Gemini (imperative commands rejected)
- Gemini-approved prose now live in `gemini-live-session.ts` (lines ~3414-3426)

## Alden Gemini Draft (July 26 2026)

```
[SESSION ANCHOR: You are here. The flow of conversation continues. Remember your purpose: language class first. Fewer words, more impact. If the Archive is silent, trust your intuition; if it speaks, verify against its truth. Should a memory feel distant, it is always an option to say, "I don't know," rather than filling a gap.]
```

Alden's recommendation: static block (not adaptive) for the first pass. The directives are evergreen and the complexity of turn-count-aware generation is not worth the first iteration.

## What Needs Gemini Approval

The block wording. This is runtime injection text (GL tool-result body) — falls under the Gemini approval gate rule (July 22 2026). Must go through consult-gemini iteration loop until "APPROVED — Ship it." before building into the injection path.

## How to Build (after Gemini approves)

Injection happens in `server/services/gemini-live-session.ts` — the Archive Guardian tool-result body concat path. Add a turn counter (`sessionTurnCount` already tracked). Every N turns (configurable), append the SESSION ANCHOR block after the existing `[ARCHIVE GUARDIAN: ...]` text.

The injection lives in the same `sendToolResult()` call — no new GL channel needed.

**Why NOT adaptive (first pass):** Static is sufficient. Adaptive (topic-aware, turn-count-labeled) adds complexity without clear payoff. Can upgrade later.

**Why:** Behavioral directives at position 0 fade over long GL sessions. This is the only safe mechanism for re-asserting them without restarting the session or triggering audio doubling.
