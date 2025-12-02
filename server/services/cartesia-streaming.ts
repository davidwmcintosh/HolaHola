/**
 * Cartesia WebSocket Streaming Service
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
  CartesiaEmotion,
  TutorPersonality,
  constrainEmotion,
  PERSONALITY_PRESETS,
  addCartesiaPhonemesToText,
} from './tts-service';

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
}

/**
 * Audio chunk from streaming synthesis
 */
export interface StreamingAudioChunk {
  audio: Buffer;        // Raw audio data
  durationMs: number;   // Duration of this chunk
  isLast: boolean;      // Is this the final chunk?
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
      this.websocket = this.client.tts.websocket({
        sampleRate: AUDIO_STREAMING_CONFIG.SAMPLE_RATE,
        container: 'mp3',
        encoding: 'pcm_s16le',
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
    
    // Determine voice
    const selectedLanguage = language?.toLowerCase() || 'english';
    const voiceConfig = CARTESIA_VOICE_MAP[selectedLanguage] || CARTESIA_VOICE_MAP['english'];
    const effectiveVoiceId = voiceId || voiceConfig.voiceId;
    
    // Constrain emotion to personality bounds
    const constrainedEmotion = constrainEmotion(emotion, personality, expressiveness);
    
    // Map speaking rate to Cartesia's 0.6-1.5 range
    // Input rates: 0.6 (slower), 0.75 (slow), 0.9 (normal), 1.1 (fast), 1.3 (faster)
    let cartesiaSpeed = Math.max(0.6, Math.min(1.5, speakingRate));
    
    // Check if we have a pronunciation dictionary for this language
    const pronunciationDictId = getPronunciationDictId(targetLanguage);
    
    let processedText: string;
    if (pronunciationDictId) {
      // Use server-side dictionary - no need for inline phoneme markers
      // This produces cleaner transcripts for better word timing
      processedText = text;
      console.log(`[Cartesia Streaming] Using pronunciation dictionary: ${pronunciationDictId} for ${targetLanguage}`);
    } else {
      // Fallback to inline phoneme processing if no dictionary available
      processedText = addCartesiaPhonemesToText(text, targetLanguage);
    }
    
    // Clean standalone quotes but PRESERVE apostrophes in contractions (I'm, don't, etc.)
    // Remove: "text", 'text', standalone quotes at word boundaries
    // Keep: I'm, don't, it's, you're (apostrophes between letters)
    const cleanedText = processedText
      .replace(/^["'"]+|["'"]+$/g, '')  // Remove leading/trailing quotes
      .replace(/\s["'"]+/g, ' ')         // Quote after space → just space
      .replace(/["'"]+\s/g, ' ')         // Quote before space → just space
      .replace(/["'"]{2,}/g, '')         // Multiple consecutive quotes → remove
      .replace(/(?<![a-zA-Z])["'"](?![a-zA-Z])/g, ''); // Standalone quotes not between letters
    
    console.log(`[Cartesia Streaming] Synthesizing: "${cleanedText.substring(0, 50)}..." (${cleanedText.length} chars)`);
    console.log(`[Cartesia Streaming] Voice: ${voiceConfig.name}, Emotion: ${constrainedEmotion}, Speed: ${cartesiaSpeed}`);
    
    const startTime = Date.now();
    let firstChunkTime: number | null = null;
    let totalBytes = 0;
    let chunkCount = 0;
    
    // Try WebSocket API first for native timestamps, fall back to bytes API
    const useWebSocket = this.isConnected();
    
    // Clear any previous timestamps before starting new synthesis
    this.lastNativeTimestamps = [];
    
    try {
      if (useWebSocket) {
        // Use WebSocket API with native word timestamps
        console.log('[Cartesia Streaming] Using WebSocket API with native timestamps');
        
        const contextId = `ctx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const response = await this.websocket.send({
          model_id: this.model,
          transcript: cleanedText,
          voice: {
            mode: 'id',
            id: effectiveVoiceId,
            __experimental_controls: {
              speed: cartesiaSpeed, // Numeric speed in 0.6-1.5 range
              emotion: constrainedEmotion ? [constrainedEmotion] : undefined,
            },
          },
          language: voiceConfig.languageCode,
          context_id: contextId,
          output_format: {
            container: 'mp3',
            sample_rate: AUDIO_STREAMING_CONFIG.SAMPLE_RATE,
            bit_rate: AUDIO_STREAMING_CONFIG.BIT_RATE,
          },
          ...(pronunciationDictId && { pronunciation_dict_id: pronunciationDictId }),
          add_timestamps: true, // Enable native word-level timestamps
        });
        
        // Collect timestamps as they arrive
        const collectedTimestamps: WordTiming[] = [];
        
        // Process all events from the response
        for await (const message of response) {
          // Handle audio chunks
          if (message.audio) {
            if (!firstChunkTime) {
              firstChunkTime = Date.now();
              console.log(`[Cartesia Streaming] TTFB (WebSocket): ${firstChunkTime - startTime}ms`);
            }
            
            const buffer = Buffer.from(message.audio);
            totalBytes += buffer.length;
            chunkCount++;
            
            yield {
              audio: buffer,
              durationMs: this.estimateDuration(buffer.length),
              isLast: false,
            };
          }
          
          // Handle word timestamps from Cartesia
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
              console.log(`[Cartesia Streaming] Received ${words.length} native word timestamps`);
            }
          }
        }
        
        // Store collected timestamps for orchestrator retrieval
        // Also emit for backward compatibility with synthesizeSentence
        if (collectedTimestamps.length > 0) {
          console.log(`[Cartesia Streaming] ✓ Storing ${collectedTimestamps.length} native timestamps`);
          this.lastNativeTimestamps = collectedTimestamps;
          this.emit('timestamps', collectedTimestamps);
        }
        
        // Signal completion
        yield {
          audio: Buffer.alloc(0),
          durationMs: 0,
          isLast: true,
        };
        
      } else {
        // Fallback to bytes API (no native timestamps)
        console.log('[Cartesia Streaming] Using bytes API (WebSocket not connected)');
        
        const requestOptions: any = {
          modelId: this.model,
          transcript: cleanedText,
          voice: {
            mode: 'id',
            id: effectiveVoiceId,
          },
          language: voiceConfig.languageCode,
          outputFormat: {
            container: 'mp3',
            sampleRate: AUDIO_STREAMING_CONFIG.SAMPLE_RATE,
            bitRate: AUDIO_STREAMING_CONFIG.BIT_RATE,
          },
          generation_config: {
            speed: cartesiaSpeed,
            emotion: constrainedEmotion,
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
          
          const buffer = Buffer.from(chunk);
          totalBytes += buffer.length;
          chunkCount++;
          
          yield {
            audio: buffer,
            durationMs: this.estimateDuration(buffer.length),
            isLast: false,
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
      
    } catch (error: any) {
      console.error('[Cartesia Streaming] Error:', error.message);
      
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
