/**
 * One-off script to drop cross-database FK constraints from SHARED Neon database
 * Run with: npx tsx server/scripts/drop-shared-fk.ts
 */

import { sql } from 'drizzle-orm';
import { getSharedDb } from '../db';

async function dropCrossDatabaseFKs() {
  console.log('[FK Cleanup] Dropping cross-database FK constraints from SHARED database...');
  
  const sharedDb = getSharedDb();
  
  // List of FK constraints to drop (tables in SHARED that reference tables in USER)
  const constraintsToDrop = [
    { table: 'collaboration_channels', constraint: 'collaboration_channels_user_id_users_id_fk' },
    { table: 'collaboration_channels', constraint: 'collaboration_channels_conversation_id_conversations_id_fk' },
  ];
  
  for (const { table, constraint } of constraintsToDrop) {
    try {
      await sharedDb.execute(sql.raw(`ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS ${constraint}`));
      console.log(`[FK Cleanup] ✓ Dropped ${constraint}`);
    } catch (err: any) {
      console.log(`[FK Cleanup] ⚠ ${constraint}: ${err.message}`);
    }
  }
  
  console.log('[FK Cleanup] Complete!');
  process.exit(0);
}

dropCrossDatabaseFKs().catch(err => {
  console.error('[FK Cleanup] Error:', err);
  process.exit(1);
});
