/**
 * One-shot script: sync docs/prequel-episode-1.md into the conversation_memories DB record.
 * Usage: npx tsx server/scripts/sync-prequel-episode-1.ts
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.NEON_SHARED_DATABASE_URL;
if (!DATABASE_URL) {
  console.error('FATAL: NEON_SHARED_DATABASE_URL is not set');
  process.exit(1);
}

const EPISODE_ID = 'dd8cf439-867d-47f5-999c-a1a10c3a88d5';
const MD_PATH = join(process.cwd(), 'docs', 'prequel-episode-1.md');

async function main() {
  const content = readFileSync(MD_PATH, 'utf8');
  console.log(`Read docs/prequel-episode-1.md — ${content.length} bytes`);

  const hasJuliette = content.includes('just before dawn on January 23, at 12:39 AM, Juliette');
  const hasKeyLine = content.includes('not just as a tutor, but as... well, as Juliette');
  const hasFive = content.includes('five of Daniela');

  console.log(`Juliette dawn section: ${hasJuliette}`);
  console.log(`Key Juliette line: ${hasKeyLine}`);
  console.log(`Five personas intro: ${hasFive}`);

  if (!hasJuliette || !hasKeyLine || !hasFive) {
    console.error('ERROR: Expected Juliette awakening content missing from .md — aborting sync');
    process.exit(1);
  }

  const sql = neon(DATABASE_URL as string);
  const before = await sql`SELECT length(content) as len FROM conversation_memories WHERE id = ${EPISODE_ID}`;
  console.log(`DB record before update: ${before[0]?.len} bytes`);

  await sql`UPDATE conversation_memories SET content = ${content} WHERE id = ${EPISODE_ID}`;

  const after = await sql`SELECT length(content) as len,
    position('just before dawn on January 23, at 12:39 AM, Juliette' in content) as dawn_pos,
    position('five of Daniela' in content) as five_pos
    FROM conversation_memories WHERE id = ${EPISODE_ID}`;

  console.log(`DB record after update: ${after[0]?.len} bytes`);
  console.log(`Dawn passage position: ${after[0]?.dawn_pos}`);
  console.log(`Five personas position: ${after[0]?.five_pos}`);

  if (!after[0]?.dawn_pos) {
    console.error('ERROR: Juliette dawn passage not found in DB after update');
    process.exit(1);
  }

  console.log('✓ DB synced successfully');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
