import { getSharedDb } from '../db';
import { curriculumLessons, curriculumUnits, curriculumPaths } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { uploadPublicBuffer, normalizeImageUrl } from '../services/image-storage';
import { GoogleGenAI, Modality } from '@google/genai';

const LANGUAGE_PRIORITY: Record<string, number> = {
  spanish: 0, french: 1, italian: 2, portuguese: 3, german: 4,
  english: 5, japanese: 6, korean: 7, mandarin: 8,
};
const LANGUAGE_CULTURE: Record<string, string> = {
  spanish: 'Latin American or Spanish culture — warm, vibrant, colorful',
  french:  'French culture — elegant, Parisian, café atmosphere',
  italian: 'Italian culture — Mediterranean warmth, food, architecture',
  portuguese: 'Brazilian or Portuguese culture — lively, coastal, warm',
  german:  'German culture — modern, clean, Central European',
  english: 'global English-speaking context — diverse, modern',
  japanese: 'Japanese culture — clean aesthetics, Tokyo or traditional setting',
  korean:  'Korean culture — modern Seoul, vibrant K-culture',
  mandarin: 'Chinese culture — rich heritage, modern urban China',
};
const PRIORITY_TOPICS = [
  'food-vocabulary','ordering','opinions','formal-language','social-vocabulary',
  'formal-requests','past-tense','professional-vocabulary','time','directions',
  'shopping','travel','cultural-vocabulary','expressing-emotions','body-parts',
];

function buildPrompt(name: string, type: string, topics: string[], language: string): string {
  const topicCtx = topics.slice(0, 3).join(', ').replace(/-/g, ' ');
  const culture = LANGUAGE_CULTURE[language] || 'a multicultural educational context';
  const typeLabel: Record<string, string> = {
    conversation: 'two people having a friendly conversation',
    vocabulary: 'a visually rich scene with key vocabulary items',
    grammar: 'a clear educational illustration',
    cultural_exploration: 'a vibrant cultural scene',
    drill: 'an engaging practice activity',
  };
  const scene = typeLabel[type] || 'a language learning scene';
  return `Create a warm, friendly educational illustration for a ${language} language learning app.
Scene: ${scene} related to "${name}" covering topics: ${topicCtx}.
Cultural setting: ${culture}.
Style: Soft warm colors, clean editorial illustration, diverse characters.
Composition: Wide landscape 16:9, clear focal point, NO text or labels, suitable as a lesson card.
Mood: Encouraging, modern, culturally authentic.
IMPORTANT: Do NOT include any text, words, letters, or labels in the image.`;
}

async function main() {
  const db = getSharedDb();
  const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  
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

  const candidates = lessons.filter(l => l.topics && l.topics.length > 0 && !l.imageUrl);
  const topicScore = (topics: string[]) => topics.reduce((s, t) => {
    const idx = PRIORITY_TOPICS.indexOf(t);
    return s + (idx >= 0 ? PRIORITY_TOPICS.length - idx : 0);
  }, 0);
  
  candidates.sort((a, b) => {
    const la = LANGUAGE_PRIORITY[a.language] ?? 99;
    const lb = LANGUAGE_PRIORITY[b.language] ?? 99;
    return la !== lb ? la - lb : topicScore(b.topics!) - topicScore(a.topics!);
  });

  console.log(`[Batch] ${candidates.length} lessons need images. Processing up to 80...`);
  let done = 0, failed = 0;

  for (const lesson of candidates.slice(0, 80)) {
    try {
      const prompt = buildPrompt(lesson.name, lesson.lessonType, lesson.topics!, lesson.language);
      const response = await genAI.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { responseModalities: [Modality.TEXT, Modality.IMAGE] },
      });
      const part = response.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData?.data);
      if (!part?.inlineData?.data) { failed++; continue; }
      const buffer = Buffer.from(part.inlineData.data, 'base64');
      const mime = part.inlineData.mimeType || 'image/png';
      const ext = mime === 'image/jpeg' ? 'jpg' : 'png';
      const rawUrl = await uploadPublicBuffer(`lesson-${lesson.id}.${ext}`, buffer, mime);
      const url = normalizeImageUrl(rawUrl);
      await db.update(curriculumLessons).set({ imageUrl: url }).where(eq(curriculumLessons.id, lesson.id));
      done++;
      console.log(`[${done}] [${lesson.language}] ${lesson.name.slice(0, 55)}`);
      await new Promise(r => setTimeout(r, 800));
    } catch (err: any) {
      console.error(`[FAIL] ${lesson.name.slice(0, 40)}: ${err.message?.slice(0, 100)}`);
      failed++;
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  console.log(`\n[Batch Done] ${done} generated, ${failed} failed, ${candidates.length - done - failed} remaining`);
}

main().catch(console.error).finally(() => process.exit(0));
