import { getSharedDb } from '../db';
import { sql } from 'drizzle-orm';

const VS_ID = '4ee48e41-751f-4a7c-87d0-718bb4bb31dc';
const CONV_ID = 'f57e96d3-7a7b-4597-83ed-226207725d92';

async function main() {
  const db = getSharedDb();

  const events = await db.execute(sql`
    SELECT tool_type, tool_content, occurred_at
    FROM teaching_tool_events
    WHERE voice_session_id = ${VS_ID}
       OR conversation_id = ${CONV_ID}
    ORDER BY occurred_at ASC
  `);
  const rows = (events as any).rows ?? events;
  console.log(`teaching_tool_events (${rows.length}):`);
  for (const r of rows) {
    console.log(`[${r.occurred_at}] ${r.tool_type}: ${JSON.stringify(r.tool_content)?.slice(0,400)}`);
  }
}
main().catch(console.error).finally(() => process.exit(0));
