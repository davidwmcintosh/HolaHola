#!/usr/bin/env npx tsx
/**
 * Fast migration using SQL-side diffing - only fetches missing rows
 * Handles UUID primary keys
 */

import { db, getNeonSharedDb } from '../server/db';
import { agentObservations, curriculumDrillItems } from '@shared/schema';
import { sql, inArray } from 'drizzle-orm';

async function getMissingIds(
  tableName: string,
  neonDb: any,
  batchSize = 10000
): Promise<string[]> {
  console.log(`[${tableName}] Finding missing IDs...`);
  
  // Get all IDs from both databases in batches
  const localIds = new Set<string>();
  const neonIds = new Set<string>();
  
  // Fetch local IDs
  console.log(`  Fetching Replit IDs...`);
  let offset = 0;
  while (true) {
    const result = await db.execute(sql.raw(
      `SELECT id FROM "${tableName}" ORDER BY id LIMIT ${batchSize} OFFSET ${offset}`
    ));
    const rows = (result as any).rows || result;
    if (rows.length === 0) break;
    rows.forEach((r: any) => localIds.add(r.id));
    offset += batchSize;
    if (offset % 100000 === 0) console.log(`    ${localIds.size.toLocaleString()} IDs loaded...`);
  }
  console.log(`  Replit: ${localIds.size.toLocaleString()} IDs`);
  
  // Fetch Neon IDs
  console.log(`  Fetching Neon IDs...`);
  offset = 0;
  while (true) {
    const result = await neonDb.execute(sql.raw(
      `SELECT id FROM "${tableName}" ORDER BY id LIMIT ${batchSize} OFFSET ${offset}`
    ));
    const rows = (result as any).rows || result;
    if (rows.length === 0) break;
    rows.forEach((r: any) => neonIds.add(r.id));
    offset += batchSize;
    if (offset % 100000 === 0) console.log(`    ${neonIds.size.toLocaleString()} IDs loaded...`);
  }
  console.log(`  Neon: ${neonIds.size.toLocaleString()} IDs`);
  
  // Find missing
  const missing: string[] = [];
  for (const id of localIds) {
    if (!neonIds.has(id)) {
      missing.push(id);
    }
  }
  
  console.log(`  Missing: ${missing.length.toLocaleString()}`);
  return missing;
}

async function migrateByIds(
  tableName: string,
  table: any,
  neonDb: any,
  ids: string[],
  batchSize = 50
): Promise<{ inserted: number; errors: number }> {
  if (ids.length === 0) {
    console.log(`[${tableName}] No missing rows to migrate`);
    return { inserted: 0, errors: 0 };
  }
  
  console.log(`[${tableName}] Migrating ${ids.length.toLocaleString()} missing rows...`);
  
  let inserted = 0;
  let errors = 0;
  
  for (let i = 0; i < ids.length; i += batchSize) {
    const batchIds = ids.slice(i, i + batchSize);
    
    // Fetch rows from Replit
    const rows = await db.select().from(table).where(inArray(table.id, batchIds));
    
    // Insert to Neon one by one to handle conflicts
    for (const row of rows) {
      try {
        await neonDb.insert(table).values(row).onConflictDoNothing();
        inserted++;
      } catch (error: any) {
        if (errors < 3) console.error(`  Error: ${error.message.substring(0, 80)}`);
        errors++;
      }
    }
    
    if ((i + batchSize) % 500 === 0 || i + batchSize >= ids.length) {
      console.log(`  Progress: ${Math.min(i + batchSize, ids.length).toLocaleString()}/${ids.length.toLocaleString()} (${inserted.toLocaleString()} inserted)`);
    }
  }
  
  console.log(`  ✅ Complete: ${inserted.toLocaleString()} inserted, ${errors} errors`);
  return { inserted, errors };
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║  FAST MIGRATION (SQL-side diffing)                               ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  
  const neonDb = getNeonSharedDb();
  const startTime = Date.now();
  
  // agent_observations
  const obsMissingIds = await getMissingIds('agent_observations', neonDb);
  await migrateByIds('agent_observations', agentObservations, neonDb, obsMissingIds);
  
  // curriculum_drill_items
  const drillMissingIds = await getMissingIds('curriculum_drill_items', neonDb);
  await migrateByIds('curriculum_drill_items', curriculumDrillItems, neonDb, drillMissingIds);
  
  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  
  // Final verification
  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log('FINAL STATUS:');
  
  const [obsLocal] = await db.select({ count: sql<number>`count(*)::int` }).from(agentObservations);
  const [obsNeon] = await neonDb.select({ count: sql<number>`count(*)::int` }).from(agentObservations);
  const [drillLocal] = await db.select({ count: sql<number>`count(*)::int` }).from(curriculumDrillItems);
  const [drillNeon] = await neonDb.select({ count: sql<number>`count(*)::int` }).from(curriculumDrillItems);
  
  console.log(`  agent_observations: ${obsLocal.count.toLocaleString()} vs ${obsNeon.count.toLocaleString()} ${obsLocal.count === obsNeon.count ? '✅' : `gap: ${obsLocal.count - obsNeon.count}`}`);
  console.log(`  curriculum_drill_items: ${drillLocal.count.toLocaleString()} vs ${drillNeon.count.toLocaleString()} ${drillLocal.count === drillNeon.count ? '✅' : `gap: ${drillLocal.count - drillNeon.count}`}`);
  console.log(`  Time: ${elapsed} minutes`);
  
  process.exit(0);
}

main().catch((error) => {
  console.error('[MIGRATION] Fatal:', error);
  process.exit(1);
});
