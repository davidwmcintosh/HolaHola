#!/usr/bin/env npx tsx
/**
 * Migration script for remaining shared tables that have cross-db FK constraints
 * Drops FK constraints that reference users/conversations (in USER DB), migrates data,
 * and does NOT recreate cross-db FKs.
 * 
 * Run: npx tsx scripts/migrate-remaining-shared-tables.ts
 */

import { db, getNeonSharedDb } from '../server/db';
import { 
  learnerPersonalFacts,
  learnerMemoryCandidates,
  danielaGrowthMemories,
  lessonDrafts,
  architectNotes,
  agentObservations,
  curriculumDrillItems,
  selfBestPractices,
} from '@shared/schema';
import { sql, eq, notInArray, inArray } from 'drizzle-orm';

// Cross-DB FK constraints to drop permanently (reference users/conversations in USER DB)
const CROSS_DB_FKS_TO_DROP = [
  { table: 'learner_personal_facts', constraint: 'learner_personal_facts_student_id_users_id_fk' },
  { table: 'learner_personal_facts', constraint: 'learner_personal_facts_source_conversation_id_conversations_id_' },
  { table: 'learner_memory_candidates', constraint: 'learner_memory_candidates_student_id_users_id_fk' },
  { table: 'daniela_growth_memories', constraint: 'daniela_growth_memories_source_user_id_users_id_fk' },
  { table: 'lesson_drafts', constraint: 'lesson_drafts_reviewed_by_users_id_fk' },
  { table: 'lesson_drafts', constraint: 'lesson_drafts_created_by_users_id_fk' },
  { table: 'architect_notes', constraint: 'architect_notes_conversation_id_conversations_id_fk' },
  { table: 'self_best_practices', constraint: 'self_best_practices_reviewed_by_users_id_fk' },
];

async function dropCrossDbFKs(neonDb: any) {
  console.log('\n[STEP 1] Dropping cross-DB FK constraints on Neon...');
  for (const fk of CROSS_DB_FKS_TO_DROP) {
    try {
      await neonDb.execute(sql.raw(`ALTER TABLE "${fk.table}" DROP CONSTRAINT IF EXISTS "${fk.constraint}"`));
      console.log(`  ✓ Dropped ${fk.constraint}`);
    } catch (error: any) {
      console.log(`  ⚠ ${fk.constraint}: ${error.message.substring(0, 60)}`);
    }
  }
}

async function migrateTable(
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
        if (errors < 5) {
          console.error(`  Error: ${error.message.substring(0, 100)}`);
        }
        errors++;
      }
    }
    
    if ((i + batchSize) % 500 === 0 || i + batchSize >= newRows.length) {
      console.log(`  Progress: ${Math.min(i + batchSize, newRows.length)}/${newRows.length} (${inserted} inserted, ${errors} errors)`);
    }
  }
  
  console.log(`  ✓ ${inserted} inserted, ${existingIds.size} already existed, ${errors} errors`);
  return { inserted, skipped: existingIds.size, errors };
}

async function migrateLargeTable(
  tableName: string,
  table: any,
  neonDb: any,
  batchSize = 500
): Promise<{ inserted: number; errors: number }> {
  console.log(`\n[MIGRATE LARGE] ${tableName}...`);
  
  // Get count from both DBs
  const [localCount] = await db.select({ count: sql`count(*)::int` }).from(table);
  const [neonCount] = await neonDb.select({ count: sql`count(*)::int` }).from(table);
  
  console.log(`  Replit: ${localCount.count} rows, Neon: ${neonCount.count} rows`);
  
  if (localCount.count === neonCount.count) {
    console.log(`  ✓ Already synced`);
    return { inserted: 0, errors: 0 };
  }
  
  // Get all IDs from Neon
  console.log(`  Fetching existing IDs from Neon...`);
  const existingIds = await neonDb.select({ id: table.id }).from(table);
  const neonIdSet = new Set(existingIds.map((r: any) => r.id));
  console.log(`  Found ${neonIdSet.size} IDs in Neon`);
  
  // Fetch local rows in batches and insert missing ones
  let inserted = 0;
  let errors = 0;
  let offset = 0;
  
  while (true) {
    const localRows = await db.select().from(table).limit(batchSize).offset(offset);
    if (localRows.length === 0) break;
    
    const newRows = localRows.filter((r: any) => !neonIdSet.has(r.id));
    
    for (const row of newRows) {
      try {
        await neonDb.insert(table).values(row).onConflictDoNothing();
        inserted++;
      } catch (error: any) {
        if (errors < 3) {
          console.error(`  Error: ${error.message.substring(0, 100)}`);
        }
        errors++;
      }
    }
    
    offset += batchSize;
    if (offset % 5000 === 0) {
      console.log(`  Progress: ${offset}/${localCount.count} processed, ${inserted} inserted, ${errors} errors`);
    }
  }
  
  console.log(`  ✓ ${inserted} inserted, ${errors} errors`);
  return { inserted, errors };
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║  REMAINING SHARED TABLES MIGRATION                               ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  
  const neonDb = getNeonSharedDb();
  
  // Step 1: Drop cross-DB FK constraints
  await dropCrossDbFKs(neonDb);
  
  // Step 2: Migrate smaller tables first
  console.log('\n[STEP 2] Migrating smaller tables...');
  await migrateTable('learner_personal_facts', learnerPersonalFacts, neonDb);
  await migrateTable('learner_memory_candidates', learnerMemoryCandidates, neonDb);
  await migrateTable('daniela_growth_memories', danielaGrowthMemories, neonDb);
  await migrateTable('lesson_drafts', lessonDrafts, neonDb);
  await migrateTable('architect_notes', architectNotes, neonDb);
  await migrateTable('self_best_practices', selfBestPractices, neonDb);
  
  // Step 3: Migrate larger tables
  console.log('\n[STEP 3] Migrating larger tables (this may take a while)...');
  await migrateLargeTable('agent_observations', agentObservations, neonDb);
  await migrateLargeTable('curriculum_drill_items', curriculumDrillItems, neonDb);
  
  // Verification
  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log('VERIFICATION:');
  console.log('══════════════════════════════════════════════════════════════════');
  
  const tables = [
    { name: 'learner_personal_facts', t: learnerPersonalFacts },
    { name: 'learner_memory_candidates', t: learnerMemoryCandidates },
    { name: 'daniela_growth_memories', t: danielaGrowthMemories },
    { name: 'lesson_drafts', t: lessonDrafts },
    { name: 'architect_notes', t: architectNotes },
    { name: 'agent_observations', t: agentObservations },
    { name: 'curriculum_drill_items', t: curriculumDrillItems },
  ];
  
  for (const { name, t } of tables) {
    const [local] = await db.select({ count: sql`count(*)::int` }).from(t);
    const [neon] = await neonDb.select({ count: sql`count(*)::int` }).from(t);
    const status = local.count === neon.count ? '✅' : '⚠️';
    console.log(`  ${name}: Replit=${local.count}, Neon=${neon.count} ${status}`);
  }
  
  console.log('\n✅ Migration complete!\n');
  
  process.exit(0);
}

main().catch((error) => {
  console.error('[MIGRATION] Fatal:', error);
  process.exit(1);
});
