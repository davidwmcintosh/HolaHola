#!/usr/bin/env npx tsx
/**
 * Compare data between Replit DB and Neon Shared DB
 * 
 * Identifies tables where Replit has data that Neon is missing.
 * This helps identify data that needs migration for proper Neon routing.
 * 
 * Run: npx tsx scripts/compare-replit-neon-data.ts
 */

import { db, getNeonSharedDb } from '../server/db';
import { sql } from 'drizzle-orm';
import { SHARED_TABLES } from '../server/neon-db';

interface TableComparison {
  table: string;
  replitCount: number;
  neonCount: number;
  difference: number;
  status: 'OK' | 'MISSING_IN_NEON' | 'NEON_ONLY' | 'MISMATCH';
}

async function countTableRows(database: any, tableName: string): Promise<number> {
  try {
    const result = await database.execute(sql.raw(`SELECT COUNT(*) as count FROM "${tableName}"`));
    const rows = result.rows || result;
    if (rows && rows.length > 0) {
      return parseInt(rows[0].count || '0', 10);
    }
    return 0;
  } catch (error: any) {
    if (error.code === '42P01') { // Table doesn't exist
      return -1;
    }
    console.error(`Error counting ${tableName}:`, error.message);
    return -1;
  }
}

async function compareAllSharedTables() {
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║         REPLIT DB vs NEON SHARED DB COMPARISON                   ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');
  
  const neonDb = getNeonSharedDb();
  const comparisons: TableComparison[] = [];
  const tablesNeedingMigration: string[] = [];
  
  const sharedTables = Array.from(SHARED_TABLES).sort();
  
  console.log(`Comparing ${sharedTables.length} shared tables...\n`);
  
  for (const tableName of sharedTables) {
    const replitCount = await countTableRows(db, tableName);
    const neonCount = await countTableRows(neonDb, tableName);
    
    let status: TableComparison['status'] = 'OK';
    let difference = 0;
    
    if (replitCount === -1 && neonCount === -1) {
      // Table doesn't exist in either
      continue;
    } else if (replitCount > 0 && neonCount === 0) {
      status = 'MISSING_IN_NEON';
      difference = replitCount;
      tablesNeedingMigration.push(tableName);
    } else if (replitCount === 0 && neonCount > 0) {
      status = 'NEON_ONLY';
      difference = -neonCount;
    } else if (replitCount !== neonCount) {
      status = 'MISMATCH';
      difference = replitCount - neonCount;
      if (difference > 0) {
        tablesNeedingMigration.push(tableName);
      }
    }
    
    comparisons.push({
      table: tableName,
      replitCount: replitCount === -1 ? 0 : replitCount,
      neonCount: neonCount === -1 ? 0 : neonCount,
      difference,
      status,
    });
  }
  
  // Print summary table
  console.log('┌─────────────────────────────────┬──────────┬──────────┬──────────┬───────────────────┐');
  console.log('│ Table                           │ Replit   │ Neon     │ Diff     │ Status            │');
  console.log('├─────────────────────────────────┼──────────┼──────────┼──────────┼───────────────────┤');
  
  for (const comp of comparisons) {
    const tablePadded = comp.table.padEnd(31);
    const replitPadded = comp.replitCount.toString().padStart(8);
    const neonPadded = comp.neonCount.toString().padStart(8);
    const diffPadded = (comp.difference > 0 ? '+' + comp.difference : comp.difference.toString()).padStart(8);
    
    let statusIcon = '';
    switch (comp.status) {
      case 'OK':
        statusIcon = '✅ OK';
        break;
      case 'MISSING_IN_NEON':
        statusIcon = '❌ MISSING IN NEON';
        break;
      case 'NEON_ONLY':
        statusIcon = '📦 NEON ONLY';
        break;
      case 'MISMATCH':
        statusIcon = '⚠️  MISMATCH';
        break;
    }
    
    console.log(`│ ${tablePadded}│ ${replitPadded} │ ${neonPadded} │ ${diffPadded} │ ${statusIcon.padEnd(17)} │`);
  }
  
  console.log('└─────────────────────────────────┴──────────┴──────────┴──────────┴───────────────────┘\n');
  
  // Summary
  const totalReplit = comparisons.reduce((sum, c) => sum + c.replitCount, 0);
  const totalNeon = comparisons.reduce((sum, c) => sum + c.neonCount, 0);
  const okCount = comparisons.filter(c => c.status === 'OK').length;
  const missingCount = comparisons.filter(c => c.status === 'MISSING_IN_NEON').length;
  const mismatchCount = comparisons.filter(c => c.status === 'MISMATCH').length;
  
  console.log('══════════════════════════════════════════════════════════════════');
  console.log('SUMMARY:');
  console.log(`  Total Replit rows:    ${totalReplit.toLocaleString()}`);
  console.log(`  Total Neon rows:      ${totalNeon.toLocaleString()}`);
  console.log(`  Tables OK:            ${okCount}`);
  console.log(`  Tables missing:       ${missingCount}`);
  console.log(`  Tables mismatched:    ${mismatchCount}`);
  console.log('══════════════════════════════════════════════════════════════════\n');
  
  if (tablesNeedingMigration.length > 0) {
    console.log('🔴 TABLES NEEDING MIGRATION TO NEON:');
    for (const table of tablesNeedingMigration) {
      const comp = comparisons.find(c => c.table === table);
      console.log(`   - ${table}: ${comp?.replitCount} rows in Replit, ${comp?.neonCount} in Neon`);
    }
    console.log('');
  } else {
    console.log('✅ All shared tables are in sync!\n');
  }
  
  process.exit(0);
}

compareAllSharedTables().catch((error) => {
  console.error('[COMPARE] Fatal error:', error);
  process.exit(1);
});
