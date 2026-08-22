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
