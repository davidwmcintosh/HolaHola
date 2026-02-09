/**
 * Cartesia WebSocket Streaming Service
 * 
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║  DANIELA'S DEDICATED TTS SERVICE - NO GOOGLE FALLBACK            ║
 * ╠═══════════════════════════════════════════════════════════════════╣
 * ║  This service is used EXCLUSIVELY for Daniela's voice.           ║
 * ║  Her voice identity is tied to Cartesia's Sonic-3 model.         ║
 * ║  There is NO fallback to Google TTS - by design.                 ║
 * ║                                                                   ║
 * ║  If Cartesia is degraded, Daniela's voice may have issues,       ║
 * ║  but she will NOT switch to a different voice provider.          ║
 * ║  Voice diagnostics will detect and alert on degradation.         ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 * 
 * Architecture: Connects to Cartesia's WebSocket API for real-time TTS streaming
 * with word-level timestamps for synchronized subtitles.
 * 
 * Benefits over bytes API:
 * - Sub-100ms time to first audio byte
 * - Word-level timestamps from Cartesia (no estimation needed)
 * - Continuous streaming without waiting for complete synthesis
 */

import { CartesiaClient } from '@cartesia/cartesia-js';
import { EventEmitter } from 'events';
import {
  AUDIO_STREAMING_CONFIG,
  WordTiming,
} from '@shared/streaming-voice-types';
import {
  stripWhiteboardMarkup,
} from '@shared/whiteboard-types';
import {
  CartesiaEmotion,
  TutorPersonality,
  constrainEmotion,
  PERSONALITY_PRESETS,
  addCartesiaPhonemesToText,
  getEmotionWithIntensity,
} from './tts-service';
import { processPronunciationTags } from './daniela-pronunciation-tags';
import { voiceDiagnostics } from './voice-diagnostics-service';

/**
 * Pronunciation dictionary IDs from Cartesia
 * These are loaded from CARTESIA_PRONUNCIATION_DICT_IDS environment variable
 */
let pronunciationDictIds: Record<string, string> = {};

function loadPronunciationDictIds(): void {
  const dictIdsJson = process.env.CARTESIA_PRONUNCIATION_DICT_IDS;
  if (dictIdsJson) {
    try {
      pronunciationDictIds = JSON.parse(dictIdsJson);
      console.log(`[Cartesia Streaming] ✓ Loaded pronunciation dictionaries for ${Object.keys(pronunciationDictIds).length} languages`);
    } catch (error) {
      console.warn('[Cartesia Streaming] Failed to parse CARTESIA_PRONUNCIATION_DICT_IDS:', error);
    }
  }
}

// Load dictionary IDs on module init
loadPronunciationDictIds();

/**
 * Get pronunciation dictionary ID for a language
 * Returns undefined if no dictionary is available for this language
 */
export function getPronunciationDictId(targetLanguage: string | undefined): string | undefined {
  if (!targetLanguage) return undefined;
  const key = targetLanguage.toLowerCase();
  return pronunciationDictIds[key];
}

/**
 * Cartesia voice mapping by language
 */
const CARTESIA_VOICE_MAP: Record<string, { voiceId: string; languageCode: string; name: string }> = {
  'english': { 
    voiceId: '573e3144-a684-4e72-ac2b-9b2063a50b53',
    languageCode: 'en',
    name: 'Teacher Lady'
  },
  'spanish': { 
    voiceId: '5c5ad5e7-1020-476b-8b91-fdcbe9cc313c',
    languageCode: 'es',
    name: 'Mexican Woman'
  },
  'french': { 
    voiceId: 'a249eaff-1e96-4d2c-b23b-12efa4f66f41',
    languageCode: 'fr',
    name: 'French Conversational Lady'
  },
  'german': { 
    voiceId: '3f4ade23-6eb4-4279-ab05-6a144947c4d5',
    languageCode: 'de',
    name: 'German Conversational Woman'
  },
  'italian': { 
    voiceId: '0e21713a-5e9a-428a-bed4-90d410b87f13',
    languageCode: 'it',
    name: 'Italian Narrator Woman'
  },
  'portuguese': { 
    voiceId: '700d1ee3-a641-4018-ba6e-899dcadc9e2b',
    languageCode: 'pt',
    name: 'Pleasant Brazilian Lady'
  },
  'japanese': { 
    voiceId: '2b568345-1d48-4047-b25f-7baccf842eb0',
    languageCode: 'ja',
    name: 'Japanese Woman Conversational'
  },
  'mandarin chinese': { 
    voiceId: 'e90c6678-f0d3-4767-9883-5d0ecf5894a8',
    languageCode: 'zh',
    name: 'Chinese Female Conversational'
  },
  'korean': { 
    voiceId: '29e5f8b4-b953-4160-848f-40fae182235b',
    languageCode: 'ko',
    name: 'Korean Calm Woman'
  },
  // Hebrew (hidden language) - voices from tutor_voices table
  'hebrew': { 
    voiceId: '1daba551-67af-465e-a189-f91495aa2347',  // Yael - default female
    languageCode: 'he',
    name: 'Yael'
  },
};

/**
 * Streaming synthesis request
 */
export interface StreamingSynthesisRequest {
  text: string;
  language?: string;
  voiceId?: string;
  targetLanguage?: string;
  speakingRate?: number;
  emotion?: CartesiaEmotion;
  personality?: TutorPersonality;
  expressiveness?: number;
  contextId?: string;  // Optional: shared context ID for prosody continuity across segments
}

/**
 * Audio format types for streaming synthesis
 */
export type StreamingAudioFormat = 'mp3' | 'pcm_f32le';

/**
 * Audio chunk from streaming synthesis
 */
export interface StreamingAudioChunk {
  audio: Buffer;        // Raw audio data
  durationMs: number;   // Duration of this chunk
  isLast: boolean;      // Is this the final chunk?
  audioFormat?: StreamingAudioFormat;  // Format of audio data (default: 'mp3')
  sampleRate?: number;  // Sample rate for PCM audio (default: 24000)
}

/**
 * Events emitted by the streaming synthesizer
 */
export interface CartesiaStreamingEvents {
  'audio': (chunk: StreamingAudioChunk) => void;
  'timestamps': (timings: WordTiming[]) => void;
  'done': () => void;
  'error': (error: Error) => void;
}

/**
 * PROGRESSIVE STREAMING: Real-time callback for audio and timestamp events
 * Used by orchestrator to forward chunks immediately instead of buffering
 */
export interface ProgressiveStreamingCallbacks {
  onAudioChunk?: (chunk: StreamingAudioChunk, chunkIndex: number) => void;
  onWordTimestamp?: (timing: WordTiming, wordIndex: number, estimatedTotalDuration: number) => void;
  onComplete?: (finalTimestamps: WordTiming[], actualDurationMs: number) => void;
}

/**
 * Cartesia WebSocket Streaming Service
 * Manages persistent WebSocket connections for ultra-low latency TTS
 */
export class CartesiaStreamingService extends EventEmitter {
  private client: CartesiaClient | null = null;
  private websocket: any = null;
  private model: string;
  private connected: boolean = false;
  
  // Store timestamps from the most recent streamSynthesize call
  // Allows orchestrator to retrieve native timestamps after streaming completes
  private lastNativeTimestamps: WordTiming[] = [];
  
  constructor() {
    super();
    this.model = process.env.TTS_CARTESIA_MODEL || 'sonic-3';
    
    if (process.env.CARTESIA_API_KEY) {
      this.client = new CartesiaClient({
        apiKey: process.env.CARTESIA_API_KEY,
      });
      console.log(`[Cartesia Streaming] ✓ Initialized (model: ${this.model})`);
    } else {
      console.warn('[Cartesia Streaming] ⚠ No API key configured');
    }
  }
  
  /**
   * Check if streaming is available
   */
  isAvailable(): boolean {
    return this.client !== null;
  }
  
  /**
   * Get and clear native timestamps from the most recent streamSynthesize call
   * Returns empty array if no native timestamps were received (bytes API fallback)
   * Atomically clears timestamps after retrieval to prevent reuse
   */
  consumeNativeTimestamps(): WordTiming[] {
    // Clone array to prevent caller mutation, then clear
    const timestamps = [...this.lastNativeTimestamps];
    this.lastNativeTimestamps = [];
    return timestamps;
  }
  
  /**
   * Check if WebSocket is connected and healthy
   */
  isConnected(): boolean {
    return this.connected && this.websocket !== null;
  }
  
  /**
   * Ensure WebSocket connection is active (for connection pooling)
   * Returns time taken to establish/verify connection
   */
  async ensureConnection(): Promise<number> {
    const startTime = Date.now();
    
    if (this.isConnected()) {
      // Already connected - verify health with a quick check
      console.log('[Cartesia Streaming] Connection verified (already active)');
      return Date.now() - startTime;
    }
    
    // Not connected - establish new connection
    await this.connect();
    const elapsed = Date.now() - startTime;
    console.log(`[Cartesia Streaming] Connection established in ${elapsed}ms`);
    return elapsed;
  }
  
  /**
   * Connect to Cartesia WebSocket
   * Call this once at session start for persistent connection
   */
  async connect(): Promise<void> {
    if (!this.client) {
      throw new Error('Cartesia client not initialized');
    }
    
    if (this.connected) {
      console.log('[Cartesia Streaming] Already connected');
      return;
    }
    
    try {
      console.log('[Cartesia Streaming] Connecting to WebSocket...');
      const connectStart = Date.now();
      
      // Get WebSocket client from Cartesia SDK
      // Use raw PCM format with native timestamps
      // Note: Client needs Web Audio API to play raw PCM (future enhancement)
      // Currently falls back to bytes API for MP3 output
      this.websocket = this.client.tts.websocket({
        sampleRate: 24000,
        container: 'raw',
        encoding: 'pcm_f32le',
      });
      
      // Connect to WebSocket
      await this.websocket.connect();
      this.connected = true;
      
      const elapsed = Date.now() - connectStart;
      console.log(`[Cartesia Streaming] ✓ WebSocket connected (${elapsed}ms handshake)`);
    } catch (error: any) {
      console.error('[Cartesia Streaming] Connection failed:', error.message);
      this.connected = false;
      throw error;
    }
  }
  
  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    if (this.websocket) {
      try {
        this.websocket.disconnect();
      } catch (e) {
        // Ignore disconnect errors
      }
      this.websocket = null;
    }
    this.connected = false;
    console.log('[Cartesia Streaming] Disconnected');
  }
  
  /**
   * Stream synthesis of text using WebSocket API with native word timestamps
   * Returns an async generator that yields audio chunks
   * Emits 'timestamps' event with word-level timing from Cartesia
   */
  async *streamSynthesize(request: StreamingSynthesisRequest): AsyncGenerator<StreamingAudioChunk> {
    if (!this.client) {
      throw new Error('Cartesia client not initialized');
    }
    
    const {
      text,
      language,
      voiceId,
      targetLanguage,
      speakingRate = 0.9,
      emotion,
      personality = 'warm',
      expressiveness = 3,
      contextId: providedContextId,
    } = request;
    
    // Skip empty text - Cartesia returns 400 for empty strings
    const trimmedText = text?.trim() || '';
    if (trimmedText.length === 0) {
      console.log('[Cartesia Streaming] Skipping empty text');
      yield {
        audio: Buffer.alloc(0),
        durationMs: 0,
        isLast: true,
      };
      return;
    }
    
    // Determine voice and language code
    const selectedLanguage = language?.toLowerCase() || 'english';
    const voiceConfig = CARTESIA_VOICE_MAP[selectedLanguage] || CARTESIA_VOICE_MAP['english'];
    const effectiveVoiceId = voiceId || voiceConfig.voiceId;
    
    // Debug logging to trace voice selection
    if (voiceId) {
      console.log(`[Cartesia Streaming] Using custom voiceId: ${voiceId.substring(0, 8)}... (passed from session)`);
    } else {
      console.log(`[Cartesia Streaming] Using default voice for ${selectedLanguage}: ${voiceConfig.name} (${voiceConfig.voiceId.substring(0, 8)}...)`);
    }
    
    // For language code, use the explicitly passed `language` parameter (from detectTextLanguageForTTS)
    // This is critical for Japanese/Korean/Chinese voices speaking English text - they need 'en' not 'ja'
    // The `targetLanguage` is kept for pronunciation dictionary lookup but NOT for the TTS language code
    const langForTTS = language?.toLowerCase() || 'english';
    const langConfig = CARTESIA_VOICE_MAP[langForTTS];
    const effectiveLanguageCode = langConfig?.languageCode || voiceConfig.languageCode;
    
    // Log when language detection changed the TTS language code
    if (langForTTS !== targetLanguage?.toLowerCase()) {
      console.log(`[Cartesia Streaming] Language override: TTS using '${effectiveLanguageCode}' (detected: ${langForTTS}) instead of target '${targetLanguage}'`);
    }
    
    // Constrain emotion to personality bounds
    const constrainedEmotion = constrainEmotion(emotion, personality, expressiveness);
    
    // Map speaking rate to Cartesia's 0.6-1.5 range
    // Input rates: 0.6 (slower), 0.75 (slow), 0.9 (normal), 1.1 (fast), 1.3 (faster)
    let cartesiaSpeed = Math.max(0.6, Math.min(1.5, speakingRate));
    
    // Check if we have a pronunciation dictionary for this language
    const pronunciationDictId = getPronunciationDictId(targetLanguage);
    
    // STEP 1: Strip whiteboard markup before any other processing
    // The tutor may include [WRITE]...[/WRITE] tags for visual display
    // These should NOT be sent to TTS - audio should sound natural
    const textWithoutMarkup = stripWhiteboardMarkup(text);
    
    // DEBUG: Log stripping effectiveness for command tags
    if (text.includes('[SWITCH_TUTOR') || text.includes('[CALL_SUPPORT') || text.includes('[PHASE_SHIFT')) {
      console.log(`[Cartesia Strip DEBUG] Input: "${text.substring(0, 80)}..."`);
      console.log(`[Cartesia Strip DEBUG] After strip: "${textWithoutMarkup.substring(0, 80)}..."`);
    }
    
    // STEP 2: Process Daniela's pronunciation tags [es:word] → <<phonemes>>
    // This gives Daniela direct control over pronunciation without complex detection
    const tagResult = processPronunciationTags(textWithoutMarkup);
    const textWithTags = tagResult.processedText;
    if (tagResult.tagsFound > 0) {
      console.log(`[Cartesia Streaming] Processed ${tagResult.tagsFound} pronunciation tag(s)`);
    }
    
    let processedText: string;
    if (pronunciationDictId) {
      // Use server-side dictionary - no need for inline phoneme markers
      // This produces cleaner transcripts for better word timing
      processedText = textWithTags;
      console.log(`[Cartesia Streaming] Using pronunciation dictionary: ${pronunciationDictId} for ${targetLanguage}`);
    } else {
      // Fallback to inline phoneme processing if no dictionary available
      processedText = addCartesiaPhonemesToText(textWithTags, targetLanguage);
    }
    
    // Clean standalone quotes but PRESERVE apostrophes in contractions (I'm, don't, etc.)
    // Remove: "text", 'text', standalone quotes at word boundaries
    // Keep: I'm, don't, it's, you're (apostrophes between letters)
    // Also strip emojis which cause Cartesia 500 errors
    const cleanedText = processedText
      .replace(/^["'"]+|["'"]+$/g, '')  // Remove leading/trailing quotes
      .replace(/\s["'"]+/g, ' ')         // Quote after space → just space
      .replace(/["'"]+\s/g, ' ')         // Quote before space → just space
      .replace(/["'"]{2,}/g, '')         // Multiple consecutive quotes → remove
      .replace(/(?<![a-zA-Z])["'"](?![a-zA-Z])/g, ''); // Standalone quotes not between letters
    
    // Strip emojis which cause Cartesia 500 errors, then clean up whitespace
    const emojiPattern = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;
    
    // Strip SSML-like tags that Gemini generates - Cartesia doesn't support SSML!
    // It treats <speed>, <volume>, <pause>, <spell> as literal text to speak
    const ssmlStripped = cleanedText
      .replace(/<speed[^>]*>(.*?)<\/speed>/gi, '$1')  // <speed ratio="0.7">word</speed> → word
      .replace(/<volume[^>]*>(.*?)<\/volume>/gi, '$1') // <volume level="2">word</volume> → word
      .replace(/<spell>(.*?)<\/spell>/gi, '$1')       // <spell>word</spell> → word
      .replace(/<pause[^>]*\/?>/gi, ' ')              // <pause duration="0.5"/> → space
      .replace(/<[a-z]+[^>]*\/?>/gi, '')              // Catch any other XML-like tags
      // Strip voice control codes that AI sometimes generates in malformed formats (defense-in-depth)
      // These should be stripped by streaming-voice-orchestrator but add fallback here
      .replace(/\[VOICE_ADJUST[^\]]*\]/gi, '')        // [VOICE_ADJUST ...]
      .replace(/voice_adjust\s*\{[^}]*\}/gi, '')      // voice_adjust{...}
      .replace(/voice_adjust\s*:\s*\{[^}]*\}/gi, '')  // voice_adjust: {...}
      .replace(/\[VOICE_RESET[^\]]*\]/gi, '')         // [VOICE_RESET ...]
      .replace(/voice_reset\s*[:\{][^}]*\}?/gi, '')   // voice_reset: {...}
      .replace(/\[SUBTITLE\s+(?:off|on|target)\s*\]/gi, '')  // [SUBTITLE off|on|target]
      .replace(/subtitle\s*:\s*\{[^}]*\}/gi, '')      // subtitle: {...}
      .replace(/<ctrl\d+>/gi, '')                     // <ctrl46> tokenization artifacts
      .replace(/\[?MEMORY_LOOKUP[^\]]*\]?/gi, '');    // MEMORY_LOOKUP query="..." domains="..."
    
    const finalText = ssmlStripped
      .replace(emojiPattern, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Handle empty text (e.g., just emojis) - yield empty audio and return
    if (!finalText || finalText.length === 0) {
      console.log('[Cartesia Streaming] Skipping empty text (after emoji/cleanup stripping)');
      yield {
        audio: Buffer.alloc(0),
        durationMs: 0,
        isLast: true,
      };
      return;
    }
    
    console.log(`[Cartesia Streaming] Synthesizing: "${finalText.substring(0, 50)}..." (${finalText.length} chars)`);
    console.log(`[TTS-LANG-DIAG] Cartesia API call: language='${selectedLanguage}', effectiveLanguageCode='${effectiveLanguageCode}', langForTTS='${langForTTS}', targetLanguage='${targetLanguage}'`);
    const voiceName = voiceId ? `custom (${voiceId.substring(0, 8)}...)` : voiceConfig.name;
    
    // Apply emotion intensity based on expressiveness level
    const emotionWithIntensity = constrainedEmotion 
      ? getEmotionWithIntensity(constrainedEmotion, expressiveness) 
      : undefined;
    console.log(`[Cartesia Streaming] Voice: ${voiceName}, Emotion: ${emotionWithIntensity || constrainedEmotion}, Speed: ${cartesiaSpeed}`);
    
    const startTime = Date.now();
    let firstChunkTime: number | null = null;
    let totalBytes = 0;
    let chunkCount = 0;
    
    // Try WebSocket API first for native timestamps (raw PCM), fall back to bytes API (MP3)
    // Client now supports both formats via Web Audio API (PCM) and HTMLAudioElement (MP3)
    const useWebSocket = this.isConnected();
    
    // Clear any previous timestamps before starting new synthesis
    this.lastNativeTimestamps = [];
    
    try {
      if (useWebSocket) {
        // Use WebSocket API with native word timestamps
        console.log('[Cartesia Streaming] Using WebSocket API with native timestamps');
        
        // Use provided contextId for prosody continuity, or generate a new one
        const contextId = providedContextId || `ctx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const response = await this.websocket.send({
          modelId: this.model,
          transcript: finalText,
          voice: {
            mode: 'id',
            id: effectiveVoiceId,
            __experimental_controls: {
              speed: cartesiaSpeed, // Numeric speed in 0.6-1.5 range
              emotion: emotionWithIntensity ? [emotionWithIntensity] : undefined,
            },
          },
          language: effectiveLanguageCode,
          contextId: contextId,
          ...(pronunciationDictId && { pronunciationDictId: pronunciationDictId }),
          addTimestamps: true, // Enable native word-level timestamps
        });
        
        // Collect timestamps as they arrive
        const collectedTimestamps: WordTiming[] = [];
        
        // Process all events from the response using events() iterator
        for await (const rawMessage of response.events('message')) {
          // Parse the raw message if it's a string/buffer
          let message: any;
          if (typeof rawMessage === 'string') {
            try {
              message = JSON.parse(rawMessage);
            } catch {
              continue;
            }
          } else if (Buffer.isBuffer(rawMessage) || rawMessage instanceof Uint8Array) {
            try {
              message = JSON.parse(rawMessage.toString());
            } catch {
              continue;
            }
          } else {
            message = rawMessage;
          }
          
          // Handle errors
          if (message.type === 'error') {
            console.error('[Cartesia Streaming] WebSocket error:', message.error, 'status:', message.status_code);
            throw new Error(`Cartesia WebSocket error: ${message.error}`);
          }
          
          // CRITICAL: Handle word timestamps BEFORE yielding audio chunks
          // This ensures streamSynthesizeProgressive sees timestamps when it checks
          // after receiving each audio chunk (yield pauses the generator)
          if (message.word_timestamps) {
            const { words, start, end } = message.word_timestamps;
            if (words && start && end) {
              // Convert parallel arrays to WordTiming objects
              for (let i = 0; i < words.length; i++) {
                collectedTimestamps.push({
                  word: words[i],
                  startTime: start[i], // Already in seconds
                  endTime: end[i],
                });
              }
              // PROGRESSIVE STREAMING FIX: Update lastNativeTimestamps immediately
              // so streamSynthesizeProgressive can access them on each audio chunk
              this.lastNativeTimestamps = [...collectedTimestamps];
              console.log(`[Cartesia Streaming] Received ${words.length} native word timestamps`);
            }
          }
          
          // Handle audio chunks (type: 'chunk') AFTER timestamps are stored
          if (message.type === 'chunk' && message.data) {
            if (!firstChunkTime) {
              firstChunkTime = Date.now();
              console.log(`[Cartesia Streaming] TTFB (WebSocket): ${firstChunkTime - startTime}ms`);
            }
            
            // message.data is base64-encoded audio (raw PCM f32le)
            const buffer = Buffer.from(message.data, 'base64');
            totalBytes += buffer.length;
            chunkCount++;
            
            yield {
              audio: buffer,
              durationMs: this.estimatePcmDuration(buffer.length),
              isLast: false,
              audioFormat: 'pcm_f32le' as const,
              sampleRate: 24000,
            };
          }
          
          // Also handle 'audio' field (older SDK versions)
          if (message.audio) {
            if (!firstChunkTime) {
              firstChunkTime = Date.now();
              console.log(`[Cartesia Streaming] TTFB (WebSocket): ${firstChunkTime - startTime}ms`);
            }
            
            const buffer = Buffer.from(message.audio, 'base64');
            totalBytes += buffer.length;
            chunkCount++;
            
            yield {
              audio: buffer,
              durationMs: this.estimatePcmDuration(buffer.length),
              isLast: false,
              audioFormat: 'pcm_f32le' as const,
              sampleRate: 24000,
            };
          }
        }
        
        // Store collected timestamps for orchestrator retrieval
        // Also emit for backward compatibility with synthesizeSentence
        if (collectedTimestamps.length > 0) {
          console.log(`[Cartesia Streaming] ✓ Storing ${collectedTimestamps.length} native timestamps`);
          this.lastNativeTimestamps = collectedTimestamps;
          this.emit('timestamps', collectedTimestamps);
        }
        
        // CRITICAL: Detect 0-byte WebSocket response (race condition with first request)
        // This happens when Cartesia's socket accepts send() before fully primed
        // Solution: Reset connection and fall back to bytes API
        if (chunkCount === 0) {
          console.warn(`[Cartesia Streaming] ⚠ WebSocket returned 0 bytes for: "${finalText.substring(0, 30)}..."`);
          console.log('[Cartesia Streaming] Resetting connection and falling back to bytes API');
          
          // Force disconnect so next synthesis uses bytes fallback
          this.connected = false;
          this.websocket = null;
          
          // Recursive call will use bytes API since WebSocket is now disconnected
          yield* this.streamSynthesize(request);
          return;
        }
        
        // Signal completion
        yield {
          audio: Buffer.alloc(0),
          durationMs: 0,
          isLast: true,
        };
        
      } else {
        // Fallback to bytes API (no native timestamps)
        // CRITICAL: The bytes API returns pcm_s16le regardless of what we request.
        // We request s16le explicitly and convert to f32le on the server so the
        // client receives identical data from both WebSocket and bytes paths.
        console.log('[Cartesia Streaming] Using bytes API (WebSocket not connected)');
        
        const requestOptions: any = {
          modelId: this.model,
          transcript: finalText,
          voice: {
            mode: 'id',
            id: effectiveVoiceId,
          },
          language: effectiveLanguageCode,
          outputFormat: {
            container: 'raw',
            sampleRate: AUDIO_STREAMING_CONFIG.SAMPLE_RATE,
            encoding: 'pcm_s16le',
          },
          generation_config: {
            speed: cartesiaSpeed,
            emotion: emotionWithIntensity || constrainedEmotion,
          },
        };
        
        if (pronunciationDictId) {
          requestOptions.pronunciationDictId = pronunciationDictId;
        }
        
        const stream = await this.client.tts.bytes(requestOptions);
        
        for await (const chunk of stream) {
          if (!firstChunkTime) {
            firstChunkTime = Date.now();
            console.log(`[Cartesia Streaming] TTFB (bytes): ${firstChunkTime - startTime}ms`);
          }
          
          const s16Buffer = Buffer.from(chunk);
          const f32Buffer = this.convertS16leToF32le(s16Buffer);
          totalBytes += f32Buffer.length;
          chunkCount++;
          
          yield {
            audio: f32Buffer,
            durationMs: this.estimateS16leDuration(s16Buffer.length),
            isLast: false,
            audioFormat: 'pcm_f32le' as const,
            sampleRate: 24000,
          };
        }
        
        // Signal completion
        yield {
          audio: Buffer.alloc(0),
          durationMs: 0,
          isLast: true,
        };
      }
      
      const elapsed = Date.now() - startTime;
      const apiType = useWebSocket ? 'WebSocket' : 'bytes';
      console.log(`[Cartesia Streaming] ✓ Complete (${apiType}): ${chunkCount} chunks, ${totalBytes} bytes in ${elapsed}ms`);
      
      // Record TTS success for auto-remediation state machine
      // Persona: 'daniela' since Cartesia streaming is used exclusively for Daniela
      voiceDiagnostics.recordTTSResult(true, elapsed, 'daniela');
      
    } catch (error: any) {
      console.error('[Cartesia Streaming] Error:', error.message);
      
      // Record TTS failure for auto-remediation state machine
      voiceDiagnostics.recordTTSResult(false, undefined, 'daniela');
      
      // If WebSocket failed, try falling back to bytes API
      if (useWebSocket && this.client) {
        console.log('[Cartesia Streaming] WebSocket failed, falling back to bytes API');
        // Fully reset connection state to ensure fallback works
        this.connected = false;
        this.websocket = null; // Clear WebSocket reference so isConnected() returns false
        
        // Recursive call will use bytes API since WebSocket is now marked disconnected
        yield* this.streamSynthesize(request);
        return;
      }
      
      throw error;
    }
  }
  
  /**
   * PROGRESSIVE STREAMING: Stream synthesis with real-time callbacks
   * 
   * Unlike streamSynthesize (which yields chunks for orchestrator to buffer),
   * this method calls callbacks immediately as data arrives from Cartesia.
   * This enables the orchestrator to forward audio/timestamps to the client
   * without waiting for the full sentence to complete.
   * 
   * @param request - Synthesis request parameters
   * @param callbacks - Real-time callbacks for audio chunks and word timestamps
   * @returns Promise that resolves when synthesis is complete
   */
  async streamSynthesizeProgressive(
    request: StreamingSynthesisRequest,
    callbacks: ProgressiveStreamingCallbacks
  ): Promise<{ totalDurationMs: number; finalTimestamps: WordTiming[] }> {
    let chunkIndex = 0;
    let wordIndex = 0;
    let totalDurationMs = 0;
    const allTimestamps: WordTiming[] = [];
    
    console.log(`[Progressive Synth] Starting for: "${request.text.substring(0, 50)}..."`);
    
    // Use the existing streamSynthesize generator but invoke callbacks immediately
    for await (const chunk of this.streamSynthesize(request)) {
      if (chunk.audio.length > 0) {
        totalDurationMs += chunk.durationMs;
        
        // Call audio callback immediately as chunk arrives
        callbacks.onAudioChunk?.(chunk, chunkIndex);
        chunkIndex++;
      }
      
      // Check for progressive timestamps that arrived with this chunk
      // Note: Cartesia sends timestamps incrementally via word_timestamps events
      // We need to check lastNativeTimestamps for new entries
      const currentTimestamps = [...this.lastNativeTimestamps];
      const newWords = currentTimestamps.length - wordIndex;
      if (newWords > 0) {
        console.log(`[Progressive Synth] Chunk ${chunkIndex}: Found ${newWords} new timestamps (total: ${currentTimestamps.length})`);
      }
      while (wordIndex < currentTimestamps.length) {
        const timing = currentTimestamps[wordIndex];
        allTimestamps.push(timing);
        
        // Estimate total duration based on last known timestamp
        const estimatedTotal = timing.endTime * 1000 * 1.1; // Add 10% buffer
        console.log(`[Progressive Synth] Sending delta: word=${wordIndex} "${timing.word}" ${timing.startTime.toFixed(3)}-${timing.endTime.toFixed(3)}s`);
        callbacks.onWordTimestamp?.(timing, wordIndex, estimatedTotal);
        wordIndex++;
      }
      
      if (chunk.isLast) {
        console.log(`[Progressive Synth] Complete: ${allTimestamps.length} total timestamps`);
        break;
      }
    }
    
    // Final callback with authoritative timings
    callbacks.onComplete?.(allTimestamps, totalDurationMs);
    
    return { totalDurationMs, finalTimestamps: allTimestamps };
  }
  
  /**
   * MULTILINGUAL STREAMING: Stream synthesis with code-switching support
   * 
   * Handles text that contains multiple languages (e.g., English explanation
   * with Spanish vocabulary words). Uses the same context_id across all
   * segments to maintain prosody continuity.
   * 
   * @param segments - Array of text segments with language codes
   * @param baseRequest - Base synthesis request (voice, emotion, etc.)
   * @param callbacks - Real-time callbacks for audio chunks and word timestamps
   * @returns Promise that resolves when all segments are synthesized
   */
  async streamSynthesizeMultilingual(
    segments: Array<{ text: string; languageCode: string; isQuoted: boolean }>,
    baseRequest: Omit<StreamingSynthesisRequest, 'text' | 'language'>,
    callbacks: ProgressiveStreamingCallbacks
  ): Promise<{ totalDurationMs: number; finalTimestamps: WordTiming[] }> {
    // If only one segment, use regular progressive streaming
    if (segments.length === 1) {
      const request: StreamingSynthesisRequest = {
        ...baseRequest,
        text: segments[0].text,
        language: this.languageCodeToName(segments[0].languageCode),
      };
      return this.streamSynthesizeProgressive(request, callbacks);
    }
    
    console.log(`[Multilingual Synth] Processing ${segments.length} segments with code-switching`);
    
    let totalChunkIndex = 0;
    let totalWordIndex = 0;
    let totalDurationMs = 0;
    const allTimestamps: WordTiming[] = [];
    let cumulativeTimeOffset = 0; // Track time offset for word timestamps
    
    // Use per-language context IDs to prevent accent carryover between languages
    // Sharing context_id causes Cartesia's prosody model to carry Spanish accent into English segments
    const contextIdBase = `ctx_ml_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const languageContextIds: Record<string, string> = {};
    
    // SEQUENTIAL SYNTHESIS with gap-minimization:
    // Segments are synthesized one at a time (safe for shared WebSocket state),
    // but audio chunks are forwarded immediately to keep the client's playback 
    // buffer full. The client's audio player handles seamless gapless playback.
    
    for (let segIndex = 0; segIndex < segments.length; segIndex++) {
      const segment = segments[segIndex];
      
      // Skip empty or punctuation-only segments (Cartesia rejects these with 400)
      const textContent = segment.text.replace(/[^a-zA-ZÀ-ÿñÑ\u3040-\u9FAF\uAC00-\uD7AF\u0590-\u06FF\u0400-\u04FF\u0900-\u097F\u0E00-\u0E7F\u0370-\u03FF]/g, '').trim();
      if (!textContent) {
        console.log(`[Multilingual Synth] Skipping punctuation-only segment ${segIndex + 1}: "${segment.text}"`);
        continue;
      }
      
      // Use separate context_id per language so accent doesn't bleed across language boundaries
      if (!languageContextIds[segment.languageCode]) {
        languageContextIds[segment.languageCode] = `${contextIdBase}_${segment.languageCode}`;
      }
      const segmentContextId = languageContextIds[segment.languageCode];
      const segmentLanguageName = this.languageCodeToName(segment.languageCode);
      
      const request: StreamingSynthesisRequest = {
        ...baseRequest,
        text: segment.text,
        language: segmentLanguageName,
        targetLanguage: segmentLanguageName,
        contextId: segmentContextId,
      };
      
      console.log(`[Multilingual Synth] Segment ${segIndex + 1}/${segments.length}: [${segment.languageCode}] "${segment.text.substring(0, 30)}..."`);
      
      let segmentDurationMs = 0;
      const segmentTimestamps: WordTiming[] = [];
      
      for await (const chunk of this.streamSynthesize(request)) {
        if (chunk.audio.length > 0) {
          segmentDurationMs += chunk.durationMs;
          callbacks.onAudioChunk?.(chunk, totalChunkIndex);
          totalChunkIndex++;
        }
        
        const currentTimestamps = [...this.lastNativeTimestamps];
        while (segmentTimestamps.length < currentTimestamps.length) {
          const timing = currentTimestamps[segmentTimestamps.length];
          const adjustedTiming: WordTiming = {
            word: timing.word,
            startTime: timing.startTime + (cumulativeTimeOffset / 1000),
            endTime: timing.endTime + (cumulativeTimeOffset / 1000),
          };
          segmentTimestamps.push(adjustedTiming);
          allTimestamps.push(adjustedTiming);
          const estimatedTotal = (totalDurationMs + segmentDurationMs) * 1.1;
          callbacks.onWordTimestamp?.(adjustedTiming, totalWordIndex, estimatedTotal);
          totalWordIndex++;
        }
        
        if (chunk.isLast) break;
      }
      
      totalDurationMs += segmentDurationMs;
      cumulativeTimeOffset += segmentDurationMs;
      
      console.log(`[Multilingual Synth] Segment ${segIndex + 1} complete: ${segmentTimestamps.length} words, ${segmentDurationMs.toFixed(0)}ms`);
    }
    
    console.log(`[Multilingual Synth] Complete: ${segments.length} segments, ${allTimestamps.length} total words, ${totalDurationMs.toFixed(0)}ms`);
    
    // Final callback
    callbacks.onComplete?.(allTimestamps, totalDurationMs);
    
    return { totalDurationMs, finalTimestamps: allTimestamps };
  }
  
  /**
   * Convert language code to language name for internal use
   */
  private languageCodeToName(code: string): string {
    const codeToName: Record<string, string> = {
      'en': 'english',
      'es': 'spanish',
      'fr': 'french',
      'de': 'german',
      'it': 'italian',
      'pt': 'portuguese',
      'ja': 'japanese',
      'ko': 'korean',
      'zh': 'mandarin',
      'he': 'hebrew',
      'ar': 'arabic',
      'ru': 'russian',
      'hi': 'hindi',
    };
    return codeToName[code.toLowerCase()] || 'english';
  }
  
  /**
   * Synthesize a single sentence for streaming
   * Convenience method that collects all chunks
   */
  async synthesizeSentence(request: StreamingSynthesisRequest): Promise<{
    audio: Buffer;
    wordTimings: WordTiming[];
    durationMs: number;
  }> {
    const chunks: Buffer[] = [];
    let wordTimings: WordTiming[] = [];
    
    // Listen for timestamps
    const timestampHandler = (timings: WordTiming[]) => {
      wordTimings = timings;
    };
    this.on('timestamps', timestampHandler);
    
    try {
      for await (const chunk of this.streamSynthesize(request)) {
        if (chunk.audio.length > 0) {
          chunks.push(chunk.audio);
        }
      }
      
      const audio = Buffer.concat(chunks);
      const durationMs = this.estimateDuration(audio.length);
      
      // Estimate word timings if not provided by WebSocket
      if (wordTimings.length === 0) {
        wordTimings = this.estimateWordTimings(request.text, durationMs / 1000);
      }
      
      return { audio, wordTimings, durationMs };
    } finally {
      this.off('timestamps', timestampHandler);
    }
  }
  
  /**
   * Convert Cartesia timestamp format to our WordTiming format
   */
  private convertTimestamps(timestamps: any): WordTiming[] {
    if (!timestamps?.words) return [];
    
    return timestamps.words.map((w: any) => ({
      word: w.word || w.text || '',
      startTime: (w.start || w.startTime || 0) / 1000, // Convert ms to seconds
      endTime: (w.end || w.endTime || 0) / 1000,
    }));
  }
  
  /**
   * Estimate audio duration from buffer size
   * MP3 at 128kbps ≈ 16KB per second
   */
  private estimateDuration(bufferSize: number): number {
    const bytesPerSecond = (AUDIO_STREAMING_CONFIG.BIT_RATE / 8);
    return (bufferSize / bytesPerSecond) * 1000; // Return ms
  }
  
  /**
   * Convert pcm_s16le buffer to pcm_f32le buffer
   * The bytes API returns s16le even when f32le is requested.
   * Each 16-bit signed integer sample is normalized to [-1.0, 1.0] float range.
   */
  private convertS16leToF32le(s16Buffer: Buffer): Buffer {
    const sampleCount = Math.floor(s16Buffer.length / 2);
    const f32Buffer = Buffer.alloc(sampleCount * 4);
    for (let i = 0; i < sampleCount; i++) {
      const s16Value = s16Buffer.readInt16LE(i * 2);
      const f32Value = s16Value / 32768.0;
      f32Buffer.writeFloatLE(f32Value, i * 4);
    }
    return f32Buffer;
  }

  /**
   * Estimate audio duration from pcm_s16le buffer size
   * PCM s16le at 24kHz mono = 2 bytes per sample
   */
  private estimateS16leDuration(bufferSize: number): number {
    const bytesPerSample = 2;
    const sampleRate = 24000;
    const channels = 1;
    const bytesPerSecond = bytesPerSample * sampleRate * channels;
    return (bufferSize / bytesPerSecond) * 1000;
  }

  /**
   * Estimate PCM audio duration from buffer size
   * PCM f32le at 24kHz mono = 4 bytes per sample × 24000 samples/sec = 96KB per second
   */
  private estimatePcmDuration(bufferSize: number): number {
    const bytesPerSample = 4; // 32-bit float = 4 bytes
    const sampleRate = 24000;
    const channels = 1;
    const bytesPerSecond = bytesPerSample * sampleRate * channels;
    return (bufferSize / bytesPerSecond) * 1000; // Return ms
  }
  
  /**
   * Estimate word timings from text and duration
   * Falls back to this when WebSocket doesn't provide timestamps
   * Note: `text` here is the original display text before phoneme conversion
   */
  private estimateWordTimings(text: string, durationSeconds: number): WordTiming[] {
    // Replace [laughter] tags with a space to preserve word alignment
    const cleanedText = text.replace(/\[laughter\]/gi, ' ');
    
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
    let currentTime = 0.1; // Small pause at start
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
let streamingService: CartesiaStreamingService | null = null;

export function getCartesiaStreamingService(): CartesiaStreamingService {
  if (!streamingService) {
    streamingService = new CartesiaStreamingService();
  }
  return streamingService;
}
