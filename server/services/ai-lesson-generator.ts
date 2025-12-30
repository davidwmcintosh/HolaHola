/**
 * AI Lesson Generator Service
 * 
 * Generates lesson content targeting specific ACTFL Can-Do statements
 * using Gemini AI. Creates comprehensive lesson drafts for founder review.
 */

import { db } from "../db";
import { 
  canDoStatements,
  lessonCanDoStatements,
  lessonDrafts
} from "@shared/schema";
import { eq } from "drizzle-orm";
import { callGeminiWithSchema, GEMINI_MODELS } from "../gemini-utils";

interface GeneratedLesson {
  name: string;
  description: string;
  objectives: string[];
  warmUp: string;
  modelInput: string;
  modelOutput: string;
  scaffoldedTasks: Array<{
    taskNumber: number;
    instruction: string;
    expectedResponse: string;
    scaffoldingNotes: string;
  }>;
  assessmentCheck: string;
  culturalConnection: string;
  vocabularyFocus: string[];
  grammarFocus: string[];
  suggestedDuration: number;
  lessonType: 'conversation' | 'drill' | 'reading' | 'writing';
}

interface LessonGenerationRequest {
  canDoStatementId: string;
  language: string;
  targetLevel: string;
  category: 'interpersonal' | 'interpretive' | 'presentational';
  additionalContext?: string;
}

const LESSON_GENERATION_SCHEMA = {
  type: "object",
  properties: {
    name: {
      type: "string",
      description: "Engaging lesson title in the target language with English translation"
    },
    description: {
      type: "string",
      description: "Brief lesson description (2-3 sentences) explaining what students will learn"
    },
    objectives: {
      type: "array",
      items: { type: "string" },
      description: "3-5 specific learning objectives aligned to the Can-Do statement"
    },
    warmUp: {
      type: "string",
      description: "5-minute warm-up activity to activate prior knowledge"
    },
    modelInput: {
      type: "string",
      description: "Sample input/stimulus in the target language for the lesson"
    },
    modelOutput: {
      type: "string",
      description: "Expected output/response demonstrating the Can-Do skill"
    },
    scaffoldedTasks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          taskNumber: { type: "integer" },
          instruction: { type: "string" },
          expectedResponse: { type: "string" },
          scaffoldingNotes: { type: "string" }
        },
        required: ["taskNumber", "instruction", "expectedResponse", "scaffoldingNotes"]
      },
      description: "3-5 progressively challenging tasks"
    },
    assessmentCheck: {
      type: "string",
      description: "How to verify the student can perform the Can-Do statement"
    },
    culturalConnection: {
      type: "string",
      description: "Cultural context or connection relevant to the lesson topic"
    },
    vocabularyFocus: {
      type: "array",
      items: { type: "string" },
      description: "5-10 key vocabulary words for this lesson"
    },
    grammarFocus: {
      type: "array",
      items: { type: "string" },
      description: "1-3 grammar points covered in this lesson"
    },
    suggestedDuration: {
      type: "integer",
      description: "Suggested lesson duration in minutes (15, 30, 45, or 60)"
    },
    lessonType: {
      type: "string",
      enum: ["conversation", "drill", "reading", "writing"],
      description: "Primary lesson type based on the Can-Do category"
    }
  },
  required: ["name", "description", "objectives", "warmUp", "modelInput", "modelOutput", 
             "scaffoldedTasks", "assessmentCheck", "culturalConnection", "vocabularyFocus", 
             "grammarFocus", "suggestedDuration", "lessonType"]
};

const LEVEL_DESCRIPTIONS: Record<string, string> = {
  novice_low: "Novice Low - Can communicate minimally with formulaic and rote utterances, lists, and phrases",
  novice_mid: "Novice Mid - Can communicate on very familiar topics using a variety of words and phrases",
  novice_high: "Novice High - Can communicate and be understood on familiar topics with simple sentences",
  intermediate_low: "Intermediate Low - Can participate in conversations on familiar topics, creating with the language",
  intermediate_mid: "Intermediate Mid - Can handle successfully a variety of uncomplicated communicative tasks",
  intermediate_high: "Intermediate High - Can narrate and describe in major time frames with good control",
  advanced_low: "Advanced Low - Can handle a variety of communicative tasks with ease and confidence",
  advanced_mid: "Advanced Mid - Can discuss concrete topics with detail and express opinions",
  advanced_high: "Advanced High - Can discuss complex topics with precision and fluency"
};

const CATEGORY_GUIDANCE: Record<string, string> = {
  interpersonal: "Focus on two-way communication, conversation practice, and interactive exchanges. Include dialogue practice, role-plays, and partner activities.",
  interpretive: "Focus on comprehension skills - listening and reading. Include authentic texts, audio materials, and comprehension questions.",
  presentational: "Focus on one-way communication for an audience. Include presentations, written compositions, and speaking tasks."
};

export async function generateLessonFromCanDo(
  request: LessonGenerationRequest
): Promise<{ success: boolean; lesson?: GeneratedLesson; error?: string }> {
  try {
    // Fetch the Can-Do statement
    const [canDo] = await db
      .select()
      .from(canDoStatements)
      .where(eq(canDoStatements.id, request.canDoStatementId));

    if (!canDo) {
      return { success: false, error: "Can-Do statement not found" };
    }

    const levelDescription = LEVEL_DESCRIPTIONS[canDo.actflLevel] || canDo.actflLevel;
    const categoryGuidance = CATEGORY_GUIDANCE[request.category] || "";

    const prompt = `You are an expert language curriculum designer specializing in ACTFL proficiency-based instruction.

Generate a complete lesson plan for ${request.language.toUpperCase()} language learners at the ${levelDescription} level.

TARGET CAN-DO STATEMENT:
"${canDo.statement}"

COMMUNICATION MODE: ${request.category.toUpperCase()}
${categoryGuidance}

REQUIREMENTS:
1. The lesson MUST directly teach and assess the Can-Do statement
2. All target language content should be in ${request.language}
3. Instructions and explanations should be in English
4. Tasks should progress from supported to independent performance
5. Include authentic cultural connections
6. Keep vocabulary and grammar appropriate for the proficiency level

${request.additionalContext ? `ADDITIONAL CONTEXT: ${request.additionalContext}` : ""}

Generate a comprehensive, engaging lesson that helps students achieve this Can-Do statement.`;

    const messages = [
      { role: 'system', content: 'You are an expert language curriculum designer.' },
      { role: 'user', content: prompt }
    ];
    
    const result = await callGeminiWithSchema<GeneratedLesson>(
      GEMINI_MODELS.FLASH,
      messages,
      LESSON_GENERATION_SCHEMA
    );

    if (!result) {
      return { success: false, error: "AI generation failed - no response" };
    }

    return { success: true, lesson: result };
  } catch (error: any) {
    console.error("[AI-LESSON] Generation error:", error);
    return { success: false, error: error.message };
  }
}

export async function generateAndSaveLessonDraft(
  canDoStatementId: string,
  createdBy?: string,
  additionalContext?: string
): Promise<{ success: boolean; draftId?: string; error?: string }> {
  try {
    // Fetch the Can-Do statement
    const [canDo] = await db
      .select()
      .from(canDoStatements)
      .where(eq(canDoStatements.id, canDoStatementId));

    if (!canDo) {
      return { success: false, error: "Can-Do statement not found" };
    }

    console.log(`[AI-LESSON] Generating lesson for: ${canDo.statement.substring(0, 50)}...`);

    // Generate the lesson
    const result = await generateLessonFromCanDo({
      canDoStatementId,
      language: canDo.language,
      targetLevel: canDo.actflLevel,
      category: canDo.category as 'interpersonal' | 'interpretive' | 'presentational',
      additionalContext
    });

    if (!result.success || !result.lesson) {
      return { success: false, error: result.error || "Generation failed" };
    }

    // Save as draft
    const [draft] = await db
      .insert(lessonDrafts)
      .values({
        canDoStatementId,
        language: canDo.language,
        actflLevel: canDo.actflLevel,
        category: canDo.category,
        name: result.lesson.name,
        description: result.lesson.description,
        draftPayload: {
          objectives: result.lesson.objectives,
          warmUp: result.lesson.warmUp,
          modelInput: result.lesson.modelInput,
          modelOutput: result.lesson.modelOutput,
          scaffoldedTasks: result.lesson.scaffoldedTasks,
          assessmentCheck: result.lesson.assessmentCheck,
          culturalConnection: result.lesson.culturalConnection,
          vocabularyFocus: result.lesson.vocabularyFocus,
          grammarFocus: result.lesson.grammarFocus,
          suggestedDuration: result.lesson.suggestedDuration,
          lessonType: result.lesson.lessonType
        },
        status: 'draft',
        createdBy: createdBy || null
      })
      .returning({ id: lessonDrafts.id });

    if (draft) {
      console.log(`[AI-LESSON] Draft saved: ${draft.id}`);
      return { success: true, draftId: draft.id };
    }

    return { success: false, error: "Failed to save draft" };
  } catch (error: any) {
    console.error("[AI-LESSON] Generation/save error:", error);
    return { success: false, error: error.message };
  }
}

export async function getLessonDrafts(
  status?: string,
  language?: string
) {
  let query = db
    .select({
      draft: lessonDrafts,
      canDo: canDoStatements
    })
    .from(lessonDrafts)
    .leftJoin(canDoStatements, eq(lessonDrafts.canDoStatementId, canDoStatements.id));

  // Apply filters if provided
  const drafts = await query;
  
  let filtered = drafts;
  if (status) {
    filtered = filtered.filter(d => d.draft.status === status);
  }
  if (language) {
    filtered = filtered.filter(d => d.draft.language === language);
  }

  return filtered;
}

export async function updateDraftStatus(
  draftId: string,
  status: 'pending' | 'approved' | 'rejected',
  reviewedBy: string,
  reviewNotes?: string
) {
  const [updated] = await db
    .update(lessonDrafts)
    .set({
      status,
      reviewedBy,
      reviewNotes,
      reviewedAt: new Date()
    })
    .where(eq(lessonDrafts.id, draftId))
    .returning();

  return updated;
}

export async function generateLessonsForGaps(
  language: string,
  limit: number = 5,
  createdBy?: string
): Promise<{ generated: number; draftIds: string[]; errors: string[] }> {
  // Get uncovered Can-Do statements for this language
  const allCanDos = await db
    .select()
    .from(canDoStatements)
    .where(eq(canDoStatements.language, language));

  const coveredIds = await db
    .select({ id: lessonCanDoStatements.canDoStatementId })
    .from(lessonCanDoStatements);

  const coveredSet = new Set(coveredIds.map(c => c.id));
  const uncovered = allCanDos.filter(c => !coveredSet.has(c.id));

  // Prioritize by level (advanced > intermediate > novice)
  const levelPriority: Record<string, number> = {
    advanced_high: 9,
    advanced_mid: 8,
    advanced_low: 7,
    intermediate_high: 6,
    intermediate_mid: 5,
    intermediate_low: 4,
    novice_high: 3,
    novice_mid: 2,
    novice_low: 1
  };

  const sorted = uncovered.sort((a, b) => 
    (levelPriority[b.actflLevel] || 0) - (levelPriority[a.actflLevel] || 0)
  );

  const toGenerate = sorted.slice(0, limit);
  const draftIds: string[] = [];
  const errors: string[] = [];

  for (const canDo of toGenerate) {
    const result = await generateAndSaveLessonDraft(canDo.id, createdBy);
    
    if (result.success && result.draftId) {
      draftIds.push(result.draftId);
    } else {
      errors.push(`${canDo.statement.substring(0, 30)}: ${result.error}`);
    }

    // Rate limiting - wait between generations
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return { generated: draftIds.length, draftIds, errors };
}

/**
 * Get all coverage gaps across all languages
 */
export async function getAllCoverageGaps(): Promise<{
  totalGaps: number;
  byLanguage: Record<string, number>;
  gaps: Array<{ id: string; language: string; actflLevel: string; category: string; statement: string }>;
}> {
  const allCanDos = await db.select().from(canDoStatements);
  
  const coveredIds = await db
    .select({ id: lessonCanDoStatements.canDoStatementId })
    .from(lessonCanDoStatements);
  
  const coveredSet = new Set(coveredIds.map(c => c.id));
  const uncovered = allCanDos.filter(c => !coveredSet.has(c.id));
  
  const byLanguage: Record<string, number> = {};
  for (const gap of uncovered) {
    byLanguage[gap.language] = (byLanguage[gap.language] || 0) + 1;
  }
  
  // Prioritize by level
  const levelPriority: Record<string, number> = {
    advanced_high: 9, advanced_mid: 8, advanced_low: 7,
    intermediate_high: 6, intermediate_mid: 5, intermediate_low: 4,
    novice_high: 3, novice_mid: 2, novice_low: 1
  };
  
  const sortedGaps = uncovered
    .sort((a, b) => (levelPriority[b.actflLevel] || 0) - (levelPriority[a.actflLevel] || 0))
    .map(g => ({
      id: g.id,
      language: g.language,
      actflLevel: g.actflLevel,
      category: g.category,
      statement: g.statement
    }));
  
  return {
    totalGaps: uncovered.length,
    byLanguage,
    gaps: sortedGaps
  };
}

/**
 * Generate lessons for ALL gaps across all languages
 * Runs in background with progress tracking
 */
export async function generateAllGapsAutomation(
  createdBy?: string,
  batchSize: number = 10,
  delayBetweenBatches: number = 5000
): Promise<{ jobId: string }> {
  const jobId = `gap-fill-${Date.now()}`;
  
  // Run in background
  (async () => {
    console.log(`[AI-LESSON] Starting automated gap fill job: ${jobId}`);
    
    const { gaps } = await getAllCoverageGaps();
    console.log(`[AI-LESSON] Found ${gaps.length} total gaps to fill`);
    
    let generated = 0;
    let errors = 0;
    
    for (let i = 0; i < gaps.length; i += batchSize) {
      const batch = gaps.slice(i, i + batchSize);
      console.log(`[AI-LESSON] Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(gaps.length / batchSize)}`);
      
      for (const gap of batch) {
        try {
          const result = await generateAndSaveLessonDraft(gap.id, createdBy);
          if (result.success) {
            generated++;
            console.log(`[AI-LESSON] Generated ${generated}/${gaps.length}: ${gap.language} - ${gap.statement.substring(0, 40)}...`);
          } else {
            errors++;
            console.error(`[AI-LESSON] Failed: ${result.error}`);
          }
        } catch (err: any) {
          errors++;
          console.error(`[AI-LESSON] Error: ${err.message}`);
        }
        
        // Rate limit between individual generations
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
      
      // Longer delay between batches
      if (i + batchSize < gaps.length) {
        console.log(`[AI-LESSON] Batch complete. Waiting ${delayBetweenBatches / 1000}s before next batch...`);
        await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
      }
    }
    
    console.log(`[AI-LESSON] Job ${jobId} complete: ${generated} generated, ${errors} errors`);
  })().catch(err => {
    console.error(`[AI-LESSON] Job ${jobId} failed:`, err);
  });
  
  return { jobId };
}
