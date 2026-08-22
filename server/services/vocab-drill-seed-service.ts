/**
 * vocab-drill-seed-service.ts
 *
 * Converts the structured vocabulary_list and key_phrases_for_chat already
 * stored in textbook_lesson_content into curriculum_drill_items so they
 * appear in the textbook visual-vocab grid and audio player.
 *
 * Safe to run multiple times — deduplicates by target_text per lesson.
 */

import { getSharedDb } from '../db';
import { eq, and, inArray, sql } from 'drizzle-orm';
import {
  textbookLessonContent,
  curriculumDrillItems,
  curriculumLessons,
  curriculumUnits,
  curriculumPaths,
  type InsertCurriculumDrillItem,
} from '../../shared/schema';

const SUPPORTED_LANGUAGES = ['spanish', 'french', 'english', 'german', 'italian', 'portuguese', 'japanese', 'mandarin', 'arabic', 'hebrew'];

interface VocabEntry {
  word: string;
  translation: string;
  partOfSpeech?: string;
}

interface PhraseEntry {
  phrase: string;
  translation: string;
  context?: string;
}

interface SeedResult {
  language: string;
  lessonsProcessed: number;
  lessonsSkipped: number; // already had translate_speak items
  lessonsNoProse: number; // no textbook_lesson_content
  itemsCreated: number;
  errors: string[];
}

/**
 * Seed vocab drill items for a single lesson.
 * Returns number of items created.
 */
async function seedLesson(
  lessonId: string,
  language: string,
  db: ReturnType<typeof getSharedDb>,
): Promise<{ created: number; skipped: boolean; reason?: string }> {
  // Load the existing textbook content for this lesson
  const [content] = await db
    .select({
      vocabularyList: textbookLessonContent.vocabularyList,
      keyPhrasesForChat: textbookLessonContent.keyPhrasesForChat,
    })
    .from(textbookLessonContent)
    .where(eq(textbookLessonContent.lessonId, lessonId))
    .limit(1);

  if (!content) {
    return { created: 0, skipped: false, reason: 'no_prose' };
  }

  const vocabList: VocabEntry[] = (content.vocabularyList as VocabEntry[] | null) ?? [];
  const phraseList: PhraseEntry[] = (content.keyPhrasesForChat as PhraseEntry[] | null) ?? [];

  if (vocabList.length === 0 && phraseList.length === 0) {
    return { created: 0, skipped: false, reason: 'empty_content' };
  }

  // Load existing drill items for dedup and order_index
  const existing = await db
    .select({ targetText: curriculumDrillItems.targetText, orderIndex: curriculumDrillItems.orderIndex })
    .from(curriculumDrillItems)
    .where(eq(curriculumDrillItems.lessonId, lessonId));

  // Check if lesson already has translate_speak items covering these words
  const existingTranslateSpeak = await db
    .select({ targetText: curriculumDrillItems.targetText })
    .from(curriculumDrillItems)
    .where(
      and(
        eq(curriculumDrillItems.lessonId, lessonId),
        eq(curriculumDrillItems.itemType, 'translate_speak' as any),
      ),
    );

  // If it already has 5+ translate_speak items, skip (already seeded or manually curated)
  if (existingTranslateSpeak.length >= 5) {
    return { created: 0, skipped: true };
  }

  const existingTargets = new Set(
    existing.map(e => normalizeTarget(e.targetText)),
  );
  const existingTranslateTargets = new Set(
    existingTranslateSpeak.map(e => normalizeTarget(e.targetText)),
  );

  const maxOrderIndex = existing.length > 0
    ? Math.max(...existing.map(e => e.orderIndex))
    : 0;

  const toInsert: InsertCurriculumDrillItem[] = [];
  let nextOrder = maxOrderIndex + 10;

  // ── Vocabulary items ────────────────────────────────────────────────────────
  for (const entry of vocabList) {
    const word = (entry.word ?? '').trim();
    const translation = (entry.translation ?? '').trim();

    if (!word || !translation) continue;
    // Skip very long entries (not suitable for vocab cards)
    if (word.length > 60) continue;
    // Skip if already covered
    if (existingTranslateTargets.has(normalizeTarget(word))) continue;

    toInsert.push({
      lessonId,
      itemType: 'translate_speak' as any,
      orderIndex: nextOrder,
      prompt: translation,        // English shown on card
      targetText: word,           // Target language word
      targetLanguage: language,
      difficulty: 1,
      tags: ['vocab', 'seeded', entry.partOfSpeech ?? 'unknown'].filter(Boolean),
    });
    existingTranslateTargets.add(normalizeTarget(word));
    nextOrder += 10;
  }

  // ── Key phrase items ────────────────────────────────────────────────────────
  for (const entry of phraseList) {
    const phrase = (entry.phrase ?? '').trim();
    const translation = (entry.translation ?? '').trim();

    if (!phrase || !translation) continue;
    // Skip very long phrases
    if (phrase.length > 80) continue;
    // Skip if already covered
    if (existingTranslateTargets.has(normalizeTarget(phrase))) continue;

    toInsert.push({
      lessonId,
      itemType: 'translate_speak' as any,
      orderIndex: nextOrder,
      prompt: translation,        // English shown on card
      targetText: phrase,         // Target language phrase
      targetLanguage: language,
      difficulty: 2,
      tags: ['phrase', 'seeded'],
    });
    existingTranslateTargets.add(normalizeTarget(phrase));
    nextOrder += 10;
  }

  if (toInsert.length === 0) {
    return { created: 0, skipped: true, reason: 'all_duplicates' };
  }

  // Insert in batches of 50
  const BATCH = 50;
  for (let i = 0; i < toInsert.length; i += BATCH) {
    await db.insert(curriculumDrillItems).values(toInsert.slice(i, i + BATCH));
  }

  return { created: toInsert.length, skipped: false };
}

function normalizeTarget(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Seed all lessons across all supported languages.
 * Yields progress updates via the onProgress callback.
 */
export async function seedVocabDrillItems(
  options: {
    languages?: string[];
    onProgress?: (msg: string) => void;
  } = {},
): Promise<SeedResult[]> {
  const db = getSharedDb();
  const languages = options.languages ?? SUPPORTED_LANGUAGES;
  const log = options.onProgress ?? (() => {});
  const results: SeedResult[] = [];

  for (const language of languages) {
    const result: SeedResult = {
      language,
      lessonsProcessed: 0,
      lessonsSkipped: 0,
      lessonsNoProse: 0,
      itemsCreated: 0,
      errors: [],
    };

    log(`[VocabDrillSeed] Starting language: ${language}`);

    // Get all lessons for this language (except Active Practice / AI-Generated leaves)
    const lessons = await db
      .select({ id: curriculumLessons.id, name: curriculumLessons.name })
      .from(curriculumLessons)
      .innerJoin(curriculumUnits, eq(curriculumUnits.id, curriculumLessons.curriculumUnitId))
      .innerJoin(curriculumPaths, eq(curriculumPaths.id, curriculumUnits.curriculumPathId))
      .where(eq(curriculumPaths.language, language));

    log(`[VocabDrillSeed] ${language}: found ${lessons.length} lessons`);

    for (const lesson of lessons) {
      // Skip Active Practice and AI-Generated lessons — they already have drills
      if (
        lesson.name.includes('Active Practice') ||
        lesson.name.includes('AI-Generated Practice') ||
        lesson.name.includes('Mixed Drills')
      ) {
        result.lessonsSkipped++;
        continue;
      }

      try {
        const outcome = await seedLesson(lesson.id, language, db);
        if (outcome.reason === 'no_prose' || outcome.reason === 'empty_content') {
          result.lessonsNoProse++;
          log(`[VocabDrillSeed] ${language}: SKIP (no prose) — ${lesson.name}`);
        } else if (outcome.skipped) {
          result.lessonsSkipped++;
        } else {
          result.lessonsProcessed++;
          result.itemsCreated += outcome.created;
          if (outcome.created > 0) {
            log(`[VocabDrillSeed] ${language}: +${outcome.created} items — ${lesson.name}`);
          }
        }
      } catch (err: any) {
        result.errors.push(`${lesson.name}: ${err.message}`);
        log(`[VocabDrillSeed] ${language}: ERROR — ${lesson.name}: ${err.message}`);
      }
    }

    log(`[VocabDrillSeed] ${language} done — processed: ${result.lessonsProcessed}, created: ${result.itemsCreated}, skipped: ${result.lessonsSkipped}, no-prose: ${result.lessonsNoProse}`);
    results.push(result);
  }

  return results;
}
