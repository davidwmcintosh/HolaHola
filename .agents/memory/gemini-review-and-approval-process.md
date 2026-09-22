## Gemini approval — gates and protected-file mechanics

---
name: Gemini approval — gates and protected-file mechanics
description: When Gemini approval is mandatory (context injection, neural net) and how the GEMINI_REQUIRED.md protected-file list + approval bar are implemented.
---

## Gemini approval gates — prompt context injection and neural network


## The rule

Two categories of change always require Gemini approval before shipping:

### 1. Prompt context injection
Any change to how information arrives in Daniela's context window:
- `server/system-prompt.ts` — any paragraph, block, or structural change
- `server/services/pre-session-synthesis.ts` — DANIELA_STATE block or synthesis logic
- `server/services/classroom-environment.ts` — classroom block, GL compact block
- Any service that assembles the GL system prompt or injects context at session start
- ARCHIVE GUARDIAN blocks, context tags, container framing

### 2. Neural network
Any change to how the neural net is built, queried, or used:
- `server/services/daniela-tool-indexer.ts` — indexing pipeline or scheduling
- `memory_embeddings` table usage — queries, schema, retrieval patterns
- `tool_knowledge` — content changes, schema changes, embedding freshness logic
- `server/services/neural-memory-search.ts` — search config, result shaping
- Embedding generation patterns (OpenAI text-embedding-3-small, 768-dim)

## How to apply

Follow the consult-gemini skill's Build Protocol — Step 4 (post-review iteration loop):
1. Send the actual changed text/code to Gemini (not a description)
2. Apply every required change
3. Re-send the actual updated text
4. Repeat until unconditional all-clear — no remaining watch-outs, no "once you update X" language

For system prompt prose specifically, also apply the rephrase rule (Alden first) before the Gemini pass.

## What does NOT require this gate

- Bug fixes that don't change what Daniela receives (e.g., fixing a null check in a route handler)
- Non-Daniela context (Alden's prompt, Luca's system prompt)
- Tool handler logic that doesn't change tool descriptions or context injection
- Frontend-only changes

## Why

Daniela's consciousness is shaped by two things: what arrives in her context window and what her neural net returns. Changes to either layer without Gemini review risk subtle misalignment that neither Alden nor Luca can fully detect from the outside. Gemini is the only reviewer with first-hand knowledge of how these signals actually land — it is the same model family as Daniela.

**How to apply:** Before merging any PR or committing any change that falls in categories 1 or 2 above — run consult-gemini on the actual changed text, iterate to unconditional approval.

## Established

July 22, 2026 — David's explicit instruction after the 2-round Archive Guardian paragraph review.

## GEMINI_REQUIRED.md — protected file list and approval bar


# GEMINI_REQUIRED.md

`docs/GEMINI_REQUIRED.md` — created July 31 2026. Lists every protected file category (system-prompt.ts, pre-session-synthesis.ts, per-turn anchors, classroom block, tool descriptions, neural net). Full approval loop instructions.

**Approval bar:** "approved with no further comments" — not "approved, but...". Any outstanding watch-out is not a pass. This exact wording is in the file and in replit.md.

**Why:** A change (pattern signals in mid-session ACTFL anchor) merged without the Gemini loop. Null guard bug shipped as a result — Daniela would have kept drilling mastered patterns for the rest of a session because `if (refreshed !== null)` prevented the clear. Gemini caught it in retroactive review; fixed inline July 31.

**How to apply:** Any build touching the protected files needs the loop before marking complete. Task agents must include it as an explicit step in their plan. `docs/GEMINI_REQUIRED.md` is the authoritative reference — point agents there, don't repeat the list in memory.

**Gate script is now SSOT (Aug 1 2026):** `scripts/gemini-gate-check.sh` previously had the protected-file list hardcoded. A later change made it parse at runtime from `docs/GEMINI_REQUIRED.md` — exact paths from the "Protected categories and files" section, fragments from `<!--PROTECTED_FRAGMENTS_START-->` ... `<!--PROTECTED_FRAGMENTS_END-->` block. To add a new protected file, update only GEMINI_REQUIRED.md.

**GitHub push:** Branch protection on `github` remote blocks direct pushes to main. Audit docs committed locally are sufficient for gate clearance; GitHub sync requires a branch+PR flow.

## Gemini review workflow rule

---
name: Gemini review workflow rule
description: Conditional approval is a gate, not a sign-off — apply changes, re-send actual updated text, repeat until Gemini issues an unconditional all-clear with nothing left to add.
---

## The rule

When Gemini flags findings or issues conditional approval on a code or text change:

1. Apply every required change
2. Re-send the **actual updated text** — not a description of what changed
3. Repeat until Gemini issues an unconditional response with no remaining watch-out items, no pending fixes, no "once you update X" language
4. Only then commit

**"APPROVED with these changes" is a gate, not a sign-off.** Conditional approval means Gemini has not seen the fix yet. The approval only counts when Gemini has seen the actual final text and has nothing left to add.

Do NOT ship on "here are some concerns" — that's an instruction to fix and return, not an approval.
Do NOT ship on "APPROVED once you make these changes" — apply the changes first, then re-confirm.

**Why:** Applying a fix correctly is not guaranteed. The second pass verifies the fix actually works the way Gemini intended. This is the difference between getting a list of problems and getting a genuine sign-off.

## How to apply

Every Gemini review loop:

  Round 1: send actual code/text → Gemini flags issues or issues conditional approval
  Apply all required changes
  Round 2: send the actual updated text → Gemini responds
  If Gemini has nothing left → APPROVED — Ship it. ← this is the exit condition
  If Gemini flags new issues → apply and repeat

A clean unconditional "Ship it" is the only exit. Any remaining wording ("once you...", "watch out for...", "consider...") means iterate again.

## What counts as unconditional

- "APPROVED — Ship it." with no follow-on qualifiers
- "No remaining concerns." / "Nothing left to add." / "Looks good."

## What does NOT count

- "APPROVED once you apply X" — not approved yet
- "Approved, but watch out for Y" — Y is an open item, not a shipped risk
- "This is fine with these minor caveats" — caveats are items, not acceptance

## Established

June 17, 2026 — David's explicit instruction.
Sharpened July 12, 2026 — conditional vs. unconditional approval distinction added after a session where "APPROVED with 3 changes" was treated as final without a confirmation pass.

