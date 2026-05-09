/**
 * Google Image Service — single integration point for all Google-based image generation.
 *
 * TWO-ENGINE STRATEGY (decided May 9, 2026):
 * ─────────────────────────────────────────────────────────────────────────────
 *  Engine A — Gemini Warm (SCENE_STYLE_WARM)
 *    Model : gemini-2.5-flash-image
 *    When  : Daniela + character scenes (social reading cards, vocabulary character images,
 *             live-session show_image() when people are present)
 *    Why   : Tight waist-up portrait crop, golden saturated palette, sun-lit warmth.
 *             The intimate framing and warm light make character scenes feel personal
 *             and engaging — closer to the original DALL-E 3 aesthetic.
 *
 *  Engine B — Base Gemini Flash (SCENE_STYLE or PROP_STYLE)
 *    Model : gemini-2.5-flash-image
 *    When  : Environment scenes (beach, playa, grass, no characters),
 *             vocabulary props (single objects on white background),
 *             all custom/freeform prompts (lesson headers, scenario covers,
 *             menu food, prop room backgrounds, admin one-off regen).
 *    Why   : Wider landscape framing is correct for environments; PROP_STYLE
 *             handles clean object isolation. Custom prompts drive their own style.
 *             The wide-frame portrait crop baked into SCENE_STYLE_WARM would be
 *             wrong for a banana or a beach.
 *
 * Replaces: DALL-E 3 (scenes), gpt-image-1 (props), generateImageWithGemini() (custom)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { GoogleGenAI } from '@google/genai';
import { uploadPublicBuffer } from './image-storage';

const MODEL = 'gemini-2.5-flash-image';

// ─── Style constants ──────────────────────────────────────────────────────────

const NO_TEXT =
  'absolutely no text, no letters, no numbers, no words, no handwriting, no captions, ' +
  'no labels, no symbols, no glyphs, no typography, no writing of any kind anywhere in the image — ' +
  'NO speech bubbles, NO dialogue bubbles, NO thought bubbles, NO comic-book panels, NO caption boxes — ' +
  'the image must be a pure illustration with zero readable or decorative text elements';

/**
 * BASE SCENE STYLE — environments, wide shots, no character framing constraints.
 * Used for: landscape/location scenes (beach, playa, grass, market, etc.)
 * Not for: character/Daniela scenes (those use SCENE_STYLE_WARM).
 */
export const SCENE_STYLE =
  'pen-and-watercolor-wash illustration in the style of a charming children\'s book or editorial picture book — ' +
  'loose expressive ink lines define the figures; soft muted watercolor washes fill in colour with gentle bleed at edges; ' +
  'figures and their surroundings share the same loose painterly quality — characters are NOT sharply rendered or smoothly shaded; ' +
  'skin and clothing painted with the same soft open washes as the background, not polished or airbrushed; ' +
  'warm muted palette: dusty blues, sage greens, warm creams, soft terracottas; ' +
  'soft flat diffuse ambient light — NO dramatic rim lighting, NO cinematic backlighting, NO spotlight glow effects; ' +
  'NOT photorealistic, NOT flat cel-shading, NOT clean digital fills, NOT 3D render, NOT vector art; ' +
  'IMPORTANT CONTENT: wholesome, appropriate for all ages, strictly platonic interactions; ' +
  'IMPORTANT SIZING: full bleed edge-to-edge composition — fill the entire canvas to every corner, ' +
  'no white space margins, no white bars, no vignette, no padding; ' +
  NO_TEXT;

/**
 * WARM CHARACTER SCENE STYLE — close portrait crop, golden palette.
 * Used for: Daniela + tutor character scenes (social reading cards, vocabulary character images).
 * NOT for: environment/landscape scenes or props (the portrait crop is wrong for those).
 */
export const SCENE_STYLE_WARM =
  'pen-and-watercolor-wash illustration in the style of a warm, inviting picture book — ' +
  'loose expressive ink lines define the figures; rich saturated watercolor washes fill in colour with a confident, glowing warmth; ' +
  'figures and their surroundings share the same painterly quality — characters are NOT sharply rendered or smoothly shaded; ' +
  'skin and clothing painted with warm open washes that feel sun-lit and alive, not polished or airbrushed; ' +
  'warm vibrant palette: rich sky blue, golden amber, warm terracotta, lush green, honeyed cream — ' +
  'saturated and inviting, like the best classic illustrated storybooks; ' +
  'warm soft directional light with a gentle golden glow — avoid cold or flat lighting; ' +
  'NOT photorealistic, NOT flat cel-shading, NOT clean digital fills, NOT 3D render, NOT vector art; ' +
  'IMPORTANT FRAMING: close intimate portrait crop — characters shown from roughly waist to crown of head, ' +
  'faces large and expressive, filling at least 70% of the frame height; ' +
  'camera feels close and personal, like a conversation, NOT a wide establishing shot; ' +
  'do NOT show full legs or feet; upper body and faces dominate the composition; ' +
  'IMPORTANT SIZING: full bleed edge-to-edge composition — fill the entire canvas to every corner, ' +
  'no white space margins, no white bars, no vignette, no padding, background colour and texture extends all the way to every edge of the image; ' +
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
 * ENGINE A — Daniela/character scene (Gemini Warm).
 * Tight portrait crop, golden palette. For social reading cards and vocabulary
 * character images. Returns a permanent public URL.
 */
export async function generateCharacterScene(concept: string): Promise<string> {
  const hint = COMPOSITION_VARIANTS[Math.floor(Math.random() * COMPOSITION_VARIANTS.length)];
  const prompt = `Square 1:1 format. Illustrated scene: ${concept}. ${hint}\n\n${SCENE_STYLE_WARM}`;
  console.log('[GoogleImage] Character scene (warm):', prompt.substring(0, 200));
  const buf = await callGemini(prompt);
  const filename = `scene-warm-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
  return uploadPublicBuffer(filename, buf, 'image/jpeg');
}

/**
 * ENGINE B — Environment / location scene (Base Gemini Flash).
 * Wide landscape framing, muted palette. For scenes without characters.
 * Returns a permanent public URL.
 */
export async function generateEnvironmentScene(concept: string): Promise<string> {
  const prompt = `Square 1:1 format. Illustrated scene: ${concept}. ${SCENE_STYLE}`;
  console.log('[GoogleImage] Environment scene (base):', prompt.substring(0, 200));
  const buf = await callGemini(prompt);
  const filename = `scene-base-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
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
