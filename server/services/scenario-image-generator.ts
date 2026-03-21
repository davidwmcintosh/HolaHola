/**
 * Scenario Image Generator
 *
 * Generates vivid, illustrative cover images for each practice scenario
 * using Gemini Flash Image. Images are stored in object storage and the
 * URL is saved back to scenarios.imageUrl.
 *
 * Runs once at startup (fire-and-forget) and processes only scenarios
 * that are missing images — safe to restart.
 */

import { getSharedDb } from '../db';
import { scenarios } from '../../shared/schema';
import { isNull } from 'drizzle-orm';
import { eq } from 'drizzle-orm';
import { uploadPublicBuffer } from './image-storage';

const CATEGORY_CONTEXT: Record<string, string> = {
  social:       'lively social gathering, warm conversation between friends',
  professional: 'modern professional office or business setting',
  travel:       'exciting travel destination, airport, or transportation hub',
  daily:        'everyday life scene, neighborhood, market, or home',
  emergency:    'calm, helpful scene in a clinic or assistance context',
  cultural:     'vibrant cultural event, local festival, or traditional setting',
};

function buildScenarioPrompt(title: string, description: string, location: string | null, category: string, topics: string[]): string {
  const categoryCtx = CATEGORY_CONTEXT[category] || 'an engaging real-world situation';
  const topicHint = topics.slice(0, 3).map(t => t.replace(/-/g, ' ')).join(', ');
  const locationHint = location ? ` The setting is: ${location}.` : '';

  return `Create a warm, cinematic editorial illustration for a language-learning app scenario card.
Scenario: "${title}" — ${description}${locationHint}
Visual context: ${categoryCtx}${topicHint ? `, featuring themes of ${topicHint}` : ''}.
Style: Soft warm color palette, clean modern illustration, diverse and friendly characters, inviting atmosphere.
Composition: Wide landscape (16:9), strong focal point, visually rich but uncluttered, no text or labels anywhere.
Mood: Approachable, realistic, culturally authentic, encouraging learners to jump in.
Do NOT include any text, words, signs, or labels in the image.`;
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
    console.error('[ScenarioImages] Generation error:', err);
    return null;
  }
}

async function generateScenarioImages(): Promise<void> {
  try {
    const db = getSharedDb();

    const pending = await db
      .select({
        id: scenarios.id,
        slug: scenarios.slug,
        title: scenarios.title,
        description: scenarios.description,
        location: scenarios.location,
        category: scenarios.category,
        topics: scenarios.curriculumTopics,
      })
      .from(scenarios)
      .where(isNull(scenarios.imageUrl));

    if (pending.length === 0) {
      console.log('[ScenarioImages] All scenarios already have images');
      return;
    }

    console.log(`[ScenarioImages] Generating images for ${pending.length} scenarios...`);
    let generated = 0;
    let failed = 0;

    for (const scenario of pending) {
      try {
        const prompt = buildScenarioPrompt(
          scenario.title,
          scenario.description,
          scenario.location ?? null,
          scenario.category,
          (scenario.topics as string[]) || [],
        );

        const img = await generateImageBuffer(prompt);
        if (!img) {
          console.warn(`[ScenarioImages] No image returned for: ${scenario.slug}`);
          failed++;
          continue;
        }

        const ext = img.mimeType === 'image/jpeg' ? 'jpg' : 'png';
        const filename = `scenario-${scenario.slug}.${ext}`;
        const url = await uploadPublicBuffer(filename, img.buffer, img.mimeType);

        await db
          .update(scenarios)
          .set({ imageUrl: url })
          .where(eq(scenarios.id, scenario.id));

        generated++;
        console.log(`[ScenarioImages] ✓ ${scenario.title}`);

        // Respect API rate limits
        await new Promise(r => setTimeout(r, 2000));
      } catch (err) {
        console.error(`[ScenarioImages] Failed for ${scenario.slug}:`, err);
        failed++;
      }
    }

    console.log(`[ScenarioImages] Done — ${generated} generated, ${failed} failed`);
  } catch (err) {
    console.error('[ScenarioImages] Fatal error:', err);
  }
}

let _scenarioWorkerStarted = false;

/**
 * Runs scenario image generation once at startup (fire-and-forget).
 * Safe to call multiple times — only one run will proceed.
 */
export function startScenarioImageWorker(): void {
  if (_scenarioWorkerStarted) return;
  _scenarioWorkerStarted = true;
  // Small delay so it doesn't race with the lesson image worker at startup
  setTimeout(() => generateScenarioImages(), 5000);
}
