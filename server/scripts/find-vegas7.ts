import { getSharedDb } from '../db';
import { sql } from 'drizzle-orm';

async function main() {
  const db = getSharedDb();

  // Check image_vision_cache columns first
  const cols = await db.execute(sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'image_vision_cache' ORDER BY ordinal_position
  `);
  console.log('image_vision_cache cols:', JSON.stringify((cols as any).rows ?? cols));

  // Look for entries around the Vegas session time (July 16, 21:40–22:00 UTC)
  const cached = await db.execute(sql`
    SELECT image_url, description, created_at
    FROM image_vision_cache
    WHERE created_at BETWEEN '2026-07-16 21:00:00' AND '2026-07-17 00:00:00'
    ORDER BY created_at ASC
  `);
  const rows = (cached as any).rows ?? cached;
  console.log(`\nimage_vision_cache entries July 16 evening (${rows.length}):`);
  for (const r of rows) {
    console.log(`[${r.created_at}] ${r.image_url}`);
    console.log(`  DESC: ${r.description?.slice(0, 300)}`);
  }

  // Also check the 5 most recent entries regardless of date
  const recent = await db.execute(sql`
    SELECT image_url, description, created_at
    FROM image_vision_cache
    ORDER BY created_at DESC
    LIMIT 10
  `);
  const rRows = (recent as any).rows ?? recent;
  console.log(`\n10 most recent image_vision_cache entries:`);
  for (const r of rRows) {
    console.log(`[${r.created_at}] ${r.image_url?.slice(0, 80)}`);
  }
}
main().catch(console.error).finally(() => process.exit(0));
