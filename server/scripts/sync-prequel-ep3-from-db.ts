/**
 * One-shot: pull DB content of prequel episode 3 into docs/prequel-episode-3.md.
 * Use when the DB is ahead of the .md (e.g. after a direct DB edit).
 */
import { neon } from '@neondatabase/serverless';
import { writeFileSync } from 'fs';
import { join } from 'path';

const DATABASE_URL = process.env.NEON_SHARED_DATABASE_URL;
if (!DATABASE_URL) { console.error('FATAL: NEON_SHARED_DATABASE_URL not set'); process.exit(1); }

const EPISODE_ID = 'cd66b19d-be9c-410c-8721-c3d3e16e3f79';
const MD_PATH = join(process.cwd(), 'docs', 'prequel-episode-3.md');

const sql = neon(DATABASE_URL);
const rows = await sql`SELECT content FROM conversation_memories WHERE id = ${EPISODE_ID}`;
const content = rows[0]?.content;
if (!content) { console.error('No content in DB'); process.exit(1); }

console.log(`DB content length: ${content.length} bytes`);
writeFileSync(MD_PATH, content, 'utf8');
console.log(`✓ Written docs/prequel-episode-3.md from DB`);
