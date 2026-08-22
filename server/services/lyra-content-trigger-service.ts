import { getSharedDb } from '../db';
import { sql } from 'drizzle-orm';
import { callGeminiWithSchema, GEMINI_MODELS } from '../gemini-utils';

const ACTFL_LEVELS = [
  'novice_low', 'novice_mid', 'novice_high',
  'intermediate_low', 'intermediate_mid', 'intermediate_high',
  'advanced_low', 'advanced_mid', 'advanced_high',
  'superior', 'distinguished',
] as const;

type ActflLevel = typeof ACTFL_LEVELS[number];

interface LessonToTag {
  id: string;
  name: string;
  type: string;
  language: string;
}

interface ActflAssignment {
  id: string;
  actflLevel: ActflLevel;
  rationale: string;
}

interface ContentTriggerResult {
  actflAssigned: number;
  actflFailed: number;
  actflDetails: ActflAssignment[];
  report: string;
}

async function inferActflLevels(lessons: LessonToTag[]): Promise<ActflAssignment[]> {
  if (lessons.length === 0) return [];

  const lessonList = lessons.map((l, i) =>
    `${i + 1}. ID: ${l.id} | Name: "${l.name}" | Type: ${l.type} | Language: ${l.language}`
  ).join('\n');

  const prompt = `You are Lyra, HolaHola's learning experience analyst. Assign the most appropriate ACTFL proficiency level to each of these language learning lessons.

ACTFL levels (in order from beginner to expert):
novice_low → novice_mid → novice_high → intermediate_low → intermediate_mid → intermediate_high → advanced_low → advanced_mid → advanced_high → superior → distinguished

Guidelines:
- Greetings, numbers, alphabet, basic phrases → novice_low or novice_mid
- Simple conversations, present tense, basic vocab → novice_high
- Past/future tenses, daily life topics → intermediate_low or intermediate_mid
- Extended discourse, narration → intermediate_high
- Discussion of abstract topics → advanced_low or advanced_mid
- Near-native fluency contexts → advanced_high to distinguished
- Drills typically match the lesson content level
- Grammar lessons match the complexity of the grammar point taught

Lessons to assign:
${lessonList}

Return one assignment per lesson, using the exact lesson ID provided.`;

  const result = await callGeminiWithSchema<{ assignments: ActflAssignment[] }>(
    GEMINI_MODELS.FLASH,
    [{ role: 'user', content: prompt }],
    {
      type: 'object',
      properties: {
        assignments: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'The exact lesson ID from the list above' },
              actflLevel: {
                type: 'string',
                enum: [...ACTFL_LEVELS],
                description: 'The ACTFL proficiency level for this lesson',
              },
              rationale: {
                type: 'string',
                description: 'One sentence explaining why this level was chosen',
              },
            },
            required: ['id', 'actflLevel', 'rationale'],
          },
          description: 'One assignment per lesson in the input list',
        },
      },
      required: ['assignments'],
    }
  );

  return result.assignments || [];
}

async function applyActflAssignments(assignments: ActflAssignment[]): Promise<{ applied: number; failed: number }> {
  let applied = 0;
  let failed = 0;
  const db = getSharedDb();

  for (const assignment of assignments) {
    try {
      if (!ACTFL_LEVELS.includes(assignment.actflLevel as ActflLevel)) {
        console.warn(`[LyraContent] Invalid ACTFL level "${assignment.actflLevel}" for lesson ${assignment.id} — skipping`);
        failed++;
        continue;
      }

      await db.execute(
        sql`UPDATE curriculum_lessons SET actfl_level = ${assignment.actflLevel} WHERE id = ${assignment.id}`
      );
      applied++;
    } catch (err: any) {
      console.error(`[LyraContent] Failed to update lesson ${assignment.id}:`, err.message);
      failed++;
    }
  }

  return { applied, failed };
}

export async function triggerActflAlignment(
  missingLessons: LessonToTag[]
): Promise<ContentTriggerResult> {
  if (missingLessons.length === 0) {
    return { actflAssigned: 0, actflFailed: 0, actflDetails: [], report: '' };
  }

  console.log(`[LyraContent] Auto-assigning ACTFL levels to ${missingLessons.length} lessons...`);

  let assignments: ActflAssignment[] = [];
  let inferFailed = 0;

  try {
    assignments = await inferActflLevels(missingLessons);
  } catch (err: any) {
    console.error(`[LyraContent] Gemini inference failed:`, err.message);
    return {
      actflAssigned: 0,
      actflFailed: missingLessons.length,
      actflDetails: [],
      report: `ACTFL auto-assignment failed: ${err.message}`,
    };
  }

  const { applied, failed } = await applyActflAssignments(assignments);
  console.log(`[LyraContent] ACTFL assignment complete: ${applied} applied, ${failed} failed`);

  const byLanguage: Record<string, ActflAssignment[]> = {};
  for (const a of assignments) {
    const lesson = missingLessons.find(l => l.id === a.id);
    const lang = lesson?.language || 'unknown';
    if (!byLanguage[lang]) byLanguage[lang] = [];
    byLanguage[lang].push(a);
  }

  const languageLines = Object.entries(byLanguage)
    .map(([lang, as]) => `  ${lang}: ${as.map(a => `"${missingLessons.find(l => l.id === a.id)?.name || a.id}" → ${a.actflLevel}`).join(', ')}`)
    .join('\n');

  const report = `**Lyra Content Fix — ACTFL Level Auto-Assignment**

Found ${missingLessons.length} lessons without ACTFL proficiency alignment. Applied levels based on lesson names, types, and languages.

Applied ${applied}/${assignments.length} assignments:
${languageLines}

${failed > 0 ? `${failed} assignment(s) failed to write — will retry on next analysis run.\n` : ''}*These levels inform the competency tracking system and Daniela's lesson sequencing. Assignments were inferred from lesson content — review any that seem off.*

*Lyra Content Trigger — ${new Date().toISOString()}*`;

  return {
    actflAssigned: applied,
    actflFailed: failed,
    actflDetails: assignments,
    report,
  };
}
