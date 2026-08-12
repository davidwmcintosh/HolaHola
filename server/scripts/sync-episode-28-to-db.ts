/**
 * One-shot: push docs/episode-28.md → DB record 28000000-0000-4000-8000-000000000028
 * Uses neon() HTTP driver (not WebSocket pool) per episode-sync-http rule.
 */
import { neon } from '@neondatabase/serverless';
import * as fs from 'fs';
import * as path from 'path';
import * as url from 'url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const EPISODE_28_ID  = '28000000-0000-4000-8000-000000000028'; // live rolling record
const SNAPSHOT_ID    = '28000000-0001-4000-8000-000000000028'; // sealed snapshot — NEVER write here
const mdPath = path.join(__dirname, '../../docs/episode-28.md');

async function main() {
  // ── Snapshot write-guard ──────────────────────────────────────────────────
  // If EPISODE_28_ID ever gets changed to the snapshot ID (by mistake or a
  // future refactor), abort immediately before touching the DB.
  if ((EPISODE_28_ID as string) === (SNAPSHOT_ID as string)) {
    console.error('BLOCKED: EPISODE_28_ID matches the sealed snapshot ID.');
    console.error(`Snapshot ID : ${SNAPSHOT_ID}`);
    console.error('The snapshot is read-only and must never be overwritten by this script.');
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL!);
  const content = fs.readFileSync(mdPath, 'utf8');
  console.log(`Read docs/episode-28.md — ${content.length} bytes`);

  const result = await sql`
    UPDATE conversation_memories
    SET content = ${content}
    WHERE id = ${EPISODE_28_ID}
    RETURNING id, length(content) as len
  `;

  if (!result[0]) {
    console.error('ERROR: No row updated — check DB ID');
    process.exit(1);
  }

  console.log(`✓ DB updated: id=${result[0].id}, length=${result[0].len} bytes`);
}

main().catch(e => { console.error(e); process.exit(1); });
