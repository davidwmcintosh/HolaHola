#!/usr/bin/env npx tsx
/**
 * Migration script that bypasses FK constraints by setting session_replication_role
 * 
 * This is necessary because shared tables reference users which are in a different database.
 * The FKs will be valid once both databases share the same user references.
 * 
 * Run: npx tsx scripts/migrate-shared-bypass-fk.ts
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
import { sql } from 'drizzle-orm';

async function migrateTableDirect(
  tableName: string,
  table: any,
  neonDb: any,
  batchSize = 100
): Promise<{ inserted: number; skipped: number; errors: number }> {
  console.log(`\n[MIGRATE] ${tableName}...`);
  
  // Get all from Replit
  const localRows = await db.select().from(table);
  console.log(`  Found ${localRows.length} rows in Replit`);
  
  if (localRows.length === 0) {
    return { inserted: 0, skipped: 0, errors: 0 };
  }
  
  // Get existing IDs in Neon
  const existingRows = await neonDb.select({ id: table.id }).from(table);
  const existingIds = new Set(existingRows.map((r: any) => r.id));
  console.log(`  Found ${existingIds.size} existing in Neon`);
  
  // Filter to only new rows
  const newRows = localRows.filter((r: any) => !existingIds.has(r.id));
  console.log(`  ${newRows.length} new rows to insert`);
  
  if (newRows.length === 0) {
    return { inserted: 0, skipped: localRows.length, errors: 0 };
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
  return { inserted, skipped: existingIds.size, errors };
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║  SHARED DATA MIGRATION (FK BYPASS MODE)                          ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  
  const neonDb = getNeonSharedDb();
  
  // Disable FK constraints by setting session to replica mode
  console.log('\n[SETUP] Disabling FK constraint checks...');
  await neonDb.execute(sql`SET session_replication_role = replica`);
  console.log('  ✓ FK checks disabled for this session\n');
  
  try {
    // Migrate tables in dependency order
    await migrateTableDirect('founder_sessions', founderSessions, neonDb);
    await migrateTableDirect('collaboration_messages', collaborationMessages, neonDb);
    await migrateTableDirect('hive_snapshots', hiveSnapshots, neonDb);
    await migrateTableDirect('feature_sprints', featureSprints, neonDb);
    await migrateTableDirect('learner_personal_facts', learnerPersonalFacts, neonDb);
    await migrateTableDirect('learner_memory_candidates', learnerMemoryCandidates, neonDb);
    await migrateTableDirect('daniela_growth_memories', danielaGrowthMemories, neonDb);
    await migrateTableDirect('compass_principles', northStarPrinciples, neonDb);
    await migrateTableDirect('lesson_drafts', lessonDrafts, neonDb);
    await migrateTableDirect('architect_notes', architectNotes, neonDb);
    await migrateTableDirect('wren_predictions', wrenPredictions, neonDb);
    
  } finally {
    // Re-enable FK constraints
    console.log('\n[CLEANUP] Re-enabling FK constraint checks...');
    await neonDb.execute(sql`SET session_replication_role = DEFAULT`);
    console.log('  ✓ FK checks re-enabled\n');
  }
  
  console.log('══════════════════════════════════════════════════════════════════');
  console.log('VERIFICATION:');
  console.log('══════════════════════════════════════════════════════════════════');
  
  const sessionCount = await neonDb.select({ count: sql`count(*)` }).from(founderSessions);
  const msgCount = await neonDb.select({ count: sql`count(*)` }).from(collaborationMessages);
  const hiveCount = await neonDb.select({ count: sql`count(*)` }).from(hiveSnapshots);
  const factsCount = await neonDb.select({ count: sql`count(*)` }).from(learnerPersonalFacts);
  const compassCount = await neonDb.select({ count: sql`count(*)` }).from(northStarPrinciples);
  
  console.log(`  founder_sessions: ${sessionCount[0]?.count || 0}`);
  console.log(`  collaboration_messages: ${msgCount[0]?.count || 0}`);
  console.log(`  hive_snapshots: ${hiveCount[0]?.count || 0}`);
  console.log(`  learner_personal_facts: ${factsCount[0]?.count || 0}`);
  console.log(`  compass_principles: ${compassCount[0]?.count || 0}`);
  
  console.log('\n✅ Migration complete!\n');
  
  process.exit(0);
}

main().catch((error) => {
  console.error('[MIGRATION] Fatal:', error);
  process.exit(1);
});
