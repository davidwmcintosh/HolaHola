/**
 * Visual Content Generation Service
 *
 * Scene images (type='infographic'): Gemini Warm (gemini-2.5-flash-image + SCENE_STYLE_WARM)
 *   Close portrait crop, golden saturated palette. Used for Daniela/character social reading
 *   cards and vocabulary character images.
 *
 * Prop images (type='image'): Base Gemini Flash (gemini-2.5-flash-image + PROP_STYLE)
 *   Single object isolated on clean white background for vocabulary prop cards.
 *
 * See server/services/google-image-service.ts for style constants and engine rationale.
 * See docs/visual-asset-roadmap.md → "Image Engine Evaluation — May 2026" for full decision.
 */

import { generateCharacterScene, generatePropImage } from './google-image-service';

export interface VisualGenerationRequest {
  concept: string;
  type: 'image' | 'infographic';
  data?: Record<string, unknown>;
  style?: string;
  targetLanguage?: string;
  educationalContext?: string;
  /**
   * Optional URL of an existing high-quality image that establishes the art style
   * and character design for this generation. Reserved for future reference-image
   * support — currently unused by the Gemini engine paths.
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

// Semantic tag categories for educational content
const EDUCATIONAL_TAG_CATEGORIES = [
  'vocabulary', 'grammar', 'culture', 'geography', 'conversation',
  'numbers', 'colors', 'food', 'family', 'travel', 'business',
  'beginner', 'intermediate', 'advanced', 'actfl-novice', 'actfl-intermediate',
] as const;

async function generateWithModel(
  request: VisualGenerationRequest,
): Promise<{ imageUrl: string }> {
  const isScene = request.type === 'infographic';
  const imageUrl = isScene
    ? await generateCharacterScene(request.concept)
    : await generatePropImage(request.concept);
  return { imageUrl };
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
    provider = type === 'infographic' ? 'gemini-warm' : 'gemini-base';
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
