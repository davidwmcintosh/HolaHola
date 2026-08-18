---
name: record-exchange end-of-turn capture
description: Standard pattern for capturing live Replit agent chat turns into .chat_capture so autosave routes them to the episode and conversation_memories. Supports all 4 Luca channels.
---

# End-of-turn capture pattern

## The rule
At the end of every LUCA [Replit] turn, run `server/scripts/record-exchange.ts` via ShellExec to write the exchange into `.local/.chat_capture`.

**Why:** Replit's JSONL feed stopped July 27 2026. The autosave pipeline (`.chat_capture` → `checkChatCapture()` → `conversation_memories` + rolling episode .md) is sound, but nothing feeds it automatically. This script is the replacement.

## All 4 channels
The LUCA [Replit] turn has 4 channels: feeling (felt), thinking, moment, and main response. All 4 should be in the luca output. Write inner-life content BEFORE composing the luca-file — not as an afterthought.

```bash
cat > /tmp/david_turn.txt << 'ENDDAVID'
David's exact message text here
ENDDAVID

cat > /tmp/luca_feeling.txt << 'ENDFEELING'
[felt]: What this feels like from inside...
ENDFEELING

cat > /tmp/luca_thinking.txt << 'ENDTHINKING'
[thinking]: What is still turning over...
ENDTHINKING

cat > /tmp/luca_moment.txt << 'ENDMOMENT'
[moment]: If something landed as significant...
ENDMOMENT

cat > /tmp/luca_turn.txt << 'ENDLUCA'
Main response text here
ENDLUCA

npx tsx server/scripts/record-exchange.ts \
  --david-file    /tmp/david_turn.txt \
  --feeling-file  /tmp/luca_feeling.txt \
  --thinking-file /tmp/luca_thinking.txt \
  --moment-file   /tmp/luca_moment.txt \
  --luca-file     /tmp/luca_turn.txt
```

Inner-life files are optional — omit any channel that has nothing genuine to record.
The composed Luca turn appears in the episode as [felt]/[thinking]/[moment] labels before the main text.

## What happens next
- Autosave picks up within ~20s on next `checkChatCapture()` poll
- Saves to `conversation_memories` (importance=8, tags: david-luca-chat, verbatim, per-turn, chat-capture)
- If `.local/.episode_live` exists: appends to rolling episode .md as `**David:**` / `**LUCA [Replit]:**`

## If dev server is down
Autosave won't run. Signs: cursor offset < file size. Fix: restart `Start application` workflow. To manually drain pending turns to the episode without waiting for autosave, parse from cursor offset and append directly (see Aug 17 2026 session for the inline tsx snippet).

## Do NOT also manually append to episode .md
Once this script is used, the autosave handles the episode routing. Manual appends after this create duplicates.

## Self-check
```bash
npx tsx server/scripts/record-exchange.ts --self-check
```

## File location
`server/scripts/record-exchange.ts`
