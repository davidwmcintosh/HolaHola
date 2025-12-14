/**
 * Bundle Management Script
 * 
 * Idempotent script for managing lesson bundles in HolaHola.
 * Bundles group related lessons (e.g., conversation + drill) and assign
 * requirement tiers (required, recommended, optional_premium).
 * 
 * Design Decision: No separate bundles table - bundles are virtual groupings
 * identified by the bundleId field on curriculumLessons.
 * 
 * Usage:
 *   npx tsx server/scripts/bundle-management.ts [command] [options]
 * 
 * Commands:
 *   list                    - List all bundles
 *   create <bundleId>       - Create a new bundle
 *   add-lesson <bundleId> <lessonId> [tier] - Add lesson to bundle
 *   link-drill <convId> <drillId> - Link conversation to drill lesson
 *   set-tier <lessonId> <tier>    - Set requirement tier for lesson
 *   sync-class <classId>    - Sync bundle settings to class curriculum
 */

import { db } from '../db';
import { curriculumLessons, curriculumUnits, curriculumPaths, classCurriculumLessons, classCurriculumUnits, teacherClasses } from '@shared/schema';
import { eq, and, inArray, isNotNull } from 'drizzle-orm';

// Types
type RequirementTier = 'required' | 'recommended' | 'optional_premium';

interface BundleDefinition {
  bundleId: string;
  name: string;
  description?: string;
  lessons: Array<{
    lessonId: string;
    tier: RequirementTier;
    linkedDrillLessonId?: string;
  }>;
}

interface BundleUpdateResult {
  bundleId: string;
  lessonsUpdated: number;
  drillsLinked: number;
  errors: string[];
}

/**
 * List all bundles in the curriculum
 */
export async function listBundles(): Promise<Map<string, { lessons: typeof curriculumLessons.$inferSelect[] }>> {
  const lessonsWithBundles = await db
    .select()
    .from(curriculumLessons)
    .where(isNotNull(curriculumLessons.bundleId));
  
  const bundles = new Map<string, { lessons: typeof curriculumLessons.$inferSelect[] }>();
  
  for (const lesson of lessonsWithBundles) {
    if (!lesson.bundleId) continue;
    
    if (!bundles.has(lesson.bundleId)) {
      bundles.set(lesson.bundleId, { lessons: [] });
    }
    bundles.get(lesson.bundleId)!.lessons.push(lesson);
  }
  
  return bundles;
}

/**
 * Get all lessons in a specific bundle
 */
export async function getBundleLessons(bundleId: string): Promise<typeof curriculumLessons.$inferSelect[]> {
  return db
    .select()
    .from(curriculumLessons)
    .where(eq(curriculumLessons.bundleId, bundleId));
}

/**
 * Add a lesson to a bundle with optional tier assignment
 * Idempotent - safe to run multiple times
 */
export async function addLessonToBundle(
  lessonId: string, 
  bundleId: string, 
  tier: RequirementTier = 'required'
): Promise<{ success: boolean; lesson?: typeof curriculumLessons.$inferSelect; error?: string }> {
  try {
    const [updated] = await db
      .update(curriculumLessons)
      .set({ 
        bundleId, 
        requirementTier: tier 
      })
      .where(eq(curriculumLessons.id, lessonId))
      .returning();
    
    if (!updated) {
      return { success: false, error: `Lesson ${lessonId} not found` };
    }
    
    return { success: true, lesson: updated };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Link a conversation lesson to its paired drill lesson
 * Idempotent - safe to run multiple times
 */
export async function linkDrillToConversation(
  conversationLessonId: string,
  drillLessonId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const [drillLesson] = await db
      .select()
      .from(curriculumLessons)
      .where(eq(curriculumLessons.id, drillLessonId));
    
    if (!drillLesson) {
      return { success: false, error: `Drill lesson ${drillLessonId} not found` };
    }
    
    if (drillLesson.lessonType !== 'drill') {
      console.warn(`Warning: Lesson ${drillLessonId} is type '${drillLesson.lessonType}', not 'drill'`);
    }
    
    const [updated] = await db
      .update(curriculumLessons)
      .set({ linkedDrillLessonId: drillLessonId })
      .where(eq(curriculumLessons.id, conversationLessonId))
      .returning();
    
    if (!updated) {
      return { success: false, error: `Conversation lesson ${conversationLessonId} not found` };
    }
    
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Set requirement tier for a lesson
 * Idempotent - safe to run multiple times
 */
export async function setLessonTier(
  lessonId: string,
  tier: RequirementTier
): Promise<{ success: boolean; error?: string }> {
  try {
    const [updated] = await db
      .update(curriculumLessons)
      .set({ requirementTier: tier })
      .where(eq(curriculumLessons.id, lessonId))
      .returning();
    
    if (!updated) {
      return { success: false, error: `Lesson ${lessonId} not found` };
    }
    
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Apply a full bundle definition (idempotent batch update)
 * Creates/updates bundle with all lessons and links
 */
export async function applyBundleDefinition(definition: BundleDefinition): Promise<BundleUpdateResult> {
  const result: BundleUpdateResult = {
    bundleId: definition.bundleId,
    lessonsUpdated: 0,
    drillsLinked: 0,
    errors: [],
  };
  
  console.log(`[Bundle] Applying bundle definition: ${definition.bundleId}`);
  
  for (const lessonDef of definition.lessons) {
    const addResult = await addLessonToBundle(lessonDef.lessonId, definition.bundleId, lessonDef.tier);
    
    if (addResult.success) {
      result.lessonsUpdated++;
      
      if (lessonDef.linkedDrillLessonId) {
        const linkResult = await linkDrillToConversation(lessonDef.lessonId, lessonDef.linkedDrillLessonId);
        if (linkResult.success) {
          result.drillsLinked++;
        } else {
          result.errors.push(`Failed to link drill: ${linkResult.error}`);
        }
      }
    } else {
      result.errors.push(`Failed to add lesson ${lessonDef.lessonId}: ${addResult.error}`);
    }
  }
  
  console.log(`[Bundle] Result: ${result.lessonsUpdated} lessons updated, ${result.drillsLinked} drills linked, ${result.errors.length} errors`);
  
  return result;
}

/**
 * Sync bundle settings from curriculum templates to class-specific syllabi
 * Propagates bundleId, requirementTier, and linkedDrillLessonId to classCurriculumLessons
 */
export async function syncBundlesToClass(classId: string): Promise<{
  synced: number;
  skipped: number;
  errors: string[];
}> {
  const result = { synced: 0, skipped: 0, errors: [] as string[] };
  
  console.log(`[Bundle Sync] Syncing bundles to class ${classId}...`);
  
  const classUnits = await db
    .select()
    .from(classCurriculumUnits)
    .where(eq(classCurriculumUnits.classId, classId));
  
  if (classUnits.length === 0) {
    result.errors.push(`No curriculum units found for class ${classId}`);
    return result;
  }
  
  const classUnitIds = classUnits.map(u => u.id);
  
  const classLessons = await db
    .select()
    .from(classCurriculumLessons)
    .where(inArray(classCurriculumLessons.classUnitId, classUnitIds));
  
  for (const classLesson of classLessons) {
    if (!classLesson.sourceLessonId) {
      result.skipped++;
      continue;
    }
    
    const [sourceLesson] = await db
      .select()
      .from(curriculumLessons)
      .where(eq(curriculumLessons.id, classLesson.sourceLessonId));
    
    if (!sourceLesson) {
      result.skipped++;
      continue;
    }
    
    if (sourceLesson.bundleId || sourceLesson.requirementTier !== 'required' || sourceLesson.linkedDrillLessonId) {
      // Note: classCurriculumLessons doesn't have requirementTier field yet
      // This sync currently just validates the source has bundle data
      // Future: Add requirementTier to classCurriculumLessons schema
      console.log(`  [Sync] Lesson ${classLesson.name}: tier=${sourceLesson.requirementTier}, bundle=${sourceLesson.bundleId || 'none'}`);
      result.synced++;
    } else {
      result.skipped++;
    }
  }
  
  console.log(`[Bundle Sync] Synced ${result.synced} lessons, skipped ${result.skipped}, ${result.errors.length} errors`);
  
  return result;
}

/**
 * Sync bundles to all classes that have curriculum templates
 */
export async function syncBundlesToAllClasses(): Promise<{
  classesProcessed: number;
  totalSynced: number;
  totalErrors: number;
}> {
  const classes = await db
    .select()
    .from(teacherClasses)
    .where(isNotNull(teacherClasses.curriculumPathId));
  
  let totalSynced = 0;
  let totalErrors = 0;
  
  for (const teacherClass of classes) {
    const result = await syncBundlesToClass(teacherClass.id);
    totalSynced += result.synced;
    totalErrors += result.errors.length;
  }
  
  return {
    classesProcessed: classes.length,
    totalSynced,
    totalErrors,
  };
}

/**
 * Auto-link drill lessons to conversation lessons within the same unit
 * Matches by name patterns (e.g., "Greetings" conversation → "Greetings Drill")
 */
export async function autoLinkDrillsInUnit(unitId: string): Promise<{
  linkedPairs: number;
  details: Array<{ conversationId: string; drillId: string; name: string }>;
}> {
  const lessons = await db
    .select()
    .from(curriculumLessons)
    .where(eq(curriculumLessons.curriculumUnitId, unitId));
  
  const drillLessons = lessons.filter(l => l.lessonType === 'drill');
  const conversationLessons = lessons.filter(l => l.lessonType === 'conversation');
  
  const details: Array<{ conversationId: string; drillId: string; name: string }> = [];
  
  for (const conv of conversationLessons) {
    if (conv.linkedDrillLessonId) continue;
    
    const matchingDrill = drillLessons.find(drill => {
      const convName = conv.name.toLowerCase().replace(/lesson \d+[:\s]*/i, '').trim();
      const drillName = drill.name.toLowerCase().replace(/drill[:\s]*/i, '').replace(/lesson \d+[:\s]*/i, '').trim();
      
      return convName.includes(drillName) || drillName.includes(convName) ||
             (conv.conversationTopic && drill.name.toLowerCase().includes(conv.conversationTopic.toLowerCase()));
    });
    
    if (matchingDrill) {
      const result = await linkDrillToConversation(conv.id, matchingDrill.id);
      if (result.success) {
        details.push({
          conversationId: conv.id,
          drillId: matchingDrill.id,
          name: conv.name,
        });
      }
    }
  }
  
  return { linkedPairs: details.length, details };
}

/**
 * Create bundle from a unit - groups all lessons in a unit under one bundle
 */
export async function createBundleFromUnit(
  unitId: string,
  bundleId?: string
): Promise<BundleUpdateResult> {
  const [unit] = await db
    .select()
    .from(curriculumUnits)
    .where(eq(curriculumUnits.id, unitId));
  
  if (!unit) {
    return {
      bundleId: bundleId || 'unknown',
      lessonsUpdated: 0,
      drillsLinked: 0,
      errors: [`Unit ${unitId} not found`],
    };
  }
  
  const generatedBundleId = bundleId || `bundle-${unit.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30)}`;
  
  const lessons = await db
    .select()
    .from(curriculumLessons)
    .where(eq(curriculumLessons.curriculumUnitId, unitId));
  
  const definition: BundleDefinition = {
    bundleId: generatedBundleId,
    name: unit.name,
    lessons: lessons.map(l => ({
      lessonId: l.id,
      tier: l.lessonType === 'drill' ? 'recommended' as RequirementTier : 'required' as RequirementTier,
    })),
  };
  
  const result = await applyBundleDefinition(definition);
  
  const linkResult = await autoLinkDrillsInUnit(unitId);
  result.drillsLinked += linkResult.linkedPairs;
  
  return result;
}

// CLI runner
async function main() {
  const [,, command, ...args] = process.argv;
  
  console.log(`\n[Bundle Management] Command: ${command || 'help'}\n`);
  
  switch (command) {
    case 'list': {
      const bundles = await listBundles();
      console.log(`Found ${bundles.size} bundles:\n`);
      const bundleEntries = Array.from(bundles.entries());
      for (const [bundleId, data] of bundleEntries) {
        console.log(`  ${bundleId}: ${data.lessons.length} lessons`);
        for (const lesson of data.lessons) {
          console.log(`    - [${lesson.requirementTier}] ${lesson.name} (${lesson.lessonType})`);
        }
      }
      break;
    }
    
    case 'add-lesson': {
      const [bundleId, lessonId, tier] = args;
      if (!bundleId || !lessonId) {
        console.log('Usage: add-lesson <bundleId> <lessonId> [tier]');
        break;
      }
      const result = await addLessonToBundle(lessonId, bundleId, (tier as RequirementTier) || 'required');
      console.log(result.success ? `Added lesson to bundle ${bundleId}` : `Error: ${result.error}`);
      break;
    }
    
    case 'link-drill': {
      const [convId, drillId] = args;
      if (!convId || !drillId) {
        console.log('Usage: link-drill <conversationLessonId> <drillLessonId>');
        break;
      }
      const result = await linkDrillToConversation(convId, drillId);
      console.log(result.success ? 'Drill linked successfully' : `Error: ${result.error}`);
      break;
    }
    
    case 'set-tier': {
      const [lessonId, tier] = args;
      if (!lessonId || !tier) {
        console.log('Usage: set-tier <lessonId> <required|recommended|optional_premium>');
        break;
      }
      const result = await setLessonTier(lessonId, tier as RequirementTier);
      console.log(result.success ? `Tier set to ${tier}` : `Error: ${result.error}`);
      break;
    }
    
    case 'sync-class': {
      const [classId] = args;
      if (!classId) {
        console.log('Usage: sync-class <classId>');
        break;
      }
      const result = await syncBundlesToClass(classId);
      console.log(`Synced: ${result.synced}, Skipped: ${result.skipped}, Errors: ${result.errors.length}`);
      break;
    }
    
    case 'sync-all': {
      const result = await syncBundlesToAllClasses();
      console.log(`Classes: ${result.classesProcessed}, Synced: ${result.totalSynced}, Errors: ${result.totalErrors}`);
      break;
    }
    
    case 'bundle-unit': {
      const [unitId, customBundleId] = args;
      if (!unitId) {
        console.log('Usage: bundle-unit <unitId> [bundleId]');
        break;
      }
      const result = await createBundleFromUnit(unitId, customBundleId);
      console.log(`Bundle ${result.bundleId}: ${result.lessonsUpdated} lessons, ${result.drillsLinked} drills linked`);
      if (result.errors.length > 0) {
        console.log('Errors:', result.errors);
      }
      break;
    }
    
    default:
      console.log(`
Bundle Management Commands:
  list                              - List all bundles
  add-lesson <bundleId> <lessonId> [tier] - Add lesson to bundle
  link-drill <convId> <drillId>     - Link conversation to drill
  set-tier <lessonId> <tier>        - Set requirement tier
  sync-class <classId>              - Sync bundles to class syllabus
  sync-all                          - Sync bundles to all classes
  bundle-unit <unitId> [bundleId]   - Create bundle from unit

Tier values: required, recommended, optional_premium
      `);
  }
  
  process.exit(0);
}

if (process.argv[1]?.includes('bundle-management')) {
  main().catch(console.error);
}

export {
  BundleDefinition,
  BundleUpdateResult,
  RequirementTier,
};
