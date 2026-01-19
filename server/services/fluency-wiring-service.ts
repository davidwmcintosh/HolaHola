/**
 * Fluency Wiring Service
 * 
 * This service bridges the gap between curriculum lessons and ACTFL fluency tracking.
 * It handles:
 * 1. Mapping lessons to Can-Do statements
 * 2. Recording student Can-Do progress when fluency is demonstrated
 * 3. Recording ACTFL assessment events
 * 
 * This is the "missing wire" that connects HolaHola's rich fluency infrastructure
 * to actual student progress tracking.
 */

import { db, getSharedDb } from "../db";
import { 
  lessonCanDoStatements,
  canDoStatements,
  studentCanDoProgress,
  actflAssessmentEvents,
  classCurriculumLessons,
  classCurriculumUnits,
  teacherClasses,
  curriculumLessons
} from "@shared/schema";
import { eq, and, inArray, sql, like, ilike, or } from "drizzle-orm";
import { callGeminiWithSchema, GEMINI_MODELS } from "../gemini-utils";

interface LessonCanDoMapping {
  lessonId: string;
  canDoStatementIds: string[];
  matchedObjectives: { objective: string; canDoStatement: string; confidence: number }[];
}

interface MappingResult {
  matchedStatementIds: string[];
  reasoning: string;
}

const MAPPING_SCHEMA = {
  type: "object",
  properties: {
    matchedStatementIds: {
      type: "array",
      items: { type: "string" },
      description: "IDs of Can-Do statements that this lesson teaches or reinforces"
    },
    reasoning: {
      type: "string",
      description: "Brief explanation of why these Can-Do statements match the lesson"
    }
  },
  required: ["matchedStatementIds", "reasoning"]
};

/**
 * Intelligently maps a single lesson to appropriate Can-Do statements
 * Uses AI to match lesson objectives to ACTFL Can-Do statements
 */
export async function mapLessonToCanDoStatements(
  lessonId: string,
  lessonName: string,
  lessonType: string,
  lessonObjectives: string[],
  conversationTopic: string | null,
  language: string,
  actflLevel: string
): Promise<LessonCanDoMapping> {
  console.log(`[FLUENCY-WIRING] Mapping lesson: ${lessonName} (${language}/${actflLevel})`);

  // Get all Can-Do statements for this language and level (and one level above/below)
  const levelMap: Record<string, string[]> = {
    'novice_low': ['novice_low', 'novice_mid'],
    'novice_mid': ['novice_low', 'novice_mid', 'novice_high'],
    'novice_high': ['novice_mid', 'novice_high', 'intermediate_low'],
    'intermediate_low': ['novice_high', 'intermediate_low', 'intermediate_mid'],
    'intermediate_mid': ['intermediate_low', 'intermediate_mid', 'intermediate_high'],
    'intermediate_high': ['intermediate_mid', 'intermediate_high', 'advanced_low'],
    'advanced_low': ['intermediate_high', 'advanced_low', 'advanced_mid'],
    'advanced_mid': ['advanced_low', 'advanced_mid', 'advanced_high'],
    'advanced_high': ['advanced_mid', 'advanced_high'],
  };

  const relevantLevels = levelMap[actflLevel] || [actflLevel];

  const statements = await getSharedDb()
    .select()
    .from(canDoStatements)
    .where(
      and(
        eq(canDoStatements.language, language),
        inArray(canDoStatements.actflLevel, relevantLevels)
      )
    );

  if (statements.length === 0) {
    console.log(`[FLUENCY-WIRING] No Can-Do statements found for ${language}/${actflLevel}`);
    return { lessonId, canDoStatementIds: [], matchedObjectives: [] };
  }

  // Determine category based on lesson type
  const categoryMap: Record<string, string[]> = {
    'conversation': ['interpersonal', 'presentational'],
    'vocabulary': ['interpersonal', 'interpretive', 'presentational'],
    'grammar': ['presentational', 'interpersonal'],
    'drill': ['interpersonal', 'interpretive'],
    'cultural_exploration': ['interpretive', 'presentational'],
    'listening': ['interpretive'],
    'reading': ['interpretive'],
    'writing': ['presentational'],
  };

  const priorityCategories = categoryMap[lessonType] || ['interpersonal', 'interpretive', 'presentational'];

  // Format statements for AI matching
  const statementsForAI = statements.map(s => ({
    id: s.id,
    statement: s.statement,
    category: s.category,
    level: s.actflLevel
  }));

  const prompt = `You are matching a language lesson to ACTFL Can-Do statements.

LESSON DETAILS:
- Name: ${lessonName}
- Type: ${lessonType}
- Objectives: ${lessonObjectives.join('; ')}
- Topic: ${conversationTopic || 'N/A'}
- Language: ${language}
- ACTFL Level: ${actflLevel}
- Priority categories for this lesson type: ${priorityCategories.join(', ')}

AVAILABLE CAN-DO STATEMENTS:
${statementsForAI.map(s => `- ID: ${s.id} | ${s.category} | ${s.statement}`).join('\n')}

Select the Can-Do statements that this lesson DIRECTLY teaches or reinforces. 
- Match 2-5 statements that best align with the lesson objectives
- Prioritize statements from the ${priorityCategories.join('/')} categories
- Choose statements that the student would practice during this lesson
- Return the IDs of matched statements`;

  try {
    const result = await callGeminiWithSchema<MappingResult>(
      GEMINI_MODELS.FLASH,
      [
        { role: "system", content: "You are an ACTFL curriculum alignment specialist. Match lessons to appropriate Can-Do statements." },
        { role: "user", content: prompt }
      ],
      MAPPING_SCHEMA
    );

    console.log(`[FLUENCY-WIRING] Matched ${result.matchedStatementIds.length} Can-Do statements for ${lessonName}`);

    // Build the matched objectives detail
    const matchedObjectives = result.matchedStatementIds.map(id => {
      const stmt = statements.find(s => s.id === id);
      return {
        objective: lessonObjectives[0] || lessonName,
        canDoStatement: stmt?.statement || '',
        confidence: 0.85
      };
    });

    return {
      lessonId,
      canDoStatementIds: result.matchedStatementIds,
      matchedObjectives
    };
  } catch (error) {
    console.error(`[FLUENCY-WIRING] Error mapping lesson ${lessonName}:`, error);
    
    // Fallback: use simple keyword matching
    return fallbackMapping(lessonId, lessonObjectives, statements, priorityCategories);
  }
}

/**
 * Fallback mapping when AI is unavailable - uses keyword matching
 */
function fallbackMapping(
  lessonId: string,
  objectives: string[],
  statements: any[],
  priorityCategories: string[]
): LessonCanDoMapping {
  const matchedIds: string[] = [];
  const matchedObjectives: { objective: string; canDoStatement: string; confidence: number }[] = [];

  // Simple keyword matching
  const objectiveText = objectives.join(' ').toLowerCase();
  
  for (const stmt of statements) {
    if (!priorityCategories.includes(stmt.category)) continue;
    
    const stmtWords = stmt.statement.toLowerCase().split(' ');
    const matchScore = stmtWords.filter((w: string) => 
      w.length > 4 && objectiveText.includes(w)
    ).length;

    if (matchScore >= 2) {
      matchedIds.push(stmt.id);
      matchedObjectives.push({
        objective: objectives[0] || '',
        canDoStatement: stmt.statement,
        confidence: 0.6
      });
    }
  }

  // Ensure at least 1-2 matches
  if (matchedIds.length === 0) {
    const filteredStmts = statements.filter(s => priorityCategories.includes(s.category));
    if (filteredStmts.length > 0) {
      matchedIds.push(filteredStmts[0].id);
      matchedObjectives.push({
        objective: objectives[0] || '',
        canDoStatement: filteredStmts[0].statement,
        confidence: 0.5
      });
    }
  }

  return { lessonId, canDoStatementIds: matchedIds.slice(0, 5), matchedObjectives };
}

/**
 * Bulk map all lessons in a class to Can-Do statements
 * RESUMABLE: Skips lessons that already have Can-Do links
 */
export async function mapAllLessonsInClass(classId: string): Promise<{
  success: boolean;
  linksCreated: number;
  lessonsProcessed: number;
  lessonsSkipped: number;
  errors: string[];
}> {
  console.log(`[FLUENCY-WIRING] Starting bulk mapping for class ${classId}`);
  
  const errors: string[] = [];
  let linksCreated = 0;
  let lessonsSkipped = 0;

  // Get class language
  const [classInfo] = await db
    .select({ language: teacherClasses.language })
    .from(teacherClasses)
    .where(eq(teacherClasses.id, classId))
    .limit(1);

  if (!classInfo) {
    return { success: false, linksCreated: 0, lessonsProcessed: 0, lessonsSkipped: 0, errors: ['Class not found'] };
  }

  // Get all lessons in this class - using SOURCE template lesson IDs
  // (lessonCanDoStatements references curriculumLessons, not classCurriculumLessons)
  const lessons = await db
    .select({
      id: classCurriculumLessons.id,
      sourceLessonId: classCurriculumLessons.sourceLessonId, // Template lesson ID
      name: classCurriculumLessons.name,
      lessonType: classCurriculumLessons.lessonType,
      objectives: classCurriculumLessons.objectives,
      conversationTopic: classCurriculumLessons.conversationTopic,
      actflLevel: classCurriculumLessons.actflLevel
    })
    .from(classCurriculumLessons)
    .innerJoin(classCurriculumUnits, eq(classCurriculumLessons.classUnitId, classCurriculumUnits.id))
    .where(eq(classCurriculumUnits.classId, classId));

  // Get already-linked source lessons to skip (for resumability)
  const alreadyLinked = await getSharedDb()
    .select({ lessonId: lessonCanDoStatements.lessonId })
    .from(lessonCanDoStatements);
  const linkedLessonIds = new Set(alreadyLinked.map(l => l.lessonId));
  
  // Filter to lessons with source templates that haven't been linked yet
  const lessonsToMap = lessons.filter(l => l.sourceLessonId && !linkedLessonIds.has(l.sourceLessonId));
  console.log(`[FLUENCY-WIRING] Found ${lessons.length} lessons, ${lessonsToMap.length} need mapping, ${linkedLessonIds.size} already linked`);

  for (const lesson of lessonsToMap) {
    try {
      // Use sourceLessonId for mapping (links to template lessons in curriculumLessons)
      const sourceLessonId = lesson.sourceLessonId!;
      
      const mapping = await mapLessonToCanDoStatements(
        sourceLessonId,
        lesson.name || 'Untitled Lesson',
        lesson.lessonType || 'conversation',
        (lesson.objectives as string[]) || [],
        lesson.conversationTopic,
        classInfo.language,
        lesson.actflLevel || 'novice_low'
      );

      // Insert the links using source template lesson ID
      for (const canDoId of mapping.canDoStatementIds) {
        await getSharedDb().insert(lessonCanDoStatements).values({
          lessonId: sourceLessonId,
          canDoStatementId: canDoId
        }).onConflictDoNothing();
        linksCreated++;
      }

      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      errors.push(`Failed to map lesson ${lesson.name}: ${error}`);
    }
  }

  lessonsSkipped = lessons.length - lessonsToMap.length;
  console.log(`[FLUENCY-WIRING] Completed mapping for class ${classId}: ${linksCreated} links created, ${lessonsSkipped} skipped`);

  return {
    success: errors.length === 0,
    linksCreated,
    lessonsProcessed: lessonsToMap.length,
    lessonsSkipped,
    errors
  };
}

/**
 * Bulk map ALL lessons across ALL classes
 */
export async function mapAllLessonsAcrossAllClasses(): Promise<{
  success: boolean;
  totalLinksCreated: number;
  classesProcessed: number;
  lessonsProcessed: number;
  errors: string[];
}> {
  console.log(`[FLUENCY-WIRING] Starting full system mapping...`);
  
  const allClasses = await db
    .select({ id: teacherClasses.id, name: teacherClasses.name })
    .from(teacherClasses);

  let totalLinksCreated = 0;
  let totalLessonsProcessed = 0;
  const allErrors: string[] = [];

  for (const cls of allClasses) {
    console.log(`[FLUENCY-WIRING] Processing class: ${cls.name}`);
    const result = await mapAllLessonsInClass(cls.id);
    totalLinksCreated += result.linksCreated;
    totalLessonsProcessed += result.lessonsProcessed;
    allErrors.push(...result.errors);
    
    // Delay between classes
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`[FLUENCY-WIRING] Full system mapping complete: ${totalLinksCreated} links across ${allClasses.length} classes`);

  return {
    success: allErrors.length === 0,
    totalLinksCreated,
    classesProcessed: allClasses.length,
    lessonsProcessed: totalLessonsProcessed,
    errors: allErrors
  };
}

/**
 * Record student achievement of a Can-Do statement
 * Called when Daniela observes fluency during conversation
 */
export async function recordStudentCanDoProgress(
  userId: string,
  canDoStatementId: string,
  options: {
    selfAssessed?: boolean;
    teacherVerified?: boolean;
    aiDetected?: boolean;
    evidenceConversationId?: string;
    notes?: string;
  } = {}
): Promise<void> {
  console.log(`[FLUENCY-WIRING] Recording Can-Do progress for user ${userId}: ${canDoStatementId}`);

  // Check if already exists
  const existing = await db
    .select()
    .from(studentCanDoProgress)
    .where(
      and(
        eq(studentCanDoProgress.userId, userId),
        eq(studentCanDoProgress.canDoStatementId, canDoStatementId)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    // Update existing record
    await db
      .update(studentCanDoProgress)
      .set({
        aiDetected: options.aiDetected ?? existing[0].aiDetected,
        teacherVerified: options.teacherVerified ?? existing[0].teacherVerified,
        evidenceConversationId: options.evidenceConversationId ?? existing[0].evidenceConversationId,
        notes: options.notes ? `${existing[0].notes || ''}\n${options.notes}`.trim() : existing[0].notes,
        updatedAt: new Date()
      })
      .where(eq(studentCanDoProgress.id, existing[0].id));
  } else {
    // Insert new record
    await db.insert(studentCanDoProgress).values({
      userId,
      canDoStatementId,
      selfAssessed: options.selfAssessed ?? false,
      teacherVerified: options.teacherVerified ?? false,
      aiDetected: options.aiDetected ?? true,
      evidenceConversationId: options.evidenceConversationId,
      notes: options.notes,
      dateAchieved: new Date()
    });
  }
}

/**
 * Record multiple Can-Do achievements at once (batch operation)
 */
export async function recordBatchCanDoProgress(
  userId: string,
  canDoStatementIds: string[],
  evidenceConversationId?: string
): Promise<number> {
  let recorded = 0;
  
  for (const canDoId of canDoStatementIds) {
    try {
      await recordStudentCanDoProgress(userId, canDoId, {
        aiDetected: true,
        evidenceConversationId
      });
      recorded++;
    } catch (error) {
      console.error(`[FLUENCY-WIRING] Error recording Can-Do ${canDoId}:`, error);
    }
  }

  return recorded;
}

/**
 * Record an ACTFL proficiency assessment event
 * Called when Daniela determines a level change or significant progress
 */
export async function recordActflAssessment(
  userId: string,
  language: string,
  previousLevel: string,
  newLevel: string,
  direction: 'advancement' | 'maintenance' | 'regression',
  options: {
    confidence?: number;
    reason?: string;
    voiceSessionId?: string;
    conversationId?: string;
    classId?: string;
    sessionDurationSeconds?: number;
    correctionCountSession?: number;
    toolsUsedBefore?: string[];
    toolsUsedSession?: string[];
    messageCountBefore?: number;
  } = {}
): Promise<string> {
  console.log(`[FLUENCY-WIRING] Recording ACTFL assessment: ${userId} ${previousLevel} → ${newLevel} (${direction})`);

  const [inserted] = await db.insert(actflAssessmentEvents).values({
    userId,
    language,
    previousLevel,
    newLevel,
    direction,
    confidence: options.confidence ?? 80,
    reason: options.reason ?? 'Assessed during conversation practice',
    voiceSessionId: options.voiceSessionId,
    conversationId: options.conversationId,
    classId: options.classId,
    sessionDurationSeconds: options.sessionDurationSeconds,
    correctionCountSession: options.correctionCountSession,
    toolsUsedBefore: options.toolsUsedBefore ?? [],
    toolsUsedSession: options.toolsUsedSession ?? [],
    messageCountBefore: options.messageCountBefore
  }).returning({ id: actflAssessmentEvents.id });

  return inserted.id;
}

/**
 * Get student's Can-Do progress for a language
 */
export async function getStudentCanDoProgress(
  userId: string,
  language: string
): Promise<{
  achieved: Array<{
    statementId: string;
    statement: string;
    category: string;
    level: string;
    dateAchieved: Date;
    aiDetected: boolean;
    teacherVerified: boolean;
  }>;
  totalForLanguage: number;
  percentComplete: number;
}> {
  // Get all Can-Do statements for this language
  const allStatements = await getSharedDb()
    .select()
    .from(canDoStatements)
    .where(eq(canDoStatements.language, language));

  // Get student's progress
  const progress = await db
    .select({
      statementId: studentCanDoProgress.canDoStatementId,
      dateAchieved: studentCanDoProgress.dateAchieved,
      aiDetected: studentCanDoProgress.aiDetected,
      teacherVerified: studentCanDoProgress.teacherVerified,
      statement: canDoStatements.statement,
      category: canDoStatements.category,
      level: canDoStatements.actflLevel
    })
    .from(studentCanDoProgress)
    .innerJoin(canDoStatements, eq(studentCanDoProgress.canDoStatementId, canDoStatements.id))
    .where(
      and(
        eq(studentCanDoProgress.userId, userId),
        eq(canDoStatements.language, language)
      )
    );

  return {
    achieved: progress.map(p => ({
      statementId: p.statementId,
      statement: p.statement,
      category: p.category || 'interpersonal',
      level: p.level || 'novice_low',
      dateAchieved: p.dateAchieved || new Date(),
      aiDetected: p.aiDetected || false,
      teacherVerified: p.teacherVerified || false
    })),
    totalForLanguage: allStatements.length,
    percentComplete: allStatements.length > 0 
      ? Math.round((progress.length / allStatements.length) * 100) 
      : 0
  };
}

/**
 * Get Can-Do statements linked to a specific lesson
 */
export async function getLessonCanDoStatements(lessonId: string): Promise<Array<{
  id: string;
  statement: string;
  category: string;
  level: string;
}>> {
  const linked = await getSharedDb()
    .select({
      id: canDoStatements.id,
      statement: canDoStatements.statement,
      category: canDoStatements.category,
      level: canDoStatements.actflLevel
    })
    .from(lessonCanDoStatements)
    .innerJoin(canDoStatements, eq(lessonCanDoStatements.canDoStatementId, canDoStatements.id))
    .where(eq(lessonCanDoStatements.lessonId, lessonId));

  return linked.map(l => ({
    id: l.id,
    statement: l.statement,
    category: l.category || 'interpersonal',
    level: l.level || 'novice_low'
  }));
}

/**
 * When a lesson is completed, record progress on associated Can-Do statements
 */
export async function recordLessonCompletionCanDo(
  userId: string,
  lessonId: string,
  conversationId?: string
): Promise<number> {
  const linkedStatements = await getLessonCanDoStatements(lessonId);
  
  if (linkedStatements.length === 0) {
    console.log(`[FLUENCY-WIRING] No Can-Do statements linked to lesson ${lessonId}`);
    return 0;
  }

  const statementIds = linkedStatements.map(s => s.id);
  return recordBatchCanDoProgress(userId, statementIds, conversationId);
}

/**
 * COVERAGE ANALYSIS - Identify gaps in Can-Do statement coverage
 */
export async function getCoverageAnalysis(language?: string): Promise<{
  summary: {
    totalStatements: number;
    coveredStatements: number;
    uncoveredStatements: number;
    coveragePercent: number;
    totalLessons: number;
    linkedLessons: number;
  };
  byLevel: Array<{
    level: string;
    total: number;
    covered: number;
    uncovered: number;
    coveragePercent: number;
  }>;
  byCategory: Array<{
    category: string;
    total: number;
    covered: number;
    uncovered: number;
    coveragePercent: number;
  }>;
  gaps: Array<{
    id: string;
    statement: string;
    category: string;
    level: string;
    language: string;
    lessonCount: number;
  }>;
  wellCovered: Array<{
    id: string;
    statement: string;
    category: string;
    level: string;
    lessonCount: number;
  }>;
}> {
  // Get all Can-Do statements (optionally filtered by language)
  let allStatements;
  if (language) {
    allStatements = await getSharedDb()
      .select()
      .from(canDoStatements)
      .where(eq(canDoStatements.language, language));
  } else {
    allStatements = await getSharedDb().select().from(canDoStatements);
  }

  // Get all lesson-statement links
  const allLinks = await getSharedDb()
    .select({
      canDoId: lessonCanDoStatements.canDoStatementId,
      lessonId: lessonCanDoStatements.lessonId
    })
    .from(lessonCanDoStatements);

  // Count links per statement
  const linkCountMap = new Map<string, number>();
  for (const link of allLinks) {
    linkCountMap.set(link.canDoId, (linkCountMap.get(link.canDoId) || 0) + 1);
  }

  // Get unique linked statements
  const linkedStatementIds = new Set(allLinks.map(l => l.canDoId));

  // Get total lessons and linked lessons
  const allLessons = await getSharedDb().select({ id: curriculumLessons.id }).from(curriculumLessons);
  const linkedLessonIds = new Set(allLinks.map(l => l.lessonId));

  // Categorize by level
  const levelStats = new Map<string, { total: number; covered: number }>();
  const categoryStats = new Map<string, { total: number; covered: number }>();

  const gaps: Array<{
    id: string;
    statement: string;
    category: string;
    level: string;
    language: string;
    lessonCount: number;
  }> = [];

  const wellCovered: Array<{
    id: string;
    statement: string;
    category: string;
    level: string;
    lessonCount: number;
  }> = [];

  for (const stmt of allStatements) {
    const level = stmt.actflLevel || 'unknown';
    const category = stmt.category || 'unknown';
    const lessonCount = linkCountMap.get(stmt.id) || 0;
    const isCovered = lessonCount > 0;

    // Update level stats
    if (!levelStats.has(level)) {
      levelStats.set(level, { total: 0, covered: 0 });
    }
    const ls = levelStats.get(level)!;
    ls.total++;
    if (isCovered) ls.covered++;

    // Update category stats
    if (!categoryStats.has(category)) {
      categoryStats.set(category, { total: 0, covered: 0 });
    }
    const cs = categoryStats.get(category)!;
    cs.total++;
    if (isCovered) cs.covered++;

    // Identify gaps (0 lessons)
    if (lessonCount === 0) {
      gaps.push({
        id: stmt.id,
        statement: stmt.statement,
        category,
        level,
        language: stmt.language,
        lessonCount: 0
      });
    }

    // Identify well-covered (3+ lessons)
    if (lessonCount >= 3) {
      wellCovered.push({
        id: stmt.id,
        statement: stmt.statement,
        category,
        level,
        lessonCount
      });
    }
  }

  // Build level breakdown
  const levelOrder = [
    'novice_low', 'novice_mid', 'novice_high',
    'intermediate_low', 'intermediate_mid', 'intermediate_high',
    'advanced_low', 'advanced_mid', 'advanced_high',
    'superior', 'distinguished'
  ];
  
  const byLevel = levelOrder
    .filter(l => levelStats.has(l))
    .map(level => {
      const stats = levelStats.get(level)!;
      return {
        level,
        total: stats.total,
        covered: stats.covered,
        uncovered: stats.total - stats.covered,
        coveragePercent: stats.total > 0 ? Math.round((stats.covered / stats.total) * 100) : 0
      };
    });

  // Build category breakdown
  const byCategory = Array.from(categoryStats.entries()).map(([category, stats]) => ({
    category,
    total: stats.total,
    covered: stats.covered,
    uncovered: stats.total - stats.covered,
    coveragePercent: stats.total > 0 ? Math.round((stats.covered / stats.total) * 100) : 0
  }));

  return {
    summary: {
      totalStatements: allStatements.length,
      coveredStatements: linkedStatementIds.size,
      uncoveredStatements: allStatements.length - linkedStatementIds.size,
      coveragePercent: allStatements.length > 0 
        ? Math.round((linkedStatementIds.size / allStatements.length) * 100) 
        : 0,
      totalLessons: allLessons.length,
      linkedLessons: linkedLessonIds.size
    },
    byLevel,
    byCategory,
    gaps: gaps.slice(0, 50), // Top 50 gaps
    wellCovered: wellCovered.slice(0, 20) // Top 20 well-covered
  };
}

/**
 * Get coverage for a specific class
 */
export async function getClassCoverageAnalysis(classId: string): Promise<{
  className: string;
  language: string;
  summary: {
    totalLessons: number;
    linkedLessons: number;
    totalLinks: number;
    uniqueStatementsCovered: number;
  };
  lessonCoverage: Array<{
    lessonId: string;
    lessonName: string;
    lessonType: string;
    statementCount: number;
  }>;
}> {
  // Get class info
  const [classInfo] = await db
    .select({ name: teacherClasses.name, language: teacherClasses.language })
    .from(teacherClasses)
    .where(eq(teacherClasses.id, classId))
    .limit(1);

  if (!classInfo) {
    throw new Error('Class not found');
  }

  // Get all lessons in this class with their source lesson IDs
  const lessons = await db
    .select({
      id: classCurriculumLessons.id,
      sourceLessonId: classCurriculumLessons.sourceLessonId,
      name: classCurriculumLessons.name,
      lessonType: classCurriculumLessons.lessonType
    })
    .from(classCurriculumLessons)
    .innerJoin(classCurriculumUnits, eq(classCurriculumLessons.classUnitId, classCurriculumUnits.id))
    .where(eq(classCurriculumUnits.classId, classId));

  // Get links for source lessons
  const sourceLessonIds = lessons.filter(l => l.sourceLessonId).map(l => l.sourceLessonId!);
  
  const links = sourceLessonIds.length > 0 ? await getSharedDb()
    .select({
      lessonId: lessonCanDoStatements.lessonId,
      canDoId: lessonCanDoStatements.canDoStatementId
    })
    .from(lessonCanDoStatements)
    .where(inArray(lessonCanDoStatements.lessonId, sourceLessonIds)) : [];

  // Count links per lesson
  const lessonLinkCounts = new Map<string, number>();
  const allCoveredStatements = new Set<string>();
  
  for (const link of links) {
    lessonLinkCounts.set(link.lessonId, (lessonLinkCounts.get(link.lessonId) || 0) + 1);
    allCoveredStatements.add(link.canDoId);
  }

  // Build lesson coverage
  const lessonCoverage = lessons.map(lesson => ({
    lessonId: lesson.id,
    lessonName: lesson.name || 'Untitled',
    lessonType: lesson.lessonType || 'conversation',
    statementCount: lesson.sourceLessonId ? (lessonLinkCounts.get(lesson.sourceLessonId) || 0) : 0
  }));

  const linkedLessons = lessonCoverage.filter(l => l.statementCount > 0).length;

  return {
    className: classInfo.name,
    language: classInfo.language,
    summary: {
      totalLessons: lessons.length,
      linkedLessons,
      totalLinks: links.length,
      uniqueStatementsCovered: allCoveredStatements.size
    },
    lessonCoverage
  };
}
