/**
 * Lesson Image Generator
 *
 * Generates warm illustrative cover images for curriculum lessons using
 * Gemini Flash Image. Images are stored permanently in object storage and
 * the URL is saved back to curriculumLessons.imageUrl.
 *
 * Only processes lessons that:
 *  - Have requiredTopics (tagged by lesson-topic-tagger)
 *  - Don't already have an imageUrl
 *  - Are from the Spanish curriculum (priority language)
 *
 * Caps at MAX_PER_RUN to control API cost per startup.
 */

import { getSharedDb } from '../db';
import { curriculumLessons, curriculumUnits, curriculumPaths } from '../../shared/schema';
import { eq, isNull, and, inArray } from 'drizzle-orm';
import { uploadPublicBuffer } from './image-storage';

const MAX_PER_RUN = 20; // Max images to generate per startup to control cost

// Topic slugs most critical to the scenario-to-textbook bridge (priority order)
const PRIORITY_TOPICS = [
  'food-vocabulary', 'ordering', 'opinions', 'formal-language', 'social-vocabulary',
  'formal-requests', 'past-tense', 'professional-vocabulary', 'time', 'directions',
  'shopping', 'travel', 'cultural-vocabulary', 'expressing-emotions', 'body-parts',
  'describing-symptoms', 'transportation', 'self-introduction', 'prices-money', 'quantities',
];

function buildImagePrompt(lessonName: string, lessonType: string, topics: string[]): string {
  const topicContext = topics.slice(0, 3).join(', ').replace(/-/g, ' ');
  const typeLabel = {
    conversation: 'two people having a friendly conversation',
    vocabulary: 'a visually rich scene showing key vocabulary items',
    grammar: 'a clear educational illustration',
    cultural_exploration: 'a vibrant cultural scene',
    drill: 'an engaging practice activity',
  }[lessonType] || 'a language learning scene';

  return `Create a warm, friendly educational illustration for a Spanish language learning app.
Scene: ${typeLabel} related to "${lessonName}" covering topics: ${topicContext}.
Style: Soft warm colors, clean editorial illustration, diverse characters, inviting and approachable.
Composition: Wide landscape format (16:9), clear focal point, minimal text, suitable as a lesson card header.
Mood: Encouraging, modern, culturally rich.
Do NOT include any text or labels in the image.`;
}

async function generateImageBuffer(prompt: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  try {
    const { GoogleGenAI, Modality } = await import('@google/genai');
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;

    const genAI = new GoogleGenAI({ apiKey });

    const response = await genAI.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { responseModalities: [Modality.TEXT, Modality.IMAGE] },
    });

    const candidate = response.candidates?.[0];
    if (!candidate?.content?.parts) return null;

    const imagePart = candidate.content.parts.find((p: any) => p.inlineData?.data);
    if (!imagePart?.inlineData?.data) return null;

    const buffer = Buffer.from(imagePart.inlineData.data, 'base64');
    const mimeType = imagePart.inlineData.mimeType || 'image/png';
    return { buffer, mimeType };
  } catch (err) {
    console.error('[LessonImages] Image generation error:', err);
    return null;
  }
}

export async function generateLessonImages(): Promise<void> {
  try {
    const db = getSharedDb();

    // Find Spanish lessons that have topics but no image
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

    // Filter: Spanish, has topics, no image
    const candidates = lessons.filter(l =>
      l.language === 'spanish' &&
      l.topics && l.topics.length > 0 &&
      !l.imageUrl
    );

    if (candidates.length === 0) {
      console.log('[LessonImages] All lessons already have images');
      return;
    }

    // Sort by priority: lessons covering the most-needed scenario gap topics first
    const topicPriorityScore = (topics: string[]) => {
      let score = 0;
      for (const t of topics) {
        const idx = PRIORITY_TOPICS.indexOf(t);
        if (idx >= 0) score += (PRIORITY_TOPICS.length - idx);
      }
      return score;
    };

    candidates.sort((a, b) => topicPriorityScore(b.topics || []) - topicPriorityScore(a.topics || []));

    const toProcess = candidates.slice(0, MAX_PER_RUN);
    console.log(`[LessonImages] Generating images for ${toProcess.length} priority lessons (${candidates.length} total need images)...`);

    let generated = 0;
    let failed = 0;

    for (const lesson of toProcess) {
      try {
        const prompt = buildImagePrompt(lesson.name, lesson.lessonType, lesson.topics || []);
        const img = await generateImageBuffer(prompt);

        if (!img) {
          failed++;
          continue;
        }

        const ext = img.mimeType === 'image/jpeg' ? 'jpg' : 'png';
        const filename = `lesson-${lesson.id}.${ext}`;
        const url = await uploadPublicBuffer(filename, img.buffer, img.mimeType);

        await db.update(curriculumLessons)
          .set({ imageUrl: url })
          .where(eq(curriculumLessons.id, lesson.id));

        generated++;
        console.log(`[LessonImages] Generated: ${lesson.name.slice(0, 50)}`);

        // Small delay to avoid rate limits
        await new Promise(r => setTimeout(r, 1500));
      } catch (err) {
        console.error(`[LessonImages] Failed for lesson ${lesson.id}:`, err);
        failed++;
      }
    }

    console.log(`[LessonImages] Done: ${generated} generated, ${failed} failed, ${candidates.length - toProcess.length} remaining for future runs`);
  } catch (error) {
    console.error('[LessonImages] Error:', error);
  }
}
