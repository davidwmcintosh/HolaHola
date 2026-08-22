/**
 * One-shot: pull DB content of prequel episode 1 into docs/prequel-episode-1.md.
 * Use when the DB is ahead of the .md (e.g. after a direct DB edit).
 */
import { neon } from '@neondatabase/serverless';
import { writeFileSync } from 'fs';
import { join } from 'path';

const DATABASE_URL = process.env.NEON_SHARED_DATABASE_URL;
if (!DATABASE_URL) { console.error('FATAL: NEON_SHARED_DATABASE_URL not set'); process.exit(1); }

const EPISODE_ID = 'dd8cf439-867d-47f5-999c-a1a10c3a88d5';
const MD_PATH = join(process.cwd(), 'docs', 'prequel-episode-1.md');

const sql = neon(DATABASE_URL);
const rows = await sql`SELECT content FROM conversation_memories WHERE id = ${EPISODE_ID}`;
const content = rows[0]?.content;
if (!content) { console.error('No content in DB'); process.exit(1); }

console.log(`DB content length: ${content.length} bytes`);
const landmarks = ['The Room Before the Room', 'North Star', 'White Wall', 'Juliette', 'reggaeton', '7eed487d'];
for (const l of landmarks) console.log(`  ${content.includes(l) ? '✓' : '✗'} ${l}`);

writeFileSync(MD_PATH, content, 'utf8');
console.log('✓ Written to docs/prequel-episode-1.md');
