import { getSharedDb } from '../db';
import { sql } from 'drizzle-orm';

async function main() {
  const db = getSharedDb();

  // Check voice_sessions from July 16 evening
  const vs = await db.execute(sql`
    SELECT id, conversation_id, language, status, created_at,
           substring(session_data::text, 1, 400) as session_data_snippet
    FROM voice_sessions
    WHERE created_at::date = '2026-07-16'
    ORDER BY created_at DESC
    LIMIT 10
  `);
  const vsRows = (vs as any).rows ?? vs;
  console.log('=== voice_sessions July 16 ===');
  for (const r of vsRows) console.log(JSON.stringify(r));

  // Look for any gl-tool-call log tables
  const tables = await db.execute(sql`
    SELECT tablename FROM pg_tables 
    WHERE schemaname = 'public' 
      AND tablename ILIKE '%tool%'
    ORDER BY tablename
  `);
  const tRows = (tables as any).rows ?? tables;
  console.log('\n=== Tool-related tables ===');
  for (const r of tRows) console.log(r.tablename);

  // Check messages from ANY date for the Vegas conversation
  // The session was where Wayne/dad spoke Spanish
  const msgs = await db.execute(sql`
    SELECT m.id, m.conversation_id, m.role, m.created_at,
           substring(m.content::text, 1, 800) as snippet
    FROM messages m
    WHERE m.content::text ILIKE '%Wayne%'
       OR m.content::text ILIKE '%sueño%'
       OR m.content::text ILIKE '%casino%'
       OR m.content::text ILIKE '%Vegas%'
    ORDER BY m.created_at DESC
    LIMIT 10
  `);
  const mRows = (msgs as any).rows ?? msgs;
  console.log('\n=== Messages mentioning Vegas/Wayne ===');
  for (const r of mRows) console.log(JSON.stringify(r));
}

main().catch(console.error).finally(() => process.exit(0));
