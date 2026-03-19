/**
 * Vocabulary Image Resolver Service
 *
 * Resolves images for vocabulary words shown on the whiteboard.
 * Uses a two-step approach:
 *   1. Check the seeded library cache (vocab_spanish_{word} key) — instant, free, consistent watercolor style
 *   2. Generate on-the-fly with DALL-E 3 (same watercolor style as the library), save to cache
 *
 * No Unsplash. Every image uses the watercolor illustrated style.
 */

import { storage } from '../storage';

export interface VocabImageRequest {
  word: string;
  language: string;
  description?: string;
  scene?: string;       // Rich generation prompt when no library image exists
  conversationId?: string;
  userId?: string;
}

export interface VocabImageResult {
  imageUrl: string;
  source: 'cache' | 'ai' | 'placeholder';
  word: string;
  description: string;
}

// ── helpers ──────────────────────────────────────────────────────────────────

function normalizeWord(word: string): string {
  return word
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

function generateCacheKey(word: string, language: string): string {
  return `vocab_${language}_${normalizeWord(word)}`;
}

function getPlaceholderUrl(word: string): string {
  const encoded = encodeURIComponent(word);
  return `https://via.placeholder.com/400x300/6366f1/ffffff?text=${encoded}`;
}

// ── main resolver ─────────────────────────────────────────────────────────────

export async function resolveVocabularyImage(
  request: VocabImageRequest,
): Promise<VocabImageResult> {
  const { word, language, description = word, scene, userId } = request;
  const cacheKey = generateCacheKey(word, language);

  console.log(`[VocabImage] Resolving "${word}" (${language}), cache key: ${cacheKey}`);

  // ── 1. Library cache lookup ──────────────────────────────────────────────
  const cached = await storage.getCachedStockImage(cacheKey);
  if (cached?.url) {
    console.log(`[VocabImage] Cache hit for "${word}"`);
    await storage.incrementImageUsage(cached.id);
    return { imageUrl: cached.url, source: 'cache', word, description };
  }

  // ── 2. Generate with DALL-E 3 (watercolor style) ────────────────────────
  const generationPrompt = scene || description || word;
  console.log(`[VocabImage] Cache miss — generating with DALL-E 3 for: "${generationPrompt}"`);

  try {
    const { generateVisual } = await import('./visual-content-service');
    const result = await generateVisual(generationPrompt, 'image');

    // Persist under the vocab cache key so future lookups are instant
    try {
      await storage.cacheImage({
        url: result.imageUrl,
        filename: `vocab_ai_${cacheKey}_${Date.now()}.jpg`,
        mimeType: 'image/jpeg',
        mediaType: 'image',
        imageSource: 'ai_generated',
        searchQuery: cacheKey,
        uploadedBy: userId ?? null,
        title: word,
        description: description,
        tags: ['vocabulary', 'ai_generated', language],
        language,
        targetWord: word,
      });
      console.log(`[VocabImage] Generated image saved to cache as "${cacheKey}"`);
    } catch (saveErr: any) {
      console.warn('[VocabImage] Cache save skipped:', saveErr.message);
    }

    return { imageUrl: result.imageUrl, source: 'ai', word, description };
  } catch (genErr: any) {
    console.error('[VocabImage] DALL-E generation failed:', genErr.message);
  }

  // ── 3. Placeholder fallback ──────────────────────────────────────────────
  console.log(`[VocabImage] Using placeholder for "${word}"`);
  return { imageUrl: getPlaceholderUrl(word), source: 'placeholder', word, description };
}

export async function resolveMultipleImages(
  requests: VocabImageRequest[],
): Promise<VocabImageResult[]> {
  return Promise.all(requests.map(resolveVocabularyImage));
}

export async function prefetchVocabularyImage(
  word: string,
  language: string,
  description?: string,
): Promise<void> {
  try {
    await resolveVocabularyImage({ word, language, description });
  } catch (err: any) {
    console.error(`[VocabImage] Prefetch failed for "${word}":`, err.message);
  }
}
