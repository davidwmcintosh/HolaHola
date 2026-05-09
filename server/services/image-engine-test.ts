/**
 * Image Engine Test Service
 *
 * Runs a single image generation across different engines for side-by-side comparison.
 * Used exclusively by the admin image engine test page.
 *
 * Engines:
 *   dall-e-3         — current scene pipeline (1024×1024 HD, SCENE_STYLE)
 *   gpt-image-1      — OpenAI alternative (same prompt), SCENE_STYLE
 *   gpt-image-1-prop — OpenAI prop pipeline (PROP_STYLE, white background)
 *   gemini-imagen    — Gemini 2.0 Flash image generation (Google)
 *   imagen-3         — Imagen 4 Standard (imagen-4.0-generate-001)
 *   imagen-4-ultra   — Imagen 4 Ultra (imagen-4.0-ultra-generate-001) — closest to ImageFX quality
 */

import OpenAI from 'openai';
import { GoogleGenAI } from '@google/genai';

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

async function runGeminiImagen(concept: string, type: 'scene' | 'prop'): Promise<EngineResult> {
  const t0 = Date.now();
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY not set');

    const ai = new GoogleGenAI({ apiKey });
    // Gemini Flash has no API aspect-ratio parameter — must be in the prompt.
    const stylePrompt = type === 'prop'
      ? `Square 1:1 format. Illustration of: ${concept}. ${PROP_STYLE}`
      : `Square 1:1 format. Illustrated scene: ${concept}. ${SCENE_STYLE}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: stylePrompt,
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    });

    const parts = response.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((p: any) => p.inlineData?.mimeType?.startsWith('image/'));
    if (!imagePart?.inlineData) throw new Error('No image in Gemini response');

    const { mimeType, data } = imagePart.inlineData as { mimeType: string; data: string };
    return { dataUrl: `data:${mimeType};base64,${data}`, elapsed: Date.now() - t0, engine: 'gemini-imagen' };
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

export async function runEngineTest(
  engine: string,
  concept: string,
  type: 'scene' | 'prop',
): Promise<EngineResult> {
  switch (engine) {
    case 'dall-e-3':       return runDallE3(concept);
    case 'gpt-image-1':    return runGptImage1Scene(concept);
    case 'gpt-image-1-prop': return runGptImage1Prop(concept);
    case 'gemini-imagen':   return runGeminiImagen(concept, type);
    case 'imagen-3':        return runImagenModel('imagen-3', 'imagen-4.0-generate-001', concept, type);
    case 'imagen-4-ultra':  return runImagenModel('imagen-4-ultra', 'imagen-4.0-ultra-generate-001', concept, type);
    default:                return { dataUrl: null, elapsed: 0, engine, error: `Unknown engine: ${engine}` };
  }
}
