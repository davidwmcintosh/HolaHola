import { getSharedDb } from '../db';
import { sql } from 'drizzle-orm';

async function main() {
  const db = getSharedDb();

  // Get voice_sessions columns
  const cols = await db.execute(sql`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_name = 'voice_sessions' ORDER BY ordinal_position LIMIT 20
  `);
  console.log('voice_sessions cols:', JSON.stringify((cols as any).rows ?? cols));

  // Tool-related tables
  const tbls = await db.execute(sql`
    SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename ILIKE '%tool%' ORDER BY tablename
  `);
  console.log('tool tables:', JSON.stringify((tbls as any).rows ?? tbls));

  // Messages from Vegas conversation (sueño = David said this to Wayne during session)
  const msgs = await db.execute(sql`
    SELECT m.id, m.conversation_id, m.role, m.created_at,
           substring(m.content::text, 1, 500) as snippet
    FROM messages m
    WHERE m.content::text ILIKE '%sueño%'
       OR m.content::text ILIKE '%Las Vegas%'
       OR m.content::text ILIKE '%casino%'
    ORDER BY m.created_at DESC LIMIT 10
  `);
  console.log('Vegas msgs:', JSON.stringify((msgs as any).rows ?? msgs));
}
main().catch(console.error).finally(() => process.exit(0));
