/**
 * Image Engine Test Service
 *
 * Runs a single image generation across different engines for side-by-side comparison.
 * Used exclusively by the admin image engine test page.
 *
 * Engines:
 *   dall-e-3         — retired May 12 2026; kept here for historical comparison only
 *   gpt-image-1      — retired; kept for comparison
 *   gpt-image-1-prop — retired; kept for comparison
 *   gemini-imagen    — Gemini 2.5 Flash (SCENE_STYLE) — production engine for character scenes
 *   gemini-imagen-env — Gemini 2.5 Flash (ENV_STYLE) — production engine for environment scenes
 *   imagen-3         — Imagen 4 Standard (imagen-4.0-generate-001)
 *   imagen-4-ultra   — Imagen 4 Ultra (imagen-4.0-ultra-generate-001)
 */

import OpenAI from 'openai';
import { GoogleGenAI } from '@google/genai';
import { getUserDb } from '../db';
import { sql as drizzleSql } from 'drizzle-orm';

// ─── Style constants (mirrored from visual-content-service.ts) ────────────────

const NO_TEXT =
  'absolutely no text, no letters, no numbers, no words, no handwriting, no captions, ' +
  'no labels, no symbols, no glyphs, no typography, no writing of any kind — ' +
  'the image must be a pure illustration with zero readable or decorative text elements';

export const SCENE_STYLE =
  "pen-and-watercolor-wash illustration in the style of a charming children's book or editorial picture book — " +
  'loose expressive ink lines define the figures; soft muted watercolor washes fill in colour with gentle bleed at edges; ' +
  'figures and their surroundings share the same loose painterly quality — characters are NOT sharply rendered or smoothly shaded; ' +
  'skin and clothing painted with the same soft open washes as the background, not polished or airbrushed; ' +
  'warm muted palette: dusty blues, sage greens, warm creams, soft terracottas; ' +
  'soft flat diffuse ambient light — NO dramatic rim lighting, NO cinematic backlighting; ' +
  'NOT photorealistic, NOT flat cel-shading, NOT clean digital fills, NOT 3D render, NOT vector art; ' +
  'IMPORTANT FRAMING: generous headroom — heads fully visible, never cropped at top of frame; ' +
  'position characters in lower two-thirds of canvas so top quarter shows sky or background; ' +
  'IMPORTANT SIZING: full bleed edge-to-edge composition — fill the entire canvas to every corner, ' +
  'no white space margins, no white bars, no vignette, no padding, background colour and texture extends all the way to every edge of the image; ' +
  NO_TEXT;

/**
 * ENVIRONMENT STYLE — vivid watercolor landscapes, natural accurate scene colors.
 * Mirror of ENV_STYLE in google-image-service.ts (canonical). Do not edit independently.
 * Used in the test page under engine key 'gemini-imagen-env'.
 * Retired: SCENE_STYLE_WARM (Gemini Warm) — replaced by SCENE_STYLE + reference image.
 *
 * Principle: natural accurate real-world colours for whatever scene is described
 * (grass → rich green, beach → warm sand, market → varied naturalistic tones).
 * No hardcoded palette — the scene concept drives the colours.
 */
export const ENV_STYLE =
  "pen-and-watercolor-wash illustration in the style of a lush, richly coloured picture book — " +
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

export const PROP_STYLE =
  'bright digital illustration, natural accurate object colors — objects appear in their real-world everyday colors, ' +
  'NOT rainbow-colored, NOT iridescent — realistic natural colors only, ' +
  'soft even lighting with no heavy shadows, slightly stylized cheerful style, semi-realistic proportions, smooth clean artwork, ' +
  'single isolated object centred on a clean pure white background, clear recognisable silhouette, ' +
  'FRAMING: entire object fully visible within frame, generous white space border on all sides, ' +
  'wholesome family-friendly educational quality, ' +
  NO_TEXT;

// ─── Preset prompts ──────────────────────────────────────────────────────────

const DANIELA =
  'Daniela, a 28-year-old Latina woman with long wavy dark-brown hair, warm medium-brown skin, and bright brown eyes, wearing a sky-blue short-sleeve collared button-up shirt and dark jeans';
const MARCO =
  'Marco, a 30-year-old Latino man with short curly black hair, light-olive skin, and friendly dark eyes, wearing a white button-up shirt and chinos';
const ROSA =
  'Rosa, a warm 68-year-old Mexican grandmother with short curly silver-white hair, warm brown skin, kind dark eyes behind gold-rimmed glasses, and a white blouse with colorful floral embroidery';

export const PRESET_PROMPTS: Record<string, { label: string; concept: string; type: 'scene' | 'prop'; description: string }> = {
  hola: {
    label: '"hola" (character scene)',
    type: 'scene',
    description: 'SCENE_OVERRIDES entry — greeting scene with named characters',
    concept: `${DANIELA} waving hello with a big cheerful smile to ${MARCO} at a sunny school entrance, both standing a few feet apart, friendly classmate greeting, wholesome platonic interaction`,
  },
  adios: {
    label: '"adiós" (character scene)',
    type: 'scene',
    description: 'SCENE_OVERRIDES entry — farewell scene with named characters',
    concept: `${DANIELA} leaning out of a car window waving adiós, ${ROSA} standing on the front porch of a cozy house waving back with a warm smile`,
  },
  // ── Missing social phrases — Unit 1 Spanish 1 ────────────────────────────
  que_tal: {
    label: '"¿Qué tal?" (casual how-are-you)',
    type: 'scene',
    description: 'SCENE_OVERRIDES — missing entry, casual check-in phrase',
    concept: `${DANIELA} giving a relaxed friendly shrug with both palms open and raised eyebrows, asking "how's it going?" in a casual warm way, cheerful everyday outdoor setting`,
  },
  que_pasa: {
    label: '"¿Qué pasa?" (what\'s up)',
    type: 'scene',
    description: 'SCENE_OVERRIDES — missing entry, casual "what\'s happening" phrase',
    concept: `${DANIELA} leaning against a wall with a relaxed easy smile, one hand gesturing open-palmed in a casual "what's going on?" expression, sunny school hallway or courtyard`,
  },
  todo_bien: {
    label: '"todo bien" (all good)',
    type: 'scene',
    description: 'SCENE_OVERRIDES — missing entry, casual positive response',
    concept: `${DANIELA} with both thumbs up and a wide relaxed grin, leaning back slightly in an easygoing "all good" posture, warm bright background`,
  },
  nada: {
    label: '"nada" (nothing)',
    type: 'scene',
    description: 'SCENE_OVERRIDES — missing entry, "nothing" response to ¿Qué pasa?',
    concept: `${DANIELA} giving a casual open-hands shrug with both palms facing upward and a small unbothered smile, expressing "nothing's going on", light airy background`,
  },
  y_tu: {
    label: '"¿y tú?" (and you?)',
    type: 'scene',
    description: 'SCENE_OVERRIDES — missing entry, conversational redirect phrase',
    concept: `${DANIELA} pointing warmly toward ${MARCO} with one open hand and a friendly inquisitive smile, eyebrows raised in a "and what about you?" gesture, casual sunny outdoor setting`,
  },
  igualmente: {
    label: '"igualmente" (likewise)',
    type: 'scene',
    description: 'SCENE_OVERRIDES — missing entry, "same to you / likewise" response',
    concept: `${DANIELA} and ${MARCO} both nodding and smiling warmly at each other, ${DANIELA} pressing a hand to her chest and gesturing back toward ${MARCO} in a warm mirroring "likewise" gesture, bright cheerful setting`,
  },
  con_permiso: {
    label: '"con permiso" (excuse me)',
    type: 'scene',
    description: 'SCENE_OVERRIDES — missing entry, polite passing phrase',
    concept: `${DANIELA} squeezing politely past ${ROSA} in a narrow doorway or corridor, one hand slightly raised in a gentle "excuse me" gesture with a kind apologetic smile, warm indoor setting`,
  },
  // ── Other test categories ─────────────────────────────────────────────────
  beach: {
    label: '"beach" (environment)',
    type: 'scene',
    description: 'isSceneConcept() path — environment with no characters',
    concept: 'A wide sandy beach with gentle waves rolling in under warm afternoon sun, soft foam at the waterline, distant horizon, no people, no figures, landscape only, wide establishing shot',
  },
  grass: {
    label: '"grass / waves" (environment)',
    type: 'scene',
    description: 'isSceneConcept() path — natural landscape, no characters',
    concept: 'Rolling green grass hills under a bright open sky with soft clouds, gentle wind visible in the grass blades, no people, landscape only',
  },
  daniela_freeform: {
    label: 'Daniela freeform (live chat)',
    type: 'scene',
    description: 'Simulates Daniela calling show_image() with a free-form scene description',
    concept: 'a young woman walking through a colorful outdoor market, warm afternoon light filtering through canvas stalls, baskets of vegetables, warm and lively',
  },
  prop_apple: {
    label: 'Prop: apple',
    type: 'prop',
    description: 'gpt-image-1 prop pipeline — single object on white background',
    concept: 'apple',
  },
};

// ─── Engine result type ───────────────────────────────────────────────────────

export interface EngineResult {
  dataUrl: string | null;
  elapsed: number;
  engine: string;
  error?: string;
  /** Extracted style description (only set when a reference image was used). */
  styleDescription?: string;
}

// Reference image passed from the client (base64 data + mime type).
// Only Gemini Flash supports this — Imagen 4 is text-to-image only via Developer API.
export interface ReferenceImage {
  b64: string;       // raw base64, no data-URL prefix
  mimeType: string;  // e.g. 'image/jpeg', 'image/png'
}

// ─── OpenAI client ────────────────────────────────────────────────────────────

function getOpenAIClient(): OpenAI {
  const key = process.env.USER_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  if (!key) throw new Error('No OpenAI API key available (USER_OPENAI_API_KEY or OPENAI_API_KEY)');
  return new OpenAI({ apiKey: key });
}

// ─── DALL-E 3 scene generation ────────────────────────────────────────────────

async function runDallE3(concept: string): Promise<EngineResult> {
  const t0 = Date.now();
  try {
    const client = getOpenAIClient();
    const prompt = `Illustrated scene: ${concept}. ${SCENE_STYLE}`;
    const res = await client.images.generate({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size: '1024x1024',
      quality: 'hd',
      response_format: 'b64_json',
    });
    const b64 = res.data?.[0]?.b64_json;
    if (!b64) throw new Error('No b64_json in DALL-E 3 response');
    return { dataUrl: `data:image/png;base64,${b64}`, elapsed: Date.now() - t0, engine: 'dall-e-3' };
  } catch (err: any) {
    return { dataUrl: null, elapsed: Date.now() - t0, engine: 'dall-e-3', error: err?.message || String(err) };
  }
}

// ─── gpt-image-1 with scene style ────────────────────────────────────────────

async function runGptImage1Scene(concept: string): Promise<EngineResult> {
  const t0 = Date.now();
  try {
    const client = getOpenAIClient();
    const prompt = `Illustrated scene: ${concept}. ${SCENE_STYLE}`;
    const res = await (client.images as any).generate({
      model: 'gpt-image-1',
      prompt,
      n: 1,
      size: '1024x1024',
      quality: 'high',
    });
    const b64 = res.data?.[0]?.b64_json;
    if (!b64) throw new Error('No b64_json in gpt-image-1 response');
    return { dataUrl: `data:image/png;base64,${b64}`, elapsed: Date.now() - t0, engine: 'gpt-image-1' };
  } catch (err: any) {
    return { dataUrl: null, elapsed: Date.now() - t0, engine: 'gpt-image-1', error: err?.message || String(err) };
  }
}

// ─── gpt-image-1 with prop style ─────────────────────────────────────────────

async function runGptImage1Prop(concept: string): Promise<EngineResult> {
  const t0 = Date.now();
  try {
    const client = getOpenAIClient();
    const prompt = `Illustration of: ${concept}. ${PROP_STYLE}`;
    const res = await (client.images as any).generate({
      model: 'gpt-image-1',
      prompt,
      n: 1,
      size: '1024x1024',
      quality: 'high',
    });
    const b64 = res.data?.[0]?.b64_json;
    if (!b64) throw new Error('No b64_json in gpt-image-1 prop response');
    return { dataUrl: `data:image/png;base64,${b64}`, elapsed: Date.now() - t0, engine: 'gpt-image-1-prop' };
  } catch (err: any) {
    return { dataUrl: null, elapsed: Date.now() - t0, engine: 'gpt-image-1-prop', error: err?.message || String(err) };
  }
}

// ─── Gemini image generation ──────────────────────────────────────────────────

// Variation nudges ensure parallel requests produce meaningfully different compositions.
const VARIATION_NUDGES: string[] = [
  'Natural framing — balanced layout, straight-on eye-level view.',
  'Low angle looking slightly up at the subject, off-centre composition, shallow depth of field.',
  'Warm late-afternoon golden light; characters show a different emotional expression and body language.',
  'Overhead or three-quarter bird\'s-eye view; reimagine the surrounding environment completely.',
];

/**
 * Two-call style-transfer cache.
 * Key: first 64 chars of the reference b64 (fast fingerprint — no full hash needed).
 * Value: the extracted style+character description string.
 * Cleared on process restart; cheap enough not to need TTL for a test tool.
 */
const styleExtractionCache = new Map<string, string>();

// ─── DB-backed style cache (survives server restarts) ─────────────────────────

// Category must be a valid editor_insight_category enum value.
// We use 'tools' (image generation tool configuration) and prefix the title
// so these rows are easily namespaced away from other tool entries.
const STYLE_CACHE_CATEGORY = 'tools';
const STYLE_PROFILE_CATEGORY = 'tools';

async function getDbStyleCache(imageHash: string): Promise<string | null> {
  try {
    const titleKey = `style_cache:${imageHash}`;
    const result = await getUserDb().execute(drizzleSql`
      SELECT content FROM editor_insights
      WHERE category = ${STYLE_CACHE_CATEGORY} AND title = ${titleKey}
      LIMIT 1
    `);
    return (result.rows[0] as any)?.content ?? null;
  } catch {
    return null;
  }
}

async function setDbStyleCache(imageHash: string, styleDescription: string): Promise<void> {
  try {
    const titleKey = `style_cache:${imageHash}`;
    await getUserDb().execute(drizzleSql`
      INSERT INTO editor_insights (id, category, title, content, importance, tags)
      VALUES (gen_random_uuid(), ${STYLE_CACHE_CATEGORY}, ${titleKey}, ${styleDescription}, 5, ARRAY['style_cache'])
      ON CONFLICT DO NOTHING
    `);
  } catch {
    // Non-fatal — memory cache still works
  }
}

// ─── Pinned style profiles (locked for production use per language) ───────────

export interface StyleProfile {
  language: string;
  styleDescription: string;
  imageHash: string;
  lockedAt: string;
}

export async function lockStyleProfile(language: string, styleDescription: string, imageHash: string): Promise<void> {
  const titleKey = `style_profile:${language}`;
  const content = JSON.stringify({ styleDescription, imageHash, lockedAt: new Date().toISOString() });
  await getUserDb().execute(drizzleSql`
    DELETE FROM editor_insights WHERE category = ${STYLE_PROFILE_CATEGORY} AND title = ${titleKey}
  `);
  await getUserDb().execute(drizzleSql`
    INSERT INTO editor_insights (id, category, title, content, importance, tags)
    VALUES (gen_random_uuid(), ${STYLE_PROFILE_CATEGORY}, ${titleKey}, ${content}, 9, ARRAY['image_style', ${language}])
  `);
  console.log(`[StyleProfile] Locked style for ${language}`);
}

export async function getStyleProfiles(): Promise<StyleProfile[]> {
  const result = await getUserDb().execute(drizzleSql`
    SELECT title, content FROM editor_insights
    WHERE category = ${STYLE_PROFILE_CATEGORY} AND title LIKE 'style_profile:%'
    ORDER BY title
  `);
  return (result.rows as any[]).map(row => ({
    language: (row.title as string).replace('style_profile:', ''),
    ...JSON.parse(row.content),
  }));
}

export async function getStyleProfileForLanguage(language: string): Promise<string | null> {
  try {
    const titleKey = `style_profile:${language}`;
    const result = await getUserDb().execute(drizzleSql`
      SELECT content FROM editor_insights
      WHERE category = ${STYLE_PROFILE_CATEGORY} AND title = ${titleKey}
      LIMIT 1
    `);
    const row = result.rows[0] as any;
    if (!row?.content) return null;
    return JSON.parse(row.content).styleDescription ?? null;
  } catch {
    return null;
  }
}

export async function deleteStyleProfile(language: string): Promise<void> {
  const titleKey = `style_profile:${language}`;
  await getUserDb().execute(drizzleSql`
    DELETE FROM editor_insights WHERE category = ${STYLE_PROFILE_CATEGORY} AND title = ${titleKey}
  `);
  console.log(`[StyleProfile] Deleted style profile for ${language}`);
}

export type ExtractionMode = 'character' | 'environment';

// ─── Extraction prompt builders ───────────────────────────────────────────────

function buildCharacterExtractionPrompt(): string {
  return (
    'You are an illustration art director doing a precise technical style analysis. ' +
    'Analyze this reference image carefully and return exactly two labelled sections.\n\n' +
    'ART STYLE (4-5 sentences):\n' +
    'FIRST: identify the primary style category from this list and name it explicitly — ' +
    'anime/manga, semi-realistic cartoon, watercolor, pen-and-watercolor-wash, ' +
    'digital painterly, cel animation, vector/flat, or graphic novel. ' +
    'THEN describe: (1) line work — are outlines bold/clean/sharp or soft/sketchy/absent? ' +
    'Are lines a key visual element or dissolved into color? ' +
    '(2) color fill method — flat cel fills, smooth digital gradients, translucent watercolor washes, or textured brushwork? ' +
    '(3) saturation level — are colors rich and saturated, muted and dusty, or somewhere in between? ' +
    '(4) dominant hues and warm/cool bias. ' +
    '(5) lighting — flat ambient, soft diffuse, or dramatic directional? ' +
    'Be precise and concrete. Do NOT use vague terms like "vibrant" or "lively." ' +
    'Do NOT describe characters, poses, or scene content — only the visual technique.\n\n' +
    'CHARACTER DESIGN (2-3 sentences): Describe only the main female character\'s ' +
    'physical appearance — face shape, hair color and texture, skin tone, ' +
    'eye color, and clothing style and colors. No poses or expressions.\n\n' +
    'Format your response as exactly:\n' +
    'ART STYLE: [your description]\n' +
    'CHARACTER DESIGN: [your description]'
  );
}

function buildEnvironmentExtractionPrompt(): string {
  return (
    'You are an illustration art director doing a precise technical style analysis. ' +
    'Analyze this reference image carefully and return exactly two labelled sections.\n\n' +
    'ART STYLE (4-5 sentences):\n' +
    'FIRST: identify the primary style category from this list and name it explicitly — ' +
    'anime/manga, semi-realistic cartoon, watercolor, pen-and-watercolor-wash, ' +
    'digital painterly, cel animation, vector/flat, or graphic novel. ' +
    'THEN describe: (1) line work — are outlines bold/clean/sharp or soft/sketchy/absent? ' +
    'Are lines a key visual element or dissolved into color? ' +
    '(2) color fill method — flat cel fills, smooth digital gradients, translucent watercolor washes, or textured brushwork? ' +
    '(3) saturation level — are colors rich and saturated, muted and dusty, or somewhere in between? ' +
    '(4) dominant hues and warm/cool bias. ' +
    '(5) lighting quality — flat ambient, soft diffuse, golden-hour warmth, dramatic directional, or overcast even? ' +
    'Be precise and concrete. Do NOT use vague terms like "vibrant" or "lively." ' +
    'Do NOT describe any people or figures — only the environmental visual technique.\n\n' +
    'ENVIRONMENT STYLE (2-3 sentences): Describe only how the environment and setting is rendered — ' +
    'how backgrounds handle depth and perspective (flat, layered, atmospheric), ' +
    'sky treatment (gradient fill, textured clouds, flat color wash), ' +
    'ground and surface texture (smooth, detailed, impressionistic), ' +
    'and any signature atmospheric qualities such as haze, glow, dappled light, or bloom.\n\n' +
    'Format your response as exactly:\n' +
    'ART STYLE: [your description]\n' +
    'ENVIRONMENT STYLE: [your description]'
  );
}

/**
 * Call 1 of the two-call reference workflow.
 *
 * Sends the reference image to gemini-2.5-flash (text output only) and asks it
 * to describe the art style in precise language — either focusing on character
 * design (mode='character') or environment rendering (mode='environment').
 * The image generator in Call 2 never sees the reference — it only sees this
 * verbal description, which carries style cues without content/composition cues.
 *
 * Cache hierarchy: memory (fastest) → DB (survives restarts) → API extraction.
 * Cache key includes the mode so character and environment extractions from the
 * same image are stored independently.
 */
async function extractStyleDescription(
  reference: ReferenceImage,
  apiKey: string,
  mode: ExtractionMode = 'character',
): Promise<string> {
  const cacheKey = `${mode}:${reference.b64.slice(0, 64)}`;

  // 1. Memory cache (same session)
  const cached = styleExtractionCache.get(cacheKey);
  if (cached) {
    console.log(`[GeminiImagen] Style description memory cache hit (${mode})`);
    return cached;
  }

  // 2. DB cache (survives server restarts)
  const dbCached = await getDbStyleCache(cacheKey);
  if (dbCached) {
    console.log(`[GeminiImagen] Style description DB cache hit (${mode})`);
    styleExtractionCache.set(cacheKey, dbCached);
    return dbCached;
  }

  const extractionPrompt = mode === 'environment'
    ? buildEnvironmentExtractionPrompt()
    : buildCharacterExtractionPrompt();

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        role: 'user',
        parts: [
          { inlineData: { mimeType: reference.mimeType, data: reference.b64 } },
          { text: extractionPrompt },
        ],
      },
    ],
  });

  const text = response.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text ?? '';
  console.log(`[GeminiImagen] Style extracted (${mode}):`, text.slice(0, 120) + '…');
  styleExtractionCache.set(cacheKey, text);
  void setDbStyleCache(cacheKey, text); // persist in background — non-blocking
  return text;
}

async function runGeminiImagen(
  concept: string,
  type: 'scene' | 'prop',
  reference?: ReferenceImage,
  variationIndex: number = 0,
  sceneStyleOverride?: string,
  extractionMode: ExtractionMode = 'character',
  styleDescriptionOverride?: string,
): Promise<EngineResult> {
  const t0 = Date.now();
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY not set');

    const ai = new GoogleGenAI({ apiKey });
    const variationNudge = VARIATION_NUDGES[variationIndex % VARIATION_NUDGES.length];

    let textPrompt: string;
    let styleDesc: string | undefined;

    const frameConstraints =
      'Square 1:1 format. Full bleed edge-to-edge, no white borders, no padding. ' +
      'Heads fully visible with generous headroom. ' +
      'Absolutely no text, letters, numbers or typography in the image.';

    if (reference) {
      // ── Two-call approach ──────────────────────────────────────────────────
      // The image generator NEVER receives the reference image directly.
      // Giving it the image causes it to reproduce the composition, not just
      // the style. Instead: Call 1 extracts style as text (character or
      // environment depending on mode). Call 2 generates from text only.
      styleDesc = await extractStyleDescription(reference, apiKey, extractionMode);

      textPrompt =
        `ILLUSTRATION STYLE TO MATCH:\n${styleDesc}\n\n` +
        `SCENE TO ILLUSTRATE (use the style above, brand new composition):\n` +
        `${concept}. ${frameConstraints}\n\n` +
        `COMPOSITION DIRECTION: ${variationNudge}`;
    } else if (styleDescriptionOverride) {
      // ── Pinned style path ──────────────────────────────────────────────────
      // No new reference image — use a previously extracted (and possibly
      // user-edited) style description from the pinned library directly.
      styleDesc = styleDescriptionOverride;

      textPrompt =
        `ILLUSTRATION STYLE TO MATCH:\n${styleDesc}\n\n` +
        `SCENE TO ILLUSTRATE (use the style above, brand new composition):\n` +
        `${concept}. ${frameConstraints}\n\n` +
        `COMPOSITION DIRECTION: ${variationNudge}`;
    } else {
      // No reference — use SCENE_STYLE (or an override for warm variant testing).
      const sceneStyle = sceneStyleOverride ?? SCENE_STYLE;
      const basePrompt = type === 'prop'
        ? `Square 1:1 format. Illustration of: ${concept}. ${PROP_STYLE}`
        : `Square 1:1 format. Illustrated scene: ${concept}. ${sceneStyle}`;
      textPrompt = `VARIATION DIRECTION: ${variationNudge}\n\n` + basePrompt;
    }

    // Always text-only contents — reference image is never passed to the generator
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: textPrompt,
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    });

    const parts = response.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((p: any) => p.inlineData?.mimeType?.startsWith('image/'));
    if (!imagePart?.inlineData) throw new Error('No image in Gemini response');

    const { mimeType, data } = imagePart.inlineData as { mimeType: string; data: string };
    const engineResult: EngineResult = {
      dataUrl: `data:${mimeType};base64,${data}`,
      elapsed: Date.now() - t0,
      engine: 'gemini-imagen',
    };
    if (styleDesc) {
      engineResult.styleDescription = styleDesc;
    }
    return engineResult;
  } catch (err: any) {
    return { dataUrl: null, elapsed: Date.now() - t0, engine: 'gemini-imagen', error: err?.message || String(err) };
  }
}

// ─── Imagen 4 via Gemini API SDK ─────────────────────────────────────────────

async function runImagenModel(
  engineId: string,
  model: string,
  concept: string,
  type: 'scene' | 'prop',
): Promise<EngineResult> {
  const t0 = Date.now();
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY not set');

    const ai = new GoogleGenAI({ apiKey });
    const stylePrompt = type === 'prop'
      ? `Illustration of: ${concept}. ${PROP_STYLE}`
      : `Illustrated scene: ${concept}. ${SCENE_STYLE}`;

    const response = await ai.models.generateImages({
      model,
      prompt: stylePrompt,
      config: {
        numberOfImages: 1,
        aspectRatio: '1:1',
      },
    });

    const img = response.generatedImages?.[0]?.image;
    if (!img?.imageBytes) throw new Error(`No image data in ${engineId} response`);

    // imageBytes is already a base64 string (SDK passthrough from bytesBase64Encoded)
    const mime = (img as any).mimeType || 'image/png';
    return { dataUrl: `data:${mime};base64,${img.imageBytes}`, elapsed: Date.now() - t0, engine: engineId };
  } catch (err: any) {
    return { dataUrl: null, elapsed: Date.now() - t0, engine: engineId, error: err?.message || String(err) };
  }
}

// ─── Main dispatch ────────────────────────────────────────────────────────────

// Engines that support reference image input (multimodal contents).
// Imagen 4 uses generateImages (text-only via Developer API).
export const REFERENCE_CAPABLE_ENGINES = ['gemini-imagen', 'gemini-imagen-ref'];

export async function runEngineTest(
  engine: string,
  concept: string,
  type: 'scene' | 'prop',
  reference?: ReferenceImage,
  variationIndex: number = 0,
  extractionMode: ExtractionMode = 'character',
  styleDescriptionOverride?: string,
): Promise<EngineResult> {
  switch (engine) {
    case 'dall-e-3':         return runDallE3(concept);
    case 'gpt-image-1':      return runGptImage1Scene(concept);
    case 'gpt-image-1-prop': return runGptImage1Prop(concept);
    case 'gemini-imagen':      return runGeminiImagen(concept, type, undefined, variationIndex);
    case 'gemini-imagen-ref':  return runGeminiImagen(concept, type, reference, variationIndex, undefined, extractionMode, styleDescriptionOverride);
    case 'gemini-imagen-env':  return runGeminiImagen(concept, type, undefined, variationIndex, ENV_STYLE);
    case 'imagen-3':           return runImagenModel('imagen-3', 'imagen-4.0-generate-001', concept, type);
    case 'imagen-4-ultra':   return runImagenModel('imagen-4-ultra', 'imagen-4.0-ultra-generate-001', concept, type);
    default:                 return { dataUrl: null, elapsed: 0, engine, error: `Unknown engine: ${engine}` };
  }
}
