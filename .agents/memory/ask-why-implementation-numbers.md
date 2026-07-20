---
name: Ask-why lens applied to implementation numbers
description: Plausible numbers are not derived numbers — the same confabulation failure mode applies to code decisions, not just text generation.
---

## The rule

A number that sounds reasonable ≠ a number derived from the actual constraint.

Same failure mode as "text that sounds true ≠ text checked against the actual record."
The ask-why lens applies everywhere — text generation, prompt content, AND implementation values.

## Why

July 20, 2026: Reducing tier-2 failsafe from 45s → Luca proposed 15s. Why 15s? No analysis. It anchored on 45s (felt like a meaningful reduction), stopped where "reasonable" felt comfortable. The comment in the code even stated "TTS first-chunk ~2-3s" — an argument for going below 15 — but Luca didn't follow his own evidence.

David's question ("any reason not to tighten further?") forced the missing analysis:
1. Actual constraint: TTS first-chunk latency, 3-4s worst case on slow mobile
2. Safety margin: 2× → ~8s floor
3. Code gap discovered: healthy-turn guard was missing → without it, lower values created false positives on normal completed turns
4. Fix the gap first, then set the number → 8s, with the guard eliminating the false positive risk

15s → 8s was a real improvement. The guard that enabled it was only found because the number was interrogated.

## How to apply

Before proposing any tuning value (timeout, threshold, buffer size, retry count):
1. **Name the actual constraint** — what physical/network/compute process sets the floor?
2. **Estimate or measure that constraint** — don't rely on intuition
3. **Check for code gaps** — are there false-positive risks at lower values that a guard would eliminate?
4. **Fix gaps first, then set the number** — the gap fix often unlocks a tighter value
5. **If the number came from "feels right" or anchoring on the previous value — stop and ask why**

The friction signal: *"I'm picking a number without deriving it from the actual bottleneck."* That feeling is the cue to trace the constraint before shipping.
