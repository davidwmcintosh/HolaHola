#!/usr/bin/env npx tsx
/**
 * Comprehensive migration of all shared tables from Replit DB to Neon Shared DB
 * 
 * Migrates all tables identified as missing or mismatched.
 * Uses UPSERT logic to avoid duplicates.
 * 
 * Run: npx tsx scripts/migrate-all-shared-to-neon.ts
 */

import { db, getNeonSharedDb } from '../server/db';
import { sql } from 'drizzle-orm';

const TABLES_TO_MIGRATE = [
  // Priority 1: Express Lane (order matters for FK constraints)
  'founder_sessions',
  'collaboration_messages',
  'hive_snapshots',
  'feature_sprints',
  
  // Priority 2: Daniela's memory
  'learner_personal_facts',
  'learner_memory_candidates',
  'daniela_growth_memories',
  'compass_principles',
  
  // Priority 3: Curriculum
  'curriculum_drill_items',
  'lesson_drafts',
  
  // Priority 4: Other
  'architect_notes',
  'wren_predictions',
  'agent_observations',
];

async function getTableColumns(database: any, tableName: string): Promise<string[]> {
  const result = await database.execute(sql.raw(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = '${tableName}'
    ORDER BY ordinal_position
  `));
  const rows = result.rows || result;
  return rows.map((row: any) => row.column_name);
}

async function migrateTable(tableName: string, batchSize = 500): Promise<{ inserted: number; skipped: number; errors: number }> {
  const neonDb = getNeonSharedDb();
  
  console.log(`\n[MIGRATE] Starting ${tableName}...`);
  
  // Get column names for this table
  const columns = await getTableColumns(db, tableName);
  if (columns.length === 0) {
    console.log(`[MIGRATE] Table ${tableName} not found in Replit DB`);
    return { inserted: 0, skipped: 0, errors: 0 };
  }
  
  // Fetch all data from Replit
  const result = await db.execute(sql.raw(`SELECT * FROM "${tableName}"`));
  const rows = result.rows || result;
  console.log(`[MIGRATE] Found ${rows.length} rows in Replit DB`);
  
  if (rows.length === 0) {
    return { inserted: 0, skipped: 0, errors: 0 };
  }
  
  let inserted = 0;
  let skipped = 0;
  let errors = 0;
  
  // Process in batches
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    
    for (const row of batch) {
      try {
        // Build column list and values
        const colList = columns.join('", "');
        const values = columns.map(col => {
          const val = row[col];
          if (val === null || val === undefined) return 'NULL';
          if (typeof val === 'boolean') return val ? 'true' : 'false';
          if (typeof val === 'number') return val.toString();
          if (val instanceof Date) return `'${val.toISOString()}'`;
          if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
          return `'${String(val).replace(/'/g, "''")}'`;
        }).join(', ');
        
        // Use INSERT ... ON CONFLICT DO NOTHING
        const insertSql = `INSERT INTO "${tableName}" ("${colList}") VALUES (${values}) ON CONFLICT DO NOTHING`;
        
        await neonDb.execute(sql.raw(insertSql));
        inserted++;
      } catch (error: any) {
        if (error.code === '23505') { // duplicate key
          skipped++;
        } else if (error.code === '23503') { // foreign key violation
          // Skip silently for FK issues
          errors++;
        } else {
          console.error(`[MIGRATE] Error in ${tableName}:`, error.message?.substring(0, 100));
          errors++;
        }
      }
    }
    
    // Progress update
    const processed = Math.min(i + batchSize, rows.length);
    if (processed % 1000 === 0 || processed === rows.length) {
      console.log(`[MIGRATE] Progress: ${processed}/${rows.length} (${inserted} inserted, ${skipped} skipped)`);
    }
  }
  
  console.log(`[MIGRATE] ${tableName}: ${inserted} inserted, ${skipped} skipped, ${errors} errors`);
  return { inserted, skipped, errors };
}

async function migrateAllSharedData() {
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║      COMPREHENSIVE NEON SHARED DATABASE MIGRATION                ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');
  
  const results: { table: string; inserted: number; skipped: number; errors: number }[] = [];
  
  for (const table of TABLES_TO_MIGRATE) {
    const result = await migrateTable(table);
    results.push({ table, ...result });
  }
  
  // Summary
  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log('MIGRATION SUMMARY:');
  console.log('══════════════════════════════════════════════════════════════════');
  
  let totalInserted = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  
  for (const r of results) {
    if (r.inserted > 0 || r.errors > 0) {
      console.log(`  ${r.table}: ${r.inserted} inserted, ${r.skipped} skipped, ${r.errors} errors`);
    }
    totalInserted += r.inserted;
    totalSkipped += r.skipped;
    totalErrors += r.errors;
  }
  
  console.log('──────────────────────────────────────────────────────────────────');
  console.log(`  TOTAL: ${totalInserted} inserted, ${totalSkipped} skipped, ${totalErrors} errors`);
  console.log('══════════════════════════════════════════════════════════════════\n');
  
  if (totalErrors > 0) {
    console.log('⚠️  Some errors occurred. You may need to run again or check FK constraints.');
  } else {
    console.log('✅ Migration complete!');
  }
  
  process.exit(0);
}

migrateAllSharedData().catch((error) => {
  console.error('[MIGRATION] Fatal error:', error);
  process.exit(1);
});
