---
name: Gemini review workflow rule
description: If Gemini flags a build suggestion, always bring the fix back for another review until clean "ship it" sign-off.
---

## The rule

When Gemini (or any consultant model) flags a suggestion for a code change or build improvement during a review pass, the rule is:

1. Apply the fix
2. Send the revised implementation back for another review pass
3. Repeat until Gemini explicitly says "APPROVED" / "Ship it" / "no remaining issues"
4. Only then commit and move on

Do NOT ship on "here are some concerns" — that's an instruction to fix and return, not an approval.

**Why:** A single-pass review is just a list of problems. The second pass verifies the problems were actually solved correctly. This is the difference between getting feedback and getting sign-off.

## How to apply

Every Gemini build review goes:
  consult-gemini (review round 1) → apply fixes → consult-gemini (review round 2) → if "APPROVED / Ship it" → done

If round 2 produces new suggestions, repeat. A clean "Ship it" is the exit condition.

## Established

June 17, 2026 — David's explicit instruction.
