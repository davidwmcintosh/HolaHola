import { getSharedDb } from '../db';
import { sql } from 'drizzle-orm';

const CONV_ID = 'f57e96d3-7a7b-4597-83ed-226207725d92';

async function main() {
  const db = getSharedDb();

  // All messages in the Vegas conversation
  const msgs = await db.execute(sql`
    SELECT id, role, created_at,
           substring(content::text, 1, 600) as snippet
    FROM messages
    WHERE conversation_id = ${CONV_ID}
    ORDER BY created_at ASC
  `);
  const rows = (msgs as any).rows ?? msgs;
  console.log(`=== All messages in Vegas conversation (${rows.length} total) ===`);
  for (const r of rows) {
    console.log(`[${r.created_at}] ${r.role}: ${r.snippet?.slice(0,300)}`);
  }

  // Check teaching_tool_events for this conversation
  const tte = await db.execute(sql`
    SELECT id, tool_name, tool_input, created_at
    FROM teaching_tool_events
    WHERE conversation_id = ${CONV_ID}
    ORDER BY created_at ASC
    LIMIT 30
  `);
  const tteRows = (tte as any).rows ?? tte;
  console.log(`\n=== teaching_tool_events (${tteRows.length}) ===`);
  for (const r of tteRows) {
    console.log(`[${r.created_at}] ${r.tool_name}: ${JSON.stringify(r.tool_input)?.slice(0,300)}`);
  }
}
main().catch(console.error).finally(() => process.exit(0));
