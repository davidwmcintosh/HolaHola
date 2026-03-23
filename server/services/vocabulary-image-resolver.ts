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

// Spanish articles and common filler words to strip before fallback lookup
const SPANISH_ARTICLES = new Set(['el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'al']);

function normalizeWord(word: string): string {
  return word
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // strip accent marks
    .replace(/[^a-z0-9\s]/g, '')     // strip punctuation (slashes, hyphens, etc.)
    .replace(/\s+/g, ' ')            // collapse multiple spaces to single space
    .trim();
}

function generateCacheKey(word: string, language: string): string {
  return `vocab_${language}_${normalizeWord(word)}`;
}

function getPlaceholderUrl(word: string): string {
  const encoded = encodeURIComponent(word);
  return `https://via.placeholder.com/400x300/6366f1/ffffff?text=${encoded}`;
}

/**
 * Returns a series of cache keys to try for the given word, in priority order:
 * 1. Exact normalized key (e.g. "vocab_spanish_caliente frio")
 * 2. Without leading articles (e.g. "las olas" → "olas")
 * 3. Each individual word component (e.g. "caliente frio" → try "caliente", then "frio")
 */
function getFallbackCacheKeys(word: string, language: string): string[] {
  const normalized = normalizeWord(word);
  const keys: string[] = [];

  // 1. Exact match
  keys.push(`vocab_${language}_${normalized}`);

  const parts = normalized.split(' ').filter(Boolean);

  if (parts.length > 1) {
    // 2. Strip leading/trailing articles
    const stripped = parts.filter(p => !SPANISH_ARTICLES.has(p));
    if (stripped.length > 0 && stripped.length < parts.length) {
      keys.push(`vocab_${language}_${stripped.join(' ')}`);
      // Also try each stripped component individually
      for (const part of stripped) {
        if (part.length > 2) keys.push(`vocab_${language}_${part}`);
      }
    }

    // 3. Each individual word component
    for (const part of parts) {
      if (part.length > 2 && !SPANISH_ARTICLES.has(part)) {
        const candidate = `vocab_${language}_${part}`;
        if (!keys.includes(candidate)) keys.push(candidate);
      }
    }
  }

  return keys;
}

/**
 * Detect whether the concept describes a full scene (background/environment) vs. an isolated object.
 * Used to pick the right DALL-E style: scene concepts → SCENE_STYLE (environment),
 * object concepts → PROP_STYLE (single object on white background).
 */
function isSceneConcept(word: string, scene?: string): boolean {
  // If a scene description was explicitly provided and is long, treat as scene
  if (scene && scene.split(' ').length >= 6) return true;

  // Certain Spanish words strongly imply a scene
  const normalized = normalizeWord(word);
  const sceneWords = ['playa', 'mar', 'olas', 'ola', 'ciudad', 'mercado', 'parque', 'bosque',
    'montanas', 'campo', 'pueblo', 'calle', 'restaurante', 'cafe', 'aeropuerto',
    'estacion', 'jardin', 'cocina', 'sala', 'dormitorio', 'escuela', 'oficina',
    'hospital', 'supermercado', 'tienda', 'banco', 'iglesia', 'museo', 'teatro',
    'playa beach ocean waves sunset sunrise landscape countryside desert jungle forest'];
  return sceneWords.some(w => normalized.includes(w));
}

// ── main resolver ─────────────────────────────────────────────────────────────

export async function resolveVocabularyImage(
  request: VocabImageRequest,
): Promise<VocabImageResult> {
  const { word, language, description = word, scene, userId } = request;

  // Primary cache key — exact match
  const primaryKey = generateCacheKey(word, language);
  console.log(`[VocabImage] Resolving "${word}" (${language}), primary key: ${primaryKey}`);

  // ── 1. Library cache lookup with fallback variants ───────────────────────
  const keysToTry = getFallbackCacheKeys(word, language);
  for (const key of keysToTry) {
    const cached = await storage.getCachedStockImage(key);
    if (cached?.url) {
      const matchType = key === primaryKey ? 'exact' : 'fallback';
      console.log(`[VocabImage] Cache hit (${matchType}) for "${word}" → key "${key}"`);
      await storage.incrementImageUsage(cached.id);
      return { imageUrl: cached.url, source: 'cache', word, description };
    }
  }

  // ── 2. Generate with DALL-E 3 (watercolor style) ────────────────────────
  // Build a descriptive English concept for DALL-E even when only given a foreign word.
  // This dramatically improves output quality for abstract concepts and non-English words.
  const conceptForGeneration = buildGenerationConcept(word, scene, description);
  const generationType = isSceneConcept(word, scene) ? 'infographic' : 'image';
  console.log(`[VocabImage] Cache miss — generating (${generationType}) for: "${conceptForGeneration}"`);

  try {
    const { generateVisual } = await import('./visual-content-service');
    const result = await generateVisual(conceptForGeneration, generationType);

    // Persist under the primary vocab cache key so future lookups are instant
    try {
      await storage.cacheImage({
        url: result.imageUrl,
        filename: `vocab_ai_${primaryKey}_${Date.now()}.jpg`,
        mimeType: 'image/jpeg',
        mediaType: 'image',
        imageSource: 'ai_generated',
        searchQuery: primaryKey,
        uploadedBy: userId ?? null,
        title: word,
        description: description,
        tags: ['vocabulary', 'ai_generated', language],
        language,
        targetWord: word,
      });
      console.log(`[VocabImage] Generated image saved to cache as "${primaryKey}"`);
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

/**
 * Build a descriptive English generation concept from the available parameters.
 * When only a foreign-language word is given, DALL-E can struggle. We use the scene
 * description when available, otherwise fall back to the description, otherwise the word.
 * We also strip leading articles since they contribute nothing to the visual.
 */
function buildGenerationConcept(word: string, scene?: string, description?: string): string {
  // Prefer the explicit scene description — most informative for generation
  if (scene && scene.trim().length > 0) return scene.trim();

  // Use the description if it adds more context than the word alone
  if (description && description !== word && description.trim().length > 0) {
    return description.trim();
  }

  // Strip Spanish articles for cleaner generation
  const normalized = normalizeWord(word);
  const parts = normalized.split(' ').filter(p => !SPANISH_ARTICLES.has(p));
  return parts.length > 0 ? parts.join(' ') : word;
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
