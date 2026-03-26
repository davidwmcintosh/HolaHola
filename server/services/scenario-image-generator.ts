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

/**
 * Per-scenario overrides for scenes where generic prompts produce poor results.
 * These are complete scene descriptions that replace the auto-generated description.
 */
const SCENE_OVERRIDES: Record<string, string> = {
  'the-bank': `Editorial illustration for a language-learning app scenario card. Scene: a bright modern bank interior with clean lines and a glass service counter. A male bank teller in his 30s — dark dress shirt, short natural hair, friendly smile — sits behind a sleek counter. Across from him stands a woman in her late 20s with curly shoulder-length hair, wearing a light blazer and jeans, holding her phone. Both characters are fully visible from head to waist, faces clearly shown. No head coverings or religious garments on any character. The atmosphere is calm and professional. ${DALL_E_STYLE}`,

  'hotel-checkin': `Editorial illustration for a language-learning app scenario card. Scene: a stylish modern hotel lobby with marble flooring and warm lighting. A male hotel receptionist in his 30s — dark suit jacket, white shirt, short hair — stands behind an elegant front desk, handing over a key card. A female traveler in her late 20s — wearing a casual blazer, jeans, sneakers, with long straight hair loose over her shoulders — stands on the guest side of the desk, pulling a suitcase. Both characters fully visible from head to mid-body, faces clearly shown. No head coverings on either character. ${DALL_E_STYLE}`,

  'dinner-with-friend': `Editorial illustration for a language-learning app scenario card. Scene: a warm, intimate bistro at evening. At a candlelit wooden table sit two close friends: a man in his early 30s (wearing a casual navy crewneck sweater, short neat conventional hair, clean-shaven) and a woman in her early 30s (wearing a simple blouse, dark wavy hair down). They are clearly two platonic friends enjoying dinner — the man is laughing warmly, holding a wine glass; the woman is leaning forward smiling. Wine glasses and shared appetisers on the table. Warm amber bistro lighting. Both faces fully visible, both characters shown from head to mid-torso. No head coverings, no jewellery, no earrings on either character. ${DALL_E_STYLE}`,

  'pharmacy': `Editorial illustration for a language-learning app scenario card. Scene: a bright, clean modern pharmacy interior with white shelving units stocked with colourful product boxes. A female pharmacist in her 40s — white lab coat over a dark top, auburn hair pulled into a loose bun — stands behind the pharmacy counter handing a white paper bag to a male customer in his 30s wearing a grey hoodie and jeans, his short curly hair uncovered. The pharmacist is pointing to the label on the bag, explaining something helpfully. Both characters fully visible from head to waist, faces clearly shown. No head coverings on any character. ${DALL_E_STYLE}`,

  'taqueria': `Editorial illustration for a language-learning app scenario card. Scene: a vibrant, colourful Mexican street taqueria. A male taquero in his 30s — white apron, plain cotton T-shirt underneath, a backward baseball cap — stands at a hot flat-top grill loaded with sizzling carne asada and al pastor, using a large spatula. Bright overhead bulb lights hang above the open-air counter. The foreground shows a counter spread with lime wedges, chopped white onion, fresh cilantro, and three small bowls of salsa verde, roja, and guacamole. A hand-painted chalkboard menu is visible in the background but contains NO text. Rich warm colours: terracotta red, avocado green, golden yellow. Festive and authentic street-food energy. ${DALL_E_STYLE}`,

  'university-class': `Editorial illustration for a language-learning app scenario card. Scene: an inviting university lecture hall with tiered wooden seating and large windows letting in afternoon light. A male professor in his 50s — tweed blazer, round glasses, salt-and-pepper hair — stands at the front gesturing animatedly toward a large whiteboard (the whiteboard is blank — no text or drawings). In the foreground, three diverse students are visible: one young woman taking notes in a spiral notebook, one young man raising his hand, one young woman looking thoughtful. Warm, rich academic colour palette: mahogany wood tones, deep green chalkboard, golden afternoon sunlight. Intellectually energetic atmosphere. All characters fully visible, faces clearly shown, no head coverings. ${DALL_E_STYLE}`,

  'taxi-ride': `Editorial illustration for a language-learning app scenario card. Scene: inside a yellow taxi cab. Viewed from a slight side angle inside the passenger cabin: a young woman with natural hair and casual clothes sits in the back seat, leaning toward a plastic partition to speak with the driver. The driver is a man in his 40s in a casual shirt, seen from behind and in the rear-view mirror. Through the windows behind the passenger, a sunny city street with buildings is visible. On the dashboard: a taxi fare meter with a glowing display. Classic taxi interior details: vinyl seats, door handles, divider partition. Clearly recognisable as a taxi cab ride. Only two people visible: one passenger, one driver. ${DALL_E_STYLE}`,
};

function buildScenarioPrompt(slug: string, title: string, description: string, location: string | null, category: string, topics: string[]): string {
  if (SCENE_OVERRIDES[slug]) return SCENE_OVERRIDES[slug];

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
          scenario.slug,
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
        const baseUrl = await uploadPublicBuffer(filename, img.buffer, img.mimeType);
        const url = `${baseUrl}?v=${Date.now()}`;

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
