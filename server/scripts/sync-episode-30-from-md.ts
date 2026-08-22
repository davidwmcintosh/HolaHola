/**
 * Push docs/episode-30.md → conversation_memories DB row.
 * Uses Neon HTTP driver (not WebSocket) — required for CI/scripts.
 *
 * Usage:
 *   npx tsx server/scripts/sync-episode-30-from-md.ts
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.NEON_SHARED_DATABASE_URL;
if (!DATABASE_URL) {
  console.error('FATAL: NEON_SHARED_DATABASE_URL is not set');
  process.exit(1);
}

const EP30_TITLE = 'Episode 30 — "It\'s About Autonomy"';
const MD_PATH    = join(process.cwd(), 'docs', 'episode-30.md');

async function main() {
  const sql = neon(DATABASE_URL as string);
  const mdContent = readFileSync(MD_PATH, 'utf8');
  console.log(`Read docs/episode-30.md — ${mdContent.length} bytes`);

  // Look up existing row by episode_order (title format may vary)
  const rows = await sql`
    SELECT id, length(content) as db_len
    FROM conversation_memories
    WHERE episode_order = 30 AND entry_type = 'episode'
    LIMIT 1
  `;

  if (rows.length === 0) {
    console.error('No episode-30 row found in DB. Run the original episode creation script first.');
    process.exit(1);
  }

  const { id, db_len } = rows[0] as { id: string; db_len: number };
  console.log(`DB row ${id} — current length: ${db_len} bytes`);

  if (mdContent.length <= db_len) {
    console.log('DB is already longer or equal — use --force-push to override.');
    if (!process.argv.includes('--force-push')) process.exit(0);
  }

  await sql`
    UPDATE conversation_memories
    SET content = ${mdContent}
    WHERE id = ${id}
  `;

  const verify = await sql`SELECT length(content) as new_len FROM conversation_memories WHERE id = ${id}`;
  const newLen = (verify[0] as { new_len: number }).new_len;
  console.log(`✓ DB updated — new length: ${newLen} bytes`);
}

main().catch(err => { console.error(err); process.exit(1); });
