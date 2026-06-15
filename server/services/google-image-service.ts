/**
 * Google Image Service — single integration point for all Google-based image generation.
 *
 * ONE-ENGINE STRATEGY (revised May 11, 2026):
 * ─────────────────────────────────────────────────────────────────────────────
 *  Single model: gemini-2.5-flash-image — used for everything.
 *  Style constants control the look; a reference image is passed for character
 *  consistency when generating Daniela/character scenes.
 *
 *  Style constants:
 *    ENV_STYLE    — vivid watercolor landscapes, rich saturated palette, no characters
 *    SCENE_STYLE  — character scenes + live-session freeform; reference image passed alongside
 *    PROP_STYLE   — single object centred on white background (vocab props)
 *    (custom)     — lesson headers, scenario covers, menu food, admin regen: caller-supplied prompt
 *
 *  No gpt-image-1, no Gemini Warm. All calls go through Base Gemini Flash.
 *  Reference image is the mechanism for character consistency, not a separate warm style.
 *
 * Replaces: DALL-E 3 (scenes), gpt-image-1 (props), generateImageWithGemini() (custom)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { GoogleGenAI } from '@google/genai';
import { uploadPublicBuffer } from './image-storage';
import { getUserDb } from '../db';
import { sql as drizzleSql } from 'drizzle-orm';

const MODEL = 'gemini-2.5-flash-image';

// ─── Style constants ──────────────────────────────────────────────────────────

const NO_TEXT =
  'absolutely no text, no letters, no numbers, no words, no handwriting, no captions, ' +
  'no labels, no symbols, no glyphs, no typography, no writing of any kind anywhere in the image — ' +
  'NO speech bubbles, NO dialogue bubbles, NO thought bubbles, NO comic-book panels, NO caption boxes — ' +
  'the image must be a pure illustration with zero readable or decorative text elements';

/**
 * ENVIRONMENT STYLE — vivid watercolor landscapes, natural accurate scene colors.
 * Used for: landscape/location vocabulary anchors (beach, grass, ocean, market…)
 * and visual_environments table backgrounds (prop room / classroom window scenes).
 * No characters. Wide establishing shot.
 *
 * Principle: colours should be natural and accurate for the specific scene described
 * (rich greens for grass, warm earth for paths, accurate blue for sky, etc.) — NOT a
 * fixed palette. Inspired by gpt-image-1 prop's "natural accurate real-world colors"
 * approach applied to full-scene environments.
 */
export const ENV_STYLE =
  'pen-and-watercolor-wash illustration in the style of a lush, richly coloured picture book — ' +
  'loose expressive ink lines define shapes and horizon lines; vibrant watercolor washes fill every area with rich, confident colour; ' +
  'COLOUR PRINCIPLE: use natural accurate real-world colours for the specific scene depicted — ' +
  'rich and fully saturated, true to what the scene actually looks like in life; ' +
  'NOT muted, NOT dusty, NOT washed-out, NOT desaturated — colours should feel vivid and alive; ' +
  'natural lighting appropriate to the scene: warm sunlight, realistic shadows, gentle atmospheric depth; ' +
  'wide establishing shot — the full environment fills the frame; NO human figures, NO people; ' +
  'detailed and lush: all textures (grass, sand, water, leaves, stone, wood) rendered with watercolor brushwork and visible ink detail; ' +
  'NOT photorealistic, NOT flat cel-shading, NOT digital fills, NOT 3D render, NOT vector art; ' +
  'IMPORTANT SIZING: full bleed edge-to-edge composition — fill the entire canvas to every corner, ' +
  'no white space margins, no white bars, no vignette, no padding, colour and texture extends all the way to every edge; ' +
  NO_TEXT;

/**
 * CHARACTER SCENE STYLE — wide framing for character scenes and live-session freeform.
 * Used for: Daniela, Rosa, Marco and other named characters in vocabulary images,
 * social phrase cards, and live-session show_image() calls.
 * A reference image should be passed alongside the prompt for character consistency.
 */
export const SCENE_STYLE =
  'pen-and-watercolor-wash illustration in the style of a charming children\'s book or editorial picture book — ' +
  'loose expressive ink lines define the figures; warm saturated watercolor washes fill in colour with gentle bleed at edges; ' +
  'figures and their surroundings share the same loose painterly quality — characters are NOT sharply rendered or smoothly shaded; ' +
  'skin and clothing painted with the same warm open washes as the background, not polished or airbrushed; ' +
  'warm inviting palette: rich sky blue, golden amber, warm terracotta, lush green, honeyed cream — ' +
  'saturated and inviting, like the best classic illustrated storybooks; ' +
  'warm soft directional light with a gentle golden glow; ' +
  'NOT photorealistic, NOT flat cel-shading, NOT clean digital fills, NOT 3D render, NOT vector art; ' +
  'IMPORTANT FRAMING: generous headroom — heads fully visible, never cropped at top of frame; ' +
  'position characters in lower two-thirds of canvas so top quarter shows sky or background; ' +
  'IMPORTANT CONTENT: wholesome, appropriate for all ages, strictly platonic interactions; ' +
  'IMPORTANT SIZING: full bleed edge-to-edge composition — fill the entire canvas to every corner, ' +
  'no white space margins, no white bars, no vignette, no padding; ' +
  NO_TEXT;

/**
 * PROP STYLE — single object isolated on white background.
 * Used for: vocabulary prop cards (banana, apple, plate, glass, etc.)
 */
export const PROP_STYLE =
  'bright digital illustration, natural accurate object colors — objects appear in their real-world everyday colors, ' +
  'NOT rainbow-colored, NOT iridescent — realistic natural colors only, ' +
  'soft even lighting with no heavy shadows, slightly stylized cheerful style, semi-realistic proportions, smooth clean artwork, ' +
  'single isolated object centred on a clean pure white background, clear recognisable silhouette, ' +
  'FRAMING: entire object fully visible within frame, generous white space border on all sides — ' +
  'subject fills no more than 65–70% of canvas width and height, never touching or bleeding to any edge, ' +
  'wholesome family-friendly educational quality, ' +
  NO_TEXT;

// Composition variants — injected randomly to prevent repetitive poses in character scenes
const COMPOSITION_VARIANTS = [
  'One character extends an open palm forward in a warm greeting gesture.',
  'One character raises a hand in a cheerful wave.',
  'One character tilts their head with a curious questioning expression.',
  'Closer framing on faces and upper bodies, expressive reactions visible.',
  'Characters at a slight angle, one a half-step ahead of the other.',
  'One character gestures openly with both hands in an expressive shrug or welcome.',
  'Characters shown side-by-side looking slightly toward each other.',
];

// ─── Core Gemini call ─────────────────────────────────────────────────────────

function getAI(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('[GoogleImageService] GEMINI_API_KEY not set');
  return new GoogleGenAI({ apiKey });
}

async function callGemini(prompt: string): Promise<Buffer> {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { responseModalities: ['TEXT', 'IMAGE'] } as any,
  });

  const candidate = response.candidates?.[0];
  for (const part of candidate?.content?.parts ?? []) {
    const p = part as any;
    if (p.inlineData?.data) {
      return Buffer.from(p.inlineData.data as string, 'base64');
    }
  }
  throw new Error('[GoogleImageService] No image data returned by Gemini');
}

// ─── Public generation functions ──────────────────────────────────────────────

/**
 * Look up a pinned style profile for the given language.
 * Returns the extracted style description string, or null if no profile is locked.
 */
async function getLockedStyleProfile(profileKey: string): Promise<string | null> {
  try {
    const titleKey = `style_profile:${profileKey}`;
    const result = await getUserDb().execute(drizzleSql`
      SELECT content FROM editor_insights
      WHERE category = 'tools' AND title = ${titleKey}
      LIMIT 1
    `);
    const row = result.rows[0] as any;
    if (!row?.content) return null;
    return JSON.parse(row.content).styleDescription ?? null;
  } catch {
    return null;
  }
}

/**
 * CHARACTER SCENE — Daniela/character scenes and live-session freeform.
 * Uses SCENE_STYLE (warm saturated watercolor, wide framing).
 * Pass a reference image via language profile for character consistency.
 * Returns a permanent public URL.
 *
 * @param language  Optional language code (e.g. 'spanish'). If a pinned style
 *                  profile exists for this language, it overrides SCENE_STYLE,
 *                  giving consistent character design across all generations.
 */
export async function generateCharacterScene(concept: string, language?: string): Promise<string> {
  const hint = COMPOSITION_VARIANTS[Math.floor(Math.random() * COMPOSITION_VARIANTS.length)];

  let styleBlock = SCENE_STYLE;
  if (language) {
    const locked = await getLockedStyleProfile(language);
    if (locked) {
      console.log(`[GoogleImage] Using pinned style profile for ${language}`);
      styleBlock =
        `ILLUSTRATION STYLE TO MATCH (extracted from reference):\n${locked}\n\n` +
        `FRAMING: generous headroom, heads fully visible, characters in lower two-thirds of canvas; ` +
        `full bleed edge-to-edge, no white borders or padding; ` +
        `absolutely no text, letters, numbers or typography in the image.`;
    }
  }

  const prompt = `Square 1:1 format. Illustrated scene: ${concept}. ${hint}\n\n${styleBlock}`;
  console.log('[GoogleImage] Character scene:', prompt.substring(0, 200));
  const buf = await callGemini(prompt);
  const filename = `scene-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
  return uploadPublicBuffer(filename, buf, 'image/jpeg');
}

/**
 * ENVIRONMENT SCENE — landscape/location scenes, no characters.
 * Uses ENV_STYLE (vivid saturated palette, wide establishing shot).
 * For both vocabulary anchor images (playa, mar, hierba) and
 * visual_environments table backgrounds (prop room / classroom window).
 * Returns a permanent public URL.
 *
 * @param profileKey  Optional profile key to look up in pinned style profiles.
 *                    Defaults to 'environment'. If a locked profile exists,
 *                    its extracted style description overrides ENV_STYLE.
 */
export async function generateEnvironmentScene(concept: string, profileKey: string = 'environment'): Promise<string> {
  let styleBlock = ENV_STYLE;

  const locked = await getLockedStyleProfile(profileKey);
  if (locked) {
    console.log(`[GoogleImage] Using pinned style profile for environment (key: ${profileKey})`);
    styleBlock =
      `ILLUSTRATION STYLE TO MATCH (extracted from reference):\n${locked}\n\n` +
      `FRAMING: wide establishing shot — fill the entire canvas edge to edge, ` +
      `no white borders or padding; no people or figures unless the concept explicitly includes them; ` +
      `absolutely no text, letters, numbers or typography in the image.`;
  }

  const prompt = `Square 1:1 format. Illustrated scene: ${concept}. ${styleBlock}`;
  console.log('[GoogleImage] Environment scene (ENV_STYLE):', prompt.substring(0, 200));
  const buf = await callGemini(prompt);
  const filename = `scene-env-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
  return uploadPublicBuffer(filename, buf, 'image/jpeg');
}

/**
 * ENGINE B — Prop image (Base Gemini Flash + PROP_STYLE).
 * Single object on white background. For vocabulary prop cards.
 * Returns a permanent public URL.
 */
export async function generatePropImage(concept: string): Promise<string> {
  const prompt = `Square 1:1 format. Illustration of: ${concept}. ${PROP_STYLE}`;
  console.log('[GoogleImage] Prop image (base):', prompt.substring(0, 200));
  const buf = await callGemini(prompt);
  const filename = `prop-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
  return uploadPublicBuffer(filename, buf, 'image/jpeg');
}

/**
 * ENGINE B — Custom / freeform prompt (Base Gemini Flash).
 * Caller provides a fully-formed prompt. Used by lesson headers, scenario covers,
 * menu food images, prop room backgrounds, and admin one-off regen.
 * Returns a base64 data URL (drop-in replacement for generateImageWithGemini()).
 */
export async function generateFromCustomPrompt(prompt: string): Promise<string> {
  console.log('[GoogleImage] Custom prompt (base):', prompt.substring(0, 200));
  const buf = await callGemini(prompt);
  return `data:image/jpeg;base64,${buf.toString('base64')}`;
}

// NOTE: Imagen 4 was evaluated (May 2026) but rejected due to API instability
// (503 RAI failures, 500 internal errors). All generation uses Gemini Flash.
// See docs/visual-asset-roadmap.md → "Final Engine Assignment (revised May 11, 2026)".
