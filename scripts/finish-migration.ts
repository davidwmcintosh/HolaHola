#!/usr/bin/env npx tsx
/**
 * Finish migration by dropping remaining cross-DB FKs and migrating learner_memory_candidates
 */

import { db, getNeonSharedDb } from '../server/db';
import { learnerMemoryCandidates } from '@shared/schema';
import { sql } from 'drizzle-orm';

async function main() {
  console.log('Finishing migration...\n');
  
  const neonDb = getNeonSharedDb();
  
  // Drop remaining FK
  console.log('Dropping learner_memory_candidates FK to voice_sessions...');
  await neonDb.execute(sql.raw(`ALTER TABLE "learner_memory_candidates" DROP CONSTRAINT IF EXISTS "learner_memory_candidates_db_session_id_voice_sessions_id_fk"`));
  console.log('  ✓ Dropped\n');
  
  // Migrate learner_memory_candidates
  console.log('Migrating learner_memory_candidates...');
  const localRows = await db.select().from(learnerMemoryCandidates);
  console.log(`  Found ${localRows.length} rows in Replit`);
  
  const existingRows = await neonDb.select({ id: learnerMemoryCandidates.id }).from(learnerMemoryCandidates);
  const existingIds = new Set(existingRows.map((r: any) => r.id));
  console.log(`  Found ${existingIds.size} existing in Neon`);
  
  const newRows = localRows.filter((r: any) => !existingIds.has(r.id));
  console.log(`  ${newRows.length} new rows to insert`);
  
  let inserted = 0;
  for (const row of newRows) {
    try {
      await neonDb.insert(learnerMemoryCandidates).values(row).onConflictDoNothing();
      inserted++;
    } catch (error: any) {
      console.error(`  Error: ${error.message.substring(0, 80)}`);
    }
  }
  console.log(`  ✓ ${inserted} inserted\n`);
  
  // Verify all tables
  console.log('=== CURRENT STATUS ===');
  const tables = [
    'founder_sessions', 'collaboration_messages', 'hive_snapshots',
    'learner_personal_facts', 'learner_memory_candidates', 'daniela_growth_memories',
    'lesson_drafts', 'architect_notes', 'compass_principles'
  ];
  
  for (const t of tables) {
    const localResult = await db.execute(sql.raw(`SELECT count(*) as c FROM "${t}"`));
    const neonResult = await neonDb.execute(sql.raw(`SELECT count(*) as c FROM "${t}"`));
    const local = (localResult.rows?.[0] as any)?.c || (localResult as any)[0]?.c || 0;
    const neon = (neonResult.rows?.[0] as any)?.c || (neonResult as any)[0]?.c || 0;
    const status = local === neon ? '✅' : (neon > 0 ? '⚠️' : '❌');
    console.log(`  ${t}: Replit=${local}, Neon=${neon} ${status}`);
  }
  
  console.log('\n✅ Done!');
  process.exit(0);
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
