import { neon } from '@neondatabase/serverless';
async function main() {
  const sql = neon(process.env.NEON_SHARED_DATABASE_URL ?? process.env.DATABASE_URL ?? '');
  const r = await sql`SELECT id::text, title, tags, length(content) as len FROM conversation_memories WHERE id IN ('28000000-0000-4000-8000-000000000028','27000000-0000-4000-8000-000000000027') ORDER BY created_at DESC`;
  r.forEach((x: any) => console.log('id:', x.id.slice(0,8), 'len:', x.len, 'tags:', JSON.stringify(x.tags)));
  
  const rolling = await sql`SELECT id::text, title, length(content) as len, tags FROM conversation_memories WHERE 'rolling' = ANY(tags) ORDER BY created_at DESC LIMIT 5`;
  console.log('Rolling episodes:', rolling.length);
  rolling.forEach((x: any) => console.log('  rolling:', x.id.slice(0,8), 'len:', x.len, 'tags:', JSON.stringify(x.tags)));
  process.exit(0);
}
main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
