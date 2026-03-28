/**
 * Textbook Seed Service
 *
 * One-time pipeline that generates proper textbook content for every lesson
 * in a curriculum path by synthesising OER sources:
 *
 *   Wiktionary   → vocabulary entries (definitions, conjugations, forms)
 *   Tatoeba      → natural example sentences in the target language
 *   Wikivoyage   → phrasebook + destination content (Gemini picks Tatoeba OR
 *                  Wikivoyage depending on which fits the lesson better)
 *   Wikipedia    → cultural context for the unit's cultural theme
 *   Gemini       → synthesises everything into structured textbook prose
 *
 * Run once per curriculum path. Already-seeded lessons are skipped.
 */

import { GoogleGenAI } from '@google/genai';
import { getUserDb } from '../db';
import { sql } from 'drizzle-orm';
import { fetchWiktionaryEntries } from './wiktionary-service';
import { fetchTatoebaSentences, fetchTatoebaForVocabulary } from './tatoeba-service';
import { fetchWikivoyagePhrases } from './wikivoyage-service';
import { fetchSeedAndImages } from './openstax-content-service';

// ── Types ──────────────────────────────────────────────────────────────────

export interface SeedProgress {
  current:       number;
  total:         number;
  currentLesson: string;
  status:        'running' | 'complete' | 'error';
  errors:        string[];
  pathId:        string;
  pathName:      string;
}

// In-memory job store (survives for lifetime of process)
export const seedJobs = new Map<string, SeedProgress>();

// ── Gemini ─────────────────────────────────────────────────────────────────

let gemini: GoogleGenAI | null = null;
function getGemini() {
  if (!gemini) {
    gemini = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY || '',
    });
  }
  return gemini;
}

// ── Retry wrapper for Gemini rate-limit errors ─────────────────────────────

async function generateWithRetry(
  ai: GoogleGenAI,
  params: Parameters<GoogleGenAI['models']['generateContent']>[0],
  maxRetries = 3,
): Promise<any> {
  let lastErr: any;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await ai.models.generateContent(params) as any;
    } catch (err: any) {
      lastErr = err;
      const msg: string = err?.message ?? String(err);
      // Retry on rate-limit (429) or quota errors
      const isRetryable = msg.includes('429') || msg.toLowerCase().includes('rate') ||
                          msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('resource exhausted');
      if (!isRetryable || attempt === maxRetries) break;
      const delay = (attempt + 1) * 8000; // 8s, 16s, 24s back-off
      console.warn(`[TextbookSeed] Gemini rate-limit on attempt ${attempt + 1}; retrying in ${delay / 1000}s…`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

// ── Core: seed one lesson ──────────────────────────────────────────────────

export async function seedLesson(
  lessonId:   string,
  language:   string,
  actflLevel: string | null,
): Promise<boolean> {
  const db = getUserDb();

  // Skip if already seeded
  const existing = await db.execute(sql`
    SELECT id FROM textbook_lesson_content WHERE lesson_id = ${lessonId} LIMIT 1
  `);
  if (existing.rows.length > 0) return false;

  // Fetch lesson + unit data
  const lessonRow = await db.execute(sql`
    SELECT cl.id, cl.name, cl.description, cl.lesson_type, cl.conversation_topic,
           cl.required_vocabulary, cl.required_grammar, cl.objectives,
           cu.name as unit_name, cu.cultural_theme, cu.actfl_level as unit_actfl,
           cu.chapter_type
    FROM curriculum_lessons cl
    JOIN curriculum_units cu ON cu.id = cl.curriculum_unit_id
    WHERE cl.id = ${lessonId}
    LIMIT 1
  `);
  if (lessonRow.rows.length === 0) return false;

  const lesson = lessonRow.rows[0] as any;
  const vocab: string[]   = lesson.required_vocabulary ?? [];
  const grammar: string[] = lesson.required_grammar ?? [];
  const topic             = lesson.conversation_topic || lesson.name;
  const culturalTheme     = lesson.cultural_theme || lesson.chapter_type || topic;
  const level             = actflLevel || lesson.unit_actfl || 'novice_low';

  // ── Parallel OER fetches ──
  const [wiktionaryData, tatoebaVocab, topicSentences, culturalSeed, wikivoyageData] = await Promise.all([
    vocab.length > 0
      ? fetchWiktionaryEntries(vocab.slice(0, 10), language)
      : Promise.resolve({} as Record<string, string>),

    vocab.length > 0
      ? fetchTatoebaForVocabulary(vocab.slice(0, 8), language, 3)
      : Promise.resolve({} as Record<string, any[]>),

    fetchTatoebaSentences(topic, language, 6),

    fetchSeedAndImages(culturalTheme, 'history').then(r => r.text).catch(() => ''),

    fetchWikivoyagePhrases(topic, language).catch(() => ''),
  ]);

  // ── Gemini synthesis ──
  const wiktionaryBlock = Object.entries(wiktionaryData)
    .filter(([, v]) => v)
    .map(([w, v]) => `[${w}]\n${v.slice(0, 500)}`)
    .join('\n\n');

  const tatoebaVocabBlock = Object.entries(tatoebaVocab)
    .flatMap(([w, sents]: [string, any[]]) =>
      sents.map((s: any) => `${w}: "${s.target}" — "${s.translation}"`)
    )
    .join('\n');

  const topicSentsBlock = topicSentences
    .map(s => `"${s.target}" / "${s.translation}"`)
    .join('\n');

  const prompt = `You are writing a chapter of an authentic ${language} language textbook for students at the ${level} level (ACTFL scale).

Lesson: ${lesson.name}
Unit: ${lesson.unit_name}
Topic: ${topic}
Grammar focus: ${grammar.join(', ') || 'none specified'}
Key vocabulary: ${vocab.join(', ') || 'none specified'}
Learning objectives: ${(lesson.objectives ?? []).join(', ') || 'none specified'}

Reference material from open educational resources. You have been given TWO sources of example sentences/phrases (Tatoeba and Wikivoyage). Choose whichever is the better fit for this lesson — or blend both — based on the topic. For conversational, travel, restaurant, hotel, shopping, or situational lessons, Wikivoyage phrasebook content is often the richer choice. For abstract grammar or literary topics, Tatoeba sentences tend to be better.

<wiktionary_entries>
${wiktionaryBlock || '(none available)'}
</wiktionary_entries>

<tatoeba_vocabulary_sentences>
${tatoebaVocabBlock || '(none available)'}
</tatoeba_vocabulary_sentences>

<tatoeba_topic_sentences>
${topicSentsBlock || '(none available)'}
</tatoeba_topic_sentences>

<wikivoyage_phrases>
${wikivoyageData || '(none available)'}
</wikivoyage_phrases>

<cultural_context>
${culturalSeed ? culturalSeed.slice(0, 1500) : '(none available)'}
</cultural_context>

Write a complete textbook lesson. Respond ONLY with a JSON object (no markdown fences) with this exact structure:
{
  "introduction": "2-3 engaging paragraphs framing the lesson topic and why it matters to learners",
  "grammarExplanation": "Clear prose explanation of the grammar concept(s) for this level, 2-4 paragraphs",
  "grammarExamples": [
    {"target": "${language} example sentence", "translation": "English translation", "note": "short grammatical annotation"}
  ],
  "vocabularyList": [
    {"word": "target word", "translation": "English", "partOfSpeech": "noun/verb/adj/etc", "gender": "m/f/n if applicable", "conjugations": {"yo":"", "tú":"", "él/ella":""} /* for verbs only */, "exampleSentences": [{"target":"...", "translation":"..."}]}
  ],
  "culturalNote": "1-2 paragraphs of genuine cultural context relevant to the lesson topic",
  "readingPassage": "A short reading passage (3-5 sentences) appropriate for this level, using vocabulary and grammar from the lesson",
  "readingPassageTranslation": "English translation of the reading passage",
  "comprehensionQuestions": [
    {"question": "Question about the reading passage in ${language}", "answer": "Expected answer in ${language}"}
  ],
  "keyPhrasesForChat": [
    {"phrase": "target language phrase", "translation": "English", "context": "when/how to use it"}
  ]
}

Requirements:
- vocabularyList: 8-14 words, prioritise the required vocabulary listed above
- grammarExamples: 4-6 examples showing the grammar focus
- comprehensionQuestions: exactly 3
- keyPhrasesForChat: 5-7 phrases the student should have ready before a conversation with their AI tutor
- Reading passage difficulty must match ${level}
- ALL target-language text must be correct, natural ${language}`;

  const ai = getGemini();
  console.log(`[TextbookSeed] Calling Gemini for lesson "${lesson.name}" (${language}, ${level})`);
  const response = await generateWithRetry(ai, {
    model:    'gemini-3-flash-preview',
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config:   {
      temperature:     0.4,
      maxOutputTokens: 6000,
      thinkingConfig:  { thinkingLevel: 'MINIMAL' } as any,
    },
  });

  const rawText = response.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  if (!rawText) {
    const finishReason = response.candidates?.[0]?.finishReason;
    throw new Error(`Gemini returned empty response for lesson ${lessonId} (finishReason: ${finishReason ?? 'unknown'})`);
  }
  const jsonText = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();

  let parsed: any;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error(`Gemini returned invalid JSON for lesson ${lessonId}: ${jsonText.slice(0, 200)}`);
  }

  // ── Store in DB ──
  const sourcesUsed = [
    { source: 'wiktionary', note: `${Object.keys(wiktionaryData).length} entries` },
    { source: 'tatoeba', note: `${topicSentences.length} topic sentences` },
    wikivoyageData ? { source: 'wikivoyage', note: 'phrasebook + destination content' } : null,
    culturalSeed ? { source: 'wikipedia', note: 'cultural context' } : null,
  ].filter(Boolean);

  await db.execute(sql`
    INSERT INTO textbook_lesson_content
      (lesson_id, language, actfl_level, introduction, grammar_explanation,
       grammar_examples, vocabulary_list, cultural_note, reading_passage,
       reading_passage_translation, comprehension_questions, key_phrases_for_chat, sources)
    VALUES (
      ${lessonId}, ${language}, ${level},
      ${parsed.introduction ?? null},
      ${parsed.grammarExplanation ?? null},
      ${JSON.stringify(parsed.grammarExamples ?? [])},
      ${JSON.stringify(parsed.vocabularyList ?? [])},
      ${parsed.culturalNote ?? null},
      ${parsed.readingPassage ?? null},
      ${parsed.readingPassageTranslation ?? null},
      ${JSON.stringify(parsed.comprehensionQuestions ?? [])},
      ${JSON.stringify(parsed.keyPhrasesForChat ?? [])},
      ${JSON.stringify(sourcesUsed)}
    )
  `);

  return true;
}

// ── Seed an entire curriculum path ─────────────────────────────────────────

export async function seedCurriculumPath(
  pathId:     string,
  jobId:      string,
): Promise<void> {
  const db = getUserDb();

  // Fetch path info
  const pathRow = await db.execute(sql`
    SELECT id, name, language FROM curriculum_paths WHERE id = ${pathId} LIMIT 1
  `);
  if (pathRow.rows.length === 0) throw new Error('Curriculum path not found');
  const path = pathRow.rows[0] as any;

  // Fetch all lessons in this path
  const lessonsRow = await db.execute(sql`
    SELECT cl.id, cl.name, cl.actfl_level, cu.actfl_level as unit_actfl
    FROM curriculum_lessons cl
    JOIN curriculum_units cu ON cu.id = cl.curriculum_unit_id
    WHERE cu.curriculum_path_id = ${pathId}
    ORDER BY cu.order_index, cl.order_index
  `);
  const lessons = lessonsRow.rows as any[];

  const job: SeedProgress = {
    current:       0,
    total:         lessons.length,
    currentLesson: '',
    status:        'running',
    errors:        [],
    pathId,
    pathName:      path.name,
  };
  seedJobs.set(jobId, job);

  for (const lesson of lessons) {
    job.currentLesson = lesson.name;
    job.current++;
    seedJobs.set(jobId, { ...job });

    try {
      const level = lesson.actfl_level || lesson.unit_actfl;
      await seedLesson(lesson.id, path.language, level);
    } catch (err: any) {
      const msg = typeof err?.message === 'string' ? err.message : String(err);
      const detail = err?.cause ? ` [cause: ${err.cause}]` : err?.stack ? ` [at: ${err.stack?.split('\n')[1]?.trim()}]` : '';
      console.error(`[TextbookSeed] Error seeding lesson "${lesson.name}": ${msg}${detail}`);
      job.errors.push(`${lesson.name}: ${msg}`);
    }

    // Small delay to avoid hammering APIs
    await new Promise(r => setTimeout(r, 500));
  }

  job.status = 'complete';
  job.currentLesson = 'Done';
  seedJobs.set(jobId, { ...job });
  console.log(`[TextbookSeed] ✓ Path "${path.name}" seeded — ${lessons.length} lessons, ${job.errors.length} errors`);
}

// ── Bulk seed ALL paths ────────────────────────────────────────────────────

export interface BulkSeedProgress {
  totalPaths:       number;
  completedPaths:   number;
  currentPath:      string;
  currentLanguage:  string;
  totalLessons:     number;
  processedLessons: number;
  skipped:          number;
  seeded:           number;
  status:           'running' | 'complete' | 'error';
  errors:           string[];
  startedAt:        string;
  estimatedMinutes: number;
}

export const bulkSeedJobs = new Map<string, BulkSeedProgress>();

export async function bulkSeedAllPaths(jobId: string): Promise<void> {
  const db = getUserDb();

  const pathRows = await db.execute(sql`
    SELECT cp.id, cp.name, cp.language,
           (SELECT COUNT(cl.id)
            FROM curriculum_units cu
            JOIN curriculum_lessons cl ON cl.curriculum_unit_id = cu.id
            WHERE cu.curriculum_path_id = cp.id) as lesson_count
    FROM curriculum_paths cp
    ORDER BY cp.language, cp.name
  `);
  const paths = pathRows.rows as any[];
  const totalLessons = paths.reduce((s, p) => s + Number(p.lesson_count), 0);

  const bulk: BulkSeedProgress = {
    totalPaths:       paths.length,
    completedPaths:   0,
    currentPath:      '',
    currentLanguage:  '',
    totalLessons,
    processedLessons: 0,
    skipped:          0,
    seeded:           0,
    status:           'running',
    errors:           [],
    startedAt:        new Date().toISOString(),
    estimatedMinutes: Math.ceil((totalLessons * 2) / 60),
  };
  bulkSeedJobs.set(jobId, { ...bulk });

  for (let pi = 0; pi < paths.length; pi++) {
    const path = paths[pi];
    bulk.currentPath     = path.name;
    bulk.currentLanguage = path.language;
    bulkSeedJobs.set(jobId, { ...bulk });

    const lessonRows = await db.execute(sql`
      SELECT cl.id, cl.name, cl.actfl_level, cu.actfl_level as unit_actfl
      FROM curriculum_lessons cl
      JOIN curriculum_units cu ON cu.id = cl.curriculum_unit_id
      WHERE cu.curriculum_path_id = ${path.id}
      ORDER BY cu.order_index, cl.order_index
    `);
    const lessons = lessonRows.rows as any[];

    for (let li = 0; li < lessons.length; li++) {
      const lesson = lessons[li];
      try {
        const level = lesson.actfl_level || lesson.unit_actfl;
        const wasNew = await seedLesson(lesson.id, path.language, level);
        if (wasNew) bulk.seeded++;
        else        bulk.skipped++;
      } catch (err: any) {
        console.error(`[BulkSeed] ${path.name} / ${lesson.name}:`, err.message);
        bulk.errors.push(`[${path.language}] ${lesson.name}: ${err.message.slice(0, 120)}`);
      }
      bulk.processedLessons++;
      bulkSeedJobs.set(jobId, { ...bulk });

      // Throttle: Gemini + 5 OER API calls per lesson
      await new Promise(r => setTimeout(r, 1500));
    }

    bulk.completedPaths++;
    bulkSeedJobs.set(jobId, { ...bulk });
    console.log(`[BulkSeed] ✓ ${path.name} complete (${pi + 1}/${paths.length}) — ${bulk.seeded} seeded, ${bulk.skipped} skipped`);
  }

  bulk.status = 'complete';
  bulkSeedJobs.set(jobId, { ...bulk });
  console.log(`[BulkSeed] All ${paths.length} paths seeded. ${bulk.seeded} new, ${bulk.skipped} skipped, ${bulk.errors.length} errors.`);
}
