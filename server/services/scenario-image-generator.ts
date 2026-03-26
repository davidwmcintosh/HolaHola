/**
 * Scenario Image Generator
 *
 * Generates vivid, illustrative cover images for each practice scenario
 * using DALL-E 3. Images are stored in object storage and the URL is
 * saved back to scenarios.imageUrl.
 *
 * Runs once at startup (fire-and-forget) and processes only scenarios
 * that are missing images — safe to restart.
 */

import OpenAI from 'openai';
import { getSharedDb } from '../db';
import { scenarios } from '../../shared/schema';
import { isNull, eq } from 'drizzle-orm';
import { uploadPublicBuffer } from './image-storage';

const DALL_E_STYLE = `Warm editorial illustration style. Rich, inviting color palette with soft depth. Cinematic but illustrated — not photographic. Wide landscape format (16:9).
Characters: racially diverse group of people with uncovered hair. Every character wears only contemporary Western casual or business-casual clothing — jeans, chinos, T-shirts, blouses, sweaters, blazers, sneakers, loafers. Every character's full head, face, and hair are clearly visible and uncropped within the frame. All characters positioned at medium or wide distance from the viewer so their entire head and shoulders are well within the image boundaries.
Pure illustration — the image contains absolutely no letters, numbers, words, text, typography, speech bubbles, signs, or written symbols of any kind anywhere. Zero text. No words.
Suitable as a scenario card cover image for a language-learning app.`;

const CATEGORY_CONTEXT: Record<string, string> = {
  social:       'lively social gathering or warm conversation between friends in an everyday setting',
  professional: 'modern professional office, business meeting, or workplace interaction',
  travel:       'exciting travel scene at an airport, train station, or iconic destination',
  daily:        'everyday life — a neighborhood, local market, or familiar home environment',
  emergency:    'calm, helpful scene inside a clinic, pharmacy, or assistance context',
  cultural:     'vibrant local cultural event, traditional festival, or authentic neighborhood scene',
};

function buildScenarioPrompt(title: string, description: string, location: string | null, category: string, topics: string[]): string {
  const categoryCtx = CATEGORY_CONTEXT[category] || 'an engaging real-world situation';
  const topicHint = topics.slice(0, 3).map(t => t.replace(/-/g, ' ')).join(', ');
  const locationHint = location ? ` The specific setting is: ${location}.` : '';

  return `Editorial illustration for a language-learning app scenario card. Scene: "${title}" — ${description}${locationHint} Context: ${categoryCtx}${topicHint ? `, with themes of ${topicHint}` : ''}. ${DALL_E_STYLE}`;
}

function getDallEClient(): OpenAI | null {
  const key = process.env.USER_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  if (!key) return null;
  return new OpenAI({ apiKey: key });
}

async function generateImageBuffer(prompt: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const client = getDallEClient();
  if (!client) {
    console.warn('[ScenarioImages] OPENAI_API_KEY not set — skipping');
    return null;
  }

  try {
    const response = await client.images.generate({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size: '1792x1024',
      quality: 'hd',
      response_format: 'url',
    });

    const imageUrl = response.data?.[0]?.url;
    if (!imageUrl) return null;

    const fetchRes = await fetch(imageUrl);
    if (!fetchRes.ok) throw new Error(`Failed to download image: ${fetchRes.status}`);
    const buffer = Buffer.from(await fetchRes.arrayBuffer());
    return { buffer, mimeType: 'image/png' };
  } catch (err: any) {
    if (err?.status === 401 || err?.code === 'invalid_api_key') {
      console.error('[ScenarioImages] OpenAI API key is invalid — worker halted. Update OPENAI_API_KEY to resume.');
      throw err; // propagate to stop the loop
    }
    console.error('[ScenarioImages] DALL-E generation error:', err);
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

    console.log(`[ScenarioImages] Generating ${pending.length} scenario covers via DALL-E 3...`);
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

        const filename = `scenario-${scenario.slug}.png`;
        const url = await uploadPublicBuffer(filename, img.buffer, img.mimeType);

        await db
          .update(scenarios)
          .set({ imageUrl: url })
          .where(eq(scenarios.id, scenario.id));

        generated++;
        console.log(`[ScenarioImages] ✓ ${scenario.title}`);

        // DALL-E 3 rate limit — 12s between calls
        await new Promise(r => setTimeout(r, 12_000));
      } catch (err: any) {
        if (err?.status === 401 || err?.code === 'invalid_api_key') throw err; // abort on bad key
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
  setTimeout(() => generateScenarioImages(), 8_000);
}
