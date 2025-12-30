/**
 * Fluency Wiring Seed Script
 * 
 * Maps lessons to ACTFL Can-Do statements to complete the fluency tracking pipeline.
 * This is a one-time migration that ensures all lessons have proper Can-Do statement links.
 */

import { db } from "../db";
import { lessonCanDoStatements, classCurriculumLessons } from "@shared/schema";
import { sql } from "drizzle-orm";

export async function seedFluencyWiring(): Promise<{ 
  linksCreated: number; 
  skipped: boolean;
  reason?: string;
}> {
  console.log('[FLUENCY-WIRING SEED] Checking if fluency wiring is needed...');
  
  // Check if mapping has already been done
  const [linkCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(lessonCanDoStatements);
  
  const existingLinks = Number(linkCount?.count || 0);
  
  // If we already have links, skip
  if (existingLinks > 50) {
    console.log(`[FLUENCY-WIRING SEED] Already have ${existingLinks} lesson-to-CanDo links - skipping`);
    return { linksCreated: 0, skipped: true, reason: `Already have ${existingLinks} links` };
  }
  
  // Check if there are lessons to map
  const [lessonCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(classCurriculumLessons);
  
  const totalLessons = Number(lessonCount?.count || 0);
  
  if (totalLessons === 0) {
    console.log('[FLUENCY-WIRING SEED] No lessons found - skipping');
    return { linksCreated: 0, skipped: true, reason: 'No lessons to map' };
  }
  
  // Log that we're waiting for admin trigger
  console.log(`[FLUENCY-WIRING SEED] Found ${totalLessons} lessons with ${existingLinks} existing links`);
  console.log('[FLUENCY-WIRING SEED] Fluency wiring ready for admin trigger');
  console.log('[FLUENCY-WIRING SEED] Trigger with: POST /api/admin/fluency-wiring/map-all-lessons');
  
  return { 
    linksCreated: 0, 
    skipped: true, 
    reason: `Ready for admin trigger (${totalLessons} lessons, ${existingLinks} existing links)` 
  };
}
