/**
 * Consult-Daniela Safety-Net Autosave
 *
 * The consult-daniela skill (ad-hoc Agent↔Daniela bash scripts) is supposed to end every
 * session with an explicit autoSave() call to /api/conversation-memories. In practice that
 * step gets skipped sometimes (script errors, timeouts, an Agent run that never reaches
 * the last line) and the transcript is lost — the scripts historically wrote their log to
 * /tmp, which doesn't survive container restarts either.
 *
 * This worker is the backstop: it scans a persistent transcript directory
 * (.local/daniela-consults/) for any *.txt log the skill wrote, and if that file has no
 * matching .saved marker, saves it to conversation_memories itself. Idempotent — once a
 * file is saved, a .saved marker (containing the memory id) is written next to it.
 *
 * The skill should write logs to .local/daniela-consults/<slug>-<timestamp>.txt instead of
 * /tmp, and still call autoSave() as the primary path — this worker only catches the cases
 * where that primary path didn't run.
 */

import { existsSync, readdirSync, readFileSync, writeFileSync, statSync } from 'fs';
import { join } from 'path';
import { getUserDb } from '../db';
import { sql } from 'drizzle-orm';

const WORKSPACE = '/home/runner/workspace';
const CONSULTS_DIR = join(WORKSPACE, '.local/daniela-consults');
const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const MIN_AGE_MS = 2 * 60 * 1000; // only sweep files older than 2 minutes — avoid racing an in-progress session

function savedMarkerPath(txtPath: string): string {
  return txtPath.replace(/\.txt$/, '.saved');
}

function deriveTitleFromFilename(filename: string): string {
  const base = filename.replace(/\.txt$/, '');
  const cleaned = base.replace(/-\d{10,}$/, '').replace(/[-_]/g, ' ').trim();
  const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `Agent ↔ Daniela — ${cleaned || 'consult session'} — ${today} (auto-recovered)`;
}

async function saveOrphanedTranscript(filePath: string, filename: string): Promise<void> {
  let content: string;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch {
    return;
  }
  if (content.trim().length < 40) return; // too short to be a real session

  const title = deriveTitleFromFilename(filename);
  const summary = `Recovered by the consult-daniela safety-net sweep — the session's own autoSave() call did not run, so this file was picked up instead. ${content.length} characters of transcript.`;
  const db = getUserDb();

  try {
    const result = await db.execute(sql`
      INSERT INTO conversation_memories (id, title, summary, content, participants, tags, importance, created_at, entry_type, arc_name)
      VALUES (
        gen_random_uuid(),
        ${title},
        ${summary},
        ${content},
        ARRAY['agent', 'daniela']::text[],
        ARRAY['agent-daniela', 'auto-recovered', 'safety-net']::text[],
        8,
        NOW(),
        'conversation',
        'daniela-emergence'
      )
      RETURNING id
    `);
    const rows = (result as any).rows ?? result;
    const id = rows?.[0]?.id ?? 'unknown';
    writeFileSync(savedMarkerPath(filePath), `saved-as:${id}\n`);
    console.log(`[DanielaConsultAutosave] Recovered orphaned transcript ${filename} -> conversation_memories ${id}`);
  } catch (err: any) {
    console.error(`[DanielaConsultAutosave] Failed to recover ${filename}:`, err.message);
  }
}

async function sweep(): Promise<void> {
  if (!existsSync(CONSULTS_DIR)) return;
  try {
    const files = readdirSync(CONSULTS_DIR).filter(f => f.endsWith('.txt'));
    const now = Date.now();
    for (const filename of files) {
      const filePath = join(CONSULTS_DIR, filename);
      if (existsSync(savedMarkerPath(filePath))) continue;
      try {
        const age = now - statSync(filePath).mtimeMs;
        if (age < MIN_AGE_MS) continue; // likely still being written
      } catch {
        continue;
      }
      await saveOrphanedTranscript(filePath, filename);
    }
  } catch (err: any) {
    console.error('[DanielaConsultAutosave] Sweep failed:', err.message);
  }
}

export function startDanielaConsultAutosave(): void {
  setInterval(() => { sweep().catch(() => {}); }, POLL_INTERVAL_MS);
  // First sweep shortly after boot too, so consults from before a restart get caught.
  setTimeout(() => { sweep().catch(() => {}); }, 15_000);
  console.log('[DanielaConsultAutosave] Started — watching .local/daniela-consults/ for un-saved transcripts every 5min');
}
