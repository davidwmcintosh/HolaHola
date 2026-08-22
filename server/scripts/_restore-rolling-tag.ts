import { neon } from '@neondatabase/serverless';
async function main() {
  const sql = neon(process.env.NEON_SHARED_DATABASE_URL ?? process.env.DATABASE_URL ?? '');
  // Check current state
  const rows = await sql`SELECT id::text, title, tags FROM conversation_memories WHERE 'rolling' = ANY(tags) OR 'rolling-protected' = ANY(tags) ORDER BY created_at DESC LIMIT 5`;
  rows.forEach((r: any) => console.log(r.id.slice(0,8), r.title?.slice(0,40), JSON.stringify(r.tags)));
  
  // Find the most recent episode that should be rolling (episode-28)
  const ep28 = await sql`SELECT id::text, title, tags FROM conversation_memories WHERE id = '28000000-0000-4000-8000-000000000028'`;
  if (ep28.length > 0) {
    const r = ep28[0] as any;
    console.log('\nEp28 current tags:', JSON.stringify(r.tags));
    if (!(r.tags as string[]).includes('rolling')) {
      const upd = await sql`UPDATE conversation_memories SET tags = array_append(tags, 'rolling') WHERE id = '28000000-0000-4000-8000-000000000028' AND NOT ('rolling' = ANY(tags))`;
      console.log('Added rolling tag to ep28');
    } else {
      console.log('Ep28 already has rolling tag');
    }
  }
  process.exit(0);
}
main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
