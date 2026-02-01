/**
 * Audio Caching Service
 * 
 * Provides persistent database-backed caching for TTS audio.
 * Uses SHA256 hashing to uniquely identify audio based on:
 * - Text content
 * - Language
 * - Voice ID/gender
 * - Speed (slow/normal)
 * 
 * Key features:
 * - Cache-first: Always check database before generating
 * - Auto-cache on miss: Automatically stores newly generated audio
 * - Hit counter: Tracks usage for analytics
 * - Content type: Categorizes audio for different use cases
 */

import crypto from 'crypto';
import { getSharedDb } from '../neon-db';
import { audioLibrary, type InsertAudioLibrary, type AudioLibraryEntry } from '@shared/schema';
import { eq, sql, and } from 'drizzle-orm';
import { getTTSService, getAssistantVoice, type AssistantVoiceGender } from './tts-service';

export type AudioContentType = 'drill' | 'vocabulary' | 'pronunciation' | 'textbook';
export type AudioSpeed = 'slow' | 'normal' | 'fast';

interface CacheKey {
  text: string;
  language: string;
  voiceId: string;
  speed: AudioSpeed;
}

interface CachedAudio {
  audioUrl: string;
  durationMs: number | null;
  cacheHit: boolean;
}

interface GenerateOptions {
  contentType: AudioContentType;
  sourceId?: string;
  speakingRate?: number;
}

/**
 * Generate a SHA256 hash for cache lookup
 * Combines text, language, voice, and speed into unique identifier
 */
function generateTextHash(key: CacheKey): string {
  const data = `${key.text}|${key.language}|${key.voiceId}|${key.speed}`;
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Estimate audio duration from MP3 buffer size
 * MP3 at 128kbps ≈ 16KB per second
 */
function estimateDurationMs(bufferSize: number): number {
  const bytesPerSecond = (128 * 1000) / 8;
  return Math.round((bufferSize / bytesPerSecond) * 1000);
}

/**
 * Get speaking rate based on speed setting
 */
function getSpeakingRate(speed: AudioSpeed): number {
  switch (speed) {
    case 'slow': return 0.7;
    case 'normal': return 0.9;
    case 'fast': return 1.1;
    default: return 0.9;
  }
}

/**
 * Look up cached audio by hash
 * Returns null if not found, updates hit counter if found
 */
async function lookupCachedAudio(textHash: string): Promise<AudioLibraryEntry | null> {
  try {
    const db = getSharedDb();
    const results = await db
      .select()
      .from(audioLibrary)
      .where(eq(audioLibrary.textHash, textHash))
      .limit(1);
    
    if (results.length === 0) {
      return null;
    }
    
    const entry = results[0];
    
    await db
      .update(audioLibrary)
      .set({
        hitCount: sql`${audioLibrary.hitCount} + 1`,
        lastAccessedAt: new Date(),
      })
      .where(eq(audioLibrary.id, entry.id));
    
    return entry;
  } catch (error: any) {
    console.error('[Audio Cache] Lookup error:', error.message);
    return null;
  }
}

/**
 * Store audio in the cache
 */
async function storeAudioInCache(
  key: CacheKey,
  audioUrl: string,
  durationMs: number | null,
  options: GenerateOptions
): Promise<void> {
  try {
    const db = getSharedDb();
    const textHash = generateTextHash(key);
    
    const entry: InsertAudioLibrary = {
      contentType: options.contentType,
      textHash,
      text: key.text,
      language: key.language,
      voiceId: key.voiceId,
      speed: key.speed,
      audioUrl,
      durationMs,
      sourceId: options.sourceId,
    };
    
    await db.insert(audioLibrary).values(entry);
    console.log(`[Audio Cache] Stored: "${key.text.substring(0, 30)}..." (${key.language}, ${key.speed})`);
  } catch (error: any) {
    if (error.code === '23505') {
      console.log('[Audio Cache] Entry already exists (race condition), ignoring');
    } else {
      console.error('[Audio Cache] Store error:', error.message);
    }
  }
}

/**
 * Get or generate pronunciation audio with caching
 * 
 * This is the main entry point for cached audio generation.
 * Checks cache first, generates on miss, and auto-stores.
 * 
 * @param text - Text to synthesize
 * @param language - Target language (e.g., 'spanish', 'french')
 * @param gender - Voice gender preference
 * @param speed - Speed setting ('slow', 'normal', 'fast')
 * @param options - Additional options for categorization
 * @returns Cached or freshly generated audio
 */
export async function getCachedPronunciationAudio(
  text: string,
  language: string,
  gender: AssistantVoiceGender = 'female',
  speed: AudioSpeed = 'normal',
  options: Partial<GenerateOptions> = {}
): Promise<CachedAudio> {
  const voiceConfig = getAssistantVoice(language, gender);
  const voiceId = voiceConfig.name;
  
  const cacheKey: CacheKey = {
    text: text.trim(),
    language: language.toLowerCase(),
    voiceId,
    speed,
  };
  
  const textHash = generateTextHash(cacheKey);
  
  const cached = await lookupCachedAudio(textHash);
  if (cached) {
    console.log(`[Audio Cache] HIT: "${text.substring(0, 30)}..." (${language}, ${speed})`);
    return {
      audioUrl: cached.audioUrl,
      durationMs: cached.durationMs,
      cacheHit: true,
    };
  }
  
  console.log(`[Audio Cache] MISS: "${text.substring(0, 30)}..." (${language}, ${speed}) - generating...`);
  
  const speakingRate = options.speakingRate ?? getSpeakingRate(speed);
  const ttsService = getTTSService();
  
  const result = await ttsService.synthesize({
    text,
    language,
    voice: voiceConfig.name,
    speakingRate,
  });
  
  const audioBase64 = result.audioBuffer.toString('base64');
  const audioUrl = `data:audio/mpeg;base64,${audioBase64}`;
  const durationMs = estimateDurationMs(result.audioBuffer.length);
  
  await storeAudioInCache(cacheKey, audioUrl, durationMs, {
    contentType: options.contentType || 'pronunciation',
    sourceId: options.sourceId,
    speakingRate,
  });
  
  return {
    audioUrl,
    durationMs,
    cacheHit: false,
  };
}

/**
 * Pre-warm cache for a batch of texts
 * Useful for drill lessons or vocabulary sets
 */
export async function preWarmCache(
  items: Array<{ text: string; language: string; sourceId?: string }>,
  gender: AssistantVoiceGender = 'female',
  speeds: AudioSpeed[] = ['normal', 'slow'],
  contentType: AudioContentType = 'drill'
): Promise<{ generated: number; cached: number; errors: number }> {
  let generated = 0;
  let cached = 0;
  let errors = 0;
  
  console.log(`[Audio Cache] Pre-warming ${items.length} items x ${speeds.length} speeds...`);
  
  for (const item of items) {
    for (const speed of speeds) {
      try {
        const result = await getCachedPronunciationAudio(
          item.text,
          item.language,
          gender,
          speed,
          { contentType, sourceId: item.sourceId }
        );
        
        if (result.cacheHit) {
          cached++;
        } else {
          generated++;
        }
      } catch (error: any) {
        console.error(`[Audio Cache] Pre-warm error for "${item.text}":`, error.message);
        errors++;
      }
    }
  }
  
  console.log(`[Audio Cache] Pre-warm complete: ${generated} generated, ${cached} cached, ${errors} errors`);
  return { generated, cached, errors };
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
  totalEntries: number;
  byContentType: Record<string, number>;
  totalHits: number;
}> {
  try {
    const db = getSharedDb();
    
    const allEntries = await db.select().from(audioLibrary);
    
    const byContentType: Record<string, number> = {};
    let totalHits = 0;
    
    for (const entry of allEntries) {
      const type = entry.contentType || 'unknown';
      byContentType[type] = (byContentType[type] || 0) + 1;
      totalHits += entry.hitCount;
    }
    
    return {
      totalEntries: allEntries.length,
      byContentType,
      totalHits,
    };
  } catch (error: any) {
    console.error('[Audio Cache] Stats error:', error.message);
    return { totalEntries: 0, byContentType: {}, totalHits: 0 };
  }
}
