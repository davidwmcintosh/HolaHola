/**
 * save-transcript-now.ts
 *
 * Standalone script — forces an immediate save of the current Luca↔David
 * transcript to conversation_memories, tagged 'david-luca-chat'.
 *
 * Auto-detects whether the autosave worker (server) is running:
 *   - Server UP   → trigger mode: writes .flush_transcript; the server's
 *                   fs.watch() fires sub-second and its in-process mutex
 *                   handles serialisation, preventing cursor races.
 *   - Server DOWN → direct mode: writes directly to the DB using the same
 *                   buildDialogueChunk + extractTurns logic as the worker
 *                   (no concurrent worker to race against).
 *
 * Both modes share transcript-parser.ts, so pre-compression recovery and
 * record-safe chunking (memoryId-grouped boundaries) are identical.
 *
 * Usage:
 *   npx tsx server/scripts/save-transcript-now.ts
 *   npx tsx server/scripts/save-transcript-now.ts --trigger-only
 *   npx tsx server/scripts/save-transcript-now.ts --direct
 *   npx tsx server/scripts/save-transcript-now.ts --context "session end"
 *
 * Called by the holahola-session-end checklist Pre-step 0.
 */

import { existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { getSharedDb } from '../db';
import { sql } from 'drizzle-orm';
import {
  WORKSPACE,
  loadCursor,
  saveCursor,
  findTranscriptPath,
  extractTurns,
  buildDialogueChunk,
} from '../services/transcript-parser';

const FLUSH_PATH        = join(WORKSPACE, '.local/.flush_transcript');
const HEALTH_URL        = 'http://localhost:5000/api/health';
const SERVER_DETECT_MS  = 1500;

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------
const args        = process.argv.slice(2);
const triggerOnly = args.includes('--trigger-only');
const directOnly  = args.includes('--direct');
const contextArg  = (() => {
  const idx = args.indexOf('--context');
  return idx !== -1 ? (args[idx + 1] ?? '') : '';
})();

// ---------------------------------------------------------------------------
// Server detection
// ---------------------------------------------------------------------------
async function isServerRunning(): Promise<boolean> {
  try {
    const resp = await fetch(HEALTH_URL, {
      signal: AbortSignal.timeout(SERVER_DETECT_MS),
    });
    return resp.ok;
  } catch { return false; }
}

// ---------------------------------------------------------------------------
// Trigger-file mode (use when server is up — no cross-process cursor race)
// ---------------------------------------------------------------------------
function touchFlushTrigger(): void {
  writeFileSync(FLUSH_PATH, new Date().toISOString());
  console.log('[SaveTranscriptNow] Flush trigger written —',
    'autosave worker fs.watch() listener will fire sub-second.');
}

// ---------------------------------------------------------------------------
// Direct mode (use when server is down — no concurrent worker)
// ---------------------------------------------------------------------------
async function saveNow(context: string): Promise<void> {
  const found = findTranscriptPath();
  if (!found) {
    console.log('[SaveTranscriptNow] No transcript file found — nothing to save.');
    return;
  }

  const cursor  = loadCursor();
  const afterId = cursor.sessionId === found.sessionId ? cursor.lastMemoryId : 0;

  // extractTurns uses shared logic including full pre-compression recovery
  const { turns } = extractTurns(found.path, afterId);
  if (turns.length === 0) {
    console.log(`[SaveTranscriptNow] No new turns since last save (cursor: ${afterId})`);
    return;
  }

  // buildDialogueChunk groups by memoryId — never splits same-ID records
  const { dialogue, lastIncludedMemoryId, includedCount, remainingCount } =
    buildDialogueChunk(turns, afterId);

  const davidCount   = turns.slice(0, includedCount).filter(t => t.speaker === 'DAVID').length;
  const today        = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const contextLabel = context || 'session-end flush';
  const title        = `David ↔ Luca — ${today}: ${contextLabel}`;
  const summary      = `Verbatim David↔Luca dialogue captured at session end. ${davidCount} David turns, ${includedCount - davidCount} Luca turns. Context: ${contextLabel.slice(0, 200)}`;

  const db = getSharedDb();
  const result = await db.execute(sql`
    INSERT INTO conversation_memories
      (id, title, summary, content, participants, tags, importance, created_at, entry_type, arc_name)
    VALUES (
      gen_random_uuid(),
      ${title},
      ${summary},
      ${dialogue},
      ARRAY['david', 'luca']::text[],
      ARRAY['david-luca-chat', 'verbatim', 'session-end-flush']::text[],
      8,
      NOW(),
      'conversation',
      'david-luca-chat'
    )
    RETURNING id
  `);

  const savedId = (result.rows as any[])[0]?.id ?? '?';

  // Advance cursor only through persisted groups — remaining survive for next flush
  saveCursor({ sessionId: found.sessionId, lastMemoryId: lastIncludedMemoryId });
  console.log(`[SaveTranscriptNow] ✓ Saved: "${title}"`);
  console.log(`[SaveTranscriptNow]   id=${savedId}`);
  console.log(`[SaveTranscriptNow]   ${davidCount} David + ${includedCount - davidCount} Luca turns (cursor ${afterId}→${lastIncludedMemoryId}${remainingCount > 0 ? `, ${remainingCount} turns queued for next flush` : ''})`);

  // Also touch the flush trigger so the autosave worker's mtime stays in sync
  // if/when it starts — prevents a redundant save on next poll.
  if (existsSync(join(WORKSPACE, '.local'))) {
    try { touchFlushTrigger(); } catch { /* ignore — .local may be read-only */ }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
(async () => {
  if (triggerOnly) {
    touchFlushTrigger();
    process.exit(0);
  }

  if (!directOnly) {
    const serverUp = await isServerRunning();
    if (serverUp) {
      console.log('[SaveTranscriptNow] Server is running — using trigger mode (avoids cross-process cursor race).');
      touchFlushTrigger();
      process.exit(0);
    }
    console.log('[SaveTranscriptNow] Server not detected — using direct save mode.');
  }

  try {
    await saveNow(contextArg);
  } catch (err: any) {
    console.error('[SaveTranscriptNow] ERROR:', err.message);
    process.exit(1);
  }

  process.exit(0);
})();
