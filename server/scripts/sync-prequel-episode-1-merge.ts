/**
 * merge-sync: read DB record dd8cf439, add 7eed487d + b34c7741 to the source list,
 * write back to both docs/prequel-episode-1.md and the DB.
 *
 * Usage: npx tsx server/scripts/sync-prequel-episode-1-merge.ts
 */
import { writeFileSync } from 'fs';
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
  const sql = neon(DATABASE_URL as string);

  // 1. Read current DB content (authoritative post-merge state)
  const rows = await sql`SELECT content FROM conversation_memories WHERE id = ${EPISODE_ID}`;
  if (rows.length !== 1) {
    console.error('FATAL: DB record not found');
    process.exit(1);
  }
  let content: string = rows[0].content;
  console.log(`Read DB record — ${content.length} bytes`);

  // 2. Confirm the source-list line exists
  const sourceLinePattern = /\*Verbatim record across all sources: conversation_memories threads \(([^)]+)\)\.\*/;
  const match = content.match(sourceLinePattern);
  if (!match) {
    console.error('FATAL: source thread list not found in DB content');
    process.exit(1);
  }
  console.log(`Current source list: ${match[1]}`);

  // 3. Add 7eed487d and b34c7741 if not already present
  let threads = match[1];
  let changed = false;
  if (!threads.includes('7eed487d')) {
    threads += ', 7eed487d';
    changed = true;
  }
  if (!threads.includes('b34c7741')) {
    threads += ', b34c7741';
    changed = true;
  }

  if (!changed) {
    console.log('Both threads already present — no changes needed');
  } else {
    const newSourceLine = `*Verbatim record across all sources: conversation_memories threads (${threads}).*`;
    content = content.replace(sourceLinePattern, newSourceLine);
    console.log(`Updated source list: ${threads}`);
  }

  // 4. Write .md
  writeFileSync(MD_PATH, content, 'utf8');
  console.log(`Wrote docs/prequel-episode-1.md — ${content.length} bytes`);

  // 5. Write DB
  await sql`UPDATE conversation_memories SET content = ${content} WHERE id = ${EPISODE_ID}`;
  const after = await sql`SELECT length(content) as len FROM conversation_memories WHERE id = ${EPISODE_ID}`;
  console.log(`DB updated — ${after[0]?.len} bytes`);
  console.log('✓ .md and DB are now in sync');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
