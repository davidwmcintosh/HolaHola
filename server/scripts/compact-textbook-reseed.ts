/**
 * compact-textbook-reseed.ts
 *
 * Rewrites `introduction` and `grammar_explanation` for verbose lessons in Spanish,
 * French, Portuguese, German, Italian, and Korean.
 *
 * The original seed used a "traditional textbook" prompt that produces:
 *   - 150-word welcome paragraphs repeating the unit name every lesson
 *   - 200-word grammar essays instead of a pattern + one example
 *
 * The new prompt targets:
 *   - introduction: 1-2 sentences, ≤ 220 characters, no unit welcome, no motivation
 *   - grammar_explanation: pattern + 1 example, ≤ 400 characters, no paragraph structure
 *
 * vocabulary_list, key_phrases_for_chat, reading_passage, cultural_note are untouched.
 *
 * Usage:
 *   npx tsx server/scripts/compact-textbook-reseed.ts --sample   (5 lessons, prints before/after)
 *   npx tsx server/scripts/compact-textbook-reseed.ts --run      (full 837 lessons)
 */

import { Pool } from 'pg';
import { GoogleGenAI } from '@google/genai';

const GEMINI_FLASH = 'gemini-3-flash-preview';
const BATCH_SIZE = 12;
const BATCH_DELAY_MS = 600;

const VERBOSE_INTRO_THRESHOLD = 600;
const VERBOSE_GRAMMAR_THRESHOLD = 800;

const LANGUAGES = ['spanish', 'french', 'portuguese', 'german', 'italian', 'korean'];

const gemini = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY || '',
  httpOptions: {
    apiVersion: '',
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL || '',
  },
});

interface LessonRow {
  id: string;
  lesson_id: string;
  lesson_name: string;
  lesson_type: string;
  language: string;
  introduction: string;
  grammar_explanation: string;
  vocabulary_list: any[];
  seed_version: number;
}

interface CompactContent {
  introduction: string;
  grammar_explanation: string;
}

function buildPrompt(lesson: LessonRow): string {
  const vocabSample = (lesson.vocabulary_list || [])
    .slice(0, 6)
    .map((v: any) => v.word || v.term || JSON.stringify(v))
    .join(', ');

  return `You are writing companion content for a language learning app. This is NOT a traditional textbook.
The purpose: the student reads this BRIEFLY before a voice conversation with an AI tutor.
The goal is rapid uptake — get the concept in, then let the conversation cement it.

Rules:
- NO "Welcome to Unit X" or "Bienvenue à l'Unité" or any unit re-introduction
- NO motivational phrases like "Imagine yourself..." or "Learning this will open doors..."
- NO "First we will... Then we will... Next..." structure
- State each thing ONCE. No repetition.
- Be direct and specific to THIS lesson.

Lesson name: ${lesson.lesson_name}
Language: ${lesson.language}
Lesson type: ${lesson.lesson_type}
Key vocabulary: ${vocabSample || 'see lesson'}

Generate two fields:

1. INTRODUCTION (1-2 sentences, ≤ 220 characters):
   Describe exactly what this lesson covers. Be specific to the lesson topic.
   Start with what the student will learn/use, not with a greeting.
   Example style: "In this lesson you practice asking and answering questions about daily routines using reflexive verbs."

2. GRAMMAR_EXPLANATION (rule + 1 example, ≤ 400 characters):
   State the core grammar pattern or rule for this lesson type.
   Give exactly one target-language example with translation in parentheses.
   No paragraph prose. No "This is used when..." lead-ins longer than one clause.
   If lesson type is 'conversation' or 'drill', focus on the key structure students will use in chat.
   Example style: "Use 'jouer à' for ball sports and 'faire de' for activities: Je joue au tennis (I play tennis) / Je fais de la natation (I swim)."

Return valid JSON only: { "introduction": "...", "grammar_explanation": "..." }`;
}

async function generateCompactContent(lesson: LessonRow): Promise<CompactContent | null> {
  const prompt = buildPrompt(lesson);
  try {
    const response = await gemini.models.generateContent({
      model: GEMINI_FLASH,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object' as any,
          properties: {
            introduction: { type: 'string' as any },
            grammar_explanation: { type: 'string' as any },
          },
          required: ['introduction', 'grammar_explanation'],
        },
      },
    });
    const text = response.text || '';
    const parsed = JSON.parse(text);
    if (!parsed.introduction || !parsed.grammar_explanation) return null;
    // Enforce hard length caps
    const intro = parsed.introduction.slice(0, 320);
    const grammar = parsed.grammar_explanation.slice(0, 520);
    return { introduction: intro, grammar_explanation: grammar };
  } catch (err: any) {
    return null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const isSample = args.includes('--sample');
  const isRun = args.includes('--run');

  if (!isSample && !isRun) {
    console.log('Usage:');
    console.log('  npx tsx server/scripts/compact-textbook-reseed.ts --sample   (preview 5 lessons)');
    console.log('  npx tsx server/scripts/compact-textbook-reseed.ts --run      (full re-seed)');
    process.exit(0);
  }

  const pool = new Pool({ connectionString: process.env.NEON_SHARED_DATABASE_URL, ssl: { rejectUnauthorized: false } });

  const langList = LANGUAGES.map((_, i) => `$${i + 1}`).join(', ');
  const { rows: lessons } = await pool.query<LessonRow>(`
    SELECT 
      tlc.id,
      tlc.lesson_id,
      cl.name as lesson_name,
      cl.lesson_type,
      tlc.language,
      tlc.introduction,
      tlc.grammar_explanation,
      tlc.vocabulary_list,
      tlc.seed_version
    FROM textbook_lesson_content tlc
    JOIN curriculum_lessons cl ON cl.id = tlc.lesson_id
    WHERE (LENGTH(tlc.introduction) > ${VERBOSE_INTRO_THRESHOLD} 
        OR LENGTH(tlc.grammar_explanation) > ${VERBOSE_GRAMMAR_THRESHOLD})
      AND tlc.language = ANY($1::text[])
    ORDER BY tlc.language, cl.lesson_type, cl.name
    ${isSample ? 'LIMIT 6' : ''}
  `, [LANGUAGES]);

  console.log(`\n[CompactReseed] ${isSample ? 'SAMPLE MODE' : 'FULL RUN'} — ${lessons.length} lessons to process\n`);

  let updated = 0;
  let failed = 0;

  for (let i = 0; i < lessons.length; i += BATCH_SIZE) {
    const batch = lessons.slice(i, i + BATCH_SIZE);

    await Promise.all(batch.map(async (lesson) => {
      const compact = await generateCompactContent(lesson);

      if (!compact) {
        console.log(`  ✗ FAILED: ${lesson.lesson_name} (${lesson.language})`);
        failed++;
        return;
      }

      if (isSample) {
        console.log(`\n${'═'.repeat(72)}`);
        console.log(`LESSON: ${lesson.lesson_name} [${lesson.lesson_type}] (${lesson.language})`);
        console.log(`\nBEFORE intro  (${lesson.introduction?.length || 0}ch): "${lesson.introduction?.slice(0, 200)}..."`);
        console.log(`AFTER  intro  (${compact.introduction.length}ch): "${compact.introduction}"`);
        console.log(`\nBEFORE grammar (${lesson.grammar_explanation?.length || 0}ch): "${lesson.grammar_explanation?.slice(0, 200)}..."`);
        console.log(`AFTER  grammar (${compact.grammar_explanation.length}ch): "${compact.grammar_explanation}"`);
      } else {
        await pool.query(`
          UPDATE textbook_lesson_content
          SET introduction = $1,
              grammar_explanation = $2,
              seed_version = COALESCE(seed_version, 1) + 1
          WHERE id = $3
        `, [compact.introduction, compact.grammar_explanation, lesson.id]);
        updated++;
      }
    }));

    if (!isSample) {
      const pct = Math.round(((i + batch.length) / lessons.length) * 100);
      console.log(`[CompactReseed] Batch ${Math.ceil(i / BATCH_SIZE) + 1} — ${i + batch.length}/${lessons.length} (${pct}%) — ${updated} updated, ${failed} failed`);
    }

    if (i + BATCH_SIZE < lessons.length) {
      await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
    }
  }

  if (isSample) {
    console.log(`\n[CompactReseed] Sample complete. Run with --run to apply to all ${lessons.length} lessons.`);
  } else {
    console.log(`\n[CompactReseed] Done — ${updated} updated, ${failed} failed out of ${lessons.length} total.`);
  }

  await pool.end();
}

main().catch(console.error);
