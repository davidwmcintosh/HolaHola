import { neon } from '@neondatabase/serverless';
async function main() {
  const sql = neon(process.env.NEON_SHARED_DATABASE_URL ?? process.env.DATABASE_URL ?? '');
  const r = await sql`SELECT id::text, title, tags, length(content) as len, created_at FROM conversation_memories WHERE title LIKE '%Episode 30%' OR title LIKE '%30%' ORDER BY created_at DESC LIMIT 3`;
  r.forEach((x: any) => console.log(x.id.slice(0,8), 'title:', x.title?.slice(0,60), 'len:', x.len, 'tags:', JSON.stringify(x.tags)));
  process.exit(0);
}
main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
