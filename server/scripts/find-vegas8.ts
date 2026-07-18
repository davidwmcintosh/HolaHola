import { getSharedDb } from '../db';
import { sql } from 'drizzle-orm';

async function main() {
  const db = getSharedDb();

  // Check last_used_at around July 16
  const used = await db.execute(sql`
    SELECT image_url, description, created_at, last_used_at
    FROM image_vision_cache
    WHERE last_used_at BETWEEN '2026-07-16 00:00:00' AND '2026-07-17 23:59:59'
    ORDER BY last_used_at DESC
  `);
  const rows = (used as any).rows ?? used;
  console.log(`Images last used around July 16 (${rows.length}):`);
  for (const r of rows) {
    console.log(`\n[created: ${r.created_at}] [last_used: ${r.last_used_at}]`);
    console.log(`URL: ${r.image_url}`);
    console.log(`DESC: ${r.description?.slice(0, 400)}`);
  }

  // Also check last_used_at in the last 30 days sorted
  const recent = await db.execute(sql`
    SELECT image_url, last_used_at, created_at,
           substring(description, 1, 200) as desc_snippet
    FROM image_vision_cache
    WHERE last_used_at IS NOT NULL
    ORDER BY last_used_at DESC
    LIMIT 15
  `);
  const rRows = (recent as any).rows ?? recent;
  console.log(`\nMost recently USED cache entries:`);
  for (const r of rRows) {
    console.log(`[last_used: ${r.last_used_at}] ${r.image_url?.slice(0,70)}`);
    console.log(`  ${r.desc_snippet}`);
  }
}
main().catch(console.error).finally(() => process.exit(0));
