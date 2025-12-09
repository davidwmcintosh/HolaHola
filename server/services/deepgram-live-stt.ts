/**
 * Deepgram Live Streaming STT Service
 * 
 * Purpose: Reliable speech-to-text for push-to-talk voice mode
 * 
 * Core Values:
 * - <2 second response time: WebSocket reduces connection overhead
 * - Word timestamps for karaoke: Enabled via smart_format
 * - Sequential pipeline: Returns complete transcript before LLM call
 * - Reliability: Live API handles WebM/Opus better than prerecorded
 * 
 * Architecture: Send complete audio blob → Wait for final transcript → Return
 */

import { createClient, LiveTranscriptionEvents } from "@deepgram/sdk";

export interface TranscriptionResult {
  transcript: string;
  confidence: number;
  words: Array<{
    word: string;
    start: number;
    end: number;
    confidence: number;
  }>;
  durationMs: number;
}

export interface DeepgramLiveConfig {
  language: string;
  model?: string;
}

const deepgramClient = createClient(process.env.DEEPGRAM_API_KEY || '');

/**
 * Transcribe audio using Deepgram's live streaming API
 * 
 * This is more reliable than the prerecorded API for WebM/Opus audio
 * from browser MediaRecorder. We send the complete blob and wait for
 * the final transcript.
 * 
 * @param audioBuffer - Complete audio buffer (WebM/Opus from browser)
 * @param config - Language and model configuration
 * @returns Promise<TranscriptionResult> with transcript, confidence, and word timings
 */
export async function transcribeWithLiveAPI(
  audioBuffer: Buffer,
  config: DeepgramLiveConfig
): Promise<TranscriptionResult> {
  const startTime = Date.now();
  
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Deepgram live transcription timeout (10s)'));
    }, 10000);
    
    try {
      // For WebM container format (from browser MediaRecorder), DON'T specify
      // encoding/sample_rate - Deepgram auto-detects from container headers
      const connection = deepgramClient.listen.live({
        model: config.model || 'nova-2',
        language: config.language,
        punctuate: true,
        smart_format: true,
        // NO encoding/sample_rate for container formats like WebM
      });
      
      let finalTranscript = '';
      let finalConfidence = 0;
      let finalWords: TranscriptionResult['words'] = [];
      let hasReceivedAnyTranscript = false;
      let closeTimeout: NodeJS.Timeout | null = null;
      
      connection.on(LiveTranscriptionEvents.Open, () => {
        console.log(`[Deepgram Live] Connected, sending ${audioBuffer.length} bytes`);
        
        // Send all audio data at once
        connection.send(audioBuffer);
        
        // Wait for Deepgram to process, then close connection
        // The 2.5 second timeout worked in earlier tests
        closeTimeout = setTimeout(() => {
          console.log(`[Deepgram Live] Closing after timeout (transcript: "${finalTranscript}")`);
          connection.requestClose();
        }, 2500);
      });
      
      connection.on(LiveTranscriptionEvents.Transcript, (data) => {
        const alternative = data.channel?.alternatives?.[0];
        if (!alternative) return;
        
        const transcript = alternative.transcript || '';
        const confidence = alternative.confidence || 0;
        const words = alternative.words || [];
        
        hasReceivedAnyTranscript = true;
        
        if (data.is_final && transcript.length > 0) {
          finalTranscript = transcript;
          finalConfidence = confidence;
          finalWords = words.map((w: any) => ({
            word: w.word || '',
            start: w.start || 0,
            end: w.end || 0,
            confidence: w.confidence || 0,
          }));
          
          console.log(`[Deepgram Live] Final: "${transcript}" (${(confidence * 100).toFixed(0)}%)`);
          
          // Got final result - close early instead of waiting for timeout
          if (closeTimeout) {
            clearTimeout(closeTimeout);
            closeTimeout = null;
          }
          // Small delay to ensure all data is flushed
          setTimeout(() => connection.requestClose(), 50);
        } else if (transcript.length > 0) {
          console.log(`[Deepgram Live] Interim: "${transcript}"`);
        }
      });
      
      connection.on(LiveTranscriptionEvents.Close, () => {
        clearTimeout(timeout);
        if (closeTimeout) clearTimeout(closeTimeout);
        const durationMs = Date.now() - startTime;
        
        console.log(`[Deepgram Live] Closed after ${durationMs}ms`);
        
        resolve({
          transcript: finalTranscript,
          confidence: finalConfidence,
          words: finalWords,
          durationMs,
        });
      });
      
      connection.on(LiveTranscriptionEvents.Error, (error) => {
        clearTimeout(timeout);
        console.error('[Deepgram Live] Error:', error);
        reject(error);
      });
      
    } catch (error) {
      clearTimeout(timeout);
      reject(error);
    }
  });
}

/**
 * Get Deepgram language code from our language names
 */
export function getDeepgramLanguageCode(language: string): string {
  const languageMap: Record<string, string> = {
    'spanish': 'es',
    'french': 'fr',
    'german': 'de',
    'italian': 'it',
    'portuguese': 'pt',
    'japanese': 'ja',
    'korean': 'ko',
    'chinese': 'zh',
    'english': 'en',
  };
  return languageMap[language.toLowerCase()] || 'en';
}

/**
 * Open Mic Streaming Session
 * 
 * Continuous audio streaming with VAD events for natural conversation flow.
 * Emits events for speech detection and provides transcripts for each utterance.
 */
export interface OpenMicEvents {
  onSpeechStarted?: () => void;
  onUtteranceEnd?: (transcript: string, confidence: number) => void;
  onInterimTranscript?: (transcript: string) => void;
  onError?: (error: Error) => void;
  onClose?: () => void;
}

export class OpenMicSession {
  private connection: any = null;
  private isOpen = false;
  private events: OpenMicEvents;
  private language: string;
  private currentTranscript = '';
  private currentConfidence = 0;
  private lastInterimTranscript = '';
  private lastInterimConfidence = 0;
  private chunkCount = 0;
  private totalBytes = 0;
  
  constructor(language: string, events: OpenMicEvents) {
    this.language = language;
    this.events = events;
  }
  
  /**
   * Start the open mic session - opens connection to Deepgram with VAD enabled
   * Configured for raw PCM linear16 audio at 16kHz sample rate
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      let resolved = false;
      
      const resolveOnce = () => {
        if (!resolved) {
          resolved = true;
          console.log('[OpenMic] Deepgram connection ready');
          this.isOpen = true;
          resolve();
        }
      };
      
      try {
        // MULTI-LANGUAGE: Always use 'multi' for bilingual detection
        // Students naturally mix native + target language during lessons
        // Better to get 85% accurate bilingual transcript than miss English entirely
        const languageCode = 'multi';
        console.log(`[OpenMic] Creating Deepgram live connection (language: ${languageCode}, target: ${this.language})`);
        
        this.connection = deepgramClient.listen.live({
          model: 'nova-2',
          language: languageCode,
          punctuate: true,
          smart_format: true,
          vad_events: true,
          utterance_end_ms: 1400, // Allow ~1.4s pause for natural thinking without cutting off
          interim_results: true,
          encoding: 'linear16',
          sample_rate: 16000,
          channels: 1,
        });
        
        // Attach Open handler first
        this.connection.on(LiveTranscriptionEvents.Open, () => {
          console.log('[OpenMic] Deepgram Open event received');
          resolveOnce();
        });
        
        // Attach other handlers immediately after Open
        this.connection.on(LiveTranscriptionEvents.SpeechStarted, () => {
          console.log('[OpenMic] Speech started (VAD)');
          // If we get a SpeechStarted event, connection is definitely open
          resolveOnce();
          this.events.onSpeechStarted?.();
        });
        
        this.connection.on(LiveTranscriptionEvents.UtteranceEnd, () => {
          console.log(`[OpenMic] Utterance end - transcript: "${this.currentTranscript}"`);
          if (this.currentTranscript.trim()) {
            this.events.onUtteranceEnd?.(this.currentTranscript, this.currentConfidence);
          }
          this.currentTranscript = '';
          this.currentConfidence = 0;
        });
        
        this.connection.on(LiveTranscriptionEvents.Transcript, (data: any) => {
          // Log EVERY transcript event raw with actual content
          const alt = data.channel?.alternatives?.[0];
          const text = alt?.transcript || '';
          const conf = alt?.confidence || 0;
          console.log(`[OpenMic] RAW Transcript: is_final=${data.is_final}, speech_final=${data.speech_final}, text="${text}", conf=${conf.toFixed(2)}`);
          
          const alternative = data.channel?.alternatives?.[0];
          if (!alternative) {
            console.log(`[OpenMic] Transcript event with no alternative`);
            return;
          }
          
          // If we get a transcript event, connection is definitely open
          resolveOnce();
          
          const transcript = alternative.transcript || '';
          const confidence = alternative.confidence || 0;
          
          // Log all transcript events for debugging
          if (transcript.length > 0) {
            console.log(`[OpenMic] Transcript: "${transcript}" (final=${data.is_final}, conf=${(confidence * 100).toFixed(0)}%)`);
          }
          
          // Track the latest transcript (both interim and final)
          if (transcript.length > 0) {
            if (data.is_final) {
              // Accumulate final segments
              this.currentTranscript += (this.currentTranscript ? ' ' : '') + transcript;
              this.currentConfidence = confidence;
              console.log(`[OpenMic] Final segment accumulated: "${this.currentTranscript}"`);
            } else {
              // For interim results, update UI but also track for fallback
              this.events.onInterimTranscript?.(transcript);
              // Store interim as potential fallback if no final comes
              if (!this.currentTranscript) {
                this.lastInterimTranscript = transcript;
                this.lastInterimConfidence = confidence;
              }
            }
          }
          
          // When speech_final=true, trigger auto-submit with whatever we have
          if (data.speech_final) {
            const finalText = this.currentTranscript.trim() || this.lastInterimTranscript?.trim() || '';
            const finalConf = this.currentConfidence || this.lastInterimConfidence || 0;
            
            if (finalText) {
              console.log(`[OpenMic] Speech final - submitting: "${finalText}"`);
              this.events.onUtteranceEnd?.(finalText, finalConf);
            } else {
              console.log(`[OpenMic] Speech final but no transcript to submit`);
            }
            
            // Reset for next utterance
            this.currentTranscript = '';
            this.currentConfidence = 0;
            this.lastInterimTranscript = '';
            this.lastInterimConfidence = 0;
          }
        });
        
        this.connection.on(LiveTranscriptionEvents.Error, (error: any) => {
          console.error('[OpenMic] Error:', error);
          this.events.onError?.(new Error(error.message || 'Deepgram error'));
          if (!resolved) {
            resolved = true;
            reject(new Error(error.message || 'Deepgram connection error'));
          }
        });
        
        this.connection.on(LiveTranscriptionEvents.Close, () => {
          console.log('[OpenMic] Connection closed');
          this.isOpen = false;
          this.events.onClose?.();
        });
        
        // Timeout after 10 seconds if connection never opens
        setTimeout(() => {
          if (!resolved) {
            console.error('[OpenMic] Connection timeout - no Open event after 10s');
            resolved = true;
            reject(new Error('Deepgram connection timeout'));
          }
        }, 10000);
        
      } catch (error) {
        console.error('[OpenMic] Failed to create connection:', error);
        reject(error);
      }
    });
  }
  
  /**
   * Send audio chunk to Deepgram (raw PCM linear16 format)
   */
  sendAudio(audioBuffer: Buffer): void {
    if (this.isOpen && this.connection) {
      this.chunkCount++;
      this.totalBytes += audioBuffer.length;
      
      // Log first chunk for debugging
      if (!this.hasLoggedFirstChunk) {
        this.hasLoggedFirstChunk = true;
        // PCM audio doesn't have container headers - just raw samples
        console.log(`[OpenMic] First PCM chunk: ${audioBuffer.length} bytes (${(audioBuffer.length / 2 / 16000 * 1000).toFixed(0)}ms at 16kHz)`);
      }
      
      // Log periodically every 50 chunks (~13 seconds of audio)
      if (this.chunkCount % 50 === 0) {
        const totalSeconds = (this.totalBytes / 2 / 16000).toFixed(1);
        console.log(`[OpenMic] Audio stats: ${this.chunkCount} chunks, ${totalSeconds}s total`);
      }
      
      this.connection.send(audioBuffer);
    } else {
      console.warn(`[OpenMic] Cannot send audio - isOpen: ${this.isOpen}, connection: ${!!this.connection}`);
    }
  }
  
  private hasLoggedFirstChunk = false;
  
  /**
   * Check if session is active
   */
  isActive(): boolean {
    return this.isOpen;
  }
  
  /**
   * Close the session
   */
  close(): void {
    if (this.connection) {
      try {
        this.connection.requestClose();
      } catch (e) {
        console.warn('[OpenMic] Error closing connection:', e);
      }
      this.connection = null;
      this.isOpen = false;
    }
  }
}
