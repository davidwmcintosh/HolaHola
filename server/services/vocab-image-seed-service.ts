/**
 * Vocab Image Seed Service
 *
 * Pre-generates and caches watercolor vocabulary images for every word in the
 * textbook curriculum, so students never wait for on-demand DALL-E generation.
 *
 * Strategy:
 *   1. Pull all distinct vocab drill words (listen_repeat + translate_speak,
 *      target_text length < 50) for the requested language(s).
 *   2. Run each word through resolveVocabularyImage — which checks the shared
 *      cache first (free, instant) and only calls DALL-E on a true miss.
 *   3. Process 3 words concurrently per batch to stay within rate limits.
 *   4. Report progress via in-memory job map (polled by the admin endpoint).
 */

import { getUserDb } from '../db';
import { curriculumDrillItems } from '../../shared/schema';
import { inArray, sql } from 'drizzle-orm';
import { resolveVocabularyImage } from './vocabulary-image-resolver';

// ── Types ──────────────────────────────────────────────────────────────────

export interface VocabSeedProgress {
  language: string;
  status: 'running' | 'complete' | 'error';
  total: number;
  processed: number;
  cached: number;    // already had an image (cache hit)
  generated: number; // newly generated via DALL-E
  skipped: number;   // placeholder / error
  errors: string[];
  currentWord: string;
  startedAt: string;
  finishedAt?: string;
}

export const vocabSeedJobs = new Map<string, VocabSeedProgress>();

// ── Helpers ────────────────────────────────────────────────────────────────

async function fetchTextbookVocab(
  language: string,
): Promise<Array<{ word: string; prompt: string }>> {
  const db = getUserDb();

  // Map UI language names to targetLanguage column values
  const langMap: Record<string, string> = {
    spanish: 'spanish',
    french: 'french',
    german: 'german',
    portuguese: 'portuguese',
    italian: 'italian',
    english: 'english',
    mandarin: 'mandarin',
    japanese: 'japanese',
    korean: 'korean',
  };
  const dbLang = langMap[language.toLowerCase()] ?? language.toLowerCase();

  const rows = await db.execute(sql`
    SELECT DISTINCT
      TRIM(target_text) AS word,
      TRIM(prompt)      AS prompt
    FROM curriculum_drill_items
    WHERE item_type IN ('listen_repeat', 'translate_speak')
      AND target_language = ${dbLang}
      AND target_text IS NOT NULL
      AND LENGTH(TRIM(target_text)) BETWEEN 1 AND 40
      -- exclude numbered multiple-choice answers ("2. They are ordering...")
      AND TRIM(target_text) !~ '^[0-9]'
      -- exclude full sentences (more than 5 words)
      AND array_length(regexp_split_to_array(TRIM(target_text), '\s+'), 1) <= 5
    ORDER BY word
  `);

  return (rows.rows ?? rows) as Array<{ word: string; prompt: string }>;
}

// ── Main seeder ────────────────────────────────────────────────────────────

export async function seedVocabImages(language: string, jobId: string): Promise<void> {
  const progress: VocabSeedProgress = {
    language,
    status: 'running',
    total: 0,
    processed: 0,
    cached: 0,
    generated: 0,
    skipped: 0,
    errors: [],
    currentWord: '',
    startedAt: new Date().toISOString(),
  };
  vocabSeedJobs.set(jobId, progress);

  try {
    const words = await fetchTextbookVocab(language);
    progress.total = words.length;
    console.log(`[VocabSeed] ${language}: ${words.length} vocab words to process`);

    const BATCH = 3;
    for (let i = 0; i < words.length; i += BATCH) {
      const batch = words.slice(i, i + BATCH);

      await Promise.all(
        batch.map(async ({ word, prompt }) => {
          progress.currentWord = word;
          try {
            // Extract English translation from prompt (strips "Say X in Spanish. Context: ..." patterns)
            const translation = cleanPromptToEnglish(prompt, word);

            const result = await resolveVocabularyImage({
              word,
              language,
              description: word,
              translation: translation !== word ? translation : undefined,
            });

            if (result.source === 'cache') {
              progress.cached++;
            } else if (result.source === 'ai') {
              progress.generated++;
              console.log(`[VocabSeed] ✓ Generated: "${word}" (${language})`);
            } else {
              progress.skipped++;
            }
          } catch (err: any) {
            progress.skipped++;
            progress.errors.push(`"${word}": ${err.message}`);
            console.error(`[VocabSeed] ✗ Failed: "${word}":`, err.message);
          }
          progress.processed++;
        }),
      );

      // Brief pause between batches to avoid overwhelming DALL-E
      if (i + BATCH < words.length) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    progress.status = 'complete';
    progress.finishedAt = new Date().toISOString();
    console.log(
      `[VocabSeed] ✓ ${language} complete — ` +
      `${progress.cached} cached, ${progress.generated} generated, ${progress.skipped} skipped`,
    );
  } catch (err: any) {
    progress.status = 'error';
    progress.errors.push(err.message);
    progress.finishedAt = new Date().toISOString();
    console.error(`[VocabSeed] Fatal error for ${language}:`, err.message);
  }
}

// ── Bulk seeder (all languages) ────────────────────────────────────────────

export interface BulkVocabSeedProgress {
  status: 'running' | 'complete' | 'error';
  languages: string[];
  current: string;
  completed: string[];
  errors: string[];
  startedAt: string;
  finishedAt?: string;
}

export const bulkVocabSeedJobs = new Map<string, BulkVocabSeedProgress>();

const ALL_LANGUAGES = ['spanish', 'french', 'german', 'portuguese', 'italian', 'english', 'mandarin', 'japanese', 'korean'];

export async function seedAllVocabImages(jobId: string, languages?: string[]): Promise<void> {
  const langs = languages ?? ALL_LANGUAGES;

  const bulk: BulkVocabSeedProgress = {
    status: 'running',
    languages: langs,
    current: '',
    completed: [],
    errors: [],
    startedAt: new Date().toISOString(),
  };
  bulkVocabSeedJobs.set(jobId, bulk);

  try {
    for (const lang of langs) {
      bulk.current = lang;
      const subJobId = `${jobId}-${lang}`;
      try {
        await seedVocabImages(lang, subJobId);
        bulk.completed.push(lang);
      } catch (err: any) {
        bulk.errors.push(`${lang}: ${err.message}`);
        console.error(`[BulkVocabSeed] Error for ${lang}:`, err.message);
      }
    }

    bulk.status = 'complete';
    bulk.finishedAt = new Date().toISOString();
    console.log(`[BulkVocabSeed] All languages complete`);
  } catch (err: any) {
    bulk.status = 'error';
    bulk.errors.push(err.message);
    bulk.finishedAt = new Date().toISOString();
  }
}

// ── Prompt cleaner ─────────────────────────────────────────────────────────

function cleanPromptToEnglish(prompt: string, word: string): string {
  if (!prompt) return word;
  return prompt
    .replace(/^Say\s+"([^"]+)"\s+in\s+\w+\.\s*Context:\s*/i, '$1 — ')
    .replace(/^Say\s+"([^"]+)"\s+in\s+\w+\.?\s*/i, '$1')
    .replace(/^Translate[:\s]+/i, '')
    .trim() || word;
}
