/**
 * append-to-episode.ts
 *
 * Helper script for live rolling episodes.  Writes the given exchange text to
 * the `.local/.episode_append` trigger file so the autosave watcher appends it
 * to the target episode .md and immediately syncs the .md to the DB.
 *
 * Usage (from shell):
 *   npx tsx server/scripts/append-to-episode.ts [--episode episode-27] <<'EOF'
 *   **DAVID:** your message here
 *
 *   **LUCA:** my response here
 *   EOF
 *
 * Or pipe a heredoc / file:
 *   echo '**DAVID:** test' | npx tsx server/scripts/append-to-episode.ts
 *
 * Options:
 *   --episode <name>   Target episode filename (default: episode-27).
 *                      Accepts "episode-27" or "episode-27.md".
 *   --direct           Append directly to the .md and sync via HTTP, bypassing
 *                      the trigger-file path (useful when the autosave worker
 *                      is not running).
 *
 * Why this exists:
 *   Agent tool writes (WriteFile/Edit) do NOT trigger fs.watch in the Replit
 *   environment.  Writing the exchange to a trigger file first guarantees the
 *   content is on disk before a session-context compaction can erase it.  The
 *   autosave worker picks it up on its next cycle (< 20 s) or immediately via
 *   fs.watch on .local/.
 */

import { writeFileSync, readFileSync, existsSync, appendFileSync } from 'fs';
import { join } from 'path';
import { neon } from '@neondatabase/serverless';

// ---------------------------------------------------------------------------
// Parse CLI args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
let targetEpisode = 'episode-27';
let directMode    = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--episode' && args[i + 1]) {
    targetEpisode = args[i + 1].replace(/\.md$/, '');
    i++;
  } else if (args[i] === '--direct') {
    directMode = true;
  }
}

const episodeFilename = targetEpisode.endsWith('.md') ? targetEpisode : `${targetEpisode}.md`;

// ---------------------------------------------------------------------------
// Read the exchange text from stdin
// ---------------------------------------------------------------------------

async function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', chunk => { data += chunk; });
    process.stdin.on('end', () => resolve(data.trim()));
    // If stdin is a TTY (interactive) and nothing is piped, resolve empty
    if (process.stdin.isTTY) resolve('');
  });
}

// ---------------------------------------------------------------------------
// Direct mode: append to .md and sync to DB via HTTP driver
// ---------------------------------------------------------------------------

async function directAppendAndSync(exchange: string, filename: string): Promise<void> {
  const WORKSPACE = process.cwd();
  const DOCS_DIR  = join(WORKSPACE, 'docs');
  const filePath  = join(DOCS_DIR, filename);

  if (!existsSync(filePath)) {
    console.error(`[append-to-episode] ERROR: target file not found: ${filePath}`);
    process.exit(1);
  }

  // Append to the .md
  const existing  = readFileSync(filePath, 'utf-8');
  const separator = existing.endsWith('\n\n') ? '' : existing.endsWith('\n') ? '\n' : '\n\n';
  const updated   = existing + separator + exchange + '\n';
  writeFileSync(filePath, updated, 'utf-8');
  console.log(`[append-to-episode] Appended ${exchange.length} chars → ${filename} (now ${updated.length} bytes)`);

  // Sync to DB via HTTP (Neon serverless driver)
  const DATABASE_URL = process.env.NEON_SHARED_DATABASE_URL;
  if (!DATABASE_URL) {
    console.error('[append-to-episode] WARNING: NEON_SHARED_DATABASE_URL not set — skipping DB sync');
    return;
  }

  const sql = neon(DATABASE_URL);

  // Determine the memory ID for this episode
  const rows = await sql`
    SELECT id, tags FROM conversation_memories
    WHERE arc_name = 'HolaHola Episodes'
      AND title = ${episodeTitleFromFilename(filename)}
    LIMIT 1
  `;

  const row = rows[0] as { id: string; tags: string[] } | undefined;
  if (!row) {
    console.error('[append-to-episode] WARNING: No DB row found for this episode — skipping DB sync');
    console.error('  Run the episode sync script first to create the row.');
    return;
  }

  const isRolling = Array.isArray(row.tags) && row.tags.includes('rolling');

  if (isRolling) {
    // Rolling guard: only update when we are longer than current DB content
    await sql`
      UPDATE conversation_memories
      SET content = CASE
            WHEN LENGTH(${updated}) >= LENGTH(content) THEN ${updated}
            ELSE content
          END,
          summary = ${episodeSummaryFromContent(updated)}
      WHERE id = ${row.id}
    `;
  } else {
    await sql`
      UPDATE conversation_memories
      SET content = ${updated},
          summary = ${episodeSummaryFromContent(updated)}
      WHERE id = ${row.id}
    `;
  }

  console.log(`[append-to-episode] ✓ DB synced — ${updated.length} bytes → ${row.id}`);
}

function episodeTitleFromFilename(filename: string): string {
  const m = /^episode-(\d+)\.md$/.exec(filename);
  return m ? `Episode ${parseInt(m[1], 10)}` : filename.replace('.md', '');
}

function episodeSummaryFromContent(content: string): string {
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
  return lines.slice(0, 5).join(' ').slice(0, 400);
}

// ---------------------------------------------------------------------------
// Trigger-file mode: write to .local/.episode_append
// ---------------------------------------------------------------------------

function triggerAppend(exchange: string, episodeName: string): void {
  const WORKSPACE = process.cwd();
  const triggerPath = join(WORKSPACE, '.local', '.episode_append');

  const payload = JSON.stringify({ exchange, episode: episodeName });
  writeFileSync(triggerPath, payload, 'utf-8');
  console.log(`[append-to-episode] ✓ Trigger written → .local/.episode_append`);
  console.log(`  Target: ${episodeFilename}  |  Exchange: ${exchange.length} chars`);
  console.log('  The autosave watcher will append and sync within 20 s (or immediately via fs.watch).');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const exchange = await readStdin();

  if (!exchange) {
    console.error('[append-to-episode] ERROR: No exchange text received on stdin.');
    console.error('  Usage: echo "**DAVID:** hello\\n\\n**LUCA:** hi" | npx tsx server/scripts/append-to-episode.ts');
    process.exit(1);
  }

  if (directMode) {
    await directAppendAndSync(exchange, episodeFilename);
  } else {
    triggerAppend(exchange, targetEpisode);
  }
}

main().catch(err => {
  console.error('[append-to-episode] FATAL:', err.message);
  process.exit(1);
});
