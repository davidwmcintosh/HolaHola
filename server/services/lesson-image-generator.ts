/**
 * Lesson Image Generator
 *
 * Generates warm illustrative cover images for curriculum lessons using
 * Gemini Flash Image. Images are stored permanently in object storage and the URL
 * is saved back to curriculumLessons.imageUrl.
 *
 * Processes lessons that:
 *  - Have requiredTopics (tagged by lesson-topic-tagger)
 *  - Don't already have an imageUrl
 *  - Across all languages (Spanish first as priority)
 *
 * startLessonImageWorker() runs continuously: batch → 10s cooldown → next batch
 * until all lessons are covered, then stops.
 */

import { generateFromCustomPrompt } from './google-image-service';
import { getSharedDb } from '../db';
import { curriculumLessons, curriculumUnits, curriculumPaths } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { uploadPublicBuffer, normalizeImageUrl } from './image-storage';

const MAX_PER_RUN = 50; // Gemini is fast — larger batches are fine

// Language priority order — Spanish first (highest scenario coverage), then others
const LANGUAGE_PRIORITY: Record<string, number> = {
  spanish: 0,
  french: 1,
  italian: 2,
  portuguese: 3,
  german: 4,
  english: 5,
  japanese: 6,
  korean: 7,
  mandarin: 8,
};

// Cultural context per language for richer prompts
const LANGUAGE_CULTURE: Record<string, string> = {
  spanish: 'Latin American or Spanish cultural setting — warm, vibrant, colorful',
  french:  'French cultural setting — elegant, Parisian, café atmosphere',
  italian: 'Italian cultural setting — Mediterranean warmth, terracotta rooftops, food culture',
  portuguese: 'Brazilian or Portuguese cultural setting — lively, coastal, warm',
  german:  'German cultural setting — modern, orderly, Central European architecture',
  english: 'global English-speaking setting — diverse, modern, urban',
  japanese: 'Japanese cultural setting — clean aesthetics, modern Tokyo or traditional ryokan',
  korean:  'Korean cultural setting — K-culture, urban Seoul, modern and vibrant',
  mandarin: 'Chinese cultural setting — rich heritage blended with modern China',
};

// Topic slugs most critical to the scenario-to-textbook bridge (priority order)
const PRIORITY_TOPICS = [
  'food-vocabulary', 'ordering', 'opinions', 'formal-language', 'social-vocabulary',
  'formal-requests', 'past-tense', 'professional-vocabulary', 'time', 'directions',
  'shopping', 'travel', 'cultural-vocabulary', 'expressing-emotions', 'body-parts',
  'describing-symptoms', 'transportation', 'self-introduction', 'prices-money', 'quantities',
];

const GEMINI_STYLE = `Warm editorial illustration style. Soft, inviting color palette with gentle gradients. Clean composition with a clear focal point. Wide landscape format.
Characters: racially diverse people with uncovered, freely styled hair. Every character wears only contemporary Western casual clothing — jeans, chinos, T-shirts, blouses, sweaters, blazers, sneakers. Every character's full head, face, and hair are clearly visible and fully within the frame. Characters shown at medium or wide distance so their entire head and upper body are well within the image boundaries — never cropped at the neck or shoulders.
Pure illustration — the image contains absolutely no letters, numbers, words, text, typography, speech bubbles, signs, or written symbols of any kind anywhere. Zero text. No words. No captions.
Suitable as an educational app lesson card header.`;

function buildImagePrompt(lessonName: string, lessonType: string, topics: string[], language: string): string {
  const topicContext = topics.slice(0, 3).join(', ').replace(/-/g, ' ');
  const culture = LANGUAGE_CULTURE[language] || 'a multicultural educational context';
  const typeScene = ({
    conversation: 'Two people having a warm, engaged conversation',
    vocabulary: 'A visually rich everyday scene showcasing key objects and vocabulary',
    grammar: 'A clear, friendly educational scene',
    cultural_exploration: 'A vibrant authentic cultural moment',
    drill: 'An engaging hands-on practice scene',
  } as Record<string, string>)[lessonType] || 'A language learning scene';

  return `${typeScene} for a "${lessonName}" language lesson. Topics: ${topicContext}. Setting: ${culture}. ${GEMINI_STYLE}`;
}

async function generateImageBuffer(prompt: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  try {
    const dataUrl = await generateFromCustomPrompt(prompt);
    const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) return null;
    return { buffer: Buffer.from(matches[2], 'base64'), mimeType: matches[1] };
  } catch (err) {
    console.error('[LessonImages] Gemini generation error:', err);
    return null;
  }
}

export async function generateLessonImages(): Promise<number> {
  try {
    const db = getSharedDb();

    const lessons = await db.select({
      id: curriculumLessons.id,
      name: curriculumLessons.name,
      lessonType: curriculumLessons.lessonType,
      topics: curriculumLessons.requiredTopics,
      imageUrl: curriculumLessons.imageUrl,
      language: curriculumPaths.language,
    })
    .from(curriculumLessons)
    .innerJoin(curriculumUnits, eq(curriculumUnits.id, curriculumLessons.curriculumUnitId))
    .innerJoin(curriculumPaths, eq(curriculumPaths.id, curriculumUnits.curriculumPathId));

    const candidates = lessons.filter(l =>
      l.topics && l.topics.length > 0 &&
      !l.imageUrl
    );

    if (candidates.length === 0) {
      console.log('[LessonImages] All lessons already have images');
      return 0;
    }

    const topicPriorityScore = (topics: string[]) => {
      let score = 0;
      for (const t of topics) {
        const idx = PRIORITY_TOPICS.indexOf(t);
        if (idx >= 0) score += (PRIORITY_TOPICS.length - idx);
      }
      return score;
    };

    candidates.sort((a, b) => {
      const langA = LANGUAGE_PRIORITY[a.language] ?? 99;
      const langB = LANGUAGE_PRIORITY[b.language] ?? 99;
      if (langA !== langB) return langA - langB;
      return topicPriorityScore(b.topics || []) - topicPriorityScore(a.topics || []);
    });

    const toProcess = candidates.slice(0, MAX_PER_RUN);
    console.log(`[LessonImages] Generating ${toProcess.length} images via Gemini (${candidates.length} total need images)...`);

    let generated = 0;
    let failed = 0;

    for (const lesson of toProcess) {
      try {
        const prompt = buildImagePrompt(lesson.name, lesson.lessonType, lesson.topics || [], lesson.language);
        const img = await generateImageBuffer(prompt);

        if (!img) {
          failed++;
          continue;
        }

        const filename = `lesson-${lesson.id}.png`;
        const baseUrl = await uploadPublicBuffer(filename, img.buffer, img.mimeType);
        const url = normalizeImageUrl(`${baseUrl}?v=${Date.now()}`);

        await db.update(curriculumLessons)
          .set({ imageUrl: url })
          .where(eq(curriculumLessons.id, lesson.id));

        generated++;
        console.log(`[LessonImages] ✓ [${lesson.language}] ${lesson.name.slice(0, 50)}`);

        await new Promise(r => setTimeout(r, 1_000));
      } catch (err) {
        console.error(`[LessonImages] Failed for lesson ${lesson.id}:`, err);
        failed++;
      }
    }

    const remaining = candidates.length - toProcess.length;
    console.log(`[LessonImages] Done: ${generated} generated, ${failed} failed, ${remaining} remaining`);
    return remaining;
  } catch (error) {
    console.error('[LessonImages] Error:', error);
    return -1;
  }
}

let _workerRunning = false;

/**
 * Starts a continuous image generation worker using Gemini Flash Image.
 * Runs batches back-to-back with a short cooldown until all lessons are covered.
 * Safe to call multiple times — only one worker runs at a time.
 */
export function startLessonImageWorker(): void {
  if (_workerRunning) return;
  _workerRunning = true;

  const COOLDOWN_MS = 10_000;

  async function loop() {
    try {
      const remaining = await generateLessonImages();
      if (remaining === 0) {
        console.log('[LessonImages] Worker complete — all lessons have images');
        _workerRunning = false;
        return;
      }
    } catch (err) {
      console.error('[LessonImages] Worker error:', err);
    }
    setTimeout(loop, COOLDOWN_MS);
  }

  loop();
}
