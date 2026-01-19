#!/usr/bin/env npx tsx
/**
 * Migrate Express Lane data from Replit DB to Neon Shared DB
 * 
 * This script copies founder_sessions and collaboration_messages from the local
 * Replit database to the Neon shared database for cross-environment access.
 * 
 * Run: npx tsx scripts/migrate-express-lane-to-neon.ts
 */

import { db, getNeonSharedDb } from '../server/db';
import { founderSessions, collaborationMessages } from '@shared/schema';
import { eq } from 'drizzle-orm';

async function migrateExpressLaneData() {
  console.log('[MIGRATION] Starting Express Lane data migration to Neon...\n');
  
  const neonDb = getNeonSharedDb();
  
  // Step 1: Migrate founder_sessions
  console.log('[MIGRATION] Fetching founder sessions from Replit DB...');
  const localSessions = await db.select().from(founderSessions);
  console.log(`[MIGRATION] Found ${localSessions.length} founder sessions in Replit DB`);
  
  let sessionsInserted = 0;
  let sessionsSkipped = 0;
  
  for (const session of localSessions) {
    try {
      // Check if already exists in Neon
      const existing = await neonDb.select({ id: founderSessions.id })
        .from(founderSessions)
        .where(eq(founderSessions.id, session.id))
        .limit(1);
      
      if (existing.length > 0) {
        sessionsSkipped++;
        continue;
      }
      
      // Insert into Neon
      await neonDb.insert(founderSessions).values(session);
      sessionsInserted++;
    } catch (error: any) {
      if (error.code === '23505') { // duplicate key
        sessionsSkipped++;
      } else {
        console.error(`[MIGRATION] Error inserting session ${session.id}:`, error.message);
      }
    }
  }
  
  console.log(`[MIGRATION] Sessions: ${sessionsInserted} inserted, ${sessionsSkipped} skipped (already exist)\n`);
  
  // Step 2: Migrate collaboration_messages
  console.log('[MIGRATION] Fetching collaboration messages from Replit DB...');
  const localMessages = await db.select().from(collaborationMessages);
  console.log(`[MIGRATION] Found ${localMessages.length} collaboration messages in Replit DB`);
  
  let messagesInserted = 0;
  let messagesSkipped = 0;
  
  // Batch insert in chunks
  const chunkSize = 100;
  for (let i = 0; i < localMessages.length; i += chunkSize) {
    const chunk = localMessages.slice(i, i + chunkSize);
    
    for (const message of chunk) {
      try {
        // Check if already exists
        const existing = await neonDb.select({ id: collaborationMessages.id })
          .from(collaborationMessages)
          .where(eq(collaborationMessages.id, message.id))
          .limit(1);
        
        if (existing.length > 0) {
          messagesSkipped++;
          continue;
        }
        
        // Insert into Neon
        await neonDb.insert(collaborationMessages).values(message);
        messagesInserted++;
      } catch (error: any) {
        if (error.code === '23505') { // duplicate key
          messagesSkipped++;
        } else {
          console.error(`[MIGRATION] Error inserting message ${message.id}:`, error.message);
        }
      }
    }
    
    // Progress update every chunk
    const processed = Math.min(i + chunkSize, localMessages.length);
    console.log(`[MIGRATION] Progress: ${processed}/${localMessages.length} messages processed...`);
  }
  
  console.log(`\n[MIGRATION] Messages: ${messagesInserted} inserted, ${messagesSkipped} skipped (already exist)\n`);
  
  // Verification
  console.log('[MIGRATION] Verifying Neon data...');
  const neonSessions = await neonDb.select({ id: founderSessions.id }).from(founderSessions);
  const neonMessages = await neonDb.select({ id: collaborationMessages.id }).from(collaborationMessages);
  
  console.log(`[MIGRATION] Neon shared DB now has:`);
  console.log(`  - ${neonSessions.length} founder sessions`);
  console.log(`  - ${neonMessages.length} collaboration messages`);
  
  console.log('\n[MIGRATION] ✓ Express Lane data migration complete!');
  
  process.exit(0);
}

migrateExpressLaneData().catch((error) => {
  console.error('[MIGRATION] Fatal error:', error);
  process.exit(1);
});
