import { getSharedDb } from '../db';
import { sql } from 'drizzle-orm';
async function main() {
  const db = getSharedDb();
  const rows = await db.execute(sql`
    SELECT id, title, length(content) as len, tags
    FROM conversation_memories WHERE 'rolling' = ANY(tags) ORDER BY created_at DESC LIMIT 5
  `);
  const r = (rows as any).rows ?? rows;
  r.forEach((x: any) => console.log(x.id?.toString().slice(0,8), 'len:', x.len, x.title?.slice(0,50)));
  process.exit(0);
}
main().catch(e => { console.error(e.message); process.exit(1); });
