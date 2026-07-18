import { getSharedDb } from '../db';
import { sql } from 'drizzle-orm';

const CONV_ID = 'f57e96d3-7a7b-4597-83ed-226207725d92';

async function main() {
  const db = getSharedDb();

  // Get teaching_tool_events columns
  const cols = await db.execute(sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'teaching_tool_events' ORDER BY ordinal_position
  `);
  console.log('teaching_tool_events cols:', JSON.stringify((cols as any).rows ?? cols));

  // Get voice session for this conversation
  const vs = await db.execute(sql`
    SELECT * FROM voice_sessions WHERE conversation_id = ${CONV_ID} LIMIT 5
  `);
  console.log('voice_session:', JSON.stringify((vs as any).rows ?? vs));
}
main().catch(console.error).finally(() => process.exit(0));
