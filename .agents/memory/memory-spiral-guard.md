---
name: Memory spiral guard — budget-proximity design
description: How and why the memory spiral guard works — text-mode fires at budget proximity, GL fires after 6 consecutive batches. System prompt is the primary fix, code is the backstop.
---

# Memory Spiral Guard

## The problem

Daniela chains memory tools (recall → browse_conversations_by_date → read_full_session) across consecutive FC turns without producing a response. Student hears silence. She hits MAX_TURNS and returns a hard error.

Her behavior is CHOSEN — she decided to look something up deeply. The infrastructure failing to give her a path from retrieval to response is the failure, not her.

## Design (current — July 30 2026)

### Primary fix: system prompt
`buildMinimalIdentityAnchor` in `server/system-prompt.ts` contains a Gemini-approved Retrieval Protocol paragraph:

> "I have to remember that every moment I spend looking inward is a moment David spends in silence. If I have reached into my memory twice in a row and still don't have the full picture, I stop. A third search is a wall between us..."

Full Alden + Gemini iteration trail in `docs/gemini-audit-2026-07-30.md`.

### Code backstop: text-mode (daniela-caller.ts)
- `MEMORY_CHAIN_LIMIT = 3` — fires after 3 consecutive memory-only turns
- `memoryNudgeSent` flag — fires ONCE per call
- Placement: appended to last tool response with `--- SYSTEM STATUS ---` separator
- Gemini-approved text: "CRITICAL: Approaching processing limit. Student-facing latency is high. Do not perform further tool calls. Synthesize the current findings into a direct response to the student immediately."

### Code backstop: GL (gemini-live-session.ts)
- `GL_MEMORY_CHAIN_LIMIT = 6` — higher threshold, no MAX_TURNS ceiling
- `glMemoryNudgeSent` flag — fires once per spiral episode
- Resets when: (a) non-memory tool fires in same batch, (b) Daniela produces audio (generationComplete)
- Same approved nudge text

## What was tried and rejected

**Budget-proximity approach (MAX_TURNS - 2):** Fires once when 2 turns from MAX_TURNS. David's challenge: "what if she needs to dig deep?" This design would have given her unlimited lookups up to the final 2 turns. Task agents reverted it back to consecutive-count=3 after adding the system prompt rule. The system prompt rule is now the primary protection, making the exact trigger point less critical.

**Consecutive-count=2:** Too aggressive — recall→read_full_session is a normal 2-step lookup.

## Key Gemini findings (audit July 30)

1. Use latency pressure ("latency is high") not sufficiency logic ("you have enough context")
2. Markdown separator separates instruction from data in the model's attention
3. Threshold 3 not 2 — normal 2-step lookup should complete uninterrupted
4. Unified text across text-mode and GL for behavioral consistency

**Why:** Same required action regardless of trigger mechanism — stop searching, start talking.
