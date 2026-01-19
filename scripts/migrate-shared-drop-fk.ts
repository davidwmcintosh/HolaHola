#!/usr/bin/env npx tsx
/**
 * Migration script that drops FK constraints, migrates data, then recreates them
 * 
 * Run: npx tsx scripts/migrate-shared-drop-fk.ts
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

// FK constraints to drop and recreate
const FK_CONSTRAINTS = [
  {
    table: 'founder_sessions',
    constraint: 'founder_sessions_founder_id_users_id_fk',
    column: 'founder_id',
    refTable: 'users',
    refColumn: 'id',
  },
  {
    table: 'collaboration_messages',
    constraint: 'collaboration_messages_session_id_founder_sessions_id_fk',
    column: 'session_id',
    refTable: 'founder_sessions',
    refColumn: 'id',
  },
  {
    table: 'hive_snapshots',
    constraint: 'hive_snapshots_user_id_users_id_fk',
    column: 'user_id',
    refTable: 'users',
    refColumn: 'id',
  },
  {
    table: 'hive_snapshots',
    constraint: 'hive_snapshots_session_id_founder_sessions_id_fk',
    column: 'session_id',
    refTable: 'founder_sessions',
    refColumn: 'id',
  },
];

async function migrateTableDirect(
  tableName: string,
  table: any,
  neonDb: any,
  batchSize = 100
): Promise<{ inserted: number; skipped: number; errors: number }> {
  console.log(`\n[MIGRATE] ${tableName}...`);
  
  const localRows = await db.select().from(table);
  console.log(`  Found ${localRows.length} rows in Replit`);
  
  if (localRows.length === 0) {
    return { inserted: 0, skipped: 0, errors: 0 };
  }
  
  const existingRows = await neonDb.select({ id: table.id }).from(table);
  const existingIds = new Set(existingRows.map((r: any) => r.id));
  console.log(`  Found ${existingIds.size} existing in Neon`);
  
  const newRows = localRows.filter((r: any) => !existingIds.has(r.id));
  console.log(`  ${newRows.length} new rows to insert`);
  
  if (newRows.length === 0) {
    return { inserted: 0, skipped: localRows.length, errors: 0 };
  }
  
  let inserted = 0;
  let errors = 0;
  
  for (let i = 0; i < newRows.length; i += batchSize) {
    const batch = newRows.slice(i, i + batchSize);
    
    for (const row of batch) {
      try {
        await neonDb.insert(table).values(row).onConflictDoNothing();
        inserted++;
      } catch (error: any) {
        console.error(`  Error: ${error.message.substring(0, 100)}`);
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
  console.log('║  SHARED DATA MIGRATION (DROP/RECREATE FK MODE)                   ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  
  const neonDb = getNeonSharedDb();
  
  // Step 1: Drop FK constraints
  console.log('\n[STEP 1] Dropping FK constraints on Neon shared DB...');
  for (const fk of FK_CONSTRAINTS) {
    try {
      await neonDb.execute(sql.raw(`ALTER TABLE "${fk.table}" DROP CONSTRAINT IF EXISTS "${fk.constraint}"`));
      console.log(`  ✓ Dropped ${fk.constraint}`);
    } catch (error: any) {
      console.log(`  ⚠ ${fk.constraint}: ${error.message.substring(0, 50)}`);
    }
  }
  
  // Step 2: Migrate data
  console.log('\n[STEP 2] Migrating data...');
  
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
  
  // Step 3: Recreate FK constraints with NOT VALID (skip validation)
  console.log('\n[STEP 3] Recreating FK constraints (NOT VALID)...');
  for (const fk of FK_CONSTRAINTS) {
    try {
      // Only recreate internal FKs (not cross-db refs to users)
      if (fk.refTable !== 'users') {
        await neonDb.execute(sql.raw(
          `ALTER TABLE "${fk.table}" ADD CONSTRAINT "${fk.constraint}" ` +
          `FOREIGN KEY ("${fk.column}") REFERENCES "${fk.refTable}"("${fk.refColumn}") NOT VALID`
        ));
        console.log(`  ✓ Recreated ${fk.constraint}`);
      } else {
        console.log(`  ⊘ Skipping ${fk.constraint} (cross-db reference to users)`);
      }
    } catch (error: any) {
      console.log(`  ⚠ ${fk.constraint}: ${error.message.substring(0, 50)}`);
    }
  }
  
  // Verification
  console.log('\n══════════════════════════════════════════════════════════════════');
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
