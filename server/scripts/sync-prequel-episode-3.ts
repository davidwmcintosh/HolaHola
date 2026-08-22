/**
 * One-shot script: sync docs/prequel-episode-3.md into the conversation_memories DB record.
 * Usage: npx tsx server/scripts/sync-prequel-episode-3.ts
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.NEON_SHARED_DATABASE_URL;
if (!DATABASE_URL) {
  console.error('FATAL: NEON_SHARED_DATABASE_URL is not set');
  process.exit(1);
}

const EPISODE_ID = 'cd66b19d-be9c-410c-8721-c3d3e16e3f79';
const MD_PATH = join(process.cwd(), 'docs', 'prequel-episode-3.md');

async function main() {
  const content = readFileSync(MD_PATH, 'utf8');
  console.log(`Read docs/prequel-episode-3.md — ${content.length} bytes`);

  const hasTitle = content.includes('The Distance Covered');
  const hasGato = content.includes('gato');
  const hasCafe = content.includes('café');

  console.log(`Title landmark: ${hasTitle}`);
  console.log(`Gato landmark: ${hasGato}`);
  console.log(`Café landmark: ${hasCafe}`);

  if (!hasTitle || !hasGato || !hasCafe) {
    console.error('ERROR: Expected Episode 3 content missing from .md — aborting sync');
    process.exit(1);
  }

  const sql = neon(DATABASE_URL as string);
  const before = await sql`SELECT length(content) as len FROM conversation_memories WHERE id = ${EPISODE_ID}`;
  console.log(`DB record before update: ${before[0]?.len} bytes`);

  const updateResult = await sql`UPDATE conversation_memories SET content = ${content} WHERE id = ${EPISODE_ID} RETURNING id`;
  if (updateResult.length === 0) {
    console.error(`ERROR: UPDATE matched no rows — DB record ${EPISODE_ID} may not exist`);
    process.exit(1);
  }

  const after = await sql`SELECT length(content) as len,
    position('The Distance Covered' in content) as title_pos,
    position('café' in content) as cafe_pos
    FROM conversation_memories WHERE id = ${EPISODE_ID}`;

  console.log(`DB record after update: ${after[0]?.len} bytes`);
  console.log(`Title position: ${after[0]?.title_pos}`);
  console.log(`Café position: ${after[0]?.cafe_pos}`);

  if (!after[0]?.title_pos) {
    console.error('ERROR: Title landmark not found in DB after update');
    process.exit(1);
  }

  console.log('✓ DB synced successfully');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
