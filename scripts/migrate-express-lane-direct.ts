#!/usr/bin/env npx tsx
/**
 * Direct migration of Express Lane data using Drizzle ORM
 * 
 * Run: npx tsx scripts/migrate-express-lane-direct.ts
 */

import { db, getNeonSharedDb } from '../server/db';
import { 
  founderSessions, 
  collaborationMessages,
  hiveSnapshots,
  featureSprints,
  learnerPersonalFacts,
  learnerMemoryCandidates,
  danielaGrowthMemories,
  northStarPrinciples,
  lessonDrafts,
  architectNotes,
  wrenPredictions,
} from '@shared/schema';
import { eq, sql } from 'drizzle-orm';

async function migrateTableDirect<T>(
  tableName: string,
  table: any,
  batchSize = 100
): Promise<{ inserted: number; skipped: number }> {
  const neonDb = getNeonSharedDb();
  
  console.log(`\n[MIGRATE] ${tableName}...`);
  
  // Get all from Replit
  const localRows = await db.select().from(table);
  console.log(`  Found ${localRows.length} rows in Replit`);
  
  if (localRows.length === 0) {
    return { inserted: 0, skipped: 0 };
  }
  
  // Get existing IDs in Neon
  const existingRows = await neonDb.select({ id: table.id }).from(table);
  const existingIds = new Set(existingRows.map((r: any) => r.id));
  console.log(`  Found ${existingIds.size} existing in Neon`);
  
  // Filter to only new rows
  const newRows = localRows.filter((r: any) => !existingIds.has(r.id));
  console.log(`  ${newRows.length} new rows to insert`);
  
  if (newRows.length === 0) {
    return { inserted: 0, skipped: localRows.length };
  }
  
  let inserted = 0;
  let errors = 0;
  
  // Insert in batches
  for (let i = 0; i < newRows.length; i += batchSize) {
    const batch = newRows.slice(i, i + batchSize);
    
    for (const row of batch) {
      try {
        await neonDb.insert(table).values(row).onConflictDoNothing();
        inserted++;
      } catch (error: any) {
        console.error(`  Error: ${error.message.substring(0, 80)}`);
        errors++;
      }
    }
    
    if ((i + batchSize) % 500 === 0 || i + batchSize >= newRows.length) {
      console.log(`  Progress: ${Math.min(i + batchSize, newRows.length)}/${newRows.length}`);
    }
  }
  
  console.log(`  ✓ ${inserted} inserted, ${existingIds.size} skipped, ${errors} errors`);
  return { inserted, skipped: existingIds.size };
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║      EXPRESS LANE & SHARED DATA MIGRATION (DRIZZLE ORM)          ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  
  // Migrate in dependency order
  await migrateTableDirect('founder_sessions', founderSessions);
  await migrateTableDirect('collaboration_messages', collaborationMessages);
  await migrateTableDirect('hive_snapshots', hiveSnapshots);
  await migrateTableDirect('feature_sprints', featureSprints);
  await migrateTableDirect('learner_personal_facts', learnerPersonalFacts);
  await migrateTableDirect('learner_memory_candidates', learnerMemoryCandidates);
  await migrateTableDirect('daniela_growth_memories', danielaGrowthMemories);
  await migrateTableDirect('compass_principles', northStarPrinciples);
  await migrateTableDirect('lesson_drafts', lessonDrafts);
  await migrateTableDirect('architect_notes', architectNotes);
  await migrateTableDirect('wren_predictions', wrenPredictions);
  
  console.log('\n✅ Migration complete!\n');
  
  // Verify
  const neonDb = getNeonSharedDb();
  const sessionCount = await neonDb.select({ count: sql`count(*)` }).from(founderSessions);
  const msgCount = await neonDb.select({ count: sql`count(*)` }).from(collaborationMessages);
  
  console.log('Verification:');
  console.log(`  founder_sessions: ${sessionCount[0]?.count || 0}`);
  console.log(`  collaboration_messages: ${msgCount[0]?.count || 0}`);
  
  process.exit(0);
}

main().catch((error) => {
  console.error('[MIGRATION] Fatal:', error);
  process.exit(1);
});
