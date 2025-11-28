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
   * Stream synthesis of text
   * Returns an async generator that yields audio chunks
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
    
    // Determine voice
    const selectedLanguage = language?.toLowerCase() || 'english';
    const voiceConfig = CARTESIA_VOICE_MAP[selectedLanguage] || CARTESIA_VOICE_MAP['english'];
    const effectiveVoiceId = voiceId || voiceConfig.voiceId;
    
    // Constrain emotion to personality bounds
    const constrainedEmotion = constrainEmotion(emotion, personality, expressiveness);
    
    // Map speaking rate to Cartesia's 0.6-1.5 range
    let cartesiaSpeed = 0.9;
    if (speakingRate <= 0.7) {
      cartesiaSpeed = 0.7;
    } else if (speakingRate >= 1.2) {
      cartesiaSpeed = 1.3;
    }
    
    // Apply phoneme tags for correct pronunciation of foreign words
    const phonemedText = addCartesiaPhonemesToText(text, targetLanguage);
    
    // Clean quotes but preserve phoneme tags
    const cleanedText = phonemedText.replace(/["'"]/g, '');
    
    console.log(`[Cartesia Streaming] Synthesizing: "${cleanedText.substring(0, 50)}..." (${cleanedText.length} chars)`);
    console.log(`[Cartesia Streaming] Voice: ${voiceConfig.name}, Emotion: ${constrainedEmotion}, Speed: ${cartesiaSpeed}`);
    
    const startTime = Date.now();
    let firstChunkTime: number | null = null;
    let totalBytes = 0;
    let chunkCount = 0;
    
    try {
      // Use WebSocket if connected for lower latency, otherwise fall back to bytes API
      if (this.connected && this.websocket) {
        // WebSocket streaming using events API
        console.log('[Cartesia Streaming] Using WebSocket streaming');
        
        const response = await this.websocket.send({
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
        });
        
        // Collect chunks using Promise-based event handling
        // The SDK uses response.on('message', callback) pattern
        const chunks: Buffer[] = [];
        let done = false;
        
        await new Promise<void>((resolve, reject) => {
          // Set up message handler
          response.on('message', (message: any) => {
            if (message.type === 'chunk' && message.data) {
              if (!firstChunkTime) {
                firstChunkTime = Date.now();
                console.log(`[Cartesia Streaming] TTFB: ${firstChunkTime - startTime}ms`);
              }
              // Data is Base64 encoded
              const buffer = Buffer.from(message.data, 'base64');
              totalBytes += buffer.length;
              chunkCount++;
              chunks.push(buffer);
            } else if (message.type === 'timestamps') {
              console.log(`[Cartesia Streaming] Received word timestamps`);
            } else if (message.done || message.type === 'done') {
              console.log(`[Cartesia Streaming] Stream complete`);
              done = true;
              resolve();
            } else if (message.type === 'error') {
              console.error(`[Cartesia Streaming] Stream error:`, message);
              reject(new Error(message.message || 'WebSocket stream error'));
            }
          });
          
          // Timeout fallback in case 'done' is never received
          setTimeout(() => {
            if (!done) {
              console.log(`[Cartesia Streaming] Timeout, completing with ${chunks.length} chunks`);
              resolve();
            }
          }, 10000);
        });
        
        // Yield all collected chunks
        for (const chunk of chunks) {
          yield {
            audio: chunk,
            durationMs: this.estimateDuration(chunk.length),
            isLast: false,
          };
        }
        
        // Signal completion
        yield {
          audio: Buffer.alloc(0),
          durationMs: 0,
          isLast: true,
        };
        
      } else {
        // Fall back to bytes API (still streams, just not WebSocket)
        console.log('[Cartesia Streaming] Using bytes API fallback');
        
        const stream = await this.client.tts.bytes({
          modelId: this.model,
          transcript: cleanedText,
          voice: {
            mode: 'id',
            id: effectiveVoiceId,
          },
          language: voiceConfig.languageCode as any,
          outputFormat: {
            container: 'mp3',
            sampleRate: AUDIO_STREAMING_CONFIG.SAMPLE_RATE,
            bitRate: AUDIO_STREAMING_CONFIG.BIT_RATE,
          },
          // @ts-ignore
          generation_config: {
            speed: cartesiaSpeed,
            emotion: constrainedEmotion,
          },
        });
        
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
      console.log(`[Cartesia Streaming] ✓ Complete: ${chunkCount} chunks, ${totalBytes} bytes in ${elapsed}ms`);
      
    } catch (error: any) {
      console.error('[Cartesia Streaming] Error:', error.message);
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
