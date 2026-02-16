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
  keyterms?: string[];
}

// EAGER initialization - voice is a core feature, fail fast if Deepgram is unavailable
// This ensures startup crashes immediately if DEEPGRAM_API_KEY is missing/invalid
const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;
if (!DEEPGRAM_API_KEY) {
  throw new Error('DEEPGRAM_API_KEY is required - voice chat will not work without it');
}
const deepgramClient = createClient(DEEPGRAM_API_KEY);
console.log('[Deepgram] ✓ Client initialized (eager startup)');

/**
 * Deepgram Configuration Feature Flags
 * 
 * ⚠️ LOCKED CONFIGURATION - See replit.md "Voice Architecture" ⚠️
 * 
 * These flags control Deepgram model and feature usage.
 * Constants are imported from voice-config.ts to ensure consistency.
 * 
 * AVAILABILITY: Nova-3 and Audio Intelligence features (intent, sentiment, topics, etc.)
 * are available on ALL plans including Pay-as-You-Go. Only CONCURRENCY limits differ:
 * - Pay-as-You-Go/Growth: 100 pre-recorded, 50 streaming, 10 intelligence concurrent
 * - Enterprise: Higher limits, custom arrangements
 * 
 * CRITICAL: Nova-3 is REQUIRED for reliable 'multi' language mode in live streaming.
 * Nova-2 with 'multi' returns empty transcripts despite receiving valid audio.
 * 
 * DO NOT change to nova-2 or disable intelligence without founder approval.
 */
import { DANIELA_STT_MODEL, DANIELA_STT_INTELLIGENCE_ENABLED } from './voice-config';

// Use centralized constants - DO NOT override with process.env directly
const DEEPGRAM_MODEL = process.env.DEEPGRAM_MODEL || DANIELA_STT_MODEL;
const DEEPGRAM_INTELLIGENCE_ENABLED = process.env.DEEPGRAM_INTELLIGENCE_ENABLED !== 'false' && DANIELA_STT_INTELLIGENCE_ENABLED;

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
    // Increased timeout to 20s - long audio needs more processing time
    // The Close event should resolve before this, but this is a safety net
    const timeout = setTimeout(() => {
      reject(new Error('Deepgram live transcription timeout (20s)'));
    }, 20000);
    
    try {
      // For WebM container format (from browser MediaRecorder), DON'T specify
      // encoding/sample_rate - Deepgram auto-detects from container headers
      const enableIntelligence = config.enableIntelligence !== false;
      
      const connectionOptions: any = {
        model: config.model || DEEPGRAM_MODEL,
        language: config.language,
        punctuate: true,
        smart_format: true,
        // NO encoding/sample_rate for container formats like WebM
      };
      
      if (config.keyterms && config.keyterms.length > 0) {
        connectionOptions.keyterm = config.keyterms;
        console.log(`[Deepgram Live] Keyterms: [${config.keyterms.join(', ')}]`);
      }
      
      // Add Deepgram features - only when plan supports them
      // OPTIMIZATION: Skip diarize for PTT mode (single speaker, adds latency)
      // Diarize is only useful for multi-speaker scenarios like open-mic with echo
      if (DEEPGRAM_INTELLIGENCE_ENABLED && enableIntelligence) {
        // connectionOptions.diarize = true;  // DISABLED: Adds ~500ms latency, not needed for single speaker
        console.log('[Deepgram Live] Intelligence: diarize DISABLED for faster PTT response');
      } else {
        console.log(`[Deepgram Live] Intelligence disabled (DEEPGRAM_INTELLIGENCE_ENABLED=${DEEPGRAM_INTELLIGENCE_ENABLED})`);
      }
      
      const connection = deepgramClient.listen.live(connectionOptions);
      
      // IMPORTANT: Collect ALL final transcripts - Deepgram sends one per utterance
      let collectedTranscripts: string[] = [];
      let finalConfidence = 0;
      let confidenceCount = 0;
      let finalWords: TranscriptionResult['words'] = [];
      let finalIntelligence: DeepgramIntelligence = {};
      let hasReceivedAnyTranscript = false;
      let closeTimeout: NodeJS.Timeout | null = null;
      let lastTranscriptTime = Date.now();
      
      connection.on(LiveTranscriptionEvents.Open, () => {
        console.log(`[Deepgram Live] Connected, sending ${audioBuffer.length} bytes`);
        
        // Send all audio data at once
        connection.send(audioBuffer);
        
        // Adaptive close: wait for transcripts to stop coming
        // OPTIMIZED: Use shorter timeouts for faster PTT response
        // 1s initial, extend only if actively receiving transcripts
        const scheduleClose = () => {
          if (closeTimeout) clearTimeout(closeTimeout);
          closeTimeout = setTimeout(() => {
            const timeSinceLastTranscript = Date.now() - lastTranscriptTime;
            // If we got a transcript in the last 500ms, wait a bit longer
            if (timeSinceLastTranscript < 500 && hasReceivedAnyTranscript) {
              console.log(`[Deepgram Live] Still receiving transcripts, extending timeout...`);
              scheduleClose();
            } else {
              const fullTranscript = collectedTranscripts.join(' ');
              console.log(`[Deepgram Live] Closing (collected ${collectedTranscripts.length} segments: "${fullTranscript.substring(0, 50)}...")`);
              connection.requestClose();
            }
          }, 1000); // Reduced from 3000ms to 1000ms
        };
        scheduleClose();
      });
      
      connection.on(LiveTranscriptionEvents.Transcript, (data) => {
        const alternative = data.channel?.alternatives?.[0];
        if (!alternative) return;
        
        const transcript = alternative.transcript || '';
        const confidence = alternative.confidence || 0;
        const words = alternative.words || [];
        
        hasReceivedAnyTranscript = true;
        
        if (data.is_final && transcript.length > 0) {
          // APPEND to collected transcripts instead of overwriting
          collectedTranscripts.push(transcript);
          lastTranscriptTime = Date.now();
          
          // Average confidence across all segments
          finalConfidence = ((finalConfidence * confidenceCount) + confidence) / (confidenceCount + 1);
          confidenceCount++;
          
          // Append words with offset
          const wordOffset = finalWords.length > 0 ? finalWords[finalWords.length - 1].end : 0;
          const mappedWords = words.map((w: any) => ({
            word: w.word || '',
            start: (w.start || 0) + wordOffset,
            end: (w.end || 0) + wordOffset,
            confidence: w.confidence || 0,
            speaker: w.speaker,
          }));
          finalWords = [...finalWords, ...mappedWords];
          
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
        
        // Join all collected transcript segments
        const fullTranscript = collectedTranscripts.join(' ').trim();
        
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
        
        console.log(`[Deepgram Live] Closed after ${durationMs}ms with ${collectedTranscripts.length} segments`);
        console.log(`[Deepgram Live] Full transcript: "${fullTranscript.substring(0, 100)}..."`);
        
        resolve({
          transcript: fullTranscript,
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
    'hebrew': 'he',
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
  onFinalReceived?: () => void;
  onIntelligence?: (intelligence: DeepgramIntelligence) => void;
  onError?: (error: Error) => void;
  onClose?: () => void;
}

export class OpenMicSession {
  private connection: any = null;
  private isOpen = false;
  private events: OpenMicEvents;
  private language: string;
  private keyterms: string[];
  private currentTranscript = '';
  private currentConfidence = 0;
  private currentIntelligence: DeepgramIntelligence = {};
  private lastInterimTranscript = '';
  private lastInterimConfidence = 0;
  private bestInterimForSegment = '';  // Track best interim transcript for current segment (preserves Spanish)
  private chunkCount = 0;
  private totalBytes = 0;
  private keepaliveInterval: NodeJS.Timeout | null = null;
  private isSuppressed = false;
  private lastFinalSegment = '';  // Deduplication: Track last final segment to prevent duplicates
  private emptySpeechFinalTimeout: NodeJS.Timeout | null = null;
  private consecutiveEmptyCount = 0;
  private suppressionEndedAt = 0;
  private lastSuccessfulTranscriptAt = 0;
  
  constructor(language: string, events: OpenMicEvents, keyterms?: string[]) {
    this.language = language;
    this.events = events;
    this.keyterms = keyterms || [];
  }
  
  /**
   * Suppress transcript events while TTS is playing
   * Prevents echo/feedback from being treated as user speech
   */
  setSuppressed(suppressed: boolean): void {
    if (this.isSuppressed !== suppressed) {
      console.log(`[OpenMic] Suppression ${suppressed ? 'ENABLED' : 'DISABLED'} (TTS ${suppressed ? 'playing' : 'stopped'})`);
      this.isSuppressed = suppressed;
      if (suppressed) {
        this.currentTranscript = '';
        this.currentConfidence = 0;
        this.currentIntelligence = {};
        this.lastFinalSegment = '';
        this.bestInterimForSegment = '';
      } else {
        this.suppressionEndedAt = Date.now();
        this.consecutiveEmptyCount = 0;
      }
    }
  }
  
  /**
   * Check if session is currently suppressing transcripts
   */
  getSuppressed(): boolean {
    return this.isSuppressed;
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
        // CRITICAL: nova-3 is FORCED here because nova-2 + 'multi' returns empty transcripts
        // This overrides DEEPGRAM_MODEL env var for open-mic mode specifically
        const languageCode = 'multi';
        const openMicModel = 'nova-3';  // Always nova-3 for open-mic - multi-language requires it
        console.log(`[OpenMic] Creating Deepgram live connection (model: ${openMicModel} [forced for multi-lang], language: ${languageCode}, target: ${this.language}, intelligence: ${DEEPGRAM_INTELLIGENCE_ENABLED})`);
        
        const connectionOptions: any = {
          model: openMicModel,  // nova-3 is required for reliable multi-language streaming
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
          // Intelligence features only when plan supports them
          ...(DEEPGRAM_INTELLIGENCE_ENABLED && {
            diarize: true,           // Speaker separation
          }),
        };
        
        if (this.keyterms.length > 0) {
          connectionOptions.keyterm = this.keyterms;
          console.log(`[OpenMic] Keyterms (${this.keyterms.length}): [${this.keyterms.slice(0, 10).join(', ')}${this.keyterms.length > 10 ? '...' : ''}]`);
        }
        
        this.connection = deepgramClient.listen.live(connectionOptions);
        console.log(`[OpenMic] Intelligence ${DEEPGRAM_INTELLIGENCE_ENABLED ? 'enabled: diarize' : 'disabled (plan limitation)'}`);
        
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
          
          // ECHO SUPPRESSION: Don't emit VAD events while TTS is playing
          // Browser echo cancellation isn't perfect, Deepgram picks up TTS output
          if (this.isSuppressed) {
            console.log('[OpenMic] VAD suppressed - TTS playing');
            return;
          }
          this.events.onSpeechStarted?.();
        });
        
        this.connection.on(LiveTranscriptionEvents.UtteranceEnd, () => {
          console.log(`[OpenMic] Utterance end - transcript: "${this.currentTranscript}"`);
          
          // Clear the safety timeout since real UtteranceEnd arrived
          if (this.emptySpeechFinalTimeout) {
            clearTimeout(this.emptySpeechFinalTimeout);
            this.emptySpeechFinalTimeout = null;
          }
          
          // ECHO SUPPRESSION: Don't process utterance end while TTS is playing
          if (this.isSuppressed) {
            console.log('[OpenMic] Utterance end suppressed - TTS playing');
            this.currentTranscript = '';
            this.currentConfidence = 0;
            this.currentIntelligence = {};
            this.lastFinalSegment = '';  // Reset dedup tracker
            this.bestInterimForSegment = '';  // Reset Spanish preservation tracker
            return;
          }
          
          // CONSECUTIVE EMPTY TRACKING for silence loop detection
          if (!this.currentTranscript.trim()) {
            this.consecutiveEmptyCount++;
            console.log(`[OpenMic] Empty transcript #${this.consecutiveEmptyCount} - signaling [EMPTY_TRANSCRIPT] to prevent timeout`);
            if (this.consecutiveEmptyCount >= 5) {
              console.warn(`[OpenMic] SILENCE LOOP DETECTED: ${this.consecutiveEmptyCount} consecutive empty transcripts — mic may be picking up nothing or ambient noise only`);
            }
          } else {
            if (this.consecutiveEmptyCount > 0) {
              console.log(`[OpenMic] Silence broken after ${this.consecutiveEmptyCount} empty transcripts`);
            }
            this.consecutiveEmptyCount = 0;
            this.lastSuccessfulTranscriptAt = Date.now();
          }
          
          const intel = Object.keys(this.currentIntelligence).length > 0 ? this.currentIntelligence : undefined;
          this.events.onUtteranceEnd?.(this.currentTranscript.trim() || '[EMPTY_TRANSCRIPT]', this.currentConfidence, intel);
          
          this.currentTranscript = '';
          this.currentConfidence = 0;
          this.currentIntelligence = {};
          this.lastFinalSegment = '';  // Reset dedup tracker for new utterance
          this.bestInterimForSegment = '';  // Reset Spanish preservation tracker
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
            // ECHO SUPPRESSION: Don't accumulate or emit while TTS is playing
            if (this.isSuppressed) {
              console.log(`[OpenMic] Transcript suppressed (TTS playing): "${transcript.slice(0, 50)}..."`);
              return;
            }
            
            // POST-SUPPRESSION ECHO LEAKAGE DETECTION
            // After TTS stops, the mic can pick up residual audio from speakers
            // for ~500ms. Only reject very low confidence transcripts to avoid
            // false-rejecting legitimate short replies like "yes", "ok".
            const POST_SUPPRESSION_GRACE_MS = 500;
            const msSinceSuppression = Date.now() - this.suppressionEndedAt;
            if (this.suppressionEndedAt > 0 && msSinceSuppression < POST_SUPPRESSION_GRACE_MS) {
              if (confidence < 0.75 && transcript.split(/\s+/).length <= 4) {
                console.log(`[OpenMic] ECHO LEAKAGE rejected (${msSinceSuppression}ms post-suppression, ${(confidence * 100).toFixed(0)}% conf): "${transcript}"`);
                return;
              }
            }
            
            if (data.is_final) {
              // DEDUPLICATION: Deepgram can send same final segment multiple times
              // (especially during PTT streaming). Skip if identical to last segment.
              const trimmedTranscript = transcript.trim();
              const isExactDuplicate = trimmedTranscript === this.lastFinalSegment.trim();
              
              if (isExactDuplicate) {
                console.log(`[OpenMic] DEDUP: Skipping duplicate final segment: "${trimmedTranscript.slice(0, 50)}..."`);
              } else {
                // MULTILINGUAL PRESERVATION: Deepgram's final transcripts often drop foreign language
                // words that were correctly captured in interim transcripts. This affects all 42+
                // languages - Spanish, French, German, Hebrew, Japanese, Korean, Chinese, etc.
                // Use universal non-ASCII character detection instead of language-specific word lists.
                let transcriptToUse = transcript;
                
                if (this.bestInterimForSegment) {
                  // Count non-ASCII characters (foreign language content)
                  // This catches: accented letters (é, ñ, ü), CJK characters, Hebrew, Arabic, etc.
                  const countNonAscii = (text: string) => {
                    return (text.match(/[^\x00-\x7F]/g) || []).length;
                  };
                  
                  // Count words for word-level preservation check
                  const countWords = (text: string) => {
                    return text.trim().split(/\s+/).filter(w => w.length > 0).length;
                  };
                  
                  const interimNonAscii = countNonAscii(this.bestInterimForSegment);
                  const finalNonAscii = countNonAscii(transcript);
                  const interimWords = countWords(this.bestInterimForSegment);
                  const finalWords = countWords(transcript);
                  
                  // Check if foreign language content was lost
                  const lostNonAscii = interimNonAscii - finalNonAscii;
                  
                  if (lostNonAscii >= 2) {
                    // Lost 2+ non-ASCII chars = likely dropped foreign words
                    console.log(`[OpenMic] MULTILINGUAL PRESERVATION: Lost ${lostNonAscii} non-ASCII chars in final`);
                    console.log(`[OpenMic]   Final (${finalNonAscii} non-ASCII): "${transcript.slice(0, 60)}..."`);
                    console.log(`[OpenMic]   Using interim (${interimNonAscii} non-ASCII): "${this.bestInterimForSegment.slice(0, 60)}..."`);
                    transcriptToUse = this.bestInterimForSegment;
                  } else if (interimWords > finalWords) {
                    // WORD COUNT PRESERVATION: If interim has more words, prefer it
                    // This catches "Hola, guapa" → "Hola," truncation even without special chars
                    console.log(`[OpenMic] WORD PRESERVATION: Final has fewer words (${finalWords} vs ${interimWords})`);
                    console.log(`[OpenMic]   Final: "${transcript}"`);
                    console.log(`[OpenMic]   Using interim: "${this.bestInterimForSegment}"`);
                    transcriptToUse = this.bestInterimForSegment;
                  } else if (this.bestInterimForSegment.length > transcript.length + 5) {
                    // Fallback: If interim is significantly longer (5+ chars), prefer it
                    // Lowered from 10 to catch shorter phrase truncation
                    console.log(`[OpenMic] CONTENT PRESERVATION: Final much shorter than interim (${transcript.length} vs ${this.bestInterimForSegment.length} chars)`);
                    transcriptToUse = this.bestInterimForSegment;
                  }
                }
                
                // Accumulate final segments
                this.currentTranscript += (this.currentTranscript ? ' ' : '') + transcriptToUse;
                this.currentConfidence = confidence;
                this.lastFinalSegment = trimmedTranscript;
                // Reset best interim for next segment
                this.bestInterimForSegment = '';
                console.log(`[OpenMic] Final segment accumulated: "${this.currentTranscript}"`);
                // CRITICAL: Also notify PTT handler of accumulated transcript
                // This ensures PTT mode sees the full accumulated text, not just interim fragments
                this.events.onInterimTranscript?.(this.currentTranscript);
                this.events.onFinalReceived?.();
              }
            } else {
              // For interim results, send accumulated finals + current interim
              // This ensures PTT handler always has the complete picture
              const fullTranscript = this.currentTranscript 
                ? this.currentTranscript + ' ' + transcript 
                : transcript;
              this.events.onInterimTranscript?.(fullTranscript);
              
              // Track the best (longest) interim for this segment - these often capture
              // Spanish words that get dropped in the final transcript
              if (transcript.length > this.bestInterimForSegment.length) {
                this.bestInterimForSegment = transcript;
              }
              
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
            
            // SAFETY: When speech_final fires with empty transcript, Deepgram may never
            // send UtteranceEnd (no real utterance to end). Set a fallback timeout to
            // prevent the user from being stuck in limbo forever.
            if (!this.currentTranscript.trim() && !transcript.trim()) {
              if (this.emptySpeechFinalTimeout) clearTimeout(this.emptySpeechFinalTimeout);
              this.emptySpeechFinalTimeout = setTimeout(() => {
                this.emptySpeechFinalTimeout = null;
                if (this.isSuppressed) return;
                console.log('[OpenMic] SAFETY: UtteranceEnd never arrived after empty speech_final - forcing utterance end');
                this.events.onUtteranceEnd?.('[EMPTY_TRANSCRIPT]', 0);
                this.currentTranscript = '';
                this.currentConfidence = 0;
                this.currentIntelligence = {};
                this.lastFinalSegment = '';
                this.bestInterimForSegment = '';
              }, 2000);
            }
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
   * Get diagnostic state for voice health monitoring
   */
  getDiagnostics(): {
    isOpen: boolean;
    isSuppressed: boolean;
    consecutiveEmptyCount: number;
    chunkCount: number;
    totalAudioSeconds: number;
    msSinceLastSuccessfulTranscript: number;
    msSinceSuppressionEnded: number;
    inSilenceLoop: boolean;
  } {
    return {
      isOpen: this.isOpen,
      isSuppressed: this.isSuppressed,
      consecutiveEmptyCount: this.consecutiveEmptyCount,
      chunkCount: this.chunkCount,
      totalAudioSeconds: parseFloat((this.totalBytes / 2 / 16000).toFixed(1)),
      msSinceLastSuccessfulTranscript: this.lastSuccessfulTranscriptAt > 0 
        ? Date.now() - this.lastSuccessfulTranscriptAt : -1,
      msSinceSuppressionEnded: this.suppressionEndedAt > 0 
        ? Date.now() - this.suppressionEndedAt : -1,
      inSilenceLoop: this.consecutiveEmptyCount >= 5,
    };
  }
  
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
    if (this.emptySpeechFinalTimeout) {
      clearTimeout(this.emptySpeechFinalTimeout);
      this.emptySpeechFinalTimeout = null;
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
