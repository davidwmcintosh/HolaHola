import { getSharedDb } from '../db';
import { sql } from 'drizzle-orm';

async function main() {
  const db = getSharedDb();

  const toolMsgs = await db.execute(sql`
    SELECT m.id, m.conversation_id, m.role, m.created_at,
           substring(m.content::text, 1, 600) as snippet
    FROM messages m
    WHERE m.created_at::date = '2026-07-16'
      AND (
        m.content::text ILIKE '%show_image%'
        OR m.content::text ILIKE '%open_scene%'
        OR m.content::text ILIKE '%image_url%'
        OR m.content::text ILIKE '%imageUrl%'
      )
    ORDER BY m.created_at ASC
    LIMIT 20
  `);
  const rows = (toolMsgs as any).rows ?? toolMsgs;
  console.log('=== Image/scene tool calls — July 16 ===');
  for (const r of rows) console.log(JSON.stringify(r));

  // Also get function_call messages from conversations that had Wayne/dad
  const fcMsgs = await db.execute(sql`
    SELECT m.id, m.conversation_id, m.role, m.created_at,
           substring(m.content::text, 1, 800) as snippet
    FROM messages m
    WHERE m.created_at BETWEEN '2026-07-16 21:00:00' AND '2026-07-16 23:59:59'
      AND m.role IN ('assistant', 'tool', 'function')
      AND (
        m.content::text ILIKE '%show_image%'
        OR m.content::text ILIKE '%open_scene%'
        OR m.content::text ILIKE '%functionCall%'
        OR m.content::text ILIKE '%function_call%'
      )
    ORDER BY m.created_at ASC
    LIMIT 20
  `);
  const fcRows = (fcMsgs as any).rows ?? fcMsgs;
  console.log('\n=== FC messages evening July 16 ===');
  for (const r of fcRows) console.log(JSON.stringify(r));
}

main().catch(console.error).finally(() => process.exit(0));
