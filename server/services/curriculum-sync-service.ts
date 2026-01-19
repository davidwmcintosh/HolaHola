import { db, getSharedDb } from "../db";
import { 
  teacherClasses,
  curriculumPaths,
  curriculumUnits,
  curriculumLessons,
  classCurriculumUnits,
  classCurriculumLessons
} from "@shared/schema";
import { eq, and, sql, inArray, isNull } from "drizzle-orm";

interface SyncResult {
  classId: string;
  className: string;
  unitsAdded: number;
  lessonsAdded: number;
  errors: string[];
}

interface SyncPreview {
  classId: string;
  className: string;
  language: string;
  currentLessons: number;
  availableLessons: number;
  missingUnits: { id: string; name: string; lessonCount: number }[];
  missingLessons: { id: string; name: string; unitName: string }[];
}

export async function previewClassSync(classId: string): Promise<SyncPreview | null> {
  const [teacherClass] = await db
    .select()
    .from(teacherClasses)
    .where(eq(teacherClasses.id, classId));
  
  if (!teacherClass || !teacherClass.curriculumPathId) {
    return null;
  }
  
  const masterUnits = await getSharedDb()
    .select()
    .from(curriculumUnits)
    .where(eq(curriculumUnits.curriculumPathId, teacherClass.curriculumPathId));
  
  // Get ALL class units (including removed) to align preview with sync behavior
  const classUnits = await db
    .select()
    .from(classCurriculumUnits)
    .where(eq(classCurriculumUnits.classId, classId));
  
  // Include removed units in the set - sync skips them too
  const existingSourceUnitIds = new Set(classUnits.map(u => u.sourceUnitId).filter(Boolean));
  const activeClassUnits = classUnits.filter(u => !u.isRemoved);
  
  const missingUnits: SyncPreview['missingUnits'] = [];
  const missingLessons: SyncPreview['missingLessons'] = [];
  
  for (const masterUnit of masterUnits) {
    if (!existingSourceUnitIds.has(masterUnit.id)) {
      const lessons = await getSharedDb()
        .select({ count: sql<number>`count(*)::int` })
        .from(curriculumLessons)
        .where(eq(curriculumLessons.curriculumUnitId, masterUnit.id));
      
      missingUnits.push({
        id: masterUnit.id,
        name: masterUnit.name,
        lessonCount: lessons[0]?.count || 0
      });
    } else {
      const classUnit = activeClassUnits.find(u => u.sourceUnitId === masterUnit.id);
      if (!classUnit) continue; // Unit exists but is removed - skip
      
      const masterLessons = await getSharedDb()
        .select()
        .from(curriculumLessons)
        .where(eq(curriculumLessons.curriculumUnitId, masterUnit.id));
      
      // Get ALL class lessons (including removed) to match sync behavior
      const classLessons = await db
        .select()
        .from(classCurriculumLessons)
        .where(eq(classCurriculumLessons.classUnitId, classUnit.id));
      
      // Include all source lesson IDs (including removed) to match sync behavior
      const existingSourceLessonIds = new Set(classLessons.map(l => l.sourceLessonId).filter(Boolean));
      
      for (const masterLesson of masterLessons) {
        if (!existingSourceLessonIds.has(masterLesson.id)) {
          missingLessons.push({
            id: masterLesson.id,
            name: masterLesson.name,
            unitName: masterUnit.name
          });
        }
      }
    }
  }
  
  const currentLessonsCount = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(classCurriculumLessons)
    .innerJoin(classCurriculumUnits, eq(classCurriculumLessons.classUnitId, classCurriculumUnits.id))
    .where(and(
      eq(classCurriculumUnits.classId, classId),
      eq(classCurriculumLessons.isRemoved, false)
    ));
  
  const availableLessonsCount = await getSharedDb()
    .select({ count: sql<number>`count(*)::int` })
    .from(curriculumLessons)
    .innerJoin(curriculumUnits, eq(curriculumLessons.curriculumUnitId, curriculumUnits.id))
    .where(eq(curriculumUnits.curriculumPathId, teacherClass.curriculumPathId));
  
  return {
    classId,
    className: teacherClass.name,
    language: teacherClass.language,
    currentLessons: currentLessonsCount[0]?.count || 0,
    availableLessons: availableLessonsCount[0]?.count || 0,
    missingUnits,
    missingLessons
  };
}

export async function syncClassWithMaster(classId: string): Promise<SyncResult> {
  const result: SyncResult = {
    classId,
    className: '',
    unitsAdded: 0,
    lessonsAdded: 0,
    errors: []
  };
  
  try {
    const [teacherClass] = await db
      .select()
      .from(teacherClasses)
      .where(eq(teacherClasses.id, classId));
    
    if (!teacherClass) {
      result.errors.push('Class not found');
      return result;
    }
    
    result.className = teacherClass.name;
    
    if (!teacherClass.curriculumPathId) {
      result.errors.push('Class has no curriculum path assigned');
      return result;
    }
    
    const masterUnits = await getSharedDb()
      .select()
      .from(curriculumUnits)
      .where(eq(curriculumUnits.curriculumPathId, teacherClass.curriculumPathId))
      .orderBy(curriculumUnits.orderIndex);
    
    const classUnits = await db
      .select()
      .from(classCurriculumUnits)
      .where(eq(classCurriculumUnits.classId, classId));
    
    const sourceUnitMap = new Map(classUnits.map(u => [u.sourceUnitId, u]));
    
    for (const masterUnit of masterUnits) {
      let classUnit = sourceUnitMap.get(masterUnit.id);
      
      if (!classUnit) {
        const [newUnit] = await db
          .insert(classCurriculumUnits)
          .values({
            classId,
            sourceUnitId: masterUnit.id,
            name: masterUnit.name,
            description: masterUnit.description,
            orderIndex: masterUnit.orderIndex,
            actflLevel: masterUnit.actflLevel,
            culturalTheme: masterUnit.culturalTheme,
            estimatedHours: masterUnit.estimatedHours,
            commitments: masterUnit.commitments,
            isCustom: false,
            isRemoved: false
          })
          .returning();
        
        classUnit = newUnit;
        result.unitsAdded++;
        console.log(`[SYNC] Added unit "${masterUnit.name}" to class "${teacherClass.name}"`);
      } else if (classUnit.isRemoved) {
        continue;
      }
      
      const masterLessons = await getSharedDb()
        .select()
        .from(curriculumLessons)
        .where(eq(curriculumLessons.curriculumUnitId, masterUnit.id))
        .orderBy(curriculumLessons.orderIndex);
      
      const classLessons = await db
        .select()
        .from(classCurriculumLessons)
        .where(eq(classCurriculumLessons.classUnitId, classUnit.id));
      
      // Include all source lesson IDs (including removed) to avoid re-adding removed items
      const sourceLessonIds = new Set(classLessons.map(l => l.sourceLessonId).filter(Boolean));
      
      // Track order incrementally as we add lessons
      let currentMaxOrder = classLessons.reduce((max, l) => Math.max(max, l.orderIndex), 0);
      
      for (const masterLesson of masterLessons) {
        if (sourceLessonIds.has(masterLesson.id)) continue;
        
        // Increment order for each new lesson
        currentMaxOrder++;
        
        await db
          .insert(classCurriculumLessons)
          .values({
            classUnitId: classUnit.id,
            sourceLessonId: masterLesson.id,
            name: masterLesson.name,
            description: masterLesson.description,
            orderIndex: currentMaxOrder,
            lessonType: masterLesson.lessonType,
            actflLevel: masterLesson.actflLevel,
            requirementTier: masterLesson.requirementTier || 'required',
            bundleId: masterLesson.bundleId,
            linkedDrillLessonId: masterLesson.linkedDrillLessonId,
            prerequisiteLessonId: masterLesson.prerequisiteLessonId,
            conversationTopic: masterLesson.conversationTopic,
            conversationPrompt: masterLesson.conversationPrompt,
            objectives: masterLesson.objectives,
            estimatedMinutes: masterLesson.estimatedMinutes,
            requiredTopics: masterLesson.requiredTopics,
            requiredVocabulary: masterLesson.requiredVocabulary,
            requiredGrammar: masterLesson.requiredGrammar,
            minPronunciationScore: masterLesson.minPronunciationScore,
            isCustom: false,
            isRemoved: false
          });
        
        result.lessonsAdded++;
      }
    }
    
    console.log(`[SYNC] Class "${teacherClass.name}" synced: ${result.unitsAdded} units, ${result.lessonsAdded} lessons added`);
    
  } catch (error: any) {
    console.error(`[SYNC] Error syncing class ${classId}:`, error);
    result.errors.push(error.message);
  }
  
  return result;
}

export async function syncAllClasses(): Promise<{ synced: number; results: SyncResult[] }> {
  const classes = await db
    .select({ id: teacherClasses.id })
    .from(teacherClasses)
    .where(eq(teacherClasses.isActive, true));
  
  const results: SyncResult[] = [];
  
  for (const cls of classes) {
    const result = await syncClassWithMaster(cls.id);
    results.push(result);
  }
  
  const synced = results.filter(r => r.errors.length === 0 && (r.unitsAdded > 0 || r.lessonsAdded > 0)).length;
  
  console.log(`[SYNC] Synced ${synced} classes with new curriculum content`);
  
  return { synced, results };
}

export async function getClassSyncStatus(): Promise<{
  classes: { id: string; name: string; language: string; currentLessons: number; availableLessons: number; needsSync: boolean }[];
  totalNeedingSync: number;
}> {
  const classes = await db
    .select()
    .from(teacherClasses)
    .where(eq(teacherClasses.isActive, true));
  
  const classStatuses = [];
  
  for (const cls of classes) {
    if (!cls.curriculumPathId) continue;
    
    const preview = await previewClassSync(cls.id);
    if (!preview) continue;
    
    const needsSync = preview.missingUnits.length > 0 || preview.missingLessons.length > 0;
    
    classStatuses.push({
      id: cls.id,
      name: cls.name,
      language: cls.language,
      currentLessons: preview.currentLessons,
      availableLessons: preview.availableLessons,
      needsSync
    });
  }
  
  return {
    classes: classStatuses,
    totalNeedingSync: classStatuses.filter(c => c.needsSync).length
  };
}
