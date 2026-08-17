---
name: record-exchange end-of-turn capture
description: Standard pattern for capturing live Replit agent chat turns into .chat_capture so autosave routes them to the episode and conversation_memories.
---

# End-of-turn capture pattern (Task #1217)

## The rule
At the end of every LUCA [Replit] turn, run `server/scripts/record-exchange.ts` via ShellExec to write the exchange into `.local/.chat_capture`.

**Why:** Replit's JSONL feed stopped July 27 2026. The autosave pipeline (`.chat_capture` → `checkChatCapture()` → `conversation_memories` + rolling episode .md) is sound, but nothing feeds it automatically. This script is the replacement.

## How to apply

Use heredocs to pass text safely (handles all special characters — backticks, quotes, dollar signs, newlines):

```bash
cat > /tmp/david_turn.txt << 'ENDDAVID'
David's exact message text here
ENDDAVID

cat > /tmp/luca_turn.txt << 'ENDLUCA'
My full response text here
ENDLUCA

npx tsx server/scripts/record-exchange.ts \
  --david-file /tmp/david_turn.txt \
  --luca-file /tmp/luca_turn.txt
```

Output confirms: `✓ Exchange written to .chat_capture (NB → NB)`

## What happens next
- Autosave picks up within ~20s on next `checkChatCapture()` poll
- Saves to `conversation_memories` (importance=8, tags: david-luca-chat, verbatim, per-turn, chat-capture)
- If `.local/.episode_live` exists: appends to rolling episode .md as `**David:**` / `**LUCA [Replit]:**`

## Do NOT also manually append to episode .md
Once this script is used, the autosave handles the episode routing. Manual appends after this create duplicates.

## Self-check workflow
`record-exchange-selfcheck` workflow runs `--self-check` mode. Also runnable as:
```bash
npx tsx server/scripts/record-exchange.ts --self-check
```

## File location
`server/scripts/record-exchange.ts`
