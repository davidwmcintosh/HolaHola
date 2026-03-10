/**
 * Curriculum Enrichment Service
 *
 * Two-pass OER pipeline that runs over every lesson in a curriculum path
 * BEFORE textbook seeding:
 *
 *   Pass 1 — BACKFILL
 *     For lessons missing required_vocabulary or required_grammar, fetches
 *     real OER material (Wiktionary, Tatoeba, Wikivoyage) and asks Gemini to
 *     generate those fields in the same rich format the best existing lessons
 *     already use.
 *
 *   Pass 2 — OER VALIDATION
 *     For all lessons (including already-populated ones), cross-checks the
 *     existing vocabulary against Wiktionary (are the words real and correctly
 *     described?) and notes how well Tatoeba + Wikivoyage corroborate the
 *     content. Stores a lightweight `enrichment_notes` JSON blob on the lesson.
 *
 * Writes back to curriculum_lessons.required_vocabulary,
 * curriculum_lessons.required_grammar, curriculum_lessons.enrichment_notes,
 * and curriculum_lessons.enriched_at.
 */

import { GoogleGenAI } from '@google/genai';
import { getUserDb } from '../db';
import { sql } from 'drizzle-orm';
import { fetchWiktionaryEntries } from './wiktionary-service';
import { fetchTatoebaSentences } from './tatoeba-service';
import { fetchWikivoyagePhrases } from './wikivoyage-service';

// ── Types ──────────────────────────────────────────────────────────────────

export interface EnrichProgress {
  current:       number;
  total:         number;
  currentLesson: string;
  status:        'running' | 'complete' | 'error';
  errors:        string[];
  pathId:        string;
  pathName:      string;
  backfilled:    number;
  validated:     number;
}

export const enrichJobs = new Map<string, EnrichProgress>();

// ── Gemini ──────────────────────────────────────────────────────────────────

let gemini: GoogleGenAI | null = null;
function getGemini() {
  if (!gemini) {
    gemini = new GoogleGenAI({
      apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '',
    });
  }
  return gemini;
}

// ── Vocabulary format examples by language (for prompt alignment) ───────────

const VOCAB_FORMAT_EXAMPLES: Record<string, string> = {
  spanish:    '"hablar - to speak (regular -ar verb)"',
  french:     '"parler - to speak (regular -er verb)"',
  german:     '"sprechen (sprach, gesprochen) - to speak"',
  italian:    '"parlare - to speak (regular -are verb)"',
  portuguese: '"falar - to speak (regular -ar verb)"',
  japanese:   '"話す (はなす, hanasu) - to speak; to talk"',
  korean:     '"말하다 (malhada) - to speak; to say"',
  mandarin:   '"说话 (shuōhuà) - to speak; to talk"',
  chinese:    '"说话 (shuōhuà) - to speak; to talk"',
  english:    '"articulate (adj) - able to express ideas clearly"',
};

const GRAMMAR_FORMAT_EXAMPLES: Record<string, string> = {
  spanish:    '"Present tense conjugation of regular -ar verbs (yo hablo, tú hablas, él habla)"',
  french:     '"Present tense of -er verbs: je parle, tu parles, il/elle parle"',
  german:     '"Strong verb conjugation in present tense (e.g. sprechen: ich spreche, du sprichst)"',
  italian:    '"Present indicative of -are verbs: parlo, parli, parla, parliamo"',
  portuguese: '"Present indicative of -ar verbs: falo, falas, fala, falamos"',
  japanese:   '"て形 (te-form) for linking actions: 食べて、飲んで (eat and drink)"',
  korean:     '"아/어서 connective ending for sequential actions or reasons"',
  mandarin:   '"了 (le) particle for completed actions or changed states"',
  chinese:    '"了 (le) particle for completed actions or changed states"',
  english:    '"Subordinate clauses with because, although, while + subject + verb"',
};

// ── Core: enrich one lesson ──────────────────────────────────────────────────

export async function enrichLesson(lessonId: string, language: string): Promise<{
  backfilled: boolean;
  validated:  boolean;
}> {
  const db = getUserDb();

  // Fetch lesson + unit
  const rows = await db.execute(sql`
    SELECT cl.id, cl.name, cl.description, cl.lesson_type, cl.conversation_topic,
           cl.required_vocabulary, cl.required_grammar, cl.objectives,
           cl.enriched_at,
           cu.name as unit_name, cu.cultural_theme, cu.actfl_level, cu.chapter_type,
           cp.language as path_language
    FROM curriculum_lessons cl
    JOIN curriculum_units cu ON cu.id = cl.curriculum_unit_id
    JOIN curriculum_paths cp ON cp.id = cu.curriculum_path_id
    WHERE cl.id = ${lessonId}
    LIMIT 1
  `);
  if (rows.rows.length === 0) return { backfilled: false, validated: false };

  const lesson = rows.rows[0] as any;
  const lang = language || lesson.path_language;
  const level = lesson.actfl_level || 'novice_low';
  const topic = lesson.conversation_topic || lesson.name;
  const existingVocab: string[] | null = lesson.required_vocabulary;
  const existingGrammar: string[] | null = lesson.required_grammar;
  const needsBackfill = !existingVocab || existingVocab.length === 0
                     || !existingGrammar || existingGrammar.length === 0;

  // ── OER fetches ──
  // For Wiktionary: use bare words stripped from existing vocab entries, or
  // topic keywords if no vocab yet
  const topicWords = topic.split(/[\s,;]+/).filter((w: string) => w.length > 3).slice(0, 6);
  const vocabWords = existingVocab
    ? existingVocab.slice(0, 8).map(v => v.split(/[\s(]/)[0].trim()).filter(w => w.length > 1)
    : topicWords;

  const [wiktionaryData, tatoebaSents, wikivoyageData] = await Promise.all([
    vocabWords.length > 0
      ? fetchWiktionaryEntries(vocabWords.slice(0, 8), lang).catch(() => ({} as Record<string, string>))
      : Promise.resolve({} as Record<string, string>),
    fetchTatoebaSentences(topic, lang, 5).catch(() => []),
    fetchWikivoyagePhrases(topic, lang).catch(() => ''),
  ]);

  const wiktionaryBlock = Object.entries(wiktionaryData)
    .filter(([, v]) => v)
    .map(([w, v]) => `[${w}]: ${v.slice(0, 400)}`)
    .join('\n\n');

  const tatoebaBlock = tatoebaSents
    .map(s => `"${s.target}" / "${s.translation}"`)
    .join('\n');

  const vocabFormatExample = VOCAB_FORMAT_EXAMPLES[lang] || VOCAB_FORMAT_EXAMPLES['spanish'];
  const grammarFormatExample = GRAMMAR_FORMAT_EXAMPLES[lang] || GRAMMAR_FORMAT_EXAMPLES['spanish'];

  const prompt = `You are a senior ${lang} language curriculum designer validating and enriching a lesson for an ACTFL-aligned digital textbook.

LESSON CONTEXT
==============
Language: ${lang}
ACTFL Level: ${level}
Lesson name: ${lesson.name}
Lesson type: ${lesson.lesson_type}
Topic / conversation focus: ${topic}
Unit: ${lesson.unit_name}
Cultural theme: ${lesson.cultural_theme || 'not specified'}
Objectives:
${(lesson.objectives ?? []).join('\n') || 'not specified'}

EXISTING CURRICULUM DATA (may be null/empty if not yet populated)
==================================================================
required_vocabulary: ${existingVocab ? JSON.stringify(existingVocab) : 'NULL — needs generation'}
required_grammar: ${existingGrammar ? JSON.stringify(existingGrammar) : 'NULL — needs generation'}

OER SOURCE MATERIAL
===================
<wiktionary>
${wiktionaryBlock || '(not available for this topic)'}
</wiktionary>

<tatoeba_sentences>
${tatoebaBlock || '(not available)'}
</tatoeba_sentences>

<wikivoyage>
${wikivoyageData ? wikivoyageData.slice(0, 1500) : '(not applicable)'}
</wikivoyage>

YOUR TASK
=========
1. VOCABULARY: ${existingVocab && existingVocab.length > 0
    ? 'The vocabulary list already exists. Cross-check each word against the Wiktionary data. Remove any that appear incorrect or misattributed to this language. Add up to 4 new words that the OER sources suggest are highly relevant to this lesson topic and level. Return the final improved list.'
    : 'Generate a vocabulary list of 8-14 words perfectly suited to this lesson topic, type, and ACTFL level.'}
   FORMAT each vocabulary entry as a single string like: ${vocabFormatExample}
   For Japanese/Korean/Mandarin ALWAYS include romanisation (romaji/romanization/pinyin) in parentheses.
   For gendered languages (Spanish/French/German/Italian/Portuguese) include gender markers (m/f) where applicable.

2. GRAMMAR: ${existingGrammar && existingGrammar.length > 0
    ? 'The grammar list already exists. Validate that each concept is appropriate for this ACTFL level and lesson type. Adjust wording for clarity if needed. Return the improved list.'
    : 'Generate 3-6 grammar concepts appropriate for this ACTFL level and lesson type.'}
   FORMAT each grammar entry as a single descriptive string like: ${grammarFormatExample}

3. OER_CORROBORATION: Provide a brief JSON object summarising what OER sources confirmed:
   - wiktionary: how many vocab words were confirmed in Wiktionary
   - tatoeba: whether Tatoeba had sentences for this topic
   - wikivoyage: whether Wikivoyage had relevant phrasebook content
   - quality_flags: array of strings flagging any issues found (e.g. "word X not found in Wiktionary", "level mismatch on grammar concept Y")

Respond ONLY with a JSON object (no markdown fences):
{
  "vocabulary": ["...", "...", ...],
  "grammar": ["...", "...", ...],
  "oerCorroboration": {
    "wiktionary": "8 of 10 words confirmed",
    "tatoeba": "5 sentences found",
    "wikivoyage": "phrasebook section matched",
    "qualityFlags": []
  }
}`;

  const ai = getGemini();
  const response = await ai.models.generateContent({
    model:    'gemini-2.0-flash',
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config:   { temperature: 0.3, maxOutputTokens: 1500 },
  });

  const rawText = response.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const jsonText = rawText
    .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();

  let parsed: any;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error(`Gemini returned invalid JSON for lesson ${lessonId}: ${jsonText.slice(0, 200)}`);
  }

  const newVocab:   string[] = parsed.vocabulary  ?? existingVocab  ?? [];
  const newGrammar: string[] = parsed.grammar      ?? existingGrammar ?? [];
  const notes = parsed.oerCorroboration ?? {};

  await db.execute(sql`
    UPDATE curriculum_lessons
    SET required_vocabulary = ${newVocab},
        required_grammar    = ${newGrammar},
        enrichment_notes    = ${JSON.stringify(notes)},
        enriched_at         = NOW()
    WHERE id = ${lessonId}
  `);

  return { backfilled: needsBackfill, validated: true };
}

// ── Enrich an entire curriculum path ────────────────────────────────────────

export async function enrichCurriculumPath(pathId: string, jobId: string): Promise<void> {
  const db = getUserDb();

  const pathRow = await db.execute(sql`
    SELECT id, name, language FROM curriculum_paths WHERE id = ${pathId} LIMIT 1
  `);
  if (pathRow.rows.length === 0) throw new Error(`Path ${pathId} not found`);

  const { name: pathName, language } = pathRow.rows[0] as any;

  const lessonRows = await db.execute(sql`
    SELECT cl.id, cl.name, cl.enriched_at
    FROM curriculum_lessons cl
    JOIN curriculum_units cu ON cu.id = cl.curriculum_unit_id
    WHERE cu.curriculum_path_id = ${pathId}
    ORDER BY cu.order_index, cl.order_index
  `);
  const lessons = lessonRows.rows as any[];

  const job: EnrichProgress = {
    current: 0, total: lessons.length, currentLesson: '',
    status: 'running', errors: [],
    pathId, pathName, backfilled: 0, validated: 0,
  };
  enrichJobs.set(jobId, job);

  for (let i = 0; i < lessons.length; i++) {
    const lesson = lessons[i];
    job.current       = i + 1;
    job.currentLesson = lesson.name;
    enrichJobs.set(jobId, { ...job });

    try {
      const result = await enrichLesson(lesson.id, language);
      if (result.backfilled) job.backfilled++;
      if (result.validated)  job.validated++;
    } catch (err: any) {
      console.error(`[CurriculumEnrich] ${lesson.name}:`, err.message);
      job.errors.push(`${lesson.name}: ${err.message.slice(0, 120)}`);
    }

    // Throttle: 1 lesson per 1.2 s to respect Gemini rate limits
    await new Promise(r => setTimeout(r, 1200));
  }

  job.status = 'complete';
  enrichJobs.set(jobId, { ...job });
}
