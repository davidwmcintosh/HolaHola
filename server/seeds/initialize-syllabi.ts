import { db } from "../db";
import { teacherClasses, classCurriculumUnits, classCurriculumLessons, curriculumLessons } from "@shared/schema";
import { storage } from "../storage";
import { isNotNull, eq, inArray, sql } from "drizzle-orm";

export async function initializeAllSyllabi(): Promise<{
  initialized: number;
  skipped: number;
  errors: number;
  details: Array<{ classId: string; className: string; status: string; units?: number; lessons?: number }>;
}> {
  console.log('[Syllabus Init] Starting bulk syllabus initialization...');
  
  const allClasses = await db
    .select()
    .from(teacherClasses)
    .where(isNotNull(teacherClasses.curriculumPathId));
  
  console.log(`[Syllabus Init] Found ${allClasses.length} classes with curriculum templates`);
  
  const results: Array<{ classId: string; className: string; status: string; units?: number; lessons?: number }> = [];
  
  for (const teacherClass of allClasses) {
    const existingUnits = await db
      .select()
      .from(classCurriculumUnits)
      .where(eq(classCurriculumUnits.classId, teacherClass.id));
    
    if (existingUnits.length > 0) {
      console.log(`[Syllabus Init] Skipping ${teacherClass.name} - already has ${existingUnits.length} units`);
      results.push({
        classId: teacherClass.id,
        className: teacherClass.name,
        status: 'skipped_has_syllabus',
        units: existingUnits.length,
      });
      continue;
    }
    
    try {
      console.log(`[Syllabus Init] Initializing syllabus for ${teacherClass.name}...`);
      const cloned = await storage.cloneCurriculumToClass(teacherClass.id, teacherClass.curriculumPathId!);
      console.log(`[Syllabus Init] ✓ ${teacherClass.name}: ${cloned.units.length} units, ${cloned.lessons.length} lessons`);
      results.push({
        classId: teacherClass.id,
        className: teacherClass.name,
        status: 'initialized',
        units: cloned.units.length,
        lessons: cloned.lessons.length,
      });
    } catch (cloneError: any) {
      console.error(`[Syllabus Init] ✗ Error for ${teacherClass.name}:`, cloneError.message);
      results.push({
        classId: teacherClass.id,
        className: teacherClass.name,
        status: 'error',
      });
    }
  }
  
  const initialized = results.filter(r => r.status === 'initialized');
  const skipped = results.filter(r => r.status === 'skipped_has_syllabus');
  const errors = results.filter(r => r.status === 'error');
  
  console.log(`[Syllabus Init] Complete: ${initialized.length} initialized, ${skipped.length} skipped, ${errors.length} errors`);
  
  // Sync lesson types: update class_curriculum_lessons to match curriculum_lessons types
  // This ensures drill lessons in templates become drill lessons in class syllabi
  try {
    const drillLessons = await db
      .select({ id: curriculumLessons.id })
      .from(curriculumLessons)
      .where(eq(curriculumLessons.lessonType, 'drill'));
    
    if (drillLessons.length > 0) {
      const drillLessonIds = drillLessons.map(l => l.id);
      await db
        .update(classCurriculumLessons)
        .set({ lessonType: 'drill' })
        .where(inArray(classCurriculumLessons.sourceLessonId, drillLessonIds));
      console.log(`[Syllabus Init] Synced ${drillLessons.length} drill lesson types to class syllabi`);
    }
  } catch (e) {
    console.log(`[Syllabus Init] Lesson type sync skipped (already done or error)`);
  }
  
  return {
    initialized: initialized.length,
    skipped: skipped.length,
    errors: errors.length,
    details: results,
  };
}
