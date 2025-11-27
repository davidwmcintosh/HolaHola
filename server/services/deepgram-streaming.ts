/**
 * Deepgram Real-Time Streaming STT Service
 * 
 * Provides ultra-low latency speech-to-text by streaming audio in real-time
 * instead of waiting for the full recording to complete.
 * 
 * Key benefits:
 * - Transcript ready the moment user stops speaking (vs 400-800ms batch delay)
 * - Interim results for live feedback
 * - Smart end-of-speech detection
 */

import { createClient, LiveTranscriptionEvents, LiveClient } from "@deepgram/sdk";
import { EventEmitter } from 'events';

const deepgram = createClient(process.env.DEEPGRAM_API_KEY || '');

/**
 * Language code mapping for Deepgram
 */
const LANGUAGE_CODES: Record<string, string> = {
  'english': 'en',
  'spanish': 'es',
  'french': 'fr',
  'german': 'de',
  'italian': 'it',
  'portuguese': 'pt',
  'japanese': 'ja',
  'mandarin chinese': 'zh',
  'mandarin': 'zh',
  'chinese': 'zh',
  'korean': 'ko',
  'russian': 'ru',
};

/**
 * Events emitted by the streaming STT session
 */
export interface StreamingSTTEvents {
  'interim': (transcript: string, confidence: number) => void;
  'final': (transcript: string, confidence: number, words: WordResult[]) => void;
  'speech_started': () => void;
  'speech_ended': () => void;
  'error': (error: Error) => void;
  'closed': () => void;
}

/**
 * Word-level result from Deepgram
 */
export interface WordResult {
  word: string;
  start: number;
  end: number;
  confidence: number;
  punctuated_word?: string;
}

/**
 * Configuration for streaming STT session
 */
export interface StreamingSTTConfig {
  language: string;
  interimResults?: boolean;
  smartFormat?: boolean;
  punctuate?: boolean;
  endpointing?: number;
  utteranceEndMs?: number;
}

/**
 * Streaming STT Session
 * Manages a real-time transcription session with Deepgram
 */
export class StreamingSTTSession extends EventEmitter {
  private connection: LiveClient | null = null;
  private isConnected: boolean = false;
  private language: string;
  private config: StreamingSTTConfig;
  private fullTranscript: string = '';
  private lastInterimTranscript: string = '';
  private startTime: number = 0;
  private speechStarted: boolean = false;
  
  constructor(config: StreamingSTTConfig) {
    super();
    this.language = LANGUAGE_CODES[config.language.toLowerCase()] || 'en';
    this.config = {
      interimResults: true,
      smartFormat: true,
      punctuate: true,
      endpointing: 300,
      utteranceEndMs: 1000,
      ...config,
    };
  }
  
  /**
   * Connect to Deepgram streaming API
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      console.log('[Deepgram Streaming] Already connected');
      return;
    }
    
    if (!process.env.DEEPGRAM_API_KEY) {
      const error = new Error('DEEPGRAM_API_KEY environment variable is not set');
      console.error('[Deepgram Streaming]', error.message);
      throw error;
    }
    
    this.startTime = Date.now();
    
    try {
      console.log(`[Deepgram Streaming] Connecting (language: ${this.language})...`);
      
      this.connection = deepgram.listen.live({
        model: 'nova-3',
        language: this.language,
        smart_format: this.config.smartFormat,
        punctuate: this.config.punctuate,
        interim_results: this.config.interimResults,
        endpointing: this.config.endpointing,
        utterance_end_ms: this.config.utteranceEndMs,
        encoding: 'linear16',
        sample_rate: 16000,
        channels: 1,
      });
      
      this.setupEventHandlers();
      
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Deepgram connection timeout'));
        }, 5000);
        
        this.connection!.on(LiveTranscriptionEvents.Open, () => {
          clearTimeout(timeout);
          this.isConnected = true;
          const connectTime = Date.now() - this.startTime;
          console.log(`[Deepgram Streaming] ✓ Connected in ${connectTime}ms`);
          resolve();
        });
        
        this.connection!.on(LiveTranscriptionEvents.Error, (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
      
    } catch (error: any) {
      console.error('[Deepgram Streaming] Connection failed:', error.message);
      this.isConnected = false;
      throw error;
    }
  }
  
  /**
   * Set up event handlers for the Deepgram connection
   */
  private setupEventHandlers(): void {
    if (!this.connection) return;
    
    this.connection.on(LiveTranscriptionEvents.Transcript, (data) => {
      try {
        const alternative = data.channel?.alternatives?.[0];
        if (!alternative) return;
        
        const transcript = alternative.transcript || '';
        const confidence = alternative.confidence || 0;
        const words = (alternative.words || []) as WordResult[];
        const isFinal = data.is_final === true;
        const speechFinal = data.speech_final === true;
        
        if (!transcript.trim()) return;
        
        if (!this.speechStarted) {
          this.speechStarted = true;
          this.emit('speech_started');
          console.log('[Deepgram Streaming] Speech started');
        }
        
        if (isFinal) {
          this.fullTranscript += (this.fullTranscript ? ' ' : '') + transcript;
          this.lastInterimTranscript = '';
          console.log(`[Deepgram Streaming] Final: "${transcript}" (confidence: ${(confidence * 100).toFixed(1)}%)`);
          this.emit('final', transcript, confidence, words);
          
          if (speechFinal) {
            console.log('[Deepgram Streaming] Speech ended (utterance complete)');
            this.emit('speech_ended');
          }
        } else {
          this.lastInterimTranscript = transcript;
          this.emit('interim', transcript, confidence);
        }
        
      } catch (error: any) {
        console.error('[Deepgram Streaming] Error processing transcript:', error.message);
      }
    });
    
    this.connection.on(LiveTranscriptionEvents.UtteranceEnd, () => {
      console.log('[Deepgram Streaming] Utterance end detected');
      if (this.speechStarted) {
        this.emit('speech_ended');
      }
    });
    
    this.connection.on(LiveTranscriptionEvents.SpeechStarted, () => {
      console.log('[Deepgram Streaming] VAD: Speech detected');
      if (!this.speechStarted) {
        this.speechStarted = true;
        this.emit('speech_started');
      }
    });
    
    this.connection.on(LiveTranscriptionEvents.Close, () => {
      console.log('[Deepgram Streaming] Connection closed');
      this.isConnected = false;
      this.emit('closed');
    });
    
    this.connection.on(LiveTranscriptionEvents.Error, (error) => {
      console.error('[Deepgram Streaming] Error:', error);
      this.emit('error', new Error(String(error)));
    });
  }
  
  /**
   * Send audio chunk to Deepgram for real-time transcription
   */
  sendAudio(audioData: Buffer | ArrayBuffer): void {
    if (!this.isConnected || !this.connection) {
      console.warn('[Deepgram Streaming] Cannot send audio - not connected');
      return;
    }
    
    try {
      const buffer = audioData instanceof Buffer ? audioData : Buffer.from(audioData);
      this.connection.send(buffer);
    } catch (error: any) {
      console.error('[Deepgram Streaming] Error sending audio:', error.message);
    }
  }
  
  /**
   * Signal that the user has finished speaking
   * This helps Deepgram finalize any pending transcription
   */
  finishSpeaking(): void {
    if (this.connection && this.isConnected) {
      try {
        this.connection.finish();
        console.log('[Deepgram Streaming] Finish signal sent');
      } catch (error: any) {
        console.error('[Deepgram Streaming] Error sending finish:', error.message);
      }
    }
  }
  
  /**
   * Get the full transcript so far
   */
  getFullTranscript(): string {
    const combined = this.fullTranscript + 
      (this.lastInterimTranscript ? ' ' + this.lastInterimTranscript : '');
    return combined.trim();
  }
  
  /**
   * Close the streaming connection
   */
  close(): void {
    if (this.connection) {
      try {
        this.connection.removeAllListeners();
        this.connection.finish();
      } catch (e) {
      }
      this.connection = null;
    }
    this.removeAllListeners();
    this.isConnected = false;
    this.fullTranscript = '';
    this.lastInterimTranscript = '';
    this.speechStarted = false;
    console.log('[Deepgram Streaming] Session closed');
  }
  
  /**
   * Check if connected
   */
  isActive(): boolean {
    return this.isConnected;
  }
}

/**
 * Create a new streaming STT session
 */
export function createStreamingSTTSession(config: StreamingSTTConfig): StreamingSTTSession {
  return new StreamingSTTSession(config);
}

/**
 * Streaming STT Service Singleton
 * Manages STT sessions for the voice orchestrator
 */
class StreamingSTTService {
  private sessions: Map<string, StreamingSTTSession> = new Map();
  
  constructor() {
    console.log('[Streaming STT Service] Initialized');
  }
  
  /**
   * Create a new STT session for a voice session
   */
  async createSession(sessionId: string, language: string): Promise<StreamingSTTSession> {
    const existingSession = this.sessions.get(sessionId);
    if (existingSession) {
      existingSession.close();
    }
    
    const session = createStreamingSTTSession({ language });
    await session.connect();
    
    this.sessions.set(sessionId, session);
    
    session.on('closed', () => {
      this.sessions.delete(sessionId);
    });
    
    return session;
  }
  
  /**
   * Get an existing STT session
   */
  getSession(sessionId: string): StreamingSTTSession | undefined {
    return this.sessions.get(sessionId);
  }
  
  /**
   * Close a specific session
   */
  closeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.close();
      this.sessions.delete(sessionId);
    }
  }
  
  /**
   * Close all sessions
   */
  closeAllSessions(): void {
    this.sessions.forEach((session) => {
      session.close();
    });
    this.sessions.clear();
  }
}

let sttService: StreamingSTTService | null = null;

export function getStreamingSTTService(): StreamingSTTService {
  if (!sttService) {
    sttService = new StreamingSTTService();
  }
  return sttService;
}
