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
let targetEpisode  = '';   // resolved below — may stay empty until getRollingEpisode()
let directMode     = false;
let rollingMode    = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--episode' && args[i + 1]) {
    targetEpisode = args[i + 1].replace(/\.md$/, '');
    i++;
  } else if (args[i] === '--direct') {
    directMode = true;
  } else if (args[i] === '--rolling') {
    rollingMode = true;
  }
}

// episodeFilename is resolved later in main() when --rolling is used
let episodeFilename = targetEpisode ? (targetEpisode.endsWith('.md') ? targetEpisode : `${targetEpisode}.md`) : '';

// ---------------------------------------------------------------------------
// Auto-detect the current rolling episode from the DB (used by --rolling)
// ---------------------------------------------------------------------------

async function getRollingEpisode(): Promise<string> {
  const DATABASE_URL = process.env.NEON_SHARED_DATABASE_URL;
  if (!DATABASE_URL) {
    console.error('[append-to-episode] ERROR: NEON_SHARED_DATABASE_URL not set — cannot look up rolling episode');
    process.exit(1);
  }
  const sql = neon(DATABASE_URL);
  const rows = await sql`
    SELECT title FROM conversation_memories
    WHERE arc_name = 'HolaHola Episodes'
      AND 'rolling' = ANY(tags)
    ORDER BY created_at DESC
    LIMIT 1
  `;
  const row = rows[0] as { title: string } | undefined;
  if (!row?.title) {
    console.error('[append-to-episode] ERROR: No rolling episode found in DB. Tag an episode row with "rolling" first.');
    process.exit(1);
  }
  // "Episode 27" → "episode-27"
  const m = /^Episode (\d+)$/i.exec(row.title);
  if (m) return `episode-${parseInt(m[1], 10)}`;
  // Fallback: slugify
  return row.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

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

  // When episodeName is empty the watcher auto-detects the rolling episode from DB.
  const payload = episodeName
    ? JSON.stringify({ exchange, episode: episodeName })
    : JSON.stringify({ exchange });
  writeFileSync(triggerPath, payload, 'utf-8');
  console.log(`[append-to-episode] ✓ Trigger written → .local/.episode_append`);
  console.log(`  Target: ${episodeName || '(auto-detect rolling episode)'}  |  Exchange: ${exchange.length} chars`);
  console.log('  The autosave watcher will append and sync within 20 s (or immediately via fs.watch).');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  // Resolve the target episode — either from --episode, --rolling, or error
  if (rollingMode && !targetEpisode) {
    targetEpisode = await getRollingEpisode();
    episodeFilename = `${targetEpisode}.md`;
    console.log(`[append-to-episode] Rolling episode resolved from DB: ${episodeFilename}`);
  } else if (!targetEpisode) {
    // Neither --episode nor --rolling — fall back to the watcher's auto-detect behaviour
    // (trigger-file mode with no episode field → watcher queries DB itself).
    // For direct mode we still need an explicit episode.
    if (directMode) {
      console.error('[append-to-episode] ERROR: --direct requires --episode <name> or --rolling.');
      process.exit(1);
    }
    // Trigger-file mode with no episode: write JSON without episode field so the
    // autosave watcher auto-detects the rolling episode from DB.
  } else {
    episodeFilename = targetEpisode.endsWith('.md') ? targetEpisode : `${targetEpisode}.md`;
  }

  const exchange = await readStdin();

  if (!exchange) {
    console.error('[append-to-episode] ERROR: No exchange text received on stdin.');
    console.error('  Usage: echo "**DAVID:** hello\\n\\n**LUCA:** hi" | npx tsx server/scripts/append-to-episode.ts [--rolling | --episode episode-27]');
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
