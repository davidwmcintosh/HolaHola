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
 * 
 * Intelligence Features (enabled Dec 2024):
 * - Sentiment Analysis: Track student frustration/confidence in real-time
 * - Intent Recognition: Detect "I don't understand", "can you repeat" etc.
 * - Entity Detection: Extract names, locations, dates for personalization
 * - Diarization: Separate student vs tutor voices (FREE)
 * - Language Detection: Auto-detect code-switching between languages
 */

import { createClient, LiveTranscriptionEvents } from "@deepgram/sdk";

export interface DeepgramSentiment {
  sentiment: 'positive' | 'negative' | 'neutral';
  sentiment_score: number;
}

export interface DeepgramIntent {
  intent: string;
  confidence_score: number;
}

export interface DeepgramEntity {
  label: string;
  value: string;
  confidence: number;
  start_word?: number;
  end_word?: number;
}

export interface DeepgramTopic {
  topic: string;
  confidence: number;
}

export interface DeepgramIntelligence {
  sentiment?: DeepgramSentiment;
  intents?: DeepgramIntent[];
  entities?: DeepgramEntity[];
  topics?: DeepgramTopic[];
  summary?: string;
  detectedLanguage?: string;
  speakerId?: number;
}

export interface TranscriptionResult {
  transcript: string;
  confidence: number;
  words: Array<{
    word: string;
    start: number;
    end: number;
    confidence: number;
    speaker?: number;
  }>;
  durationMs: number;
  intelligence?: DeepgramIntelligence;
}

export interface DeepgramLiveConfig {
  language: string;
  model?: string;
  enableIntelligence?: boolean;
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
      const enableIntelligence = config.enableIntelligence !== false;
      
      const connectionOptions: any = {
        model: config.model || 'nova-2',
        language: config.language,
        punctuate: true,
        smart_format: true,
        // NO encoding/sample_rate for container formats like WebM
      };
      
      // Add Deepgram Intelligence features (Dec 2024 upgrade)
      // NOTE: intents, topics, summarize NOT available on live API for current plan
      if (enableIntelligence) {
        connectionOptions.diarize = true;           // Speaker separation (FREE)
        connectionOptions.sentiment = true;         // Sentiment analysis
        connectionOptions.detect_entities = true;   // Entity detection
        connectionOptions.detect_language = true;   // Language detection
        console.log('[Deepgram Live] Intelligence features enabled: diarize, sentiment, entities, language');
      }
      
      const connection = deepgramClient.listen.live(connectionOptions);
      
      let finalTranscript = '';
      let finalConfidence = 0;
      let finalWords: TranscriptionResult['words'] = [];
      let finalIntelligence: DeepgramIntelligence = {};
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
            speaker: w.speaker,
          }));
          
          // Extract intelligence data from response
          if (enableIntelligence) {
            // Sentiment
            if (alternative.sentiment) {
              finalIntelligence.sentiment = {
                sentiment: alternative.sentiment as 'positive' | 'negative' | 'neutral',
                sentiment_score: alternative.sentiment_score || 0,
              };
            }
            
            // Intents
            if (alternative.intents && alternative.intents.length > 0) {
              finalIntelligence.intents = alternative.intents.map((i: any) => ({
                intent: i.intent || '',
                confidence_score: i.confidence_score || i.confidence || 0,
              }));
            }
            
            // Entities
            if (alternative.entities && alternative.entities.length > 0) {
              finalIntelligence.entities = alternative.entities.map((e: any) => ({
                label: e.label || e.type || '',
                value: e.value || '',
                confidence: e.confidence || 0,
                start_word: e.start_word,
                end_word: e.end_word,
              }));
            }
            
            // Topics (if available in response)
            if (alternative.topics && alternative.topics.length > 0) {
              finalIntelligence.topics = alternative.topics.map((t: any) => ({
                topic: t.topic || '',
                confidence: t.confidence || 0,
              }));
            }
            
            // Summary (from summarize feature)
            if (data.channel?.summary || alternative.summary) {
              finalIntelligence.summary = data.channel?.summary || alternative.summary;
            }
            
            // Detected language
            if (data.channel?.detected_language) {
              finalIntelligence.detectedLanguage = data.channel.detected_language;
            }
            
            // Speaker ID (from diarization)
            if (words[0]?.speaker !== undefined) {
              finalIntelligence.speakerId = words[0].speaker;
            }
            
            if (Object.keys(finalIntelligence).length > 0) {
              console.log(`[Deepgram Live] Intelligence:`, JSON.stringify(finalIntelligence));
            }
          }
          
          console.log(`[Deepgram Live] Final: "${transcript}" (${(confidence * 100).toFixed(0)}%)`);
          
          // Got final result - close early instead of waiting for timeout
          if (closeTimeout) {
            clearTimeout(closeTimeout);
            closeTimeout = null;
          }
          // Wait 500ms for metadata events (summaries, topics) before closing
          // Metadata events often arrive after the final transcript
          setTimeout(() => connection.requestClose(), 500);
        } else if (transcript.length > 0) {
          console.log(`[Deepgram Live] Interim: "${transcript}"`);
        }
      });
      
      // Listen for Metadata events (summaries arrive here in v2)
      connection.on(LiveTranscriptionEvents.Metadata, (data: any) => {
        if (enableIntelligence) {
          // Deepgram v2 summaries come through metadata events
          if (data?.summaries && Array.isArray(data.summaries) && data.summaries.length > 0) {
            // Combine all summary segments
            const summaryText = data.summaries
              .map((s: any) => s.summary || s.text || '')
              .filter((s: string) => s.length > 0)
              .join(' ');
            
            if (summaryText) {
              finalIntelligence.summary = summaryText;
              console.log(`[Deepgram Live] Summary received: "${summaryText.substring(0, 100)}..."`);
            }
          }
          
          // Also check for topics in metadata
          if (data?.topics && Array.isArray(data.topics) && data.topics.length > 0) {
            finalIntelligence.topics = data.topics.map((t: any) => ({
              topic: t.topic || t.text || '',
              confidence: t.confidence || 0,
            }));
            console.log(`[Deepgram Live] Topics received:`, finalIntelligence.topics);
          }
        }
      });
      
      connection.on(LiveTranscriptionEvents.Close, () => {
        clearTimeout(timeout);
        if (closeTimeout) clearTimeout(closeTimeout);
        const durationMs = Date.now() - startTime;
        
        // Log final intelligence state before resolving
        const intelKeys = Object.keys(finalIntelligence);
        if (intelKeys.length > 0) {
          console.log(`[Deepgram Live] Final intelligence collected: ${intelKeys.join(', ')}`);
          if (finalIntelligence.summary) {
            console.log(`[Deepgram Live] Summary: "${finalIntelligence.summary.substring(0, 100)}..."`);
          }
          if (finalIntelligence.topics && finalIntelligence.topics.length > 0) {
            console.log(`[Deepgram Live] Topics: ${finalIntelligence.topics.map(t => t.topic).join(', ')}`);
          }
        }
        
        console.log(`[Deepgram Live] Closed after ${durationMs}ms`);
        
        resolve({
          transcript: finalTranscript,
          confidence: finalConfidence,
          words: finalWords,
          durationMs,
          intelligence: intelKeys.length > 0 ? finalIntelligence : undefined,
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
 * 
 * Intelligence Features (Dec 2024):
 * - Real-time sentiment analysis
 * - Intent recognition
 * - Entity detection
 * - Speaker diarization
 * - Language detection
 */
export interface OpenMicEvents {
  onSpeechStarted?: () => void;
  onUtteranceEnd?: (transcript: string, confidence: number, intelligence?: DeepgramIntelligence) => void;
  onInterimTranscript?: (transcript: string) => void;
  onIntelligence?: (intelligence: DeepgramIntelligence) => void;
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
  private currentIntelligence: DeepgramIntelligence = {};
  private lastInterimTranscript = '';
  private lastInterimConfidence = 0;
  private chunkCount = 0;
  private totalBytes = 0;
  private keepaliveInterval: NodeJS.Timeout | null = null;
  
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
        // IMPORTANT: nova-3 is required for reliable 'multi' language mode
        // nova-2 with 'multi' returns empty transcripts despite receiving valid audio
        const languageCode = 'multi';
        console.log(`[OpenMic] Creating Deepgram live connection (model: nova-3, language: ${languageCode}, target: ${this.language})`);
        
        this.connection = deepgramClient.listen.live({
          model: 'nova-3',  // nova-3 required for reliable multilingual streaming
          language: languageCode,
          punctuate: true,
          smart_format: true,
          vad_events: true,
          utterance_end_ms: 1400, // Allow ~1.4s pause for natural thinking without cutting off
          interim_results: true,
          encoding: 'linear16',
          sample_rate: 16000,
          channels: 1,
          endpointing: 100, // 100ms endpointing for better code-switching (recommended for multi)
          // Deepgram Intelligence Features (Dec 2024)
          // NOTE: intents, topics, summarize NOT available on live streaming API for current plan
          diarize: true,           // Speaker separation (FREE)
          sentiment: true,         // Real-time sentiment analysis
          detect_entities: true,   // Entity detection
          detect_language: true,   // Language detection
        });
        console.log('[OpenMic] Intelligence features enabled: diarize, sentiment, entities, language');
        
        // Attach Open handler first
        this.connection.on(LiveTranscriptionEvents.Open, () => {
          console.log('[OpenMic] Deepgram Open event received');
          
          // Start keepalive ping to prevent Deepgram from closing due to inactivity
          // Deepgram expects a KeepAlive message to maintain connection
          this.keepaliveInterval = setInterval(() => {
            if (this.isOpen && this.connection) {
              try {
                this.connection.keepAlive();
              } catch (e) {
                // Ignore keepalive errors
              }
            }
          }, 5000); // Send keepalive every 5 seconds
          
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
            const intel = Object.keys(this.currentIntelligence).length > 0 ? this.currentIntelligence : undefined;
            this.events.onUtteranceEnd?.(this.currentTranscript, this.currentConfidence, intel);
          }
          this.currentTranscript = '';
          this.currentConfidence = 0;
          this.currentIntelligence = {};
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
          const words = alternative.words || [];
          
          // Log all transcript events for debugging
          if (transcript.length > 0) {
            console.log(`[OpenMic] Transcript: "${transcript}" (final=${data.is_final}, conf=${(confidence * 100).toFixed(0)}%)`);
          }
          
          // Extract intelligence data from final transcripts
          if (data.is_final && transcript.length > 0) {
            const intel: DeepgramIntelligence = {};
            
            // Sentiment
            if (alternative.sentiment) {
              intel.sentiment = {
                sentiment: alternative.sentiment as 'positive' | 'negative' | 'neutral',
                sentiment_score: alternative.sentiment_score || 0,
              };
            }
            
            // Intents
            if (alternative.intents && alternative.intents.length > 0) {
              intel.intents = alternative.intents.map((i: any) => ({
                intent: i.intent || '',
                confidence_score: i.confidence_score || i.confidence || 0,
              }));
            }
            
            // Entities
            if (alternative.entities && alternative.entities.length > 0) {
              intel.entities = alternative.entities.map((e: any) => ({
                label: e.label || e.type || '',
                value: e.value || '',
                confidence: e.confidence || 0,
                start_word: e.start_word,
                end_word: e.end_word,
              }));
            }
            
            // Topics
            if (alternative.topics && alternative.topics.length > 0) {
              intel.topics = alternative.topics.map((t: any) => ({
                topic: t.topic || '',
                confidence: t.confidence || 0,
              }));
            }
            
            // Detected language
            if (data.channel?.detected_language) {
              intel.detectedLanguage = data.channel.detected_language;
            }
            
            // Speaker ID (from diarization)
            if (words[0]?.speaker !== undefined) {
              intel.speakerId = words[0].speaker;
            }
            
            // Merge into current intelligence
            if (Object.keys(intel).length > 0) {
              this.currentIntelligence = { ...this.currentIntelligence, ...intel };
              console.log(`[OpenMic] Intelligence extracted:`, JSON.stringify(intel));
              // Emit intelligence event for real-time processing
              this.events.onIntelligence?.(intel);
            }
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
          
          // NOTE: We do NOT auto-submit on speech_final anymore
          // speech_final fires too quickly and cuts users off mid-sentence
          // Instead, we rely solely on UtteranceEnd which respects utterance_end_ms (1400ms)
          // This gives users more time to pause and think without being cut off
          if (data.speech_final) {
            console.log(`[OpenMic] Speech final detected (NOT auto-submitting - waiting for UtteranceEnd)`);
          }
        });
        
        // Listen for Metadata events (summaries and topics arrive here in v2)
        this.connection.on(LiveTranscriptionEvents.Metadata, (data: any) => {
          const intel: DeepgramIntelligence = {};
          
          // Deepgram v2 summaries come through metadata events
          if (data?.summaries && Array.isArray(data.summaries) && data.summaries.length > 0) {
            const summaryText = data.summaries
              .map((s: any) => s.summary || s.text || '')
              .filter((s: string) => s.length > 0)
              .join(' ');
            
            if (summaryText) {
              intel.summary = summaryText;
              console.log(`[OpenMic] Summary received: "${summaryText.substring(0, 100)}..."`);
            }
          }
          
          // Topics may also arrive via metadata
          if (data?.topics && Array.isArray(data.topics) && data.topics.length > 0) {
            intel.topics = data.topics.map((t: any) => ({
              topic: t.topic || t.text || '',
              confidence: t.confidence || 0,
            }));
            console.log(`[OpenMic] Topics received:`, intel.topics);
          }
          
          if (Object.keys(intel).length > 0) {
            this.currentIntelligence = { ...this.currentIntelligence, ...intel };
            this.events.onIntelligence?.(intel);
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
      
      // Calculate RMS audio level from PCM samples
      let sumSquares = 0;
      let maxSample = 0;
      const numSamples = audioBuffer.length / 2; // 16-bit samples
      for (let i = 0; i < audioBuffer.length; i += 2) {
        const sample = audioBuffer.readInt16LE(i);
        sumSquares += sample * sample;
        maxSample = Math.max(maxSample, Math.abs(sample));
      }
      const rms = Math.sqrt(sumSquares / numSamples);
      const rmsDb = rms > 0 ? 20 * Math.log10(rms / 32768) : -96;
      
      // Log first chunk for debugging with audio level
      if (!this.hasLoggedFirstChunk) {
        this.hasLoggedFirstChunk = true;
        console.log(`[OpenMic] First PCM chunk: ${audioBuffer.length} bytes (${(audioBuffer.length / 2 / 16000 * 1000).toFixed(0)}ms at 16kHz), RMS: ${rmsDb.toFixed(1)}dB, max: ${maxSample}`);
      }
      
      // Log periodically every 50 chunks (~13 seconds of audio)
      if (this.chunkCount % 50 === 0) {
        const totalSeconds = (this.totalBytes / 2 / 16000).toFixed(1);
        console.log(`[OpenMic] Audio stats: ${this.chunkCount} chunks, ${totalSeconds}s total, RMS: ${rmsDb.toFixed(1)}dB, max: ${maxSample}`);
      }
      
      // Warn if audio appears to be silence
      if (rmsDb < -60 && this.chunkCount % 20 === 0) {
        console.warn(`[OpenMic] LOW AUDIO LEVEL: ${rmsDb.toFixed(1)}dB (chunk ${this.chunkCount}) - may be silence`);
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
    // Clear keepalive interval
    if (this.keepaliveInterval) {
      clearInterval(this.keepaliveInterval);
      this.keepaliveInterval = null;
    }
    
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
