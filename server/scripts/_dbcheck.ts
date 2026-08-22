import { getSharedDb } from '../db';
import { neon } from '@neondatabase/serverless';
import { sql } from 'drizzle-orm';

async function main() {
  // HTTP driver
  const httpDb = neon(process.env.NEON_SHARED_DATABASE_URL ?? process.env.DATABASE_URL ?? '');
  const h = await httpDb`SELECT id::text, title, length(content) as len FROM conversation_memories WHERE 'rolling' = ANY(tags) ORDER BY created_at DESC LIMIT 3`;
  console.log('HTTP rolling episodes:', h.length, h.map((r: any) => `${r.id.slice(0,8)} len=${r.len}`).join(', '));
  
  // WebSocket driver
  const wsDb = getSharedDb();
  const w = await wsDb.execute(sql`SELECT id, title, length(content) as len FROM conversation_memories WHERE 'rolling' = ANY(tags) ORDER BY created_at DESC LIMIT 3`);
  const wr = (w as any).rows ?? w;
  console.log('WS rolling episodes:', wr.length, wr.map((r: any) => `${r.id?.toString().slice(0,8)} len=${r.len}`).join(', '));
  process.exit(0);
}
main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
