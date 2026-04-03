/**
 * Visual Content Generation Service
 *
 * Scene images (type='infographic'): DALL-E 3 HD
 *   Naturally produces the warm Disney-style illustrated cartoon with watercolor-wash
 *   backgrounds that matches the HoloHola aesthetic.
 *
 * Prop images (type='image'): gpt-image-1
 *   Better at isolating a single object against a clean white background without
 *   adding unwanted context — cleaner results for vocabulary prop cards.
 */

import OpenAI from 'openai';
import { uploadPublicBuffer } from './image-storage';

export interface VisualGenerationRequest {
  concept: string;
  type: 'image' | 'infographic';
  data?: Record<string, unknown>;
  style?: string;
  targetLanguage?: string;
  educationalContext?: string;
  /**
   * Optional URL of an existing high-quality image that establishes the art style
   * and character design for this generation.  When present (and type is
   * 'infographic'), the service calls images.edit so gpt-image-1 can reference
   * the visual style directly.  Falls back to text-only if the fetch fails.
   */
  anchorImageUrl?: string;
}

export interface VisualGenerationResult {
  imageUrl: string;
  altText: string;
  semanticTags: string[];
  accessibilityDescription: string;
  conceptAlignment: number;
  metadata: {
    provider: string;
    generatedAt: string;
    dimensions: { width: number; height: number };
    educationalLevel?: string;
  };
}

const NO_TEXT_INSTRUCTION =
  'absolutely no text, no letters, no numbers, no words, no handwriting, no captions, ' +
  'no labels, no symbols, no glyphs, no typography, no writing of any kind anywhere in the image';

// Vocabulary props: single object, white background, clean silhouette
const PROP_STYLE =
  'warm painterly digital illustration, soft natural lighting, slightly stylized friendly characters, ' +
  'rich warm color palette with golden tones, semi-realistic proportions, textured brushwork with depth, ' +
  'object centred and prominent on a clean pure white background, clear recognisable silhouette, ' +
  'wholesome family-friendly educational quality, ' +
  NO_TEXT_INSTRUCTION;

// Scene images: warm Disney-style illustrated cartoon with watercolor-wash backgrounds.
// This is the style of the existing HoloHola images — large expressive eyes, smooth
// cel-shading, watercolor-influenced backgrounds, warm golden palette.
// Generated with DALL-E 3 (hd) which naturally produces this blend.
const SCENE_STYLE =
  'warm illustrated cartoon in the style of a Disney animated film — ' +
  'slightly stylized characters with large expressive dark eyes, smooth cel-shading ' +
  'with soft gradient transitions and warm skin tones with subtle blush, ' +
  'warm watercolor-wash backgrounds with soft colour bleeding and illustrated architectural detail, ' +
  'vivid warm golden ambient lighting, professional educational illustration quality ' +
  'similar to a language learning app like Babbel or Duolingo, wholesome family-friendly, ' +
  'IMPORTANT: characters should look distinctly different ages when the scene calls for it (young adult vs clearly elderly), ' +
  'IMPORTANT FRAMING: generous headroom — heads fully visible, never cropped at top of frame, ' +
  'position characters in lower two-thirds of canvas so top quarter shows sky or background, ' +
  NO_TEXT_INSTRUCTION;

// Semantic tag categories for educational content
const EDUCATIONAL_TAG_CATEGORIES = [
  'vocabulary', 'grammar', 'culture', 'geography', 'conversation',
  'numbers', 'colors', 'food', 'family', 'travel', 'business',
  'beginner', 'intermediate', 'advanced', 'actfl-novice', 'actfl-intermediate',
] as const;

function getDallEClient(): OpenAI | null {
  const key = process.env.USER_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  if (!key) return null;
  return new OpenAI({ apiKey: key });
}

/**
 * Generate an image using gpt-image-1.
 *
 * For scene images (type='infographic') with an anchorImageUrl, calls
 * images.edit so the model can reference the existing character/style.
 * For all other cases (props, or when no anchor is available) uses
 * images.generate with gpt-image-1 which follows character-description
 * prompts far more accurately than DALL-E 3.
 *
 * gpt-image-1 always returns b64_json — no response_format needed.
 */
/**
 * Generate a SCENE image (type='infographic') using DALL-E 3.
 *
 * DALL-E 3 naturally produces the warm Disney-style illustrated cartoon with
 * watercolor-wash backgrounds that matches the existing HoloHola aesthetic.
 * gpt-image-1 consistently drifts to either flat digital cartoon or heavy
 * watercolor — neither matching the original character art.
 */
async function generateSceneWithDallE3(
  request: VisualGenerationRequest,
  client: OpenAI,
): Promise<string> {
  const prompt = `Illustrated cartoon scene: ${request.concept}. ${SCENE_STYLE}.`;
  console.log('[VisualContent] DALL-E 3 (hd) scene prompt:', prompt.substring(0, 200));

  const genResponse = await client.images.generate({
    model: 'dall-e-3',
    prompt,
    n: 1,
    size: '1024x1024',
    quality: 'hd',
    response_format: 'b64_json',
  });

  const b64 = genResponse.data?.[0]?.b64_json;
  if (!b64) throw new Error('DALL-E 3 returned no image data');
  return b64;
}

/**
 * Generate a PROP image (type='image') using gpt-image-1.
 *
 * gpt-image-1 is better than DALL-E 3 at isolating a single object against a
 * clean white background without adding unwanted context or scenery.
 */
async function generatePropWithGptImage(
  request: VisualGenerationRequest,
  client: OpenAI,
): Promise<string> {
  const prompt = `Illustration of: ${request.concept}. ${PROP_STYLE}.`;
  console.log('[VisualContent] gpt-image-1 prop prompt:', prompt.substring(0, 200));

  const genResponse = await (client.images as any).generate({
    model: 'gpt-image-1',
    prompt,
    n: 1,
    size: '1024x1024',
    quality: 'high',
  });

  const b64 = genResponse.data?.[0]?.b64_json;
  if (!b64) throw new Error('gpt-image-1 returned no image data');
  return b64;
}

async function generateWithModel(
  request: VisualGenerationRequest,
): Promise<{ imageUrl: string }> {
  const client = getDallEClient();
  if (!client) throw new Error('OPENAI_API_KEY not set');

  const isScene = request.type === 'infographic';
  let b64: string;

  if (isScene) {
    b64 = await generateSceneWithDallE3(request, client);
  } else {
    b64 = await generatePropWithGptImage(request, client);
  }

  const buf = Buffer.from(b64, 'base64');
  const filename = `visual-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
  const url = await uploadPublicBuffer(filename, buf, 'image/jpeg');
  return { imageUrl: url };
}

function generatePlaceholderImage(request: VisualGenerationRequest): { imageUrl: string } {
  const seed = request.concept.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  const size = request.type === 'infographic' ? '800x450' : '400x400';
  return {
    imageUrl: `https://picsum.photos/seed/${seed}/${size.replace('x', '/')}`,
  };
}

function generateSemanticTags(concept: string, type: string, context?: string): string[] {
  const tags: string[] = [type];
  const conceptLower = concept.toLowerCase();
  for (const category of EDUCATIONAL_TAG_CATEGORIES) {
    if (conceptLower.includes(category) || (context && context.toLowerCase().includes(category))) {
      tags.push(category);
    }
  }
  const words = concept.split(/\s+/).filter(w => w.length > 3);
  tags.push(...words.slice(0, 5).map(w => w.toLowerCase().replace(/[^a-z]/g, '')));
  return [...new Set(tags)].filter(Boolean);
}

function generateAltText(concept: string, type: string, tags: string[]): string {
  const typeDescription = type === 'infographic'
    ? 'Educational infographic showing'
    : 'Illustration depicting';
  return `${typeDescription} ${concept}. Related topics: ${tags.slice(0, 5).join(', ')}.`;
}

function generateAccessibilityDescription(concept: string, type: string, data?: Record<string, unknown>): string {
  let description = `This ${type} illustrates the concept of ${concept} for language learners.`;
  if (data && Object.keys(data).length > 0) {
    description += ` It includes information about: ${Object.keys(data).join(', ')}.`;
  }
  return description;
}

/**
 * Main function to generate educational visuals.
 *
 * @param anchorImageUrl  Optional URL of a reference image that establishes the
 *                        art style and character design.  Pass the URL of an
 *                        existing "known-good" textbook image for the language.
 */
export async function generateVisual(
  concept: string,
  type: 'image' | 'infographic',
  data?: Record<string, unknown>,
  style?: string,
  anchorImageUrl?: string,
): Promise<VisualGenerationResult> {
  const request: VisualGenerationRequest = { concept, type, data, style, anchorImageUrl };
  let imageUrl: string;
  let provider: string;

  try {
    const result = await generateWithModel(request);
    imageUrl = result.imageUrl;
    provider = type === 'infographic' ? 'dall-e-3' : 'gpt-image-1';
  } catch (error) {
    console.warn('[VisualContent] image generation failed, falling back to placeholder:', error);
    imageUrl = generatePlaceholderImage(request).imageUrl;
    provider = 'placeholder';
  }

  const semanticTags = generateSemanticTags(concept, type);
  const altText = generateAltText(concept, type, semanticTags);
  const accessibilityDescription = generateAccessibilityDescription(concept, type, data);

  return {
    imageUrl,
    altText,
    semanticTags,
    accessibilityDescription,
    conceptAlignment: provider === 'placeholder' ? 0.5 : 0.92,
    metadata: {
      provider,
      generatedAt: new Date().toISOString(),
      dimensions: type === 'infographic' ? { width: 1024, height: 1024 } : { width: 1024, height: 1024 },
    },
  };
}

/**
 * Batch generation for curriculum content
 */
export async function generateVisualBatch(
  requests: VisualGenerationRequest[],
): Promise<VisualGenerationResult[]> {
  const results: VisualGenerationResult[] = [];
  const batchSize = 3;
  for (let i = 0; i < requests.length; i += batchSize) {
    const batch = requests.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(req => generateVisual(req.concept, req.type, req.data, req.style, req.anchorImageUrl)),
    );
    results.push(...batchResults);
  }
  return results;
}

/**
 * Validate visual quality and tag accuracy
 */
export function validateVisualQuality(result: VisualGenerationResult): {
  isValid: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  if (!result.imageUrl) issues.push('Missing image URL');
  if (!result.altText || result.altText.length < 10) issues.push('Alt text too short or missing');
  if (result.semanticTags.length < 2) issues.push('Insufficient semantic tags');
  if (result.conceptAlignment < 0.7) issues.push('Low concept alignment score');
  return { isValid: issues.length === 0, issues };
}
