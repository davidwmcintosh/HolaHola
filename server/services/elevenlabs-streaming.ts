/**
 * ElevenLabs Flash v2.5 Streaming TTS Service
 * 
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║  DANIELA'S TTS SERVICE - ElevenLabs Flash v2.5                   ║
 * ╠═══════════════════════════════════════════════════════════════════╣
 * ║  Uses accent-matched voices per language with:                   ║
 * ║  - language_code parameter for correct pronunciation             ║
 * ║  - Pronunciation dictionaries for stubborn homographs            ║
 * ║  - 44% cheaper and 3-4x faster than Cartesia Sonic-3             ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 * 
 * Architecture: Uses ElevenLabs REST streaming API for TTS
 * Output: MP3 audio chunks with estimated word timings
 */

import { EventEmitter } from 'events';
import {
  WordTiming,
} from '@shared/streaming-voice-types';
import {
  stripWhiteboardMarkup,
} from '@shared/whiteboard-types';
import { voiceDiagnostics } from './voice-diagnostics-service';

import type {
  StreamingSynthesisRequest,
  StreamingAudioChunk,
  ProgressiveStreamingCallbacks,
} from './cartesia-streaming';

/**
 * ElevenLabs voice mapping by language
 * Each voice is a native speaker selected for cultural authenticity
 */
const ELEVENLABS_VOICE_MAP: Record<string, { voiceId: string; languageCode: string; name: string }> = {
  'english': {
    voiceId: 'XrExE9yKIg1WjnnlVkGX',
    languageCode: 'en',
    name: 'Matilda',
  },
  'spanish': {
    voiceId: 'zl1Ut8dvwcVSuQSB9XkG',
    languageCode: 'es',
    name: 'Ninoska',
  },
  'french': {
    voiceId: 'ICk609TItINMseDpChFt',
    languageCode: 'fr',
    name: 'Lea',
  },
  'german': {
    voiceId: 'XFigb6fqZPxl2Q2dFOXN',
    languageCode: 'de',
    name: 'Nadine',
  },
  'italian': {
    voiceId: 'Ap2b3ZnSIW7h0QbBbxCq',
    languageCode: 'it',
    name: 'Alessandra',
  },
  'portuguese': {
    voiceId: 'pFZP5JQG7iQjIQuC4Bku',
    languageCode: 'pt',
    name: 'Lily',
  },
  'japanese': {
    voiceId: 'EkK6wL8GaH8IgBZTTDGJ',
    languageCode: 'ja',
    name: 'Akari',
  },
  'mandarin chinese': {
    voiceId: 'cgSgspJ2msm6clMCkdW9',
    languageCode: 'zh',
    name: 'Jessica',
  },
  'korean': {
    voiceId: 'mYk0rAapHek2oTw18z8x',
    languageCode: 'ko',
    name: 'Salang',
  },
  'hebrew': {
    voiceId: 'Xb7hH8MSUJpSbSDYk0k2',
    languageCode: '',
    name: 'Alice',
  },
};

/**
 * Pronunciation dictionary configuration
 * Loaded from ELEVENLABS_PRONUNCIATION_DICT_IDS env var
 * Format: JSON object mapping language name to { dictionaryId, versionId }
 */
interface PronunciationDictConfig {
  dictionaryId: string;
  versionId: string;
}

let pronunciationDicts: Record<string, PronunciationDictConfig> = {};

function loadPronunciationDicts(): void {
  const dictsJson = process.env.ELEVENLABS_PRONUNCIATION_DICT_IDS;
  if (dictsJson) {
    try {
      pronunciationDicts = JSON.parse(dictsJson);
      console.log(`[ElevenLabs Streaming] ✓ Loaded pronunciation dictionaries for ${Object.keys(pronunciationDicts).length} languages`);
    } catch (error) {
      console.warn('[ElevenLabs Streaming] Failed to parse ELEVENLABS_PRONUNCIATION_DICT_IDS:', error);
    }
  }
}

loadPronunciationDicts();

export function getElevenLabsPronunciationDict(targetLanguage: string | undefined): PronunciationDictConfig | undefined {
  if (!targetLanguage) return undefined;
  return pronunciationDicts[targetLanguage.toLowerCase()];
}

/**
 * ElevenLabs Streaming TTS Service
 * Uses REST API with chunked transfer encoding for streaming MP3
 */
export class ElevenLabsStreamingService extends EventEmitter {
  private apiKey: string | null = null;
  private model: string;
  
  constructor() {
    super();
    this.model = process.env.ELEVENLABS_TTS_MODEL || 'eleven_flash_v2_5';
    this.apiKey = process.env.ELEVENLABS_API_KEY || null;
    
    if (this.apiKey) {
      console.log(`[ElevenLabs Streaming] ✓ Initialized (model: ${this.model})`);
    } else {
      console.warn('[ElevenLabs Streaming] ⚠ No API key configured (ELEVENLABS_API_KEY)');
    }
  }
  
  isAvailable(): boolean {
    return this.apiKey !== null;
  }
  
  isConnected(): boolean {
    return this.apiKey !== null;
  }
  
  async ensureConnection(): Promise<number> {
    return 0;
  }
  
  async connect(): Promise<void> {
    // No persistent connection needed - ElevenLabs uses REST API
  }
  
  disconnect(): void {
    // No persistent connection to disconnect
  }
  
  consumeNativeTimestamps(): WordTiming[] {
    return [];
  }

  /**
   * Stream synthesis using ElevenLabs REST API
   * Yields MP3 audio chunks as they arrive from the streaming response
   */
  async *streamSynthesize(request: StreamingSynthesisRequest): AsyncGenerator<StreamingAudioChunk> {
    if (!this.apiKey) {
      throw new Error('ElevenLabs API key not configured');
    }
    
    const {
      text,
      voiceId,
      targetLanguage,
      speakingRate = 0.9,
      autoDetectLanguage,
      elStability,
      elSimilarityBoost,
      elStyle,
      elSpeakerBoost,
    } = request;
    
    const trimmedText = text?.trim() || '';
    if (trimmedText.length === 0) {
      yield { audio: Buffer.alloc(0), durationMs: 0, isLast: true };
      return;
    }
    
    // Determine voice
    const selectedLanguage = (request.language || targetLanguage || 'english').toLowerCase();
    const voiceConfig = ELEVENLABS_VOICE_MAP[selectedLanguage] || ELEVENLABS_VOICE_MAP['english'];
    const effectiveVoiceId = voiceId || voiceConfig.voiceId;
    
    if (voiceId) {
      console.log(`[ElevenLabs Streaming] Using custom voiceId: ${voiceId.substring(0, 8)}...`);
    } else {
      console.log(`[ElevenLabs Streaming] Using voice for ${selectedLanguage}: ${voiceConfig.name}`);
    }
    
    // Strip whiteboard markup
    const textWithoutMarkup = stripWhiteboardMarkup(text);
    
    // Clean text: strip SSML tags, emojis, quotes, voice control codes
    const cleanedText = textWithoutMarkup
      .replace(/<speed[^>]*>(.*?)<\/speed>/gi, '$1')
      .replace(/<volume[^>]*>(.*?)<\/volume>/gi, '$1')
      .replace(/<spell>(.*?)<\/spell>/gi, '$1')
      .replace(/<pause[^>]*\/?>/gi, ' ')
      .replace(/<[a-z]+[^>]*\/?>/gi, '')
      .replace(/\[VOICE_ADJUST[^\]]*\]/gi, '')
      .replace(/voice_adjust\s*\{[^}]*\}/gi, '')
      .replace(/voice_adjust\s*:\s*\{[^}]*\}/gi, '')
      .replace(/\[VOICE_RESET[^\]]*\]/gi, '')
      .replace(/voice_reset\s*[:\{][^}]*\}?/gi, '')
      .replace(/\[SUBTITLE\s+(?:off|on|target)\s*\]/gi, '')
      .replace(/subtitle\s*:\s*\{[^}]*\}/gi, '')
      .replace(/<ctrl\d+>/gi, '')
      .replace(/\[?MEMORY_LOOKUP[^\]]*\]?/gi, '');
    
    const emojiPattern = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;
    const finalText = cleanedText
      .replace(/^["'"]+|["'"]+$/g, '')
      .replace(/\s["'"]+/g, ' ')
      .replace(/["'"]+\s/g, ' ')
      .replace(/["'"]{2,}/g, '')
      .replace(/(?<![a-zA-Z])["'"](?![a-zA-Z])/g, '')
      .replace(emojiPattern, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    if (!finalText || finalText.length === 0) {
      yield { audio: Buffer.alloc(0), durationMs: 0, isLast: true };
      return;
    }
    
    console.log(`[ElevenLabs Streaming] Synthesizing: "${finalText.substring(0, 50)}..." (${finalText.length} chars)`);
    
    // Determine language code for the request
    // When autoDetectLanguage is true, we still pass the target language code
    // because ElevenLabs language_code helps pronunciation without breaking English
    const effectiveLanguageCode = autoDetectLanguage 
      ? (targetLanguage ? (ELEVENLABS_VOICE_MAP[targetLanguage.toLowerCase()]?.languageCode || undefined) : undefined)
      : (voiceConfig.languageCode || undefined);
    
    console.log(`[ElevenLabs Streaming] language_code: ${effectiveLanguageCode || 'none'}, target: ${targetLanguage}`);
    
    // Get pronunciation dictionary for this language
    const pronDict = getElevenLabsPronunciationDict(targetLanguage);
    if (pronDict) {
      console.log(`[ElevenLabs Streaming] Using pronunciation dictionary for ${targetLanguage}`);
    }
    
    const stability = elStability ?? 0.5;
    const similarityBoost = elSimilarityBoost ?? 0.75;
    const styleValue = elStyle ?? 0;
    const speakerBoost = elSpeakerBoost ?? true;
    
    const startTime = Date.now();
    let firstChunkTime: number | null = null;
    let totalBytes = 0;
    let chunkCount = 0;
    
    try {
      const requestBody: any = {
        text: finalText,
        model_id: this.model,
        voice_settings: {
          stability,
          similarity_boost: similarityBoost,
          style: styleValue,
          use_speaker_boost: speakerBoost,
        },
      };

      if (speakingRate && speakingRate !== 1.0) {
        requestBody.speed = speakingRate;
      }
      
      if (effectiveLanguageCode) {
        requestBody.language_code = effectiveLanguageCode;
      }
      
      if (pronDict) {
        requestBody.pronunciation_dictionary_locators = [{
          pronunciation_dictionary_id: pronDict.dictionaryId,
          version_id: pronDict.versionId,
        }];
      }
      
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${effectiveVoiceId}/stream`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': this.apiKey!,
            'Content-Type': 'application/json',
            'Accept': 'audio/mpeg',
          },
          body: JSON.stringify(requestBody),
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`ElevenLabs API error ${response.status}: ${errorText}`);
      }
      
      if (!response.body) {
        throw new Error('ElevenLabs response has no body');
      }
      
      const reader = response.body.getReader();
      const CHUNK_SIZE = 4096;
      let buffer = Buffer.alloc(0);
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        if (value && value.length > 0) {
          buffer = Buffer.concat([buffer, Buffer.from(value)]);
          
          while (buffer.length >= CHUNK_SIZE) {
            const audioChunk = buffer.subarray(0, CHUNK_SIZE);
            buffer = buffer.subarray(CHUNK_SIZE);
            
            if (!firstChunkTime) {
              firstChunkTime = Date.now();
              console.log(`[ElevenLabs Streaming] TTFB: ${firstChunkTime - startTime}ms`);
            }
            
            totalBytes += audioChunk.length;
            chunkCount++;
            
            const durationMs = this.estimateMp3Duration(audioChunk.length);
            
            yield {
              audio: Buffer.from(audioChunk),
              durationMs,
              isLast: false,
              audioFormat: 'mp3' as const,
              sampleRate: 44100,
            };
          }
        }
      }
      
      // Yield remaining buffer
      if (buffer.length > 0) {
        if (!firstChunkTime) {
          firstChunkTime = Date.now();
          console.log(`[ElevenLabs Streaming] TTFB: ${firstChunkTime - startTime}ms`);
        }
        totalBytes += buffer.length;
        chunkCount++;
        
        yield {
          audio: Buffer.from(buffer),
          durationMs: this.estimateMp3Duration(buffer.length),
          isLast: false,
          audioFormat: 'mp3' as const,
          sampleRate: 44100,
        };
      }
      
      // Signal completion
      yield {
        audio: Buffer.alloc(0),
        durationMs: 0,
        isLast: true,
        audioFormat: 'mp3' as const,
        sampleRate: 44100,
      };
      
      const elapsed = Date.now() - startTime;
      console.log(`[ElevenLabs Streaming] ✓ Complete: ${chunkCount} chunks, ${totalBytes} bytes in ${elapsed}ms`);
      voiceDiagnostics.recordTTSResult(true, elapsed, 'daniela');
      
    } catch (error: any) {
      console.error('[ElevenLabs Streaming] Error:', error.message);
      voiceDiagnostics.recordTTSResult(false, undefined, 'daniela');
      throw error;
    }
  }
  
  /**
   * Progressive streaming with callbacks - matches Cartesia interface
   */
  async streamSynthesizeProgressive(
    request: StreamingSynthesisRequest,
    callbacks: ProgressiveStreamingCallbacks
  ): Promise<{ totalDurationMs: number; finalTimestamps: WordTiming[] }> {
    let chunkIndex = 0;
    let totalDurationMs = 0;
    
    console.log(`[ElevenLabs Progressive] Starting for: "${request.text.substring(0, 50)}..."`);
    
    for await (const chunk of this.streamSynthesize(request)) {
      if (chunk.audio.length > 0) {
        totalDurationMs += chunk.durationMs;
        callbacks.onAudioChunk?.(chunk, chunkIndex);
        chunkIndex++;
      }
      
      if (chunk.isLast) break;
    }
    
    // ElevenLabs doesn't provide native word timestamps
    // Generate estimated timings based on total audio duration
    const displayText = request.text || '';
    const finalTimestamps = this.estimateWordTimings(displayText, totalDurationMs / 1000);
    
    // Send all estimated timings at once
    for (let i = 0; i < finalTimestamps.length; i++) {
      const estimatedTotal = totalDurationMs;
      callbacks.onWordTimestamp?.(finalTimestamps[i], i, estimatedTotal);
    }
    
    callbacks.onComplete?.(finalTimestamps, totalDurationMs);
    
    return { totalDurationMs, finalTimestamps };
  }
  
  /**
   * Synthesize complete audio buffer (non-streaming, for audition)
   */
  async synthesizeToBuffer(
    text: string,
    voiceId: string,
    options: {
      languageCode?: string;
      speakingRate?: number;
      pronunciationDictId?: string;
      pronunciationDictVersionId?: string;
      elStability?: number;
      elSimilarityBoost?: number;
      elStyle?: number;
      elSpeakerBoost?: boolean;
    } = {}
  ): Promise<Buffer> {
    if (!this.apiKey) {
      throw new Error('ElevenLabs API key not configured');
    }
    
    const requestBody: any = {
      text,
      model_id: this.model,
      voice_settings: {
        stability: options.elStability ?? 0.5,
        similarity_boost: options.elSimilarityBoost ?? 0.75,
        style: options.elStyle ?? 0,
        use_speaker_boost: options.elSpeakerBoost ?? true,
      },
    };

    if (options.speakingRate && options.speakingRate !== 1.0) {
      requestBody.speed = options.speakingRate;
    }
    
    if (options.languageCode) {
      requestBody.language_code = options.languageCode;
    }
    
    if (options.pronunciationDictId && options.pronunciationDictVersionId) {
      requestBody.pronunciation_dictionary_locators = [{
        pronunciation_dictionary_id: options.pronunciationDictId,
        version_id: options.pronunciationDictVersionId,
      }];
    }
    
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': this.apiKey,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg',
        },
        body: JSON.stringify(requestBody),
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`ElevenLabs API error ${response.status}: ${errorText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
  
  /**
   * Estimate MP3 audio duration from buffer size
   * MP3 at ~128kbps ≈ 16KB per second
   */
  private estimateMp3Duration(bufferSize: number): number {
    const bytesPerSecond = (128 * 1000) / 8; // 128kbps
    return (bufferSize / bytesPerSecond) * 1000;
  }
  
  /**
   * Estimate word timings from text and duration
   */
  private estimateWordTimings(text: string, durationSeconds: number): WordTiming[] {
    const cleanedText = text
      .replace(/\[laughter\]/gi, ' ')
      .replace(/<[^>]+>/g, '')
      .replace(/\[[^\]]+\]/g, '');
    
    const words = cleanedText.split(/\s+/).filter(w => w.length > 0);
    if (words.length === 0) return [];
    
    const wordWeights = words.map(word => {
      let weight = Math.max(1, word.length);
      if (/[.!?]$/.test(word)) weight += 2;
      else if (/[,;:]$/.test(word)) weight += 1;
      return weight;
    });
    
    const totalWeight = wordWeights.reduce((sum, w) => sum + w, 0);
    const timings: WordTiming[] = [];
    let currentTime = 0.1;
    const speakingDuration = Math.max(0.1, durationSeconds - 0.2);
    
    for (let i = 0; i < words.length; i++) {
      const wordDuration = (wordWeights[i] / totalWeight) * speakingDuration;
      const actualDuration = Math.max(0.1, wordDuration);
      
      timings.push({
        word: words[i],
        startTime: currentTime,
        endTime: currentTime + actualDuration,
      });
      
      currentTime += actualDuration;
    }
    
    return timings;
  }
}

// Singleton instance
let streamingService: ElevenLabsStreamingService | null = null;

export function getElevenLabsStreamingService(): ElevenLabsStreamingService {
  if (!streamingService) {
    streamingService = new ElevenLabsStreamingService();
  }
  return streamingService;
}

export { ELEVENLABS_VOICE_MAP };
