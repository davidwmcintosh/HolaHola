/**
 * Drill Audio Service
 * 
 * Provides batch TTS synthesis for drill lessons with caching support.
 * Uses Google Cloud TTS for consistent, high-quality pronunciation that
 * can be cached and reused across sessions.
 * 
 * Design Decisions:
 * - Google TTS (not Cartesia) for drill audio: drills need consistent,
 *   reproducible audio for rote learning, not streaming low-latency
 * - Caching: drill items have fixed text, so audio can be generated once
 *   and reused for all learners
 * - Batch synthesis: generates audio for multiple items efficiently
 */

import { getTTSService } from './tts-service';
import { storage } from '../storage';
import type { CurriculumDrillItem } from '@shared/schema';
import crypto from 'crypto';

interface DrillAudioResult {
  drillItemId: string;
  audioUrl: string | null;
  audioDurationMs: number | null;
  error?: string;
}

interface AudioCache {
  [cacheKey: string]: {
    audioBase64: string;
    durationMs: number;
    generatedAt: number;
  };
}

// In-memory cache for audio (could be moved to Redis for production)
const audioCache: AudioCache = {};

// Cache TTL: 24 hours
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Generate a cache key for a drill item's audio
 * Based on: text + language + voice settings
 */
function generateCacheKey(text: string, language: string, speakingRate: number = 0.9): string {
  const data = `${text}:${language}:${speakingRate}`;
  return crypto.createHash('md5').update(data).digest('hex');
}

/**
 * Check if cached audio is still valid
 */
function isCacheValid(cacheKey: string): boolean {
  const cached = audioCache[cacheKey];
  if (!cached) return false;
  return Date.now() - cached.generatedAt < CACHE_TTL_MS;
}

/**
 * Estimate audio duration from MP3 buffer
 * MP3 at 128kbps ≈ 16KB per second
 */
function estimateDurationMs(bufferSize: number): number {
  const bytesPerSecond = (128 * 1000) / 8; // 128kbps
  return Math.round((bufferSize / bytesPerSecond) * 1000);
}

/**
 * Generate audio for a single drill item
 */
export async function generateDrillAudio(
  text: string,
  language: string,
  speakingRate: number = 0.9
): Promise<{ audioBase64: string; durationMs: number }> {
  const cacheKey = generateCacheKey(text, language, speakingRate);
  
  // Check cache first
  if (isCacheValid(cacheKey)) {
    console.log(`[Drill Audio] Cache HIT for text: "${text.substring(0, 30)}..."`);
    return {
      audioBase64: audioCache[cacheKey].audioBase64,
      durationMs: audioCache[cacheKey].durationMs,
    };
  }
  
  console.log(`[Drill Audio] Generating audio for: "${text.substring(0, 50)}..."`);
  
  // Use Google TTS for consistent drill audio
  const ttsService = getTTSService();
  const result = await ttsService.synthesize({
    text,
    language,
    speakingRate,
  });
  
  const audioBase64 = result.audioBuffer.toString('base64');
  const durationMs = estimateDurationMs(result.audioBuffer.length);
  
  // Cache the result
  audioCache[cacheKey] = {
    audioBase64,
    durationMs,
    generatedAt: Date.now(),
  };
  
  console.log(`[Drill Audio] Generated ${result.audioBuffer.length} bytes, ~${durationMs}ms duration`);
  
  return { audioBase64, durationMs };
}

/**
 * Generate audio for multiple drill items in batch
 * Returns results for all items, including any errors
 */
export async function batchGenerateDrillAudio(
  drillItems: CurriculumDrillItem[],
  language: string,
  speakingRate: number = 0.9
): Promise<DrillAudioResult[]> {
  console.log(`[Drill Audio] Batch generating audio for ${drillItems.length} items`);
  
  const results: DrillAudioResult[] = [];
  
  // Process items sequentially to avoid rate limiting
  for (const item of drillItems) {
    try {
      // Generate audio for the target text (the spoken content)
      const { audioBase64, durationMs } = await generateDrillAudio(
        item.targetText,
        language,
        speakingRate
      );
      
      // Create a data URL for the audio
      const audioUrl = `data:audio/mpeg;base64,${audioBase64}`;
      
      // Update the drill item in the database
      await storage.updateDrillItemAudio(item.id, audioUrl, durationMs);
      
      results.push({
        drillItemId: item.id,
        audioUrl,
        audioDurationMs: durationMs,
      });
      
    } catch (error: any) {
      console.error(`[Drill Audio] Error generating audio for item ${item.id}:`, error.message);
      results.push({
        drillItemId: item.id,
        audioUrl: null,
        audioDurationMs: null,
        error: error.message,
      });
    }
  }
  
  const successful = results.filter(r => r.audioUrl).length;
  console.log(`[Drill Audio] Batch complete: ${successful}/${drillItems.length} successful`);
  
  return results;
}

/**
 * Generate audio for all drill items in a lesson that don't have audio yet
 */
export async function generateAudioForLesson(
  lessonId: string,
  language: string,
  speakingRate: number = 0.9,
  forceRegenerate: boolean = false
): Promise<DrillAudioResult[]> {
  const drillItems = await storage.getDrillItems(lessonId);
  
  // Filter to items needing audio (unless forceRegenerate)
  const itemsNeedingAudio = forceRegenerate 
    ? drillItems 
    : drillItems.filter(item => !item.audioUrl);
  
  if (itemsNeedingAudio.length === 0) {
    console.log(`[Drill Audio] All ${drillItems.length} items already have audio`);
    return drillItems.map(item => ({
      drillItemId: item.id,
      audioUrl: item.audioUrl,
      audioDurationMs: item.audioDurationMs,
    }));
  }
  
  console.log(`[Drill Audio] Generating audio for ${itemsNeedingAudio.length}/${drillItems.length} items`);
  
  return batchGenerateDrillAudio(itemsNeedingAudio, language, speakingRate);
}

/**
 * Clear cached audio (for development/testing)
 */
export function clearAudioCache(): number {
  const count = Object.keys(audioCache).length;
  for (const key of Object.keys(audioCache)) {
    delete audioCache[key];
  }
  console.log(`[Drill Audio] Cleared ${count} cached audio entries`);
  return count;
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { totalEntries: number; totalSizeKB: number; oldestEntryAge: string } {
  const entries = Object.values(audioCache);
  const totalEntries = entries.length;
  
  let totalBytes = 0;
  let oldestTime = Date.now();
  
  for (const entry of entries) {
    totalBytes += Buffer.from(entry.audioBase64, 'base64').length;
    if (entry.generatedAt < oldestTime) {
      oldestTime = entry.generatedAt;
    }
  }
  
  const ageMs = Date.now() - oldestTime;
  const ageHours = Math.round(ageMs / (60 * 60 * 1000) * 10) / 10;
  
  return {
    totalEntries,
    totalSizeKB: Math.round(totalBytes / 1024),
    oldestEntryAge: totalEntries > 0 ? `${ageHours}h` : 'N/A',
  };
}
