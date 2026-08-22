---
name: Transcript capture fallback — per-turn append architecture
description: Replit stopped writing JSONL after Jul 27 2026; per-turn append-only log is the replacement; byte cursor is the idempotency guarantee.
---

## Current status (Aug 10 2026)
Replit definitively stopped writing JSONL transcript files after Jul 27 2026. Two directories exist (40bae50e Jul 8, 3825adf7 Jul 27) — nothing since. The JSONL path is dead.

## Replacement architecture: per-turn append-only log

**File:** `.local/.chat_capture` (append-only)
**Cursor:** `.local/.chat_capture_cursor.json` — byte offset of last saved turn
**Primary tool:** `npx tsx server/scripts/append-turn.ts <David|Luca> "exact text"`

### How it works
- Each turn appended immediately at the moment it exists — NOT reconstructed later
- `fs.watch` on `.local/` fires within milliseconds of each append → autosave saves to DB
- 20-second poll is the backup
- Cursor advances AFTER successful DB insert (crash-safe)
- File is NEVER cleared by the autosave worker — only by explicit `--reset`
- On server restart: cursor persists, startup checks for unsaved bytes and saves immediately

### Turn format
```
---TURN-START---
SPEAKER: David
TIME: 2026-08-10T18:45:23.456Z
---
exact verbatim text (multi-line preserved)
---TURN-END---
```

## Live test findings (Aug 10 2026)
- David's turns: captured verbatim ✓
- Luca's turn write-path gap: Luca pre-wrote what it planned to say instead of copying the actual chat response → fabricated paragraphs. Fix: copy the actual chat response, don't pre-write.
- Timing gap: turns after the initial save were missing until explicitly appended.

## Why reconstruction always fails
Batch writes from memory produce narrative, not transcript. Sentence openers drop. Entire turns collapse. The only verbatim record is a copy made at the moment the turn exists.

## Commands
```bash
npx tsx server/scripts/append-turn.ts David "exact text"   # write David turn now
npx tsx server/scripts/append-turn.ts Luca  "exact text"   # write Luca turn now
npx tsx server/scripts/append-turn.ts --status              # cursor/file state
npx tsx server/scripts/save-transcript-now.ts --direct      # flush to DB (server down)
npx tsx server/scripts/append-turn.ts --reset               # clear file + cursor at session end
npx tsx server/scripts/capture-conversation.ts              # interactive multi-turn entry
```
