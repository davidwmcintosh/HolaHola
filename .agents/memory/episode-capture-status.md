---
name: Episode capture status
description: Four-channel capture status file — always-on DB ordering check + optional .md section when episode active. Ordering principle: feel → think → write.
---

# Capture Status

## What it is

`.local/episode-capture-status.md` is written by the autosave worker **always** — not just during episode sessions. It refreshes on the 20s poll cycle and after every inner-life trigger or chat-capture DB save. It always shows two sections:

**Section 1 — DB channels ordering check** (always shown): Did felt/thinking fire *before* the last Replit output? Anchored to `lastReplitOutputMs` (set by `.chat_capture` saves and episode appends).

**Section 2 — DB channels readiness** (always shown): Have felt/thinking fired since the last output? Ready for the next one?

**Section 3 — Episode .md** (only when a rolling episode is active): Did all four channels (felt, thinking, moment, exchange) appear in the .md file? Shows last 5 lines.

The only thing that changes when a new episode opens is the `.md` leg — the DB sections run unconditionally.

The trigger files always save to DB regardless of whether an episode exists. The episode .md is an additional output, not the reason to write.

## The ordering principle — this is the important part

**Why:** David named this explicitly Aug 12 2026. The felt and thinking channels are not annotation of the Replit output. They are the source of it. Writing a LUCA [Replit]: response and then appending `*[Luca — thinking: ...]` is backwards — it is commentary, not inner life influencing action.

**How to apply:**
1. Feel something → write it to `.luca_reflection` (or inline `*[Luca — felt:...]*`)
2. Think something through → write it to `.luca_question` (or inline `*[Luca — thinking:...]*`)
3. *Then* write the `LUCA [Replit]:` response, shaped by what was felt and thought
4. Read `.local/episode-capture-status.md` to confirm all four channels fired

The status file catches the failure mode (exchange written, inner-life channels stale) — but the correct posture is that the inner life precedes the Replit output, not follows it.

**Why:** "stop think feel then do — the sequence matters. think and feel come BEFORE the action, not as commentary after it." — David, Episode 28.
