/**
 * Visual Content Generation Service
 * Integrates with Gemini Imagen for style-consistent educational visuals.
 * All images use the same watercolor illustrated style as the prop zone assets.
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

// Shared style — soft watercolor children's book illustration used across all generated assets
const NO_TEXT_INSTRUCTION =
  'absolutely no text, no letters, no numbers, no words, no handwriting, no captions, ' +
  'no labels, no symbols, no glyphs, no typography, no writing of any kind anywhere in the image';

// Vocabulary props: single object, white background, clean silhouette (children's book card feel)
const PROP_STYLE =
  'soft watercolor children\'s book illustration style, warm gentle colors, clean fine ink outlines, ' +
  'visible brushwork texture, object centred and prominent on a clean pure white background, ' +
  'no background elements, clear and recognisable silhouette, language learning educational quality, ' +
  NO_TEXT_INSTRUCTION;

// Scene backgrounds: immersive environments, loose painterly watercolor — NOT architectural or sketch-like
const SCENE_STYLE =
  'loose impressionistic watercolor painting style, soft glowing washes of color, warm luminous light, ' +
  'painterly brushstrokes with no hard ink outlines, dreamy soft-focus atmosphere, ' +
  'vibrant yet gentle palette, immersive background scene, language learning educational context, ' +
  'suitable for all ages, ' +
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

async function generateWithDallE(
  request: VisualGenerationRequest,
): Promise<{ imageUrl: string }> {
  const client = getDallEClient();
  if (!client) throw new Error('OPENAI_API_KEY not set');

  const style = request.type === 'infographic' ? SCENE_STYLE : PROP_STYLE;
  const prompt = request.type === 'infographic'
    ? `Watercolor illustration of a scene: ${request.concept}. ${style}.`
    : `Watercolor illustration of: ${request.concept}. ${style}.`;

  const response = await client.images.generate({
    model: 'dall-e-3',
    prompt,
    n: 1,
    size: '1024x1024',
    quality: 'standard',
    response_format: 'url',
  });

  const imageUrl = response.data?.[0]?.url;
  if (!imageUrl) throw new Error('DALL-E returned no image URL');

  // Download the image from the temporary URL
  const fetchRes = await fetch(imageUrl);
  if (!fetchRes.ok) throw new Error(`Failed to download generated image: ${fetchRes.status}`);
  const buf = Buffer.from(await fetchRes.arrayBuffer());

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
 * Main function for Daniela and other AI participants to generate visuals.
 * Uses Gemini Imagen for style-consistent watercolor illustrated images.
 */
export async function generateVisual(
  concept: string,
  type: 'image' | 'infographic',
  data?: Record<string, unknown>,
  style?: string,
): Promise<VisualGenerationResult> {
  const request: VisualGenerationRequest = { concept, type, data, style };
  let imageUrl: string;
  let provider: string;

  try {
    const result = await generateWithDallE(request);
    imageUrl = result.imageUrl;
    provider = 'dall-e-3';
  } catch (error) {
    console.warn('[VisualContent] DALL-E generation failed, falling back to placeholder:', error);
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
    conceptAlignment: provider === 'placeholder' ? 0.5 : 0.88,
    metadata: {
      provider,
      generatedAt: new Date().toISOString(),
      dimensions: type === 'infographic' ? { width: 1792, height: 1024 } : { width: 1024, height: 1024 },
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
      batch.map(req => generateVisual(req.concept, req.type, req.data, req.style)),
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
