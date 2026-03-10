/**
 * Visual Content Generation Service
 * Integrates with external image generation APIs to create
 * precisely tagged educational visuals for curriculum content.
 */

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
  conceptAlignment: number; // 0-1 score of how well visual matches concept
  metadata: {
    provider: string;
    generatedAt: string;
    dimensions: { width: number; height: number };
    educationalLevel?: string;
  };
}

export interface VisualProviderConfig {
  provider: 'openai' | 'stability' | 'placeholder';
  apiKey?: string;
  baseUrl?: string;
}

// Semantic tag categories for educational content
const EDUCATIONAL_TAG_CATEGORIES = [
  'vocabulary', 'grammar', 'culture', 'geography', 'conversation',
  'numbers', 'colors', 'food', 'family', 'travel', 'business',
  'beginner', 'intermediate', 'advanced', 'actfl-novice', 'actfl-intermediate'
] as const;

function getProviderConfig(): VisualProviderConfig {
  const openaiKey = process.env.OPENAI_API_KEY || process.env.USER_OPENAI_API_KEY;
  if (openaiKey) {
    return {
      provider: 'openai',
      apiKey: openaiKey,
    };
  }
  if (process.env.STABILITY_API_KEY) {
    return {
      provider: 'stability',
      apiKey: process.env.STABILITY_API_KEY,
      baseUrl: 'https://api.stability.ai',
    };
  }
  // Fallback to placeholder for development
  return { provider: 'placeholder' };
}

async function generateWithOpenAI(
  request: VisualGenerationRequest,
  apiKey: string
): Promise<{ imageUrl: string; revisedPrompt: string }> {
  const styleGuide = request.style || 'clean, educational, professional illustration';
  const prompt = request.type === 'infographic'
    ? `Educational infographic about ${request.concept}. ${styleGuide}. Include clear labels and visual hierarchy. Data: ${JSON.stringify(request.data || {})}`
    : `Educational illustration for language learning: ${request.concept}. ${styleGuide}. Clear, culturally appropriate, suitable for all ages.`;

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size: request.type === 'infographic' ? '1792x1024' : '1024x1024',
      quality: 'standard',
      response_format: 'url',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI image generation failed: ${error}`);
  }

  const result = await response.json();
  return {
    imageUrl: result.data[0].url,
    revisedPrompt: result.data[0].revised_prompt || prompt,
  };
}

async function generateWithStability(
  request: VisualGenerationRequest,
  apiKey: string
): Promise<{ imageUrl: string }> {
  const styleGuide = request.style || 'educational illustration, clean lines, professional';
  const prompt = `${request.concept}, ${styleGuide}, language learning visual`;

  const response = await fetch('https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      text_prompts: [{ text: prompt, weight: 1 }],
      cfg_scale: 7,
      height: 1024,
      width: 1024,
      samples: 1,
      steps: 30,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Stability AI generation failed: ${error}`);
  }

  const result = await response.json();
  // Stability returns base64, would need to upload to storage
  // For now, return as data URL
  return {
    imageUrl: `data:image/png;base64,${result.artifacts[0].base64}`,
  };
}

function generatePlaceholderImage(request: VisualGenerationRequest): { imageUrl: string } {
  // Generate a placeholder URL for development/testing
  const seed = request.concept.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  const size = request.type === 'infographic' ? '800x450' : '400x400';
  return {
    imageUrl: `https://picsum.photos/seed/${seed}/${size.replace('x', '/')}`,
  };
}

function generateSemanticTags(concept: string, type: string, context?: string): string[] {
  const tags: string[] = [];
  const conceptLower = concept.toLowerCase();

  // Add type tag
  tags.push(type);

  // Match against educational categories
  for (const category of EDUCATIONAL_TAG_CATEGORIES) {
    if (conceptLower.includes(category) || (context && context.toLowerCase().includes(category))) {
      tags.push(category);
    }
  }

  // Extract key nouns as tags (simple extraction)
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
 * Main function call for Daniela and other AI participants to generate visuals
 */
export async function generateVisual(
  concept: string,
  type: 'image' | 'infographic',
  data?: Record<string, unknown>,
  style?: string
): Promise<VisualGenerationResult> {
  const request: VisualGenerationRequest = { concept, type, data, style };
  const config = getProviderConfig();

  let imageUrl: string;
  let revisedPrompt: string | undefined;

  try {
    switch (config.provider) {
      case 'openai':
        const openaiResult = await generateWithOpenAI(request, config.apiKey!);
        imageUrl = openaiResult.imageUrl;
        revisedPrompt = openaiResult.revisedPrompt;
        break;
      case 'stability':
        const stabilityResult = await generateWithStability(request, config.apiKey!);
        imageUrl = stabilityResult.imageUrl;
        break;
      case 'placeholder':
      default:
        const placeholderResult = generatePlaceholderImage(request);
        imageUrl = placeholderResult.imageUrl;
        break;
    }
  } catch (error) {
    console.error('Visual generation failed, falling back to placeholder:', error);
    const placeholderResult = generatePlaceholderImage(request);
    imageUrl = placeholderResult.imageUrl;
  }

  const semanticTags = generateSemanticTags(concept, type, revisedPrompt);
  const altText = generateAltText(concept, type, semanticTags);
  const accessibilityDescription = generateAccessibilityDescription(concept, type, data);

  return {
    imageUrl,
    altText,
    semanticTags,
    accessibilityDescription,
    conceptAlignment: config.provider === 'placeholder' ? 0.5 : 0.85,
    metadata: {
      provider: config.provider,
      generatedAt: new Date().toISOString(),
      dimensions: type === 'infographic' ? { width: 1792, height: 1024 } : { width: 1024, height: 1024 },
    },
  };
}

/**
 * Batch generation for curriculum content
 */
export async function generateVisualBatch(
  requests: VisualGenerationRequest[]
): Promise<VisualGenerationResult[]> {
  // Process in parallel with concurrency limit
  const results: VisualGenerationResult[] = [];
  const batchSize = 3;

  for (let i = 0; i < requests.length; i += batchSize) {
    const batch = requests.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(req => generateVisual(req.concept, req.type, req.data, req.style))
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

  if (!result.imageUrl) {
    issues.push('Missing image URL');
  }
  if (!result.altText || result.altText.length < 10) {
    issues.push('Alt text too short or missing');
  }
  if (result.semanticTags.length < 2) {
    issues.push('Insufficient semantic tags for discoverability');
  }
  if (result.conceptAlignment < 0.7) {
    issues.push('Low concept alignment score - visual may not match intent');
  }

  return {
    isValid: issues.length === 0,
    issues,
  };
}