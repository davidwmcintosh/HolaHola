/**
 * Streaming Voice Orchestrator
 * 
 * The central coordinator for streaming voice mode:
 * User audio → Deepgram STT → Gemini streaming → Sentence chunks → Cartesia TTS → Audio stream
 * 
 * Target: < 1 second time to first audio byte (vs 5-7s synchronous mode)
 */

import { createClient } from "@deepgram/sdk";
import { transcribeWithLiveAPI, getDeepgramLanguageCode } from "./deepgram-live-stt";
import { getGeminiStreamingService, SentenceChunk } from "./gemini-streaming";
import { getCartesiaStreamingService } from "./cartesia-streaming";
import { WebSocket as WS } from "ws";
import {
  StreamingMessage,
  StreamingConnectedMessage,
  StreamingProcessingMessage,
  StreamingSentenceStartMessage,
  StreamingAudioChunkMessage,
  StreamingWordTimingMessage,
  StreamingWordTimingDeltaMessage,
  StreamingWordTimingFinalMessage,
  StreamingSentenceEndMessage,
  StreamingResponseCompleteMessage,
  StreamingFeedbackMessage,
  StreamingErrorMessage,
  StreamingErrorCode,
  ClientStartSessionMessage,
  WordTiming,
  LATENCY_TARGETS,
  STREAMING_FEATURE_FLAGS,
} from "@shared/streaming-voice-types";

/**
 * Lightweight metrics logger for performance monitoring
 * Uses structured JSON format for easy parsing by log aggregators
 * Non-blocking: just console.log, no DB writes or network calls
 */
function logMetric(type: string, data: Record<string, number | string | boolean>) {
  console.log(`[METRICS] ${JSON.stringify({ type, ...data, ts: Date.now() })}`);
}
import { constrainEmotion, TutorPersonality, CartesiaEmotion } from "./tts-service";
import { extractTargetLanguageText, extractTargetLanguageWithMapping, hasSignificantTargetLanguageContent } from "../text-utils";
import { storage } from "../storage";
import { validateOneUnitRule, UnitValidationResult } from "../phrase-detection";
import { GoogleGenAI } from "@google/genai";
import { assessAdvancementReadiness, formatLevel } from "../actfl-advancement";
import { tagConversation } from "./conversation-tagger";

/**
 * Clean text for display by removing markdown, emotion tags, and other formatting
 * that should not appear in subtitles
 */
function cleanTextForDisplay(text: string): string {
  // First check if the entire text is just JSON emotion data (AI sometimes outputs this at end)
  // Match patterns like: { "emotion": "happy" } or { emotion: "happy" }
  const jsonEmotionPattern = /^\s*\{\s*"?emotion"?\s*:\s*"?\w+"?\s*\}\s*$/i;
  if (jsonEmotionPattern.test(text.trim())) {
    return ''; // Return empty to skip this sentence entirely
  }
  
  let cleaned = text
    // Remove markdown bold/italic markers
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/##/g, '')
    .replace(/#/g, '')
    // Remove empty quote pairs that Gemini sometimes outputs at sentence starts
    .replace(/^["'"']+\s*/g, '')  // Leading quotes
    .replace(/\s*["'"']+$/g, '')  // Trailing quotes
    .replace(/["'"']{2,}/g, '')   // Multiple consecutive quotes (empty pairs)
    // Remove stray quotes that aren't part of meaningful text
    // Be careful not to remove apostrophes in contractions like "it's" or "you're"
    .replace(/"\s+/g, ' ')  // Quote followed by space → just space
    .replace(/\s+"/g, ' ')  // Space followed by quote → just space
    // Remove emotion tags like (friendly), (curious), (excited), etc at start/end
    .replace(/^\s*\([^)]+\)\s*/g, '')
    .replace(/\s*\([^)]+\)\s*$/g, '')
    // Also remove mid-text emotion tags
    .replace(/\s*\((?:friendly|curious|excited|calm|warm|energetic|professional|happy|sad|surprised|thoughtful|encouraging|patient)\)\s*/gi, ' ')
    // Remove [laughter] tags for display
    .replace(/\[laughter\]/gi, '')
    // Remove [bracket] emotion/action tags like [happy], [excited]
    .replace(/\[(?:friendly|curious|excited|calm|warm|energetic|professional|happy|sad|surprised|thoughtful|encouraging|patient)\]/gi, '')
    // Remove BARE emotion words at start of text (AI sometimes outputs "happy\n" or "friendly**text**")
    // Must be at the very start, optionally followed by punctuation, whitespace/newline, or ** (markdown)
    // Handles: "friendly\n", "friendly ", "friendly**Excelente**", "happyHola", "Happy! That was..."
    .replace(/^(?:friendly|curious|excited|calm|warm|energetic|professional|happy|sad|surprised|thoughtful|encouraging|patient)[!.,;:?]*(?:[\s\n\r]+|\*\*)?/gi, '');
  
  // Remove ALL parenthetical content (English translations like (Hello!), (Excellent!), (Perfect!))
  // These are distracting and redundant - the user heard the Spanish and doesn't need English in subtitles
  let prevCleaned = '';
  while (cleaned !== prevCleaned) {
    prevCleaned = cleaned;
    cleaned = cleaned.replace(/\s*\([^()]*\)\s*/g, ' ');
  }
  
  // Normalize whitespace and clean up residual punctuation
  return cleaned
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[,.\s]+|[,.\s]+$/g, '')  // Trim leading/trailing commas, periods, spaces
    .trim();
}

/**
 * Idle timeout configuration - protects tutor resources
 * When student doesn't respond within timeout, session resources are cleaned up
 */
const SESSION_IDLE_TIMEOUT_MS = 120000; // 2 minutes of inactivity before cleanup

/**
 * Voice speed options for speaking rate control
 * Maps to numeric speaking rates for TTS
 */
export type VoiceSpeedOption = 'slower' | 'slow' | 'normal' | 'fast' | 'faster';

/**
 * Convert voice speed string to numeric speaking rate
 * These values map to Cartesia's 0.6-1.5 range
 * UI labels: 0.6x, 0.8x, 1x, 1.25x, 1.5x
 */
export function voiceSpeedToRate(speed: VoiceSpeedOption | undefined): number {
  switch (speed) {
    case 'slower': return 0.6;   // 0.6x - slowest for pronunciation practice
    case 'slow': return 0.8;     // 0.8x - slightly slower for beginners
    case 'normal': return 1.0;   // 1x - natural conversation speed
    case 'fast': return 1.25;    // 1.25x - faster for advanced learners
    case 'faster': return 1.5;   // 1.5x - fastest available
    default: return 1.0;
  }
}

/**
 * Session state for a streaming voice connection
 */
export interface StreamingSession {
  id: string;
  userId: number;
  conversationId: string;  // UUID string
  targetLanguage: string;
  nativeLanguage: string;
  difficultyLevel: string;
  subtitleMode: 'off' | 'target' | 'all';
  tutorPersonality: TutorPersonality;
  tutorExpressiveness: number;
  voiceSpeed: VoiceSpeedOption;
  voiceId?: string;
  systemPrompt: string;
  conversationHistory: Array<{ role: 'user' | 'model'; content: string }>;
  ws: WS;
  startTime: number;
  isActive: boolean;
  idleTimeoutId?: NodeJS.Timeout;  // Timer for idle cleanup
  lastActivityTime: number;         // Timestamp of last student activity
  currentTurnId: number;            // Monotonic counter for subtitle packet ordering (prevents phantom subtitles)
  warmupPromise?: Promise<void>;    // Gemini + Cartesia warmup promise to await before greeting
}

/**
 * Metrics for tracking streaming performance
 */
export interface StreamingMetrics {
  sessionId: string;
  sttLatencyMs: number;
  aiFirstTokenMs: number;
  ttsFirstByteMs: number;
  totalLatencyMs: number;
  sentenceCount: number;
  audioBytes: number;
  userTranscript?: string;
  aiResponse?: string;
}

/**
 * Deepgram client (STT)
 */
const deepgram = createClient(process.env.DEEPGRAM_API_KEY || '');

/**
 * Gemini client for vocabulary extraction (using Replit AI integrations)
 * IMPORTANT: Must include apiVersion: "" and baseUrl for Replit's AI proxy to work correctly
 */
const gemini = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '',
  httpOptions: {
    apiVersion: "",  // Required: removes /v1beta path prefix for Replit proxy
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL || '',
  }
});

/**
 * Content moderation: Check for severely inappropriate content
 * Only blocks truly explicit content - mild issues are handled by the AI tutor naturally
 * Uses word boundary matching to avoid false positives (e.g., "hello" matching "hell")
 */
const SEVERE_INAPPROPRIATE_TERMS = [
  'fuck', 'shit', 'bitch', 'slur', 'n-word', 'faggot',
];

function containsSeverelyInappropriateContent(text: string): boolean {
  const lowerText = text.toLowerCase();
  return SEVERE_INAPPROPRIATE_TERMS.some(term => {
    const regex = new RegExp(`\\b${term}\\b`, 'i');
    return regex.test(lowerText);
  });
}

/**
 * Check for mildly inappropriate content that the tutor should gently redirect
 * These are passed to the AI with a note to redirect gracefully
 */
const MILD_INAPPROPRIATE_TERMS = [
  'damn', 'hell', 'crap', 'ass', 'hate', 'kill', 'murder',
  'offensive', 'curse', 'swear', 'violent',
];

function containsMildlyInappropriateContent(text: string): boolean {
  const lowerText = text.toLowerCase();
  return MILD_INAPPROPRIATE_TERMS.some(term => {
    const regex = new RegExp(`\\b${term}\\b`, 'i');
    return regex.test(lowerText);
  });
}

/**
 * Schema for vocabulary extraction using Gemini structured output
 * Includes grammar classification for enhanced flashcard filtering
 */
const VOCABULARY_EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    vocabulary: {
      type: "array",
      description: "New vocabulary words introduced in this response (max 3 per exchange)",
      items: {
        type: "object",
        properties: {
          word: { type: "string", description: "The foreign language word/phrase" },
          translation: { type: "string", description: "English translation" },
          example: { type: "string", description: "Example sentence using the word" },
          pronunciation: { type: "string", description: "Phonetic pronunciation guide" },
          wordType: { 
            type: "string", 
            enum: ["noun", "verb", "adjective", "adverb", "preposition", "conjunction", "pronoun", "article", "other"],
            description: "Grammatical category of the word" 
          },
          verbTense: { type: "string", description: "For verbs: present, past_preterite, past_imperfect, future, conditional" },
          verbMood: { type: "string", description: "For verbs: indicative, subjunctive, imperative" },
          verbPerson: { type: "string", description: "For verbs: 1st_singular, 2nd_singular, 3rd_singular, 1st_plural, 2nd_plural, 3rd_plural" },
          nounGender: { type: "string", description: "For nouns: masculine, feminine, neuter" },
          nounNumber: { type: "string", description: "For nouns: singular, plural" },
          grammarNotes: { type: "string", description: "Additional notes: irregular, reflexive, stem-changing, etc." }
        },
        required: ["word", "translation", "example", "pronunciation", "wordType"]
      }
    }
  },
  required: ["vocabulary"]
};

/**
 * Streaming Voice Orchestrator
 * Manages the full pipeline from user audio to AI audio response
 */
export class StreamingVoiceOrchestrator {
  private sessions: Map<string, StreamingSession> = new Map();
  private geminiService = getGeminiStreamingService();
  private cartesiaService = getCartesiaStreamingService();
  
  constructor() {
    console.log('[Streaming Orchestrator] Initialized');
  }
  
  /**
   * Create a new streaming session
   * Connection pooling: Pre-warms Cartesia WebSocket for low-latency TTS
   * 
   * NOTE: Full conversation history is preserved to support "Tutor knows all" philosophy
   * Gemini's 1M context window handles large histories efficiently
   */
  async createSession(
    ws: WS,
    userId: number,
    config: ClientStartSessionMessage,
    systemPrompt: string,
    conversationHistory: Array<{ role: 'user' | 'model'; content: string }>,
    voiceId?: string
  ): Promise<StreamingSession> {
    const sessionId = `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const session: StreamingSession = {
      id: sessionId,
      userId,
      conversationId: config.conversationId,
      targetLanguage: config.targetLanguage,
      nativeLanguage: config.nativeLanguage,
      difficultyLevel: config.difficultyLevel,
      subtitleMode: config.subtitleMode,
      tutorPersonality: (config.tutorPersonality as TutorPersonality) || 'warm',
      tutorExpressiveness: config.tutorExpressiveness || 3,
      voiceSpeed: (config.voiceSpeed as VoiceSpeedOption) || 'normal',
      voiceId,
      systemPrompt,
      conversationHistory,
      ws,
      startTime: Date.now(),
      isActive: true,
      lastActivityTime: Date.now(),
      currentTurnId: 0,  // Start at 0, incremented on each new response
    };
    
    // PARALLEL WARMUP: Pre-warm both Cartesia and Gemini connections concurrently
    // - Cartesia: Eliminates WebSocket handshake latency (~150-200ms)
    // - Gemini: Eliminates cold-start penalty (~3-4 seconds on first request)
    // Store promise so greeting can await completion (guarantees warmup before first AI call)
    const warmupStart = Date.now();
    let cartesiaWarmupMs = 0;
    let geminiWarmupMs = 0;
    session.warmupPromise = Promise.all([
      this.cartesiaService.ensureConnection()
        .then(time => {
          cartesiaWarmupMs = time;
          console.log(`[Streaming Orchestrator] Cartesia pre-warmed: ${time}ms`);
        })
        .catch((err: Error) => console.warn(`[Streaming Orchestrator] Cartesia warmup failed: ${err.message}`)),
      this.geminiService.warmup()
        .then(time => {
          geminiWarmupMs = time;
          console.log(`[Streaming Orchestrator] Gemini pre-warmed: ${time}ms`);
        })
        .catch((err: Error) => console.warn(`[Streaming Orchestrator] Gemini warmup failed: ${err.message}`)),
    ]).then(() => {
      const totalWarmup = Date.now() - warmupStart;
      logMetric('warmup', { 
        sessionId, 
        cartesiaMs: cartesiaWarmupMs, 
        geminiMs: geminiWarmupMs, 
        totalMs: totalWarmup 
      });
    });
    
    this.sessions.set(sessionId, session);
    
    // Send connected message
    this.sendMessage(ws, {
      type: 'connected',
      timestamp: Date.now(),
      sessionId,
    } as StreamingConnectedMessage);
    
    console.log(`[Streaming Orchestrator] Session created: ${sessionId}`);
    return session;
  }
  
  /**
   * Process user audio and stream AI response
   */
  async processUserAudio(
    sessionId: string,
    audioData: Buffer,
    audioFormat: string = 'webm'
  ): Promise<StreamingMetrics> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isActive) {
      throw new Error(`Session not found or inactive: ${sessionId}`);
    }
    
    // Student activity detected - reset idle timeout
    this.resetIdleTimeout(session);
    
    const startTime = Date.now();
    const metrics: StreamingMetrics = {
      sessionId,
      sttLatencyMs: 0,
      aiFirstTokenMs: 0,
      ttsFirstByteMs: 0,
      totalLatencyMs: 0,
      sentenceCount: 0,
      audioBytes: 0,
    };
    
    try {
      // PARALLEL PROCESSING: Run STT and Cartesia warmup concurrently
      // This overlaps the ~200ms WebSocket handshake with STT processing
      console.log(`[Streaming Orchestrator] Processing ${audioData.length} bytes of audio`);
      
      const sttStart = Date.now();
      
      // Start both operations in parallel
      const [transcriptionResult, cartesiaWarmupTime] = await Promise.all([
        // STT: Transcribe user audio with Deepgram (returns transcript + confidence)
        this.transcribeAudio(audioData, session.targetLanguage),
        // Connection warmup: Ensure Cartesia WebSocket is ready (no-op if already connected)
        this.cartesiaService.ensureConnection().catch((err: Error) => {
          console.warn(`[Streaming Orchestrator] Cartesia warmup failed: ${err.message}`);
          return -1; // Return -1 to indicate failure (will fallback to bytes API)
        }),
      ]);
      
      // Extract transcript and pronunciation confidence (per-session, no race conditions)
      const { transcript, confidence: pronunciationConfidence } = transcriptionResult;
      
      metrics.sttLatencyMs = Date.now() - sttStart;
      
      console.log(`[Streaming Orchestrator] STT: "${transcript}" (${metrics.sttLatencyMs}ms, conf: ${(pronunciationConfidence * 100).toFixed(0)}%, Cartesia: ${cartesiaWarmupTime >= 0 ? cartesiaWarmupTime + 'ms' : 'fallback'})`);
      
      if (!transcript.trim()) {
        // Empty transcript - gracefully notify client and return
        console.log('[Streaming Orchestrator] Empty transcript - audio too short or unclear');
        this.sendMessage(session.ws, {
          type: 'error',
          timestamp: Date.now(),
          code: 'EMPTY_TRANSCRIPT',
          message: 'Could not understand audio. Please try speaking again.',
          recoverable: true,
        });
        return metrics;
      }
      
      // CONTENT MODERATION: Check for severely inappropriate content (block only the worst)
      if (containsSeverelyInappropriateContent(transcript)) {
        console.log('[Streaming Orchestrator] Content moderation: Severely inappropriate content blocked');
        this.sendMessage(session.ws, {
          type: 'error',
          timestamp: Date.now(),
          code: 'CONTENT_REJECTED',
          message: 'Let\'s keep our conversation focused on language learning!',
          recoverable: true,
        });
        return metrics;
      }
      
      // For mildly inappropriate content, let the AI tutor handle it naturally
      // The tutor will gently redirect without breaking the conversation flow
      let contentRedirectNote = '';
      if (containsMildlyInappropriateContent(transcript)) {
        console.log('[Streaming Orchestrator] Content moderation: Mild content - tutor will redirect');
        contentRedirectNote = ' (Note: Gently redirect this conversation back to language learning without being preachy.)';
      }
      
      // ONE-WORD RULE: Validate user input for beginners
      // Non-blocking - we still process the request but provide feedback
      const oneWordValidation = validateOneUnitRule(transcript, session.targetLanguage, session.difficultyLevel);
      if (!oneWordValidation.isValid) {
        console.log(`[Streaming Orchestrator] One-word rule: ${oneWordValidation.message}`);
        // Send feedback to client about one-word rule (non-blocking - still process)
        this.sendMessage(session.ws, {
          type: 'feedback',
          timestamp: Date.now(),
          feedbackType: 'one_word_rule',
          message: oneWordValidation.message || 'Try practicing one word or phrase at a time for better learning!',
        } as StreamingFeedbackMessage);
      } else if (oneWordValidation.matchedPhrase) {
        console.log(`[Streaming Orchestrator] Matched phrase unit: "${oneWordValidation.matchedPhrase}"`);
      }
      
      // NEW TURN: Increment turnId for this response (for subtitle packet ordering)
      session.currentTurnId++;
      const turnId = session.currentTurnId;
      
      // Notify client that processing has started
      this.sendMessage(session.ws, {
        type: 'processing',
        timestamp: Date.now(),
        turnId,
        userTranscript: transcript,
      } as StreamingProcessingMessage);
      
      // Step 2: Stream AI response with sentence chunking
      const aiStart = Date.now();
      let firstTokenReceived = false;
      let fullText = '';
      let currentSentenceIndex = 0;
      
      // DEDUPLICATION GUARD: Track seen sentences to prevent LLM repetition loops
      const seenSentences = new Set<string>();
      const MAX_SENTENCES = 5; // Hard limit to prevent runaway responses
      let actualSentenceCount = 0;
      
      // Process sentences as they arrive from Gemini
      // Include redirect note if mild content was detected
      const userMessageWithNote = transcript + contentRedirectNote;
      
      await this.geminiService.streamWithSentenceChunking({
        systemPrompt: session.systemPrompt,
        conversationHistory: session.conversationHistory,
        userMessage: userMessageWithNote,
        onSentence: async (chunk: SentenceChunk) => {
          if (!firstTokenReceived) {
            metrics.aiFirstTokenMs = Date.now() - aiStart;
            firstTokenReceived = true;
            console.log(`[Streaming Orchestrator] AI first token: ${metrics.aiFirstTokenMs}ms`);
          }
          
          // Clean text for display (remove markdown, emotion tags)
          const displayText = cleanTextForDisplay(chunk.text);
          
          // Skip empty sentences after cleaning
          if (!displayText) {
            console.log(`[Streaming Orchestrator] Skipping empty sentence ${chunk.index} after cleaning`);
            return;
          }
          
          // DEDUPLICATION: Skip if we've already seen this sentence (LLM repetition loop)
          const normalizedText = displayText.toLowerCase().trim();
          if (seenSentences.has(normalizedText)) {
            console.log(`[Streaming Orchestrator] DEDUP: Skipping duplicate sentence ${chunk.index}: "${displayText.substring(0, 40)}..."`);
            return;
          }
          seenSentences.add(normalizedText);
          
          // MAX SENTENCE LIMIT: Prevent runaway responses
          if (actualSentenceCount >= MAX_SENTENCES) {
            console.log(`[Streaming Orchestrator] MAX LIMIT: Skipping sentence ${chunk.index} (already have ${actualSentenceCount})`);
            return;
          }
          actualSentenceCount++;
          
          // AI CONTENT MODERATION: Check AI response before sending to client/TTS
          // Only block severely inappropriate AI responses (rare edge case)
          if (containsSeverelyInappropriateContent(displayText)) {
            console.log(`[Streaming Orchestrator] AI response moderation: Skipping sentence ${chunk.index}`);
            return; // Skip this sentence entirely
          }
          
          // Extract target language with word mapping (needs raw text with bold markers)
          // This provides both targetLanguageText AND a mapping for karaoke highlighting
          const extraction = extractTargetLanguageWithMapping(displayText, chunk.text);
          
          // DEBUG: Trace extraction
          if (extraction.targetText) {
            console.log(`[TargetExtraction] Raw: "${chunk.text.substring(0, 80)}..."`);
            console.log(`[TargetExtraction] Display: "${displayText.substring(0, 80)}..."`);
            console.log(`[TargetExtraction] Target: "${extraction.targetText}"`);
          }
          
          // Convert Map to array of tuples for JSON serialization
          const wordMappingArray: [number, number][] = extraction.wordMapping.size > 0
            ? Array.from(extraction.wordMapping.entries())
            : [];
          
          // NEW ARCHITECTURE (v2): Explicit hasTargetContent flag eliminates phantom subtitles
          // Client will hide subtitles immediately when hasTargetContent is false (no fallback needed)
          const hasTargetContent = !!(extraction.targetText && extraction.targetText.trim().length > 0);
          
          // Notify client of new sentence with cleaned text and word mapping
          this.sendMessage(session.ws, {
            type: 'sentence_start',
            timestamp: Date.now(),
            turnId,
            sentenceIndex: chunk.index,
            text: displayText,
            hasTargetContent,
            targetLanguageText: hasTargetContent ? extraction.targetText : undefined,
            wordMapping: hasTargetContent && wordMappingArray.length > 0 ? wordMappingArray : undefined,
          } as StreamingSentenceStartMessage);
          
          // Synthesize and stream audio for this sentence (pass cleaned text for timing)
          const ttsStart = Date.now();
          
          // Use progressive streaming if feature flag enabled (lower latency)
          if (STREAMING_FEATURE_FLAGS.PROGRESSIVE_AUDIO_STREAMING) {
            await this.streamSentenceAudioProgressive(session, chunk, displayText, metrics, turnId);
          } else {
            await this.streamSentenceAudio(session, chunk, displayText, metrics, turnId);
          }
          
          if (chunk.index === 0) {
            metrics.ttsFirstByteMs = Date.now() - ttsStart;
          }
          
          // Use cleaned displayText for persistence (no emotion tags, no markdown)
          fullText += displayText + ' ';
          currentSentenceIndex = chunk.index;
          metrics.sentenceCount++;
        },
        onProgress: (partialText, totalChars) => {
          // Could use this for live typing indicator
        },
        onError: (error) => {
          console.error(`[Streaming Orchestrator] AI error:`, error.message);
          this.sendError(session.ws, 'AI_FAILED', error.message, true);
        },
      });
      
      // Update conversation history
      session.conversationHistory.push({ role: 'user', content: transcript });
      session.conversationHistory.push({ role: 'model', content: fullText.trim() });
      
      // Store transcript and response in metrics for message saving
      metrics.userTranscript = transcript;
      metrics.aiResponse = fullText.trim();
      
      // Send completion message
      metrics.totalLatencyMs = Date.now() - startTime;
      
      this.sendMessage(session.ws, {
        type: 'response_complete',
        timestamp: Date.now(),
        turnId,
        totalSentences: metrics.sentenceCount,
        totalDurationMs: metrics.totalLatencyMs,
        fullText: fullText.trim(),
      } as StreamingResponseCompleteMessage);
      
      console.log(`[Streaming Orchestrator] Complete: ${metrics.sentenceCount} sentences in ${metrics.totalLatencyMs}ms (turnId: ${turnId})`);
      console.log(`[Streaming Orchestrator] Latencies: STT=${metrics.sttLatencyMs}ms, AI=${metrics.aiFirstTokenMs}ms, TTS=${metrics.ttsFirstByteMs}ms`);
      
      // Log structured metrics for monitoring (non-blocking, just console.log)
      const timeToFirstAudio = metrics.sttLatencyMs + metrics.aiFirstTokenMs + metrics.ttsFirstByteMs;
      logMetric('chat_response', {
        sessionId: session.id,
        sttMs: metrics.sttLatencyMs,
        aiFirstTokenMs: metrics.aiFirstTokenMs,
        ttsFirstByteMs: metrics.ttsFirstByteMs,
        timeToFirstAudioMs: timeToFirstAudio,
        totalMs: metrics.totalLatencyMs,
        sentences: metrics.sentenceCount,
        targetMet: timeToFirstAudio <= 3000,
      });
      
      // Start idle timeout - tutor waiting for student response
      this.startIdleTimeout(session);
      
      // Persist messages to database (non-blocking)
      // Also triggers background vocabulary extraction, progress updates, and ACTFL tracking
      // Pass the per-session pronunciationConfidence (captured above, no race conditions)
      this.persistMessages(session.conversationId, transcript, fullText.trim(), session, pronunciationConfidence).catch((err: Error) => {
        console.error('[Streaming Orchestrator] Failed to persist messages:', err.message);
      });
      
      return metrics;
      
    } catch (error: any) {
      console.error(`[Streaming Orchestrator] Error:`, error.message);
      this.sendError(session.ws, 'UNKNOWN', error.message, true);
      throw error;
    }
  }
  
  /**
   * Transcribe audio using PARALLEL Deepgram APIs (Live + Prerecorded)
   * 
   * PARALLEL STT STRATEGY: Run both APIs simultaneously, use first valid result
   * This reduces latency by ~1-1.5 seconds compared to sequential fallback
   * 
   * Core values alignment:
   * - <2 sec response: Parallel race gets fastest result
   * - Word timestamps: Enabled for karaoke highlighting
   * - Reliability: Two chances to get valid transcript
   * 
   * Returns transcript AND confidence for ACTFL tracking (no shared state)
   */
  private async transcribeAudio(audioData: Buffer, targetLanguage: string): Promise<{ transcript: string; confidence: number }> {
    const languageCode = getDeepgramLanguageCode(targetLanguage);
    console.log(`[Deepgram Parallel] Transcribing ${audioData.length} bytes, language: ${languageCode}`);
    
    // Log header to verify WebM format (0x1A 0x45 0xDF 0xA3)
    const header = audioData.slice(0, 16);
    console.log(`[Deepgram Parallel] Audio header: ${header.toString('hex')}`);
    
    // PARALLEL RACE: Start both APIs simultaneously
    const livePromise = this.transcribeWithLive(audioData, languageCode);
    const prerecordedPromise = this.transcribeWithPrerecorded(audioData, languageCode);
    
    // Race for first VALID result (non-empty transcript)
    // We use a custom race that waits for valid results, not just first completion
    const result = await this.raceForValidTranscript(livePromise, prerecordedPromise);
    
    if (!result.transcript) {
      console.log('[Deepgram Parallel] Both APIs returned empty transcripts');
    }
    
    return result;
  }
  
  /**
   * Race two STT promises for the first VALID (non-empty) result
   * Uses true racing - returns IMMEDIATELY when first valid result arrives
   * If first result is empty, waits for second. If both empty, returns empty.
   */
  private async raceForValidTranscript(
    livePromise: Promise<{ transcript: string; confidence: number; source: string }>,
    prerecordedPromise: Promise<{ transcript: string; confidence: number; source: string }>
  ): Promise<{ transcript: string; confidence: number }> {
    
    // Wrap promises to handle errors gracefully and track completion
    const safeLive = livePromise.catch(err => {
      console.error('[Deepgram Live] Error:', err.message);
      return { transcript: '', confidence: 0, source: 'live-error' };
    });
    
    const safePrerecorded = prerecordedPromise.catch(err => {
      console.error('[Deepgram Prerecorded] Error:', err.message);
      return { transcript: '', confidence: 0, source: 'prerecorded-error' };
    });
    
    // TRUE RACE: Return first valid result immediately
    // Create a promise that resolves when first VALID result arrives
    return new Promise(async (resolve) => {
      let firstResult: { transcript: string; confidence: number; source: string } | null = null;
      let secondResult: { transcript: string; confidence: number; source: string } | null = null;
      let resolved = false;
      
      const handleResult = (result: { transcript: string; confidence: number; source: string }) => {
        if (resolved) return;
        
        if (!firstResult) {
          firstResult = result;
          console.log(`[Deepgram Parallel] First result (${result.source}): "${result.transcript}" (${(result.confidence * 100).toFixed(0)}%)`);
          
          // If first result has valid transcript, return immediately!
          if (result.transcript) {
            resolved = true;
            console.log(`[Deepgram Parallel] Winner: ${result.source} (first valid result)`);
            resolve({ transcript: result.transcript, confidence: result.confidence });
          }
          // If empty, wait for second result
        } else {
          secondResult = result;
          console.log(`[Deepgram Parallel] Second result (${result.source}): "${result.transcript}" (${(result.confidence * 100).toFixed(0)}%)`);
          
          // First was empty, check if second is valid
          if (result.transcript) {
            resolved = true;
            console.log(`[Deepgram Parallel] Winner: ${result.source} (second result, first was empty)`);
            resolve({ transcript: result.transcript, confidence: result.confidence });
          } else {
            // Both empty
            resolved = true;
            console.log(`[Deepgram Parallel] Both results empty`);
            resolve({ transcript: '', confidence: 0 });
          }
        }
      };
      
      // Race both promises
      safeLive.then(handleResult);
      safePrerecorded.then(handleResult);
    });
  }
  
  /**
   * Transcribe with Live Streaming API
   */
  private async transcribeWithLive(audioData: Buffer, languageCode: string): Promise<{ transcript: string; confidence: number; source: string }> {
    const startTime = Date.now();
    
    const result = await transcribeWithLiveAPI(audioData, {
      language: languageCode,
      model: 'nova-2',
    });
    
    const durationMs = Date.now() - startTime;
    console.log(`[Deepgram Live] Result: "${result.transcript}" (${(result.confidence * 100).toFixed(0)}%, ${durationMs}ms)`);
    
    return {
      transcript: result.transcript,
      confidence: result.confidence,
      source: 'live',
    };
  }
  
  /**
   * Transcribe with Prerecorded API
   */
  private async transcribeWithPrerecorded(audioData: Buffer, languageCode: string): Promise<{ transcript: string; confidence: number; source: string }> {
    const startTime = Date.now();
    
    const response = await deepgram.listen.prerecorded.transcribeFile(
      audioData,
      {
        model: 'nova-2',
        language: languageCode,
        smart_format: true,
        punctuate: true,
        mimetype: 'audio/webm',
      }
    );
    
    const alternative = response.result?.results?.channels?.[0]?.alternatives?.[0];
    const transcript = alternative?.transcript || '';
    const confidence = alternative?.confidence || 0;
    
    const durationMs = Date.now() - startTime;
    console.log(`[Deepgram Prerecorded] Result: "${transcript}" (${(confidence * 100).toFixed(0)}%, ${durationMs}ms)`);
    
    return { transcript, confidence, source: 'prerecorded' };
  }
  
  /**
   * Stream audio for a single sentence
   * Collects all audio chunks to form a complete MP3 file before sending
   * (MP3 fragments are not individually playable)
   * @param session - Current streaming session
   * @param chunk - The sentence chunk from Gemini
   * @param displayText - Cleaned text for display/timing (without markdown/emotion tags)
   * @param metrics - Metrics to update
   * @param turnId - Turn ID for packet ordering (prevents phantom subtitles)
   */
  private async streamSentenceAudio(
    session: StreamingSession,
    chunk: SentenceChunk,
    displayText: string,
    metrics: StreamingMetrics,
    turnId?: number
  ): Promise<void> {
    const { text: originalText, index } = chunk;
    
    // Determine emotion based on original text (which may have emotion tags)
    const emotion = this.selectEmotionForContext(originalText, session);
    
    let totalDurationMs = 0;
    const audioChunks: Buffer[] = [];
    let audioFormat: 'mp3' | 'pcm_f32le' = 'mp3';  // Track format from first chunk
    let sampleRate: number = 24000;
    
    try {
      // Collect all audio chunks from Cartesia (MP3 fragments need concatenation)
      // IMPORTANT: Use displayText (cleaned) for TTS, not originalText (which may have emotion tags)
      for await (const audioChunk of this.cartesiaService.streamSynthesize({
        text: displayText,
        language: session.targetLanguage,
        targetLanguage: session.targetLanguage, // For phoneme pronunciation
        voiceId: session.voiceId,
        speakingRate: voiceSpeedToRate(session.voiceSpeed),
        emotion,
        personality: session.tutorPersonality,
        expressiveness: session.tutorExpressiveness,
      })) {
        if (audioChunk.audio.length > 0) {
          audioChunks.push(audioChunk.audio);
          metrics.audioBytes += audioChunk.audio.length;
          totalDurationMs += audioChunk.durationMs;
          
          // Track format from first chunk
          if (audioChunks.length === 1 && audioChunk.audioFormat) {
            audioFormat = audioChunk.audioFormat;
            sampleRate = audioChunk.sampleRate || 24000;
          }
        }
        
        if (audioChunk.isLast) {
          break;
        }
      }
      
      // Concatenate all chunks into complete audio buffer
      const completeAudio = Buffer.concat(audioChunks);
      const formatLabel = audioFormat === 'pcm_f32le' ? 'PCM' : 'MP3';
      console.log(`[Streaming] Sentence ${index}: ${completeAudio.length} bytes (${formatLabel}), ${Math.round(totalDurationMs)}ms`);
      
      // Use current turn ID if not explicitly passed
      const effectiveTurnId = turnId ?? session.currentTurnId;
      
      // Send word timings BEFORE audio so client has them ready when playback starts
      // Use native Cartesia timestamps if available (more accurate), otherwise estimate
      if (session.subtitleMode !== 'off') {
        // Consume native timestamps from Cartesia (clears after retrieval to prevent reuse)
        const nativeTimestamps = this.cartesiaService.consumeNativeTimestamps();
        let finalTimings: WordTiming[];
        
        if (nativeTimestamps.length > 0) {
          // Use native timestamps from Cartesia WebSocket API
          console.log(`[Streaming] Using ${nativeTimestamps.length} native Cartesia timestamps for sentence ${index}`);
          finalTimings = nativeTimestamps;
        } else {
          // Fall back to estimation (when WebSocket not connected or timestamps not returned)
          finalTimings = this.estimateWordTimings(displayText, totalDurationMs / 1000);
        }
        
        this.sendMessage(session.ws, {
          type: 'word_timing',
          timestamp: Date.now(),
          turnId: effectiveTurnId,
          sentenceIndex: index,
          words: finalTimings,
          timings: finalTimings,
          expectedDurationMs: totalDurationMs, // For client-side rescaling
        } as StreamingWordTimingMessage);
      }
      
      // Send the complete audio after word timings
      const audioBase64 = completeAudio.toString('base64');
      this.sendMessage(session.ws, {
        type: 'audio_chunk',
        timestamp: Date.now(),
        turnId: effectiveTurnId,
        sentenceIndex: index,
        chunkIndex: 0,
        isLast: true,
        durationMs: totalDurationMs,
        audio: audioBase64,
        audioFormat: audioFormat,  // 'mp3' or 'pcm_f32le'
        sampleRate: sampleRate,    // 24000 for PCM
      } as StreamingAudioChunkMessage);
      
      // Send sentence end
      this.sendMessage(session.ws, {
        type: 'sentence_end',
        timestamp: Date.now(),
        turnId: effectiveTurnId,
        sentenceIndex: index,
        totalDurationMs,
      } as StreamingSentenceEndMessage);
      
    } catch (error: any) {
      console.error(`[Streaming] TTS error for sentence ${index}:`, error.message);
      throw error;
    }
  }
  
  /**
   * PROGRESSIVE STREAMING: Stream audio for a single sentence with immediate forwarding
   * 
   * Unlike streamSentenceAudio (which buffers full sentence), this method forwards
   * audio chunks to the client as soon as they arrive from Cartesia.
   * 
   * Benefits:
   * - ~2s faster time-to-first-audio (no sentence buffering delay)
   * - More responsive feel for users
   * 
   * Trade-offs:
   * - Word timings arrive incrementally (delta messages + final reconciliation)
   * - Client needs to handle progressive audio assembly
   * 
   * @param session - Current streaming session
   * @param chunk - The sentence chunk from Gemini
   * @param displayText - Cleaned text for display/timing
   * @param metrics - Metrics to update
   * @param turnId - Turn ID for packet ordering
   */
  private async streamSentenceAudioProgressive(
    session: StreamingSession,
    chunk: SentenceChunk,
    displayText: string,
    metrics: StreamingMetrics,
    turnId?: number
  ): Promise<void> {
    const { text: originalText, index } = chunk;
    const emotion = this.selectEmotionForContext(originalText, session);
    const effectiveTurnId = turnId ?? session.currentTurnId;
    
    let chunkIndex = 0;
    let firstChunkSent = false;
    
    try {
      // Use progressive streaming API with real-time callbacks
      const result = await this.cartesiaService.streamSynthesizeProgressive(
        {
          text: displayText,
          language: session.targetLanguage,
          targetLanguage: session.targetLanguage,
          voiceId: session.voiceId,
          speakingRate: voiceSpeedToRate(session.voiceSpeed),
          emotion,
          personality: session.tutorPersonality,
          expressiveness: session.tutorExpressiveness,
        },
        {
          // Forward audio chunks immediately as they arrive from Cartesia
          onAudioChunk: (audioChunk, idx) => {
            if (!firstChunkSent) {
              firstChunkSent = true;
              console.log(`[Progressive] Sentence ${index}: First chunk forwarded`);
            }
            
            const audioBase64 = audioChunk.audio.toString('base64');
            this.sendMessage(session.ws, {
              type: 'audio_chunk',
              timestamp: Date.now(),
              turnId: effectiveTurnId,
              sentenceIndex: index,
              chunkIndex: idx,
              isLast: false, // Not last until final callback
              durationMs: audioChunk.durationMs,
              audio: audioBase64,
              audioFormat: audioChunk.audioFormat || 'pcm_f32le',
              sampleRate: audioChunk.sampleRate || 24000,
            } as StreamingAudioChunkMessage);
            
            metrics.audioBytes += audioChunk.audio.length;
            chunkIndex = idx + 1;
          },
          
          // Forward word timings incrementally (delta messages)
          onWordTimestamp: (timing, wordIdx, estimatedTotal) => {
            console.log(`[Progressive] Sending word_timing_delta: sentence=${index}, word=${wordIdx} "${timing.word}"`);
            if (session.subtitleMode !== 'off') {
              this.sendMessage(session.ws, {
                type: 'word_timing_delta',
                timestamp: Date.now(),
                turnId: effectiveTurnId,
                sentenceIndex: index,
                wordIndex: wordIdx,
                word: timing.word,
                startTime: timing.startTime,
                endTime: timing.endTime,
                estimatedTotalDuration: estimatedTotal,
              } as StreamingWordTimingDeltaMessage);
            } else {
              console.log(`[Progressive] Skipping delta (subtitleMode=${session.subtitleMode})`);
            }
          },
          
          // Final reconciliation when synthesis completes
          onComplete: (finalTimestamps, actualDurationMs) => {
            // Send final timing reconciliation
            if (session.subtitleMode !== 'off') {
              const timings = finalTimestamps.length > 0 
                ? finalTimestamps 
                : this.estimateWordTimings(displayText, actualDurationMs / 1000);
              
              this.sendMessage(session.ws, {
                type: 'word_timing_final',
                timestamp: Date.now(),
                turnId: effectiveTurnId,
                sentenceIndex: index,
                words: timings,
                actualDurationMs,
              } as StreamingWordTimingFinalMessage);
            }
            
            // Send final "empty" audio chunk to signal end
            this.sendMessage(session.ws, {
              type: 'audio_chunk',
              timestamp: Date.now(),
              turnId: effectiveTurnId,
              sentenceIndex: index,
              chunkIndex,
              isLast: true,
              durationMs: 0,
              audio: '', // Empty base64
              audioFormat: 'pcm_f32le',
              sampleRate: 24000,
            } as StreamingAudioChunkMessage);
            
            // Send sentence end
            this.sendMessage(session.ws, {
              type: 'sentence_end',
              timestamp: Date.now(),
              turnId: effectiveTurnId,
              sentenceIndex: index,
              totalDurationMs: actualDurationMs,
            } as StreamingSentenceEndMessage);
            
            console.log(`[Progressive] Sentence ${index}: Complete (${chunkIndex} chunks, ${actualDurationMs}ms)`);
          },
        }
      );
      
    } catch (error: any) {
      console.error(`[Progressive] TTS error for sentence ${index}:`, error.message);
      throw error;
    }
  }
  
  /**
   * Estimate word timings when not provided by TTS
   * Uses the original display text for word timings (phonemes are only added inside Cartesia)
   */
  private estimateWordTimings(text: string, durationSeconds: number): WordTiming[] {
    // Replace [laughter] tags with a space to preserve word count alignment
    // Phoneme tags are only added inside Cartesia, so `text` here is the clean display text
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
  
  /**
   * Select appropriate emotion for the sentence context
   */
  private selectEmotionForContext(text: string, session: StreamingSession): CartesiaEmotion {
    // Simple heuristic-based emotion selection
    const lowerText = text.toLowerCase();
    
    // Excited/enthusiastic patterns
    if (lowerText.includes('great!') || 
        lowerText.includes('excellent!') || 
        lowerText.includes('perfect!') ||
        lowerText.includes('wonderful!')) {
      return constrainEmotion('excited', session.tutorPersonality, session.tutorExpressiveness);
    }
    
    // Encouraging patterns
    if (lowerText.includes('good job') || 
        lowerText.includes('well done') ||
        lowerText.includes('keep going') ||
        lowerText.includes('you\'re doing')) {
      return constrainEmotion('encouraging', session.tutorPersonality, session.tutorExpressiveness);
    }
    
    // Curious/questioning patterns
    if (lowerText.includes('?') || 
        lowerText.includes('what do you') ||
        lowerText.includes('how about')) {
      return constrainEmotion('curious', session.tutorPersonality, session.tutorExpressiveness);
    }
    
    // Patient/calm patterns (for corrections)
    if (lowerText.includes('actually') || 
        lowerText.includes('let me explain') ||
        lowerText.includes('the correct')) {
      return constrainEmotion('patient', session.tutorPersonality, session.tutorExpressiveness);
    }
    
    // Default to friendly
    return constrainEmotion('friendly', session.tutorPersonality, session.tutorExpressiveness);
  }
  
  /**
   * Convert language name to ISO code for Deepgram
   */
  private getLanguageCode(language: string): string {
    const codes: Record<string, string> = {
      'english': 'en',
      'spanish': 'es',
      'french': 'fr',
      'german': 'de',
      'italian': 'it',
      'portuguese': 'pt',
      'japanese': 'ja',
      'mandarin chinese': 'zh',
      'korean': 'ko',
    };
    return codes[language.toLowerCase()] || 'en';
  }
  
  /**
   * Persist user and AI messages to database
   */
  private async persistMessages(
    conversationId: string, 
    userTranscript: string, 
    aiResponse: string,
    session: StreamingSession,
    pronunciationConfidence: number = 0
  ): Promise<void> {
    try {
      // Save user message
      await storage.createMessage({
        conversationId,
        role: 'user',
        content: userTranscript,
      });
      
      // Extract target language text for the AI response
      const targetLanguageText = extractTargetLanguageText(aiResponse);
      const hasTargetLanguage = hasSignificantTargetLanguageContent(targetLanguageText);
      
      // Save AI message with target language text if applicable
      const aiMessage = await storage.createMessage({
        conversationId,
        role: 'assistant',
        content: aiResponse,
        ...(hasTargetLanguage ? { targetLanguageText } : {}),
        enrichmentStatus: 'pending',
      });
      
      console.log(`[Streaming Orchestrator] Messages persisted to conversation: ${conversationId}`);
      
      // BACKGROUND ENRICHMENT: Extract vocabulary and update progress (non-blocking)
      setImmediate(async () => {
        try {
          await this.processBackgroundEnrichment(
            session, 
            conversationId, 
            aiMessage.id, 
            userTranscript,
            aiResponse,
            pronunciationConfidence
          );
        } catch (error: any) {
          console.error('[Streaming Enrichment] Failed:', error.message);
        }
      });
      
    } catch (error: any) {
      console.error('[Streaming Orchestrator] Database error:', error.message);
      throw error;
    }
  }
  
  /**
   * Background enrichment: Extract vocabulary, update user progress, and track ACTFL advancement
   * Runs non-blocking after message persistence
   */
  private async processBackgroundEnrichment(
    session: StreamingSession,
    conversationId: string,
    messageId: string,
    userTranscript: string,
    aiResponse: string,
    pronunciationConfidence: number = 0
  ): Promise<void> {
    const startTime = Date.now();
    console.log(`[Streaming Enrichment] Starting for message: ${messageId}`);
    
    try {
      // Update message status to processing
      await storage.updateMessage(messageId, { enrichmentStatus: 'processing' });
      
      // Get conversation for language/difficulty info
      const conversation = await storage.getConversation(conversationId, String(session.userId));
      if (!conversation) {
        console.error('[Streaming Enrichment] Conversation not found');
        await storage.updateMessage(messageId, { enrichmentStatus: 'failed' });
        return;
      }
      
      // VOCABULARY EXTRACTION: Use Gemini to extract new vocabulary from AI response
      let vocabularyItems: any[] = [];
      try {
        const extractionPrompt = `Extract vocabulary words from this language learning response. The student is learning ${session.targetLanguage} at ${session.difficultyLevel} level. Only extract foreign language words/phrases that were introduced in this response (max 3 items).

AI Response: "${aiResponse}"

Return vocabulary items with word, translation, example sentence, and pronunciation guide.`;

        const response = await gemini.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [{ role: 'user', parts: [{ text: extractionPrompt }] }],
          config: {
            responseMimeType: "application/json",
            responseSchema: VOCABULARY_EXTRACTION_SCHEMA as any,
          },
        });
        
        const responseText = response.text || "{}";
        const parsed = JSON.parse(responseText);
        vocabularyItems = Array.isArray(parsed.vocabulary) ? parsed.vocabulary : [];
        
        console.log(`[Streaming Enrichment] Extracted ${vocabularyItems.length} vocabulary items`);
      } catch (extractError: any) {
        console.error('[Streaming Enrichment] Vocabulary extraction failed:', extractError.message);
      }
      
      // Save vocabulary words to database with grammar classification
      if (vocabularyItems.length > 0) {
        for (const vocab of vocabularyItems) {
          try {
            await storage.createVocabularyWord({
              userId: String(session.userId),
              language: session.targetLanguage,
              word: vocab.word,
              translation: vocab.translation,
              example: vocab.example || '',
              pronunciation: vocab.pronunciation || '',
              difficulty: session.difficultyLevel,
              sourceConversationId: conversationId,
              wordType: vocab.wordType || 'other',
              verbTense: vocab.verbTense || null,
              verbMood: vocab.verbMood || null,
              verbPerson: vocab.verbPerson || null,
              nounGender: vocab.nounGender || null,
              nounNumber: vocab.nounNumber || null,
              grammarNotes: vocab.grammarNotes || null,
            });
          } catch (vocabError: any) {
            // Duplicate words are expected - silently continue
            if (!vocabError.message?.includes('duplicate')) {
              console.error('[Streaming Enrichment] Failed to save vocab:', vocabError.message);
            }
          }
        }
      }
      
      // UPDATE USER PROGRESS: Increment vocabulary count and update last practice
      try {
        const progress = await storage.getOrCreateUserProgress(session.targetLanguage, String(session.userId));
        if (progress) {
          // Increment words learned if we extracted vocabulary
          const wordsLearned = progress.wordsLearned || 0;
          await storage.updateUserProgress(progress.id, {
            wordsLearned: wordsLearned + vocabularyItems.length,
            lastPracticeDate: new Date(),
          });
        }
      } catch (progressError: any) {
        console.error('[Streaming Enrichment] Progress update failed:', progressError.message);
      }
      
      // ACTFL PROGRESS TRACKING: Record voice exchange and check for advancement
      try {
        // Count actual words in user's transcript (handle empty/whitespace properly)
        const trimmedTranscript = userTranscript.trim();
        const userWordCount = trimmedTranscript.length > 0 
          ? trimmedTranscript.split(/\s+/).filter(w => w.length > 0).length 
          : 0;
        
        // Skip ACTFL tracking if user said nothing meaningful
        if (userWordCount === 0) {
          console.log('[ACTFL Tracking] Skipping - empty user transcript');
        } else {
          // Detect communication tasks from user's speech (not AI output)
          // Tasks are based on WHAT the user did, not vocabulary the AI taught
          const detectedTasks: string[] = [];
          const lowerTranscript = trimmedTranscript.toLowerCase();
          
          // Detect basic ACTFL communication functions
          if (/\b(hello|hi|buenos?|hola|bonjour|guten tag)\b/i.test(lowerTranscript)) {
            detectedTasks.push('greeting');
          }
          if (/\?$/.test(trimmedTranscript) || /\b(what|how|why|where|when|who|qué|cómo|dónde)\b/i.test(lowerTranscript)) {
            detectedTasks.push('asking_question');
          }
          if (/\b(my name|me llamo|je m'appelle|ich heisse)\b/i.test(lowerTranscript)) {
            detectedTasks.push('self_introduction');
          }
          if (/\b(i like|i want|me gusta|j'aime|ich mag)\b/i.test(lowerTranscript)) {
            detectedTasks.push('expressing_preference');
          }
          if (/\b(thank|gracias|merci|danke)\b/i.test(lowerTranscript)) {
            detectedTasks.push('thanking');
          }
          
          // Record the voice exchange with ACTUAL metrics
          const actflProgress = await storage.recordVoiceExchange(
            String(session.userId),
            session.targetLanguage,
            {
              pronunciationConfidence: pronunciationConfidence > 0 ? pronunciationConfidence : undefined,
              messageLength: userWordCount,
              topicsCovered: session.difficultyLevel ? [`${session.difficultyLevel}_practice`] : undefined,
              tasksCompleted: detectedTasks.length > 0 ? detectedTasks : undefined,
            }
          );
          
          // Assess if user is ready for ACTFL advancement
          const assessment = assessAdvancementReadiness(actflProgress);
          
          // Only consider advancement if pronunciation confidence is reasonable (at least 60%)
          const hasMinimumAccuracy = (actflProgress.avgPronunciationConfidence || 0) >= 0.6;
          
          if (assessment.readyForAdvancement && assessment.nextLevel && hasMinimumAccuracy) {
            // User qualified for advancement! Send feedback message
            console.log(`[ACTFL Advancement] User ${session.userId} ready to advance from ${assessment.currentLevel} to ${assessment.nextLevel}`);
            
            // Send advancement notification to client
            this.sendMessage(session.ws, {
              type: 'feedback',
              timestamp: Date.now(),
              feedbackType: 'actfl_advancement',
              message: `Congratulations! You're ready to advance to ${formatLevel(assessment.nextLevel)}!`,
              severity: 'positive',
              details: {
                currentLevel: assessment.currentLevel,
                nextLevel: assessment.nextLevel,
                progress: assessment.progress,
                reason: assessment.reason,
              },
            } as StreamingFeedbackMessage);
            
            // Update user's ACTFL level
            await storage.updateActflProgress(actflProgress.id, {
              currentActflLevel: assessment.nextLevel,
              lastAdvancement: new Date(),
              advancementReason: assessment.reason,
              messagesAtCurrentLevel: 0, // Reset for new level
            });
          } else if (assessment.progress >= 80 && hasMinimumAccuracy) {
            // User is close to advancement - log progress (don't spam encouragement)
            console.log(`[ACTFL Advancement] User ${session.userId} at ${assessment.progress}% progress (accuracy: ${((actflProgress.avgPronunciationConfidence || 0) * 100).toFixed(0)}%)`);
          }
        }
      } catch (actflError: any) {
        console.error('[Streaming Enrichment] ACTFL tracking failed:', actflError.message);
      }
      
      // TOPIC TAGGING: Periodically analyze conversation for topic tags
      // Run every 5 messages to avoid excessive API calls
      try {
        if (conversation.messageCount % 5 === 0) {
          const conversationMessages = await storage.getMessagesByConversation(conversationId);
          const messageData = conversationMessages.map((m: { role: string; content: string }) => ({ role: m.role, content: m.content }));
          
          await tagConversation(conversationId, messageData, session.targetLanguage);
        }
      } catch (tagError: any) {
        console.error('[Streaming Enrichment] Topic tagging failed:', tagError.message);
      }
      
      // Mark enrichment as complete
      await storage.updateMessage(messageId, { enrichmentStatus: null });
      
      const elapsed = Date.now() - startTime;
      console.log(`[Streaming Enrichment] Completed in ${elapsed}ms (${vocabularyItems.length} vocab)`);
      
    } catch (error: any) {
      console.error('[Streaming Enrichment] Error:', error.message);
      await storage.updateMessage(messageId, { enrichmentStatus: 'failed' });
    }
  }
  
  /**
   * Send a JSON message over WebSocket
   */
  private sendMessage(ws: WS, message: StreamingMessage): void {
    if (ws.readyState === WS.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }
  
  /**
   * Send an error message
   */
  private sendError(ws: WS, code: StreamingErrorCode, message: string, recoverable: boolean): void {
    this.sendMessage(ws, {
      type: 'error',
      timestamp: Date.now(),
      code,
      message,
      recoverable,
    } as StreamingErrorMessage);
  }
  
  /**
   * Generate and stream a personalized AI greeting for a new conversation
   * Uses the full streaming pipeline (Gemini → Cartesia) for real-time delivery
   */
  async processGreetingRequest(
    sessionId: string,
    userName?: string,
    isResumed?: boolean
  ): Promise<StreamingMetrics> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isActive) {
      throw new Error(`Session not found or inactive: ${sessionId}`);
    }
    
    // CRITICAL: Await warmup completion before generating greeting
    // This ensures Gemini + Cartesia are pre-warmed, avoiding cold-start penalty
    if (session.warmupPromise) {
      await session.warmupPromise;
    }
    
    const startTime = Date.now();
    const metrics: StreamingMetrics = {
      sessionId,
      sttLatencyMs: 0,  // No STT for greeting
      aiFirstTokenMs: 0,
      ttsFirstByteMs: 0,
      totalLatencyMs: 0,
      sentenceCount: 0,
      audioBytes: 0,
    };
    
    try {
      console.log(`[Streaming Greeting] Generating personalized greeting for user ${session.userId}`);
      
      // PARALLEL DATA FETCH: Run all independent DB queries concurrently
      // This reduces greeting latency by ~500-800ms compared to sequential fetches
      let actflLevel = 'Novice Low';
      let recentTopics: string[] = [];
      let wordsLearned = 0;
      let classEnrollment: { className: string; curriculumLesson?: string; curriculumUnit?: string } | null = null;
      
      try {
        const [actflProgress, userProgress, enrollments, recentConversations] = await Promise.all([
          storage.getOrCreateActflProgress(session.targetLanguage, String(session.userId))
            .catch(() => null),
          storage.getOrCreateUserProgress(session.targetLanguage, String(session.userId))
            .catch(() => null),
          storage.getStudentEnrollments(String(session.userId))
            .catch(() => []),
          storage.getUserConversations(String(session.userId))
            .catch(() => []),
        ]);
        
        // Process ACTFL progress
        actflLevel = actflProgress?.currentActflLevel || 'Novice Low';
        
        // Process user progress
        if (userProgress) {
          wordsLearned = userProgress.wordsLearned || 0;
        }
        
        // Process enrollments - find active class for this language
        const activeClass = enrollments.find(e => 
          e.isActive && 
          e.class?.isActive && 
          e.class?.language === session.targetLanguage
        );
        
        if (activeClass?.class) {
          classEnrollment = { className: activeClass.class.name };
          
          // If class has a curriculum, get current lesson context (sequential, but fast)
          if (activeClass.class.curriculumPathId) {
            try {
              const units = await storage.getCurriculumUnits(activeClass.class.curriculumPathId);
              if (units.length > 0) {
                const lessons = await storage.getCurriculumLessons(units[0].id);
                if (lessons.length > 0) {
                  classEnrollment.curriculumUnit = units[0].name;
                  classEnrollment.curriculumLesson = lessons[0].name;
                }
              }
            } catch (curriculumError: any) {
              console.log(`[Streaming Greeting] Could not fetch curriculum: ${curriculumError.message}`);
            }
          }
          console.log(`[Streaming Greeting] Student enrolled in class: ${activeClass.class.name}`);
        }
        
        // Process recent conversations for topic continuity
        if (recentConversations.length > 1) {
          const prevConversation = recentConversations[1]; // [0] is current, [1] is previous
          if (prevConversation.title) {
            recentTopics.push(prevConversation.title);
          } else if (prevConversation.topic) {
            recentTopics.push(prevConversation.topic);
          }
        }
      } catch (error: any) {
        console.log(`[Streaming Greeting] Could not fetch context data: ${error.message}`);
      }
      
      // Build greeting prompt with full context
      const greetingPrompt = this.buildGreetingPrompt(
        session,
        userName,
        actflLevel,
        wordsLearned,
        recentTopics,
        classEnrollment,
        isResumed
      );
      
      // NEW TURN: Increment turnId for this greeting response
      session.currentTurnId++;
      const turnId = session.currentTurnId;
      
      // Notify client that greeting is being generated
      this.sendMessage(session.ws, {
        type: 'processing',
        timestamp: Date.now(),
        turnId,
        userTranscript: '[Greeting]',  // Special marker for greeting
      } as StreamingProcessingMessage);
      
      // Stream AI greeting with sentence chunking
      const aiStart = Date.now();
      let firstTokenReceived = false;
      let fullText = '';
      
      await this.geminiService.streamWithSentenceChunking({
        systemPrompt: session.systemPrompt,
        conversationHistory: [],  // Fresh greeting, no history
        userMessage: greetingPrompt,
        onSentence: async (chunk: SentenceChunk) => {
          if (!firstTokenReceived) {
            metrics.aiFirstTokenMs = Date.now() - aiStart;
            firstTokenReceived = true;
            console.log(`[Streaming Greeting] AI first token: ${metrics.aiFirstTokenMs}ms`);
          }
          
          // Clean text for display
          const displayText = cleanTextForDisplay(chunk.text);
          if (!displayText) return;
          
          // Extract target language with word mapping
          const extraction = extractTargetLanguageWithMapping(displayText, chunk.text);
          const wordMappingArray: [number, number][] = extraction.wordMapping.size > 0
            ? Array.from(extraction.wordMapping.entries())
            : [];
          
          // NEW ARCHITECTURE (v2): Explicit hasTargetContent flag eliminates phantom subtitles
          const hasTargetContent = !!(extraction.targetText && extraction.targetText.trim().length > 0);
          
          // Notify client of new sentence
          this.sendMessage(session.ws, {
            type: 'sentence_start',
            timestamp: Date.now(),
            turnId,
            sentenceIndex: chunk.index,
            text: displayText,
            hasTargetContent,
            targetLanguageText: hasTargetContent ? extraction.targetText : undefined,
            wordMapping: hasTargetContent && wordMappingArray.length > 0 ? wordMappingArray : undefined,
          } as StreamingSentenceStartMessage);
          
          // Synthesize and stream audio
          const ttsStart = Date.now();
          
          // Use progressive streaming if feature flag enabled (lower latency)
          if (STREAMING_FEATURE_FLAGS.PROGRESSIVE_AUDIO_STREAMING) {
            await this.streamSentenceAudioProgressive(session, chunk, displayText, metrics, turnId);
          } else {
            await this.streamSentenceAudio(session, chunk, displayText, metrics, turnId);
          }
          
          if (chunk.index === 0) {
            metrics.ttsFirstByteMs = Date.now() - ttsStart;
          }
          
          fullText += displayText + ' ';
          metrics.sentenceCount++;
        },
        onProgress: () => {},
        onError: (error) => {
          console.error(`[Streaming Greeting] AI error:`, error.message);
          this.sendError(session.ws, 'AI_FAILED', error.message, true);
        },
      });
      
      // Update conversation history
      session.conversationHistory.push({ role: 'model', content: fullText.trim() });
      
      // Store response in metrics
      metrics.aiResponse = fullText.trim();
      
      // Send completion message
      metrics.totalLatencyMs = Date.now() - startTime;
      
      this.sendMessage(session.ws, {
        type: 'response_complete',
        timestamp: Date.now(),
        turnId,
        totalSentences: metrics.sentenceCount,
        totalDurationMs: metrics.totalLatencyMs,
        fullText: fullText.trim(),
      } as StreamingResponseCompleteMessage);
      
      console.log(`[Streaming Greeting] Complete: ${metrics.sentenceCount} sentences in ${metrics.totalLatencyMs}ms`);
      
      // Log structured metrics for monitoring (non-blocking, just console.log)
      // Note: greeting has no STT, so time-to-first-audio is AI + TTS
      const timeToFirstAudio = metrics.aiFirstTokenMs + metrics.ttsFirstByteMs;
      logMetric('greeting', {
        sessionId: session.id,
        aiFirstTokenMs: metrics.aiFirstTokenMs,
        ttsFirstByteMs: metrics.ttsFirstByteMs,
        timeToFirstAudioMs: timeToFirstAudio,
        totalMs: metrics.totalLatencyMs,
        sentences: metrics.sentenceCount,
        targetMet: timeToFirstAudio <= 3000,
      });
      
      // Start idle timeout - tutor waiting for student's first response
      this.startIdleTimeout(session);
      
      // Persist greeting message to database
      this.persistGreetingMessage(session.conversationId, fullText.trim()).catch((err: Error) => {
        console.error('[Streaming Greeting] Failed to persist greeting:', err.message);
      });
      
      return metrics;
      
    } catch (error: any) {
      console.error(`[Streaming Greeting] Error:`, error.message);
      this.sendError(session.ws, 'UNKNOWN', error.message, true);
      throw error;
    }
  }
  
  /**
   * Build a personalized greeting prompt based on student context
   * Implements "Steer but also Adhere" philosophy:
   * - Enrolled students: Teach from syllabus immediately
   * - Open-path students: Discover interests OR suggest topics based on history/ACTFL
   */
  private buildGreetingPrompt(
    session: StreamingSession,
    userName: string | undefined,
    actflLevel: string,
    wordsLearned: number,
    recentTopics: string[],
    classEnrollment: { className: string; curriculumLesson?: string; curriculumUnit?: string } | null,
    isResumed?: boolean
  ): string {
    const name = userName ? `The student's name is ${userName}.` : '';
    const topicContext = recentTopics.length > 0 
      ? `Recently, the student practiced: ${recentTopics.join(', ')}.`
      : '';
    const progressContext = wordsLearned > 0 
      ? `The student has learned ${wordsLearned} vocabulary words so far.`
      : '';
    
    // Check if this is a resumed conversation with existing history
    const hasConversationHistory = session.conversationHistory.length > 0;
    const isResumedConversation = isResumed && hasConversationHistory;
    
    // For resumed conversations, summarize what was discussed
    if (isResumedConversation) {
      // Extract key context from conversation history
      const historyPreview = session.conversationHistory
        .slice(-4) // Last 4 turns (2 exchanges)
        .map(h => `${h.role === 'user' ? 'Student' : 'Tutor'}: ${h.content.slice(0, 100)}${h.content.length > 100 ? '...' : ''}`)
        .join('\n');
      
      return `The student is resuming a previous conversation. Generate a brief welcome-back greeting.

Context:
- Student's ACTFL level: ${actflLevel}
- Target language: ${session.targetLanguage}
- Native language: ${session.nativeLanguage}
${name}

Recent conversation history:
${historyPreview}

Instructions:
1. Welcome them back warmly (in ${session.nativeLanguage})
2. Briefly reference what you were discussing before (e.g., "Great to continue! We were practicing greetings..." or "Welcome back! Last time we worked on...")
3. Offer to continue OR introduce the next topic naturally
4. Keep it to 2 sentences MAX
5. Include ONE ${session.targetLanguage} word or phrase as a refresher

Generate the welcome-back greeting now (speak as the tutor directly):`;
    }
    
    // Determine learning path type for new conversations
    const isEnrolledStudent = classEnrollment !== null;
    const isReturningOpenPath = !isEnrolledStudent && (wordsLearned > 0 || recentTopics.length > 0);
    const isNewOpenPath = !isEnrolledStudent && !isReturningOpenPath;
    
    // Build path-specific instructions
    let pathInstructions = '';
    
    if (isEnrolledStudent) {
      // ORGANIZED CLASS: Teach from syllabus immediately
      pathInstructions = `
ENROLLED STUDENT - CLASS: "${classEnrollment.className}"
${classEnrollment.curriculumUnit ? `Current Unit: ${classEnrollment.curriculumUnit}` : ''}
${classEnrollment.curriculumLesson ? `Current Lesson: ${classEnrollment.curriculumLesson}` : ''}

TEACH IMMEDIATELY FROM SYLLABUS:
- Welcome them briefly, then dive into the lesson content
- Do NOT ask about motivation or interests - they're in a structured class
- Start teaching the current lesson topic right away
- Example: "Welcome to class! Today we're working on ${classEnrollment.curriculumLesson || 'greetings'}. Let's start with **Hola** (hello)."`;
    } else if (isReturningOpenPath) {
      // RETURNING OPEN-PATH: Suggest topic based on history or ACTFL progression
      pathInstructions = `
RETURNING OPEN-PATH STUDENT:
${topicContext}
${progressContext}

SUGGEST A TOPIC (don't just ask what they want):
- Briefly welcome them back
- Suggest continuing OR offer a teaching word - pick ONE approach
- Example: "Welcome back! Ready to learn **Gracias** (thank you)? Try saying it!"`;
    } else {
      // NEW OPEN-PATH: Discover interests through teaching
      pathInstructions = `
NEW OPEN-PATH STUDENT:

TEACH FIRST, ASK ABOUT INTERESTS LATER:
- Start with a warm hello and teach a simple first word (like **Hola**)
- Ask them to try saying it - that's your ONE question
- Save interest questions for AFTER they respond
- Example: "Hi David! Let's learn your first word: **Hola** means hello. Can you say Hola?"`;
    }
    
    return `Generate a brief, warm greeting for a ${session.targetLanguage} language learning session.

Context:
- Student's ACTFL level: ${actflLevel}
- Native language: ${session.nativeLanguage}
- Difficulty: ${session.difficultyLevel}
${name}
${pathInstructions}

Requirements:
1. Keep it short (2 sentences MAX)
2. Be warm and encouraging
3. The greeting should be primarily in ${session.nativeLanguage} (student's native language)
4. Include ONE ${session.targetLanguage} teaching word with translation
5. **CRITICAL: Ask only ONE question - do NOT pile on multiple questions!**
6. End with a single prompt for them to respond (e.g., "Can you say Hola?")

Generate the greeting now (speak as the tutor directly):`;
  }
  
  /**
   * Persist greeting message to database (separate from regular message persistence)
   */
  private async persistGreetingMessage(conversationId: string, content: string): Promise<void> {
    try {
      const targetLanguageText = extractTargetLanguageText(content);
      const hasTargetLanguage = hasSignificantTargetLanguageContent(targetLanguageText);
      
      await storage.createMessage({
        conversationId,
        role: 'assistant',
        content,
        ...(hasTargetLanguage ? { targetLanguageText } : {}),
      });
      
      console.log(`[Streaming Greeting] Message persisted to conversation: ${conversationId}`);
    } catch (error: any) {
      console.error('[Streaming Greeting] Database error:', error.message);
      throw error;
    }
  }
  
  /**
   * Handle client interrupt (user started speaking while AI is responding)
   */
  handleInterrupt(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      console.log(`[Streaming Orchestrator] Interrupt received for session: ${sessionId}`);
      // Future: Cancel in-progress synthesis
    }
  }
  
  /**
   * End a streaming session
   */
  endSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      // Clear any pending idle timeout
      if (session.idleTimeoutId) {
        clearTimeout(session.idleTimeoutId);
        session.idleTimeoutId = undefined;
      }
      session.isActive = false;
      this.sessions.delete(sessionId);
      console.log(`[Streaming Orchestrator] Session ended: ${sessionId}`);
    }
  }
  
  /**
   * Start or reset the idle timeout for a session
   * Called after tutor finishes responding - gives student time to respond
   * Protects tutor resources by cleaning up inactive sessions
   */
  private startIdleTimeout(session: StreamingSession): void {
    // Clear any existing timeout
    if (session.idleTimeoutId) {
      clearTimeout(session.idleTimeoutId);
    }
    
    // Start new timeout
    session.idleTimeoutId = setTimeout(() => {
      if (session.isActive) {
        const idleTime = Date.now() - session.lastActivityTime;
        console.log(`[Streaming Orchestrator] Session ${session.id} idle timeout after ${Math.round(idleTime / 1000)}s of inactivity`);
        
        // Notify client that session is closing due to inactivity
        this.sendMessage(session.ws, {
          type: 'error',
          timestamp: Date.now(),
          code: 'TIMEOUT',
          message: 'Session closed due to inactivity. Start a new practice session when ready.',
          recoverable: false,
        } as StreamingErrorMessage);
        
        // Clean up the session
        this.endSession(session.id);
      }
    }, SESSION_IDLE_TIMEOUT_MS);
    
    console.log(`[Streaming Orchestrator] Idle timeout started for session ${session.id} (${SESSION_IDLE_TIMEOUT_MS / 1000}s)`);
  }
  
  /**
   * Reset the idle timeout when student activity is detected
   * Called when student sends audio
   */
  private resetIdleTimeout(session: StreamingSession): void {
    session.lastActivityTime = Date.now();
    
    // Clear the timeout - it will restart after tutor responds
    if (session.idleTimeoutId) {
      clearTimeout(session.idleTimeoutId);
      session.idleTimeoutId = undefined;
    }
  }
  
  /**
   * Update the voice for an active session
   * Called when user changes tutor gender mid-session
   */
  updateSessionVoice(sessionId: string, voiceId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.warn(`[Streaming Orchestrator] Cannot update voice - session ${sessionId} not found`);
      return false;
    }
    
    session.voiceId = voiceId;
    console.log(`[Streaming Orchestrator] Updated voice for session ${sessionId}: ${voiceId.substring(0, 8)}...`);
    return true;
  }
  
  /**
   * Process a brief introduction when voice/tutor is switched
   * The new tutor introduces themselves and continues the conversation
   */
  async processVoiceSwitchIntro(sessionId: string, tutorName: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isActive) {
      console.warn(`[Streaming Orchestrator] Cannot process voice switch - session not found: ${sessionId}`);
      return;
    }
    
    console.log(`[Voice Switch] New tutor ${tutorName} introducing themselves`);
    
    // Create a brief, friendly introduction message
    const introText = `Hi! I'm ${tutorName}. Let's continue practicing together!`;
    
    // NEW TURN: Increment turnId for voice switch intro
    session.currentTurnId++;
    const turnId = session.currentTurnId;
    
    try {
      // Send sentence start (no target language content in voice switch intro)
      this.sendMessage(session.ws, {
        type: 'sentence_start',
        timestamp: Date.now(),
        turnId,
        sentenceIndex: 0,
        text: introText,
        hasTargetContent: false,
        targetLanguageText: '',
      } as StreamingSentenceStartMessage);
      
      // Synthesize with new voice using streaming
      const speakingRate = voiceSpeedToRate(session.voiceSpeed);
      
      // Use streamSynthesize to get audio chunks
      const chunks = await this.cartesiaService.streamSynthesize({
        text: introText,
        language: session.targetLanguage,
        voiceId: session.voiceId,
        emotion: 'friendly',
        speakingRate,
      });
      
      let totalDurationMs = 0;
      
      // Send each audio chunk
      for await (const chunk of chunks) {
        if (session.ws.readyState === 1) { // WebSocket.OPEN
          session.ws.send(chunk.audio);
          totalDurationMs += chunk.durationMs;
        }
      }
      
      // Send sentence end
      this.sendMessage(session.ws, {
        type: 'sentence_end',
        timestamp: Date.now(),
        turnId,
        sentenceIndex: 0,
        totalDurationMs,
      } as StreamingSentenceEndMessage);
      
      // Send response complete
      this.sendMessage(session.ws, {
        type: 'response_complete',
        timestamp: Date.now(),
        turnId,
        fullText: introText,
        totalSentences: 1,
        totalDurationMs,
      } as StreamingResponseCompleteMessage);
      
      console.log(`[Voice Switch] Introduction complete: ${tutorName} (${totalDurationMs}ms)`);
      
    } catch (err: any) {
      console.error(`[Voice Switch] Failed to generate intro: ${err.message}`);
      // Non-fatal - voice switch still happened, just no audio intro
    }
  }
  
  /**
   * Get active session count
   */
  getActiveSessionCount(): number {
    return this.sessions.size;
  }
}

// Singleton instance
let orchestrator: StreamingVoiceOrchestrator | null = null;

export function getStreamingVoiceOrchestrator(): StreamingVoiceOrchestrator {
  if (!orchestrator) {
    orchestrator = new StreamingVoiceOrchestrator();
  }
  return orchestrator;
}
