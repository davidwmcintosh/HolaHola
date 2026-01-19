#!/usr/bin/env npx tsx
/**
 * Efficient migration for large tables - processes in batches with progress tracking
 */

import { db, getNeonSharedDb } from '../server/db';
import { agentObservations, curriculumDrillItems } from '@shared/schema';
import { sql, gt } from 'drizzle-orm';

async function migrateInBatches(
  tableName: string,
  table: any,
  neonDb: any,
  batchSize = 1000
) {
  console.log(`\n[${tableName}] Starting migration...`);
  
  // Get counts
  const [localCount] = await db.select({ count: sql<number>`count(*)::int` }).from(table);
  const [neonCount] = await neonDb.select({ count: sql<number>`count(*)::int` }).from(table);
  
  const gap = localCount.count - neonCount.count;
  console.log(`  Replit: ${localCount.count.toLocaleString()}, Neon: ${neonCount.count.toLocaleString()}, Gap: ${gap.toLocaleString()}`);
  
  if (gap <= 0) {
    console.log(`  ✅ Already synced!`);
    return { inserted: 0, errors: 0 };
  }
  
  // Get all IDs from Neon (in batches to avoid memory issues)
  console.log(`  Building ID set from Neon...`);
  const neonIdSet = new Set<number>();
  let idOffset = 0;
  const idBatchSize = 50000;
  
  while (true) {
    const batch = await neonDb
      .select({ id: table.id })
      .from(table)
      .limit(idBatchSize)
      .offset(idOffset);
    
    if (batch.length === 0) break;
    batch.forEach((r: any) => neonIdSet.add(r.id));
    idOffset += idBatchSize;
    
    if (idOffset % 500000 === 0) {
      console.log(`    Loaded ${neonIdSet.size.toLocaleString()} IDs...`);
    }
  }
  console.log(`  Loaded ${neonIdSet.size.toLocaleString()} Neon IDs`);
  
  // Process Replit data in batches, insert missing rows
  let inserted = 0;
  let errors = 0;
  let processed = 0;
  let lastId = 0;
  
  console.log(`  Migrating missing rows...`);
  
  while (true) {
    // Fetch batch from Replit ordered by ID
    const rows = await db
      .select()
      .from(table)
      .where(gt(table.id, lastId))
      .orderBy(table.id)
      .limit(batchSize);
    
    if (rows.length === 0) break;
    
    // Filter to only missing rows
    const missingRows = rows.filter((r: any) => !neonIdSet.has(r.id));
    
    // Insert in smaller batches
    for (const row of missingRows) {
      try {
        await neonDb.insert(table).values(row).onConflictDoNothing();
        inserted++;
      } catch (error: any) {
        if (errors < 3) {
          console.error(`    Error: ${error.message.substring(0, 80)}`);
        }
        errors++;
      }
    }
    
    lastId = rows[rows.length - 1].id;
    processed += rows.length;
    
    if (processed % 50000 === 0 || inserted % 5000 === 0) {
      console.log(`    Processed: ${processed.toLocaleString()}, Inserted: ${inserted.toLocaleString()}, Errors: ${errors}`);
    }
    
    // Early exit if we've inserted enough
    if (inserted >= gap + 1000) {
      console.log(`    Reached target, stopping early`);
      break;
    }
  }
  
  console.log(`  ✅ Complete: ${inserted.toLocaleString()} inserted, ${errors} errors`);
  return { inserted, errors };
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║  LARGE TABLE MIGRATION                                           ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  
  const neonDb = getNeonSharedDb();
  const startTime = Date.now();
  
  // Migrate agent_observations first (larger gap)
  const obs = await migrateInBatches('agent_observations', agentObservations, neonDb, 500);
  
  // Then curriculum_drill_items
  const drills = await migrateInBatches('curriculum_drill_items', curriculumDrillItems, neonDb, 500);
  
  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  
  // Final verification
  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log('FINAL STATUS:');
  console.log('══════════════════════════════════════════════════════════════════');
  
  const [obsLocal] = await db.select({ count: sql<number>`count(*)::int` }).from(agentObservations);
  const [obsNeon] = await neonDb.select({ count: sql<number>`count(*)::int` }).from(agentObservations);
  const [drillLocal] = await db.select({ count: sql<number>`count(*)::int` }).from(curriculumDrillItems);
  const [drillNeon] = await neonDb.select({ count: sql<number>`count(*)::int` }).from(curriculumDrillItems);
  
  console.log(`  agent_observations: Replit=${obsLocal.count.toLocaleString()}, Neon=${obsNeon.count.toLocaleString()} ${obsLocal.count === obsNeon.count ? '✅' : '⚠️'}`);
  console.log(`  curriculum_drill_items: Replit=${drillLocal.count.toLocaleString()}, Neon=${drillNeon.count.toLocaleString()} ${drillLocal.count === drillNeon.count ? '✅' : '⚠️'}`);
  console.log(`\n  Total time: ${elapsed} minutes`);
  console.log(`  Inserted: ${obs.inserted + drills.inserted} rows`);
  
  process.exit(0);
}

main().catch((error) => {
  console.error('[MIGRATION] Fatal:', error);
  process.exit(1);
});
