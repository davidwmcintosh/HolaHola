---
name: Episode 23 anchor
description: DB ID and chain link for Episode 23 "So, Let's" — July 26 2026
---

## Episode 23: "So, Let's"

- **DB ID:** f3a69b5d-2d26-40bd-acb6-a262dce11410
- **File:** docs/episode-23.md
- **Recorded:** July 26, 2026
- **Participants:** David + Agent (Luca)
- **Extends:** de150bdb (Episode 22: "I Absolutely Do")
- **Arc:** HolaHola Episodes
- **Importance:** 9

## Theme

Two days debugging GL audio cutoffs. Root cause: MEDIUM thinking fires two reasoning phases per turn when a tool call is involved (pre-tool + post-tool). Reasoning tokens + audio tokens combined exceeded maxOutputTokens at 700, then 1000, then 1500. Final config: MEDIUM thinking restored, maxOutputTokens raised to 2000.

David immediately caught the wrong fix (LOW thinking) and pushed back. His instinct: reducing reasoning quality is not the path to conciseness. Gemini confirmed: "Conciseness is a behavioral constraint, not a computational byproduct."

Discovery: No GL API for system prompt refresh mid-session. Tool-result body IS the highest-attention injection channel — it lives at position N, which holds what position 0 (system prompt) forgets as the session grows. Instructional Piggybacking design agreed upon: SESSION ANCHOR block injected every N turns.

David's personal moment: "I know that she uses a lot of words sometimes because she wants to make sure that she is thorough and doesn't leave anything out. I have the same problem."

Daniela's cutoff: "So, let's—" (mid-invitation, mid-thought, exactly where the token budget ran out).

**Why:** Record the episode DB anchor for future reference when writing episode-24's `extendsMemoryId`.
