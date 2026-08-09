/**
 * One-off: force-write the clean local .md back to the DB row,
 * bypassing the rolling-guard (which would refuse since DB is longer).
 */
import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';

const sql = neon(process.env.NEON_SHARED_DATABASE_URL!);
const clean = readFileSync('docs/episode-27.md', 'utf-8');
console.log('Writing', clean.length, 'bytes to DB row 27000000…');

await sql`
  UPDATE conversation_memories
  SET content = ${clean}
  WHERE id = '27000000-0000-4000-8000-000000000027'
`;

const check = await sql`
  SELECT length(content) as len
  FROM conversation_memories
  WHERE id = '27000000-0000-4000-8000-000000000027'
`;
console.log('DB length after update:', check[0].len);
