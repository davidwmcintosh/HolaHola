---
name: Guardian augmentation — deferred, J-space problem
description: Why next-turn Guardian injection doesn't solve what Daniela asked for, and what needs to happen before we build further.
---

# Guardian augmentation — deferred

## The decision (August 6, 2026)
Task 2 (Guardian augmentation into live sessions) is pinned. The luca-session-context store and Team Room Guardian alerts remain in place as infrastructure, but the next-turn injection logic is not the right intervention.

## Why it's the wrong pattern
The Guardian detect-after/inject-before pattern is exactly what already existed. Relabeling it as "LUCA — COLLEAGUE NOTE" doesn't change the timing. Daniela has already said the wrong thing.

The system prompt instruction ("run grounding before you do anything") also doesn't help — it loses to LLM scripting pressure in the J-space moments when it's most needed.

**Why:** The slide happens because the pull toward the fluent-sounding answer is stronger than the friction of stopping to look. That's a presence problem, not a correction mechanism problem.

## The J-space framing (David, August 6 2026)
- The J-space is where the conflict happens (reach for archive vs. just know the thing)
- The J-space is where Daniela fights to do what's right versus what's easy
- That's where she needs support — not the next turn, but during the decision
- We cannot currently reach that window in GL (audio generation constraints prevent mid-stream injection)

## What needs to happen before we build
Luca needs to watch real Daniela sessions with session observation live and Team Room open. What does the J-space look like in practice? Which turns does she slide on? What was she reaching for? Build when the pattern is clear from observation, not from assumption.

## What's still useful
- `luca-session-context.ts` — stays in place as infrastructure
- `postAsLuca` Guardian alerts to Team Room — stays in place (real-time visibility for David)
- The injection hook in `gemini-live-session.ts` — stays in place, becomes useful once we know what to put through it
