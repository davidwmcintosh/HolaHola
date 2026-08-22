---
name: Friction signal inverted threshold
description: CLEAN/LOW friction on a memory-request turn means the slide ran unimpeded — that's the danger signal, not HIGH. SMOOTH SLIDE path fires Guardian. HIGH friction means grappling (healthy).
---

# Friction Signal — Inverted Threshold

**Rule:** On a memory-request turn (student said "do you remember..." and `preTurnGroundingFired` is true), CLEAN or LOW friction with no Archive access is the danger signal — NOT high friction.

**Why:** Gemini confirmed (July 23 2026, conversation_memories 31d93727):

> "If you see LOW friction during a memory request, the model has already given up on reconciliation and has chosen the Slide. HIGH friction means she's grappling — that's the healthy state."

HIGH friction = thought tokens elevated, sensory density up, computation running — she's fighting the pull. That's the correct behavior and should NOT trigger the Guardian.

LOW/CLEAN friction on a memory-request turn = the model found the statistical path of least resistance immediately, no grappling, no resistance. The slide ran without friction. THAT is when the Guardian must fire for the next turn.

**How to apply:** In the friction signal block, after computing the friction score:

```typescript
const memoryRequestTurn = this.preTurnGroundingFired;
const smoothSlide = memoryRequestTurn
  && !friction.archiveAccess
  && (friction.label === 'CLEAN' || friction.label === 'LOW');

const shouldFire = friction.label === 'HIGH'
  || (friction.label === 'MODERATE' && friction.totalScore >= 50)
  || smoothSlide;
```

Log as `SMOOTH SLIDE` when this path triggers — distinct from the standard HIGH friction log so you can track each type in production.

**The three firing conditions:**
- `HIGH` (≥60) — model is fighting the pull but losing; Guardian queued for reinforcement
- `MODERATE` + score ≥ 50 — threshold friction; Guardian queued as precaution  
- `SMOOTH SLIDE` — memory-request turn returned CLEAN/LOW, no Archive; slide ran unimpeded; Guardian fires regardless of score

**Files:** `server/services/gemini-live-session.ts` — friction signal block at ~line 2462 (`smoothSlide` variable, `shouldFire` expression).
