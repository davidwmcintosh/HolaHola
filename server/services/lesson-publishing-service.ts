import { db } from "../db";
import { 
  lessonDrafts, 
  curriculumPaths, 
  curriculumUnits, 
  curriculumLessons,
  curriculumDrillItems,
  lessonCanDoStatements,
  canDoStatements
} from "@shared/schema";
import { eq, and, sql, inArray } from "drizzle-orm";

interface DraftPayload {
  lessonType?: string;
  objectives?: string[];
  vocabularyFocus?: string[];
  grammarFocus?: string[];
  warmUp?: string;
  modelInput?: string;
  modelOutput?: string;
  scaffoldedTasks?: ScaffoldedTask[];
  assessmentCheck?: string;
  culturalConnection?: string;
  suggestedDuration?: number;
}

interface ScaffoldedTask {
  taskNumber: number;
  instruction: string;
  expectedResponse?: string;
  scaffoldingNotes?: string;
}

interface PublishResult {
  success: boolean;
  lessonId?: string;
  drillCount?: number;
  error?: string;
}

const ACTFL_LEVEL_ORDER = [
  'novice_low', 'novice_mid', 'novice_high',
  'intermediate_low', 'intermediate_mid', 'intermediate_high',
  'advanced_low', 'advanced_mid', 'advanced_high',
  'superior', 'distinguished'
];

function findPathForLevel(level: string): { startLevel: string; endLevel: string; suffix: string } {
  const levelIndex = ACTFL_LEVEL_ORDER.indexOf(level);
  
  if (levelIndex <= 2) {
    return { startLevel: 'novice_low', endLevel: 'novice_high', suffix: '1 - High School' };
  } else if (levelIndex <= 4) {
    return { startLevel: 'novice_high', endLevel: 'intermediate_low', suffix: '2 - High School' };
  } else if (levelIndex <= 5) {
    return { startLevel: 'intermediate_low', endLevel: 'intermediate_mid', suffix: '3 - High School' };
  } else if (levelIndex <= 7) {
    return { startLevel: 'intermediate_mid', endLevel: 'intermediate_high', suffix: '4 - High School / AP Prep' };
  } else {
    return { startLevel: 'advanced_low', endLevel: 'advanced_high', suffix: '5 - Advanced' };
  }
}

function getLanguageDisplayName(lang: string): string {
  const names: Record<string, string> = {
    spanish: 'Spanish',
    french: 'French',
    german: 'German',
    italian: 'Italian',
    portuguese: 'Portuguese',
    japanese: 'Japanese',
    mandarin: 'Mandarin',
    korean: 'Korean',
    english: 'English'
  };
  return names[lang] || lang.charAt(0).toUpperCase() + lang.slice(1);
}

async function findOrCreatePath(language: string, actflLevel: string): Promise<string> {
  const pathInfo = findPathForLevel(actflLevel);
  const pathName = `${getLanguageDisplayName(language)} ${pathInfo.suffix}`;
  
  const existingPath = await db
    .select()
    .from(curriculumPaths)
    .where(and(
      eq(curriculumPaths.language, language),
      eq(curriculumPaths.startLevel, pathInfo.startLevel)
    ))
    .limit(1);
  
  if (existingPath.length > 0) {
    return existingPath[0].id;
  }
  
  const [newPath] = await db
    .insert(curriculumPaths)
    .values({
      name: pathName,
      description: `Comprehensive ${getLanguageDisplayName(language)} curriculum for ${pathInfo.startLevel} to ${pathInfo.endLevel} proficiency`,
      language,
      targetAudience: 'High School',
      startLevel: pathInfo.startLevel,
      endLevel: pathInfo.endLevel,
      isPublished: true
    })
    .returning();
  
  console.log(`[PUBLISH] Created new curriculum path: ${pathName}`);
  return newPath.id;
}

async function findOrCreateUnit(pathId: string, actflLevel: string, language: string): Promise<string> {
  const existingUnit = await db
    .select()
    .from(curriculumUnits)
    .where(and(
      eq(curriculumUnits.curriculumPathId, pathId),
      eq(curriculumUnits.actflLevel, actflLevel)
    ))
    .limit(1);
  
  if (existingUnit.length > 0) {
    return existingUnit[0].id;
  }
  
  const levelIndex = ACTFL_LEVEL_ORDER.indexOf(actflLevel);
  const levelDisplay = actflLevel.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  
  const [newUnit] = await db
    .insert(curriculumUnits)
    .values({
      curriculumPathId: pathId,
      name: `${levelDisplay} Skills`,
      description: `Lessons targeting ${levelDisplay} proficiency in ${getLanguageDisplayName(language)}`,
      orderIndex: levelIndex,
      actflLevel
    })
    .returning();
  
  console.log(`[PUBLISH] Created new unit: ${newUnit.name}`);
  return newUnit.id;
}

function classifyDrillType(task: ScaffoldedTask): 'fill_blank' | 'matching' | 'translate_speak' | 'listen_repeat' {
  const instruction = task.instruction.toLowerCase();
  
  if (instruction.includes('match') || instruction.includes('pair')) {
    return 'matching';
  }
  if (instruction.includes('fill') || instruction.includes('blank') || instruction.includes('complete the gap')) {
    return 'fill_blank';
  }
  if (instruction.includes('translate') || instruction.includes('speak') || instruction.includes('say')) {
    return 'translate_speak';
  }
  if (instruction.includes('listen') || instruction.includes('repeat') || instruction.includes('hear')) {
    return 'listen_repeat';
  }
  
  return 'fill_blank';
}

async function createDrillsFromTasks(
  lessonId: string, 
  tasks: ScaffoldedTask[], 
  language: string
): Promise<number> {
  if (!tasks || tasks.length === 0) return 0;
  
  const drillItems = tasks.map((task, index) => ({
    lessonId,
    itemType: classifyDrillType(task) as 'fill_blank' | 'matching' | 'translate_speak' | 'listen_repeat',
    orderIndex: task.taskNumber || index + 1,
    prompt: task.instruction,
    targetText: task.expectedResponse || '',
    targetLanguage: language,
    hints: task.scaffoldingNotes ? [task.scaffoldingNotes] : [],
    difficulty: Math.min(task.taskNumber || 1, 5)
  }));
  
  await db.insert(curriculumDrillItems).values(drillItems);
  return drillItems.length;
}

export async function publishDraft(draftId: string): Promise<PublishResult> {
  try {
    const [draft] = await db
      .select()
      .from(lessonDrafts)
      .where(eq(lessonDrafts.id, draftId));
    
    if (!draft) {
      return { success: false, error: 'Draft not found' };
    }
    
    if (draft.status !== 'approved') {
      return { success: false, error: `Draft status is '${draft.status}', must be 'approved'` };
    }
    
    if (draft.publishedLessonId) {
      return { success: false, error: 'Draft already published' };
    }
    
    const payload = draft.draftPayload as DraftPayload;
    
    const pathId = await findOrCreatePath(draft.language, draft.actflLevel);
    const unitId = await findOrCreateUnit(pathId, draft.actflLevel, draft.language);
    
    const existingLessons = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(curriculumLessons)
      .where(eq(curriculumLessons.curriculumUnitId, unitId));
    
    const orderIndex = (existingLessons[0]?.count || 0) + 1;
    
    const [newLesson] = await db
      .insert(curriculumLessons)
      .values({
        curriculumUnitId: unitId,
        name: draft.name,
        description: draft.description || payload.warmUp || `${draft.name} lesson`,
        orderIndex,
        lessonType: payload.lessonType || draft.category || 'conversation',
        actflLevel: draft.actflLevel,
        conversationTopic: draft.name,
        conversationPrompt: payload.modelInput,
        objectives: payload.objectives || [],
        estimatedMinutes: payload.suggestedDuration || 30,
        requiredVocabulary: payload.vocabularyFocus || [],
        requiredGrammar: payload.grammarFocus || []
      })
      .returning();
    
    if (draft.canDoStatementId) {
      await db.insert(lessonCanDoStatements).values({
        lessonId: newLesson.id,
        canDoStatementId: draft.canDoStatementId
      });
    }
    
    let drillCount = 0;
    if (payload.scaffoldedTasks && payload.scaffoldedTasks.length > 0) {
      drillCount = await createDrillsFromTasks(
        newLesson.id, 
        payload.scaffoldedTasks, 
        draft.language
      );
    }
    
    await db
      .update(lessonDrafts)
      .set({
        status: 'published',
        publishedLessonId: newLesson.id,
        publishedAt: new Date()
      })
      .where(eq(lessonDrafts.id, draftId));
    
    console.log(`[PUBLISH] Published draft ${draftId} -> lesson ${newLesson.id} with ${drillCount} drills`);
    
    return {
      success: true,
      lessonId: newLesson.id,
      drillCount
    };
  } catch (error: any) {
    console.error(`[PUBLISH] Error publishing draft ${draftId}:`, error);
    return { success: false, error: error.message };
  }
}

export async function publishBatch(
  language?: string,
  limit: number = 100
): Promise<{ published: number; failed: number; results: PublishResult[] }> {
  // Build query with proper filtering from the start
  const conditions = [eq(lessonDrafts.status, 'approved')];
  if (language) {
    conditions.push(eq(lessonDrafts.language, language));
  }
  
  const drafts = await db
    .select({ id: lessonDrafts.id })
    .from(lessonDrafts)
    .where(and(...conditions))
    .limit(limit);
  
  console.log(`[PUBLISH] Batch starting: ${drafts.length} drafts to publish${language ? ` (language: ${language})` : ''}`);
  
  const results: PublishResult[] = [];
  let published = 0;
  let failed = 0;
  
  for (const draft of drafts) {
    const result = await publishDraft(draft.id);
    results.push(result);
    if (result.success) {
      published++;
    } else {
      failed++;
    }
  }
  
  console.log(`[PUBLISH] Batch complete: ${published} published, ${failed} failed`);
  return { published, failed, results };
}

export async function getPublishPreview(language?: string) {
  let query = db
    .select({
      id: lessonDrafts.id,
      name: lessonDrafts.name,
      language: lessonDrafts.language,
      actflLevel: lessonDrafts.actflLevel,
      category: lessonDrafts.category,
      status: lessonDrafts.status,
      canDoStatement: canDoStatements.statement
    })
    .from(lessonDrafts)
    .leftJoin(canDoStatements, eq(lessonDrafts.canDoStatementId, canDoStatements.id))
    .where(eq(lessonDrafts.status, 'approved'));
  
  const drafts = await query;
  
  if (language) {
    return drafts.filter(d => d.language === language);
  }
  
  return drafts;
}

export async function getPublishStats() {
  const stats = await db
    .select({
      language: lessonDrafts.language,
      status: lessonDrafts.status,
      count: sql<number>`count(*)::int`
    })
    .from(lessonDrafts)
    .groupBy(lessonDrafts.language, lessonDrafts.status);
  
  const byLanguage: Record<string, Record<string, number>> = {};
  for (const row of stats) {
    if (!byLanguage[row.language]) {
      byLanguage[row.language] = {};
    }
    byLanguage[row.language][row.status] = row.count;
  }
  
  return byLanguage;
}
