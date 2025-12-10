/**
 * Streaming Voice Orchestrator
 * 
 * The central coordinator for streaming voice mode:
 * User audio → Deepgram STT → Gemini streaming → Sentence chunks → Cartesia TTS → Audio stream
 * 
 * Target: < 1 second time to first audio byte (vs 5-7s synchronous mode)
 */

import { createClient } from "@deepgram/sdk";
import { getDeepgramLanguageCode } from "./deepgram-live-stt";
import { getGeminiStreamingService, SentenceChunk } from "./gemini-streaming";
import { getCartesiaStreamingService } from "./cartesia-streaming";
import { WebSocket as WS } from "ws";
import {
  StreamingMessage,
  StreamingConnectedMessage,
  StreamingProcessingMessage,
  StreamingSentenceStartMessage,
  StreamingSentenceReadyMessage,
  StreamingAudioChunkMessage,
  StreamingWordTimingMessage,
  StreamingWordTimingDeltaMessage,
  StreamingWordTimingFinalMessage,
  StreamingSentenceEndMessage,
  StreamingResponseCompleteMessage,
  StreamingFeedbackMessage,
  StreamingWhiteboardMessage,
  StreamingErrorMessage,
  StreamingErrorCode,
  ClientStartSessionMessage,
  WordTiming,
  LATENCY_TARGETS,
  STREAMING_FEATURE_FLAGS,
} from "@shared/streaming-voice-types";
import { parseWhiteboardMarkup, WhiteboardItem, WordMapItem, isWordMapItem, stripWhiteboardMarkup } from "@shared/whiteboard-types";

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
import { architectVoiceService } from "./architect-voice-service";
import { trackToolEvent, mapWhiteboardTypeToToolType } from "./pedagogical-insights-service";
import { createSystemPrompt } from "../system-prompt";

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
  
  // First strip all whiteboard markup (WRITE, DRILL, SWITCH_TUTOR, etc.)
  // This must happen before other cleaning to ensure markup doesn't appear in TTS
  let cleaned = stripWhiteboardMarkup(text)
    // Remove action/emotion tags like *laughs softly*, *chuckles*, *sighs*, *smiles warmly*, etc.
    // These should be emoted by the voice, not spoken aloud
    // Must happen BEFORE stripping individual asterisks
    .replace(/\*(?:laughs?|chuckles?|giggles?|sighs?|smiles?|grins?|nods?|pauses?|clears? throat|ahem|winks?|gasps?|whispers?|exclaims?|thinks?|considers?|reflects?|ponders?)(?:\s+\w+)*\*/gi, '')
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
    .replace(/^(?:friendly|curious|excited|calm|warm|energetic|professional|happy|sad|surprised|thoughtful|encouraging|patient)[!.,;:?]*(?:[\s\n\r]+|\*\*)?/gi, '')
    // Remove BARE action phrases at start of text (AI sometimes outputs "laughs softly It's..." without asterisks)
    // Catches: "laughs softly", "chuckles", "sighs contentedly", "smiles warmly", etc.
    .replace(/^(?:laughs?|chuckles?|giggles?|sighs?|smiles?|grins?|nods?|pauses?|clears? throat|ahem|winks?|gasps?|whispers?|exclaims?|thinks?|considers?|reflects?|ponders?)(?:\s+\w+)*\s+/gi, '');
  
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
  tutorGender: 'male' | 'female';    // Current tutor gender for persona-aware responses
  tutorName: string;                 // Current tutor's first name (e.g., "Daniela", "Agustin")
  systemPrompt: string;
  conversationHistory: Array<{ role: 'user' | 'model'; content: string }>;
  ws: WS;
  startTime: number;
  isActive: boolean;
  isFounderMode: boolean;  // Founder Mode uses English STT regardless of target language
  isRawHonestyMode: boolean;  // Raw Honesty Mode - minimal prompting for authentic conversation
  idleTimeoutId?: NodeJS.Timeout;  // Timer for idle cleanup
  lastActivityTime: number;         // Timestamp of last student activity
  currentTurnId: number;            // Monotonic counter for subtitle packet ordering (prevents phantom subtitles)
  warmupPromise?: Promise<void>;    // Gemini + Cartesia warmup promise to await before greeting
  isInterrupted: boolean;           // Set to true when user barges in (for open mic mode)
  isGenerating: boolean;            // True while AI response is being generated (for barge-in detection)
  pendingTutorSwitch?: {            // Queued tutor switch to execute after response completes
    targetGender: 'male' | 'female';
    targetLanguage?: string;        // Optional: for cross-language handoffs (e.g., "japanese")
  };
  previousTutorName?: string;       // Stored during handoff for natural intro by new tutor
  isLanguageSwitchHandoff?: boolean; // True when current handoff is a cross-language switch
  previousLanguage?: string;        // Previous language before cross-language switch
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
    voiceId?: string,
    isFounderMode: boolean = false,
    isRawHonestyMode: boolean = false
  ): Promise<StreamingSession> {
    const sessionId = `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Determine initial tutor gender and name from voice info
    // tutorName will be updated when we get voice info from the server
    const initialGender = config.tutorGender || 'female';
    const initialTutorName = initialGender === 'male' ? 'Agustin' : 'Daniela';
    
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
      tutorGender: initialGender,
      tutorName: initialTutorName,
      systemPrompt,
      conversationHistory,
      ws,
      startTime: Date.now(),
      isActive: true,
      isFounderMode,  // Founder Mode uses English STT regardless of target language
      isRawHonestyMode,  // Raw Honesty Mode - minimal prompting for authentic conversation
      lastActivityTime: Date.now(),
      currentTurnId: 0,  // Start at 0, incremented on each new response
      isInterrupted: false,  // Reset on each new request
      isGenerating: false,   // Track when AI response is being generated
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
    
    // BARGE-IN DETECTION: If AI is currently generating a response, interrupt it
    // This prevents overlapping responses when user speaks while Daniela is talking
    if (session.isGenerating) {
      console.log(`[Streaming Orchestrator] BARGE-IN: User spoke while AI generating - interrupting previous response`);
      this.handleInterrupt(sessionId);
    }
    
    // Mark that we're now generating a response
    session.isGenerating = true;
    
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
        // Founder Mode uses multi-language detection for English/Spanish mixing
        this.transcribeAudio(audioData, session.targetLanguage, session.nativeLanguage, session.isFounderMode),
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
      // BYPASS: Skip in Founder Mode - these are collaborative conversations, not language lessons
      if (!session.isFounderMode) {
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
      }
      
      // NEW TURN: Increment turnId for this response (for subtitle packet ordering)
      session.currentTurnId++;
      session.isInterrupted = false;  // Reset interrupt flag for new turn
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
      const MAX_SENTENCES = 15; // Increased for Founder Mode detailed explanations
      let actualSentenceCount = 0;
      
      // Process sentences as they arrive from Gemini
      // Include redirect note if mild content was detected
      // Also check for architect notes (Claude's contributions to the conversation)
      let architectContext = '';
      if (session.conversationId) {
        architectContext = architectVoiceService.buildArchitectContext(session.conversationId);
        if (architectContext) {
          console.log(`[Streaming Orchestrator] Including architect notes in context`);
        }
      }
      
      const userMessageWithNote = transcript + contentRedirectNote + architectContext;
      
      await this.geminiService.streamWithSentenceChunking({
        systemPrompt: session.systemPrompt,
        conversationHistory: session.conversationHistory,
        userMessage: userMessageWithNote,
        onSentence: async (chunk: SentenceChunk) => {
          // BARGE-IN CHECK: Stop processing if user interrupted
          if (session.isInterrupted) {
            console.log(`[Streaming Orchestrator] Skipping sentence ${chunk.index} - user barged in`);
            return;
          }
          
          if (!firstTokenReceived) {
            metrics.aiFirstTokenMs = Date.now() - aiStart;
            firstTokenReceived = true;
            console.log(`[Streaming Orchestrator] AI first token: ${metrics.aiFirstTokenMs}ms`);
          }
          
          // WHITEBOARD: Parse markup from the raw chunk text FIRST (before display cleaning)
          // This ensures SWITCH_TUTOR and other commands are processed even if no speakable text
          const whiteboardParsed = parseWhiteboardMarkup(chunk.text);
          
          // Clean text for display (remove markdown, emotion tags)
          const displayText = cleanTextForDisplay(chunk.text);
          
          // Process whiteboard items even if displayText is empty
          // This allows SWITCH_TUTOR to work as a standalone command
          let hasWhiteboardContent = false;
          if (whiteboardParsed.whiteboardItems.length > 0) {
            hasWhiteboardContent = true;
            console.log(`[Whiteboard] Parsed ${whiteboardParsed.whiteboardItems.length} items from sentence ${chunk.index}`);
            
            // PEDAGOGICAL TRACKING: Log each tool usage for effectiveness analysis
            // Don't await - runs in background, non-blocking
            for (let i = 0; i < whiteboardParsed.whiteboardItems.length; i++) {
              const item = whiteboardParsed.whiteboardItems[i];
              // Extract drillType from drill items (DrillItem has data.drillType)
              const drillType = item.type === 'drill' && 'data' in item && item.data && 'drillType' in item.data 
                ? (item.data as { drillType: string }).drillType 
                : undefined;
              const toolType = mapWhiteboardTypeToToolType(item.type, drillType);
              
              if (toolType) {
                // Extract content based on item type - use content field or data fields
                let toolContent: string | undefined;
                if ('content' in item && typeof item.content === 'string') {
                  toolContent = item.content;
                } else if ('data' in item && item.data) {
                  const data = item.data as unknown as Record<string, unknown>;
                  toolContent = (data.targetWord as string) || (data.word as string) || (data.text as string) || (data.prompt as string);
                }
                
                trackToolEvent({
                  voiceSessionId: session.id,
                  conversationId: session.conversationId,
                  userId: session.userId.toString(),
                  toolType,
                  toolContent,
                  language: session.targetLanguage,
                  difficulty: session.difficultyLevel,
                  sequencePosition: turnId * 100 + chunk.index * 10 + i, // Unique position within session
                });
              }
            }
            
            // SWITCH_TUTOR: Internal command - queue tutor handoff (don't send to whiteboard)
            // This allows the current tutor to finish their farewell before switching voices
            // Supports both intra-language (gender only) and cross-language (gender + language) handoffs
            const switchItem = whiteboardParsed.whiteboardItems.find(item => item.type === 'switch_tutor');
            if (switchItem && 'data' in switchItem && switchItem.data) {
              const data = switchItem.data as { targetGender: 'male' | 'female'; targetLanguage?: string };
              session.pendingTutorSwitch = { 
                targetGender: data.targetGender,
                targetLanguage: data.targetLanguage,
              };
              const languageInfo = data.targetLanguage ? ` in ${data.targetLanguage}` : '';
              console.log(`[Tutor Switch] Queued handoff to ${data.targetGender} tutor${languageInfo} after response completes`);
            }
            
            // Filter out internal commands (switch_tutor) - only send visual items to whiteboard
            const visualWhiteboardItems = whiteboardParsed.whiteboardItems.filter(
              item => item.type !== 'switch_tutor'
            );
            
            // Send whiteboard update to client (only visual teaching tools)
            if (visualWhiteboardItems.length > 0) {
              this.sendMessage(session.ws, {
                type: 'whiteboard_update',
                timestamp: Date.now(),
                turnId,
                items: visualWhiteboardItems,
                shouldClear: whiteboardParsed.shouldClear,
              } as StreamingWhiteboardMessage);
              
              // WORD_MAP ENRICHMENT: Asynchronously generate related words
              // Don't await - let this run in background while audio streams
              this.enrichWordMapItems(session.ws, visualWhiteboardItems, session.targetLanguage, turnId);
            } else if (whiteboardParsed.shouldClear) {
              // Send clear signal even if only internal commands (like SWITCH_TUTOR)
              this.sendMessage(session.ws, {
                type: 'whiteboard_update',
                timestamp: Date.now(),
                turnId,
                items: [],
                shouldClear: true,
              } as StreamingWhiteboardMessage);
            }
          }
          
          // Skip empty sentences AFTER whiteboard processing
          // This ensures SWITCH_TUTOR and other commands are processed even with no speakable text
          if (!displayText) {
            if (hasWhiteboardContent) {
              console.log(`[Streaming Orchestrator] Sentence ${chunk.index} had whiteboard content only (no speakable text)`);
            } else {
              console.log(`[Streaming Orchestrator] Skipping empty sentence ${chunk.index} after cleaning`);
            }
            return; // Skip TTS but whiteboard items were already processed above
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
      
      // Clear generating flag - response complete
      session.isGenerating = false;
      
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
      
      // TUTOR SWITCH: Execute pending handoff after farewell completes
      // Supports both intra-language (gender only) and cross-language (gender + language) handoffs
      if (session.pendingTutorSwitch) {
        const { targetGender, targetLanguage } = session.pendingTutorSwitch;
        session.pendingTutorSwitch = undefined; // Clear the pending switch
        
        const isLanguageSwitch = !!targetLanguage && targetLanguage.toLowerCase() !== session.targetLanguage.toLowerCase();
        const effectiveLanguage = targetLanguage?.toLowerCase() || session.targetLanguage.toLowerCase();
        
        console.log(`[Tutor Switch] Executing handoff to ${targetGender} tutor${isLanguageSwitch ? ` in ${effectiveLanguage}` : ''}`);
        
        // Store previous tutor name for natural handoff intro by the new tutor
        session.previousTutorName = session.tutorName;
        
        try {
          // Look up the voice for the target language + gender
          const allVoices = await storage.getAllTutorVoices();
          const matchingVoice = allVoices.find(
            (v: any) => v.language?.toLowerCase() === effectiveLanguage &&
                        v.gender?.toLowerCase() === targetGender &&
                        v.isActive
          );
          
          let tutorName: string | undefined;
          
          if (matchingVoice) {
            // Extract tutor name from voice_name (e.g., "Sayuri - Peppy Colleague" → "Sayuri")
            const voiceNameParts = matchingVoice.voiceName?.split(/\s*[-–]\s*/) || [];
            tutorName = voiceNameParts[0]?.trim();
            
            // Update session voice
            session.voiceId = matchingVoice.voiceId;
            session.tutorGender = targetGender;
            session.tutorName = tutorName;
            
            // If cross-language switch, update target language and regenerate system prompt
            if (isLanguageSwitch) {
              // Store previous language for context in handoff intro
              session.previousLanguage = session.targetLanguage;
              session.isLanguageSwitchHandoff = true;
              session.targetLanguage = effectiveLanguage;
              
              // CRITICAL: Update BOTH the conversation language AND user preferences
              // This ensures that if the client reconnects/refreshes, it will use the correct language
              try {
                await storage.updateConversationLanguage(session.conversationId, effectiveLanguage);
                console.log(`[Tutor Switch] Updated conversation language in database to ${effectiveLanguage}`);
                
                // Also update user preferences so they persist on refresh
                await storage.updateUserPreferences(session.userId.toString(), {
                  targetLanguage: effectiveLanguage,
                });
                console.log(`[Tutor Switch] Updated user preferences to ${effectiveLanguage}`);
              } catch (dbErr: any) {
                console.error(`[Tutor Switch] Failed to update language:`, dbErr.message);
              }
              
              // Clear conversation history for cross-language switch
              // New language = fresh start, but the handoff intro will reference conversation name
              console.log(`[Tutor Switch] Clearing conversation history for cross-language switch (${session.previousLanguage} -> ${effectiveLanguage})`);
              session.conversationHistory = [];
              
              // Regenerate system prompt for new language context
              // Uses session's existing settings + new language/tutor
              // Note: tutorDirectory not passed here - the initial session already has it
              session.systemPrompt = createSystemPrompt(
                effectiveLanguage,                           // language
                session.difficultyLevel,                     // difficulty
                0,                                            // messageCount (fresh start for new language)
                false,                                        // isVoiceMode
                undefined,                                    // topic
                undefined,                                    // previousConversations
                session.nativeLanguage,                      // nativeLanguage
                undefined,                                    // dueVocabulary
                undefined,                                    // sessionVocabulary
                undefined,                                    // actflLevel
                false,                                        // isResuming
                0,                                            // totalMessageCount
                session.tutorPersonality,                    // tutorPersonality
                session.tutorExpressiveness,                 // tutorExpressiveness
                true,                                         // isStreamingVoiceMode
                null,                                         // curriculumContext
                'flexible_goals',                            // tutorFreedomLevel
                undefined,                                    // targetActflLevel
                null,                                         // compassContext
                session.isFounderMode,                       // isFounderMode
                undefined,                                    // founderName
                session.isRawHonestyMode,                    // isRawHonestyMode
                tutorName || 'your tutor',                   // tutorName
                targetGender,                                // tutorGender
                undefined                                    // tutorDirectory (session already has it)
              );
              
              console.log(`[Tutor Switch] Language switched to ${effectiveLanguage}, voice: ${matchingVoice.voiceName}, system prompt regenerated`);
            } else {
              console.log(`[Tutor Switch] Same-language switch, new voice: ${matchingVoice.voiceName}`);
            }
          } else {
            console.warn(`[Tutor Switch] No matching voice found for ${targetGender} in ${effectiveLanguage}`);
          }
          
          // Notify client to update voice preference and trigger new tutor intro
          this.sendMessage(session.ws, {
            type: 'tutor_handoff',
            timestamp: Date.now(),
            targetGender,
            targetLanguage: isLanguageSwitch ? effectiveLanguage : undefined,
            tutorName,
            isLanguageSwitch,
          });
        } catch (err: any) {
          console.error(`[Tutor Switch] Error during handoff:`, err.message);
          // Still send handoff message so client can proceed
          this.sendMessage(session.ws, {
            type: 'tutor_handoff',
            timestamp: Date.now(),
            targetGender,
            isLanguageSwitch: false,
          });
        }
      }
      
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
      // Clear generating flag on error
      session.isGenerating = false;
      console.error(`[Streaming Orchestrator] Error:`, error.message);
      this.sendError(session.ws, 'UNKNOWN', error.message, true);
      throw error;
    }
  }
  
  /**
   * Process open mic transcript directly (no STT needed - Deepgram already transcribed)
   * Used when VAD detects utterance end in open mic mode
   */
  async processOpenMicTranscript(
    sessionId: string,
    transcript: string,
    confidence: number
  ): Promise<StreamingMetrics> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isActive) {
      throw new Error(`Session not found or inactive: ${sessionId}`);
    }
    
    // BARGE-IN DETECTION: If AI is currently generating a response, interrupt it
    if (session.isGenerating) {
      console.log(`[Streaming Orchestrator] BARGE-IN (open mic): User spoke while AI generating - interrupting`);
      this.handleInterrupt(sessionId);
    }
    
    // Mark that we're now generating a response
    session.isGenerating = true;
    
    // Student activity detected - reset idle timeout
    this.resetIdleTimeout(session);
    
    const startTime = Date.now();
    const metrics: StreamingMetrics = {
      sessionId,
      sttLatencyMs: 0, // Already done by Deepgram live session
      aiFirstTokenMs: 0,
      ttsFirstByteMs: 0,
      totalLatencyMs: 0,
      sentenceCount: 0,
      audioBytes: 0,
    };
    
    try {
      console.log(`[Streaming Orchestrator] Open mic transcript: "${transcript}" (${(confidence * 100).toFixed(0)}%)`);
      
      if (!transcript.trim()) {
        console.log('[Streaming Orchestrator] Empty transcript in open mic');
        return metrics;
      }
      
      // CONTENT MODERATION: Check for severely inappropriate content
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
      
      // NEW TURN: Increment turnId for this response
      session.currentTurnId++;
      session.isInterrupted = false;  // Reset interrupt flag for new turn
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
      
      // DEDUPLICATION GUARD: Track seen sentences to prevent LLM repetition loops
      const seenSentences = new Set<string>();
      const MAX_SENTENCES = 5;
      let actualSentenceCount = 0;
      
      // Check for architect notes
      let architectContext = '';
      if (session.conversationId) {
        architectContext = architectVoiceService.buildArchitectContext(session.conversationId);
      }
      
      const userMessageWithNote = transcript + architectContext;
      
      await this.geminiService.streamWithSentenceChunking({
        systemPrompt: session.systemPrompt,
        conversationHistory: session.conversationHistory,
        userMessage: userMessageWithNote,
        onSentence: async (chunk: SentenceChunk) => {
          // BARGE-IN CHECK: Stop processing if user interrupted
          if (session.isInterrupted) {
            console.log(`[Streaming Orchestrator] Skipping sentence ${chunk.index} - user barged in (open mic)`);
            return;
          }
          
          if (!firstTokenReceived) {
            metrics.aiFirstTokenMs = Date.now() - aiStart;
            firstTokenReceived = true;
            console.log(`[Streaming Orchestrator] AI first token: ${metrics.aiFirstTokenMs}ms`);
          }
          
          const displayText = cleanTextForDisplay(chunk.text);
          if (!displayText) return;
          
          const normalizedText = displayText.toLowerCase().trim();
          if (seenSentences.has(normalizedText)) return;
          seenSentences.add(normalizedText);
          
          if (actualSentenceCount >= MAX_SENTENCES) return;
          actualSentenceCount++;
          
          // Parse whiteboard markup
          const whiteboardParsed = parseWhiteboardMarkup(chunk.text);
          if (whiteboardParsed.whiteboardItems.length > 0) {
            this.sendMessage(session.ws, {
              type: 'whiteboard_update',
              timestamp: Date.now(),
              turnId,
              items: whiteboardParsed.whiteboardItems,
              shouldClear: whiteboardParsed.shouldClear,
            } as StreamingWhiteboardMessage);
          }
          
          // Extract target language with word mapping
          const extraction = extractTargetLanguageWithMapping(displayText, chunk.text);
          const wordMappingArray: [number, number][] = extraction.wordMapping.size > 0
            ? Array.from(extraction.wordMapping.entries())
            : [];
          const hasTargetContent = !!(extraction.targetText && extraction.targetText.trim().length > 0);
          
          // Send sentence start
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
          
          // Stream TTS for this sentence
          if (STREAMING_FEATURE_FLAGS.PROGRESSIVE_AUDIO_STREAMING) {
            await this.streamSentenceAudioProgressive(session, chunk, displayText, metrics, turnId);
          } else {
            await this.streamSentenceAudio(session, chunk, displayText, metrics, turnId);
          }
          
          fullText += displayText + ' ';
          metrics.sentenceCount++;
        },
      });
      
      console.log(`[Streaming Orchestrator] AI complete: ${actualSentenceCount} sentences`);
      
      // Update conversation history
      if (transcript.trim()) {
        session.conversationHistory.push({ role: 'user', content: transcript });
      }
      if (fullText.trim()) {
        session.conversationHistory.push({ role: 'model', content: fullText.trim() });
      }
      
      // Clear generating flag - response complete
      session.isGenerating = false;
      
      // Response complete
      this.sendMessage(session.ws, {
        type: 'response_complete',
        timestamp: Date.now(),
        turnId,
      } as StreamingResponseCompleteMessage);
      
      metrics.totalLatencyMs = Date.now() - startTime;
      
      // Persist messages
      this.persistMessages(session.conversationId, transcript, fullText.trim(), session, confidence).catch((err: Error) => {
        console.error('[Streaming Orchestrator] Failed to persist messages:', err.message);
      });
      
      return metrics;
      
    } catch (error: any) {
      // Clear generating flag on error
      session.isGenerating = false;
      console.error(`[Streaming Orchestrator] Open mic error:`, error.message);
      this.sendError(session.ws, 'UNKNOWN', error.message, true);
      throw error;
    }
  }
  
  /**
   * Transcribe audio using Deepgram Prerecorded API
   * 
   * PUSH-TO-TALK STRATEGY: Use prerecorded API for complete audio blobs
   * The Live API is designed for real-time streaming, not batch audio.
   * Sending complete blobs to Live API causes "Endpointing not supported for batch requests" errors.
   * 
   * For Open Mic mode, use OpenMicSession class which streams audio chunks correctly.
   * 
   * Core values alignment:
   * - <2 sec response: Prerecorded API is fast for complete audio
   * - Word timestamps: Enabled for karaoke highlighting
   * - Reliability: Prerecorded handles WebM containers well
   * 
   * MULTI-LANGUAGE DETECTION: Always enabled for all users
   * Students naturally code-switch between native and target languages during lessons.
   * 
   * Returns transcript AND confidence for ACTFL tracking (no shared state)
   */
  private async transcribeAudio(
    audioData: Buffer, 
    targetLanguage: string,
    nativeLanguage: string = 'english',
    isFounderMode: boolean = false
  ): Promise<{ transcript: string; confidence: number }> {
    // MULTI-LANGUAGE: Always use multi-language detection
    // Students naturally mix native + target language during lessons
    const languageCode = 'multi';
    
    console.log(`[Deepgram] Transcribing ${audioData.length} bytes, language: ${languageCode} (bilingual: ${nativeLanguage}/${targetLanguage})`);
    
    // Log header to verify WebM format (0x1A 0x45 0xDF 0xA3)
    const header = audioData.slice(0, 16);
    console.log(`[Deepgram] Audio header: ${header.toString('hex')}`);
    
    // Use prerecorded API for push-to-talk (complete audio blobs)
    // Live API is for streaming - it errors with "Endpointing not supported for batch requests"
    const result = await this.transcribeWithPrerecorded(audioData, languageCode, true);
    
    if (!result.transcript) {
      console.log('[Deepgram] Empty transcript returned');
    }
    
    return { transcript: result.transcript, confidence: result.confidence };
  }
  
  /**
   * Transcribe with Prerecorded API
   * @param audioData - Audio buffer to transcribe
   * @param languageCode - Language code (or 'multi' for multi-language detection)
   * @param isFounderMode - If true, enables multi-language detection
   */
  private async transcribeWithPrerecorded(audioData: Buffer, languageCode: string, isFounderMode: boolean = false): Promise<{ transcript: string; confidence: number; source: string }> {
    const startTime = Date.now();
    
    const response = await deepgram.listen.prerecorded.transcribeFile(
      audioData,
      {
        model: 'nova-2',
        language: languageCode,
        smart_format: true,
        punctuate: true,
        mimetype: 'audio/webm',
        // Multi-language detection for Founder Mode
        ...(isFounderMode && { detect_language: true }),
      }
    );
    
    const alternative = response.result?.results?.channels?.[0]?.alternatives?.[0];
    const transcript = alternative?.transcript || '';
    const confidence = alternative?.confidence || 0;
    
    // Log detected language if available (for monitoring multi-language accuracy)
    const detectedLanguage = response.result?.results?.channels?.[0]?.detected_language;
    if (detectedLanguage) {
      console.log(`[Deepgram Prerecorded] Detected language: ${detectedLanguage}`);
    }
    
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
      
      // Skip sending empty audio (e.g., from emoji-only sentences)
      // Sending empty audio confuses the client's audio playback loop
      if (completeAudio.length === 0) {
        console.log(`[Streaming] Skipping empty sentence ${index} (no audio data)`);
        return;
      }
      
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
    
    // === TIMING RACE FIX: Server-side buffering ===
    // Buffer audio chunks until we have at least the first word timing.
    // Once both are available, send atomic 'sentence_ready' message.
    // This prevents the race condition where client starts playback before timings arrive.
    
    interface BufferedAudioChunk {
      audio: Buffer;
      durationMs: number;
      audioFormat: 'mp3' | 'pcm_f32le';
      sampleRate: number;
      chunkIndex: number;
    }
    
    let bufferedAudioChunks: BufferedAudioChunk[] = [];
    let bufferedWordTimings: WordTiming[] = [];
    let estimatedTotalDuration = 0;
    let sentenceReadySent = false;  // Have we sent the sentence_ready message?
    let chunkIndex = 0;
    
    // Helper: Flush buffered data when we have both audio AND timing
    // CRITICAL: This MUST only fire when we have at least one timing
    // to guarantee the client can start playback with timing data.
    const trySendSentenceReady = () => {
      if (sentenceReadySent) return;
      if (bufferedAudioChunks.length === 0) return;  // No audio yet
      
      // CRITICAL FIX: Only send sentence_ready when we have at least one timing
      // This prevents the race condition where playback starts without timing data
      if (bufferedWordTimings.length === 0) {
        console.log(`[Progressive] Sentence ${index}: Waiting for first word timing (have ${bufferedAudioChunks.length} audio chunks buffered)`);
        return;  // Wait until we have at least one timing
      }
      
      // We have both audio AND timing - send the atomic sentence_ready message
      sentenceReadySent = true;
      
      const firstChunk = bufferedAudioChunks[0];
      console.log(`[Progressive] Sentence ${index}: Sending sentence_ready (audio=${bufferedAudioChunks.length} chunks, timings=${bufferedWordTimings.length} words)`);
      
      this.sendMessage(session.ws, {
        type: 'sentence_ready',
        timestamp: Date.now(),
        turnId: effectiveTurnId,
        sentenceIndex: index,
        firstAudioChunk: {
          chunkIndex: firstChunk.chunkIndex,
          durationMs: firstChunk.durationMs,
          audio: firstChunk.audio.toString('base64'),
          audioFormat: firstChunk.audioFormat,
          sampleRate: firstChunk.sampleRate,
        },
        firstWordTimings: [...bufferedWordTimings],
        estimatedTotalDuration: estimatedTotalDuration,
      } as StreamingSentenceReadyMessage);
      
      // Send any additional buffered audio chunks (beyond the first one)
      for (let i = 1; i < bufferedAudioChunks.length; i++) {
        const chunk = bufferedAudioChunks[i];
        this.sendMessage(session.ws, {
          type: 'audio_chunk',
          timestamp: Date.now(),
          turnId: effectiveTurnId,
          sentenceIndex: index,
          chunkIndex: chunk.chunkIndex,
          isLast: false,
          durationMs: chunk.durationMs,
          audio: chunk.audio.toString('base64'),
          audioFormat: chunk.audioFormat,
          sampleRate: chunk.sampleRate,
        } as StreamingAudioChunkMessage);
      }
      
      // Clear buffers - subsequent data goes directly to client
      bufferedAudioChunks = [];
      // Note: Word timings buffer stays to track what we've sent
    };
    
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
          // Audio chunk callback - buffer until timing arrives, then stream directly
          onAudioChunk: (audioChunk, idx) => {
            metrics.audioBytes += audioChunk.audio.length;
            
            if (!sentenceReadySent) {
              // Still buffering - wait for first timing
              console.log(`[Progressive] Sentence ${index}: Buffering audio chunk ${idx} (waiting for timing)`);
              bufferedAudioChunks.push({
                audio: audioChunk.audio,
                durationMs: audioChunk.durationMs,
                audioFormat: audioChunk.audioFormat || 'pcm_f32le',
                sampleRate: audioChunk.sampleRate || 24000,
                chunkIndex: idx,
              });
              trySendSentenceReady();
            } else {
              // sentence_ready already sent - forward audio directly
              const audioBase64 = audioChunk.audio.toString('base64');
              this.sendMessage(session.ws, {
                type: 'audio_chunk',
                timestamp: Date.now(),
                turnId: effectiveTurnId,
                sentenceIndex: index,
                chunkIndex: idx,
                isLast: false,
                durationMs: audioChunk.durationMs,
                audio: audioBase64,
                audioFormat: audioChunk.audioFormat || 'pcm_f32le',
                sampleRate: audioChunk.sampleRate || 24000,
              } as StreamingAudioChunkMessage);
            }
            
            chunkIndex = idx + 1;
          },
          
          // Word timing callback - buffer until audio arrives, then stream deltas
          onWordTimestamp: (timing, wordIdx, estimatedTotal) => {
            estimatedTotalDuration = estimatedTotal;
            
            if (!sentenceReadySent) {
              // Still buffering - accumulate timings
              console.log(`[Progressive] Sentence ${index}: Buffering word ${wordIdx} "${timing.word}" (waiting for audio)`);
              bufferedWordTimings.push(timing);
              trySendSentenceReady();
            } else {
              // sentence_ready already sent - send as delta
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
              }
            }
          },
          
          // Final reconciliation when synthesis completes
          onComplete: (finalTimestamps, actualDurationMs) => {
            // If we never sent sentence_ready (edge case: no timings at all), send now with estimated timings
            if (!sentenceReadySent && bufferedAudioChunks.length > 0) {
              console.log(`[Progressive] Sentence ${index}: No native timings received, using estimates`);
              const estimatedTimings = this.estimateWordTimings(displayText, actualDurationMs / 1000);
              bufferedWordTimings = estimatedTimings;
              trySendSentenceReady();
            }
            
            // Send final timing reconciliation
            if (session.subtitleMode !== 'off') {
              const timings = finalTimestamps.length > 0 
                ? finalTimestamps 
                : this.estimateWordTimings(displayText, actualDurationMs / 1000);
              
              console.log(`[Progressive] Sending word_timing_final: sentence=${index}, ${timings.length} words, duration=${actualDurationMs}ms`);
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
   * Enrich WORD_MAP whiteboard items with related words (synonyms, antonyms, etc.)
   * Runs asynchronously in background - sends update when complete
   */
  private async enrichWordMapItems(
    ws: WS,
    items: WhiteboardItem[],
    language: string,
    turnId: number
  ): Promise<void> {
    // Find word_map items that need enrichment using type guard
    const wordMapItems = items.filter((item): item is WordMapItem => 
      isWordMapItem(item) && item.data?.isLoading === true
    );
    
    if (wordMapItems.length === 0) return;
    
    const gemini = getGeminiStreamingService();
    
    for (const item of wordMapItems) {
      try {
        const targetWord = item.data.targetWord;
        if (!targetWord) continue;
        
        console.log(`[WORD_MAP] Enriching "${targetWord}" for ${language}...`);
        const startTime = Date.now();
        
        const relatedWords = await gemini.generateRelatedWords(targetWord, language);
        
        const elapsed = Date.now() - startTime;
        console.log(`[WORD_MAP] Enriched "${targetWord}" in ${elapsed}ms:`, {
          synonyms: relatedWords.synonyms.length,
          antonyms: relatedWords.antonyms.length,
          collocations: relatedWords.collocations.length,
          wordFamily: relatedWords.wordFamily.length,
        });
        
        // Create updated item with enriched data
        const enrichedItem: WordMapItem = {
          ...item,
          data: {
            targetWord,
            synonyms: relatedWords.synonyms,
            antonyms: relatedWords.antonyms,
            collocations: relatedWords.collocations,
            wordFamily: relatedWords.wordFamily,
            isLoading: false,
          },
        };
        
        // Send update to client with enriched item
        this.sendMessage(ws, {
          type: 'whiteboard_update',
          timestamp: Date.now(),
          turnId,
          items: [enrichedItem],
          shouldClear: false,
        } as StreamingWhiteboardMessage);
        
      } catch (error: any) {
        console.error(`[WORD_MAP] Error enriching "${item.data.targetWord}":`, error.message);
        
        // Send update with loading:false even on error (to stop spinner)
        const fallbackItem: WordMapItem = {
          ...item,
          data: {
            ...item.data,
            isLoading: false,
          },
        };
        
        this.sendMessage(ws, {
          type: 'whiteboard_update',
          timestamp: Date.now(),
          turnId,
          items: [fallbackItem],
          shouldClear: false,
        } as StreamingWhiteboardMessage);
      }
    }
  }
  
  /**
   * Send a JSON message over WebSocket
   */
  private sendMessage(ws: WS, message: StreamingMessage): void {
    if (ws.readyState === WS.OPEN) {
      const json = JSON.stringify(message);
      // DEBUG: Log critical message sends
      if (message.type === 'word_timing_delta') {
        console.log(`[SEND DEBUG] word_timing_delta: readyState=${ws.readyState}, length=${json.length}`);
      }
      if (message.type === 'word_timing_final') {
        const finalMsg = message as any;
        console.log(`[SEND DEBUG] word_timing_final: readyState=${ws.readyState}, sentence=${finalMsg.sentenceIndex}, words=${finalMsg.words?.length}, length=${json.length}`);
      }
      if (message.type === 'audio_chunk') {
        const audioMsg = message as any;
        console.log(`[SEND DEBUG] audio_chunk: sentence=${audioMsg.sentenceIndex}, chunk=${audioMsg.chunkIndex}, audioLen=${audioMsg.audio?.length || 0}, isLast=${audioMsg.isLast}`);
      }
      if (message.type === 'response_complete') {
        const completeMsg = message as any;
        console.log(`[SEND DEBUG] >>> RESPONSE_COMPLETE: totalSentences=${completeMsg.totalSentences}, fullText=${completeMsg.fullText?.slice(0, 50)}...`);
      }
      ws.send(json);
    } else {
      // DEBUG: Log when WebSocket isn't open
      if (message.type === 'word_timing_delta' || message.type === 'audio_chunk' || message.type === 'word_timing_final') {
        console.log(`[SEND DEBUG] SKIPPED ${message.type}: readyState=${ws.readyState} (not OPEN)`);
      }
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
      let connectionsAboutStudent: { mentioner: string; relationship: string; context: string }[] = [];
      
      try {
        const [actflProgress, userProgress, enrollments, recentConversations, user] = await Promise.all([
          storage.getOrCreateActflProgress(session.targetLanguage, String(session.userId))
            .catch(() => null),
          storage.getOrCreateUserProgress(session.targetLanguage, String(session.userId))
            .catch(() => null),
          storage.getStudentEnrollments(String(session.userId))
            .catch(() => []),
          storage.getUserConversations(String(session.userId))
            .catch(() => []),
          storage.getUser(String(session.userId))
            .catch(() => null),
        ]);
        
        // Look up connections about this student (where others mentioned them)
        // This enables "warm introductions" - e.g., "I know you're David's friend from graduate school!"
        if (user?.firstName) {
          try {
            const connections = await storage.getConnectionsAboutPerson(
              String(session.userId),
              user.firstName,
              user.lastName || undefined
            );
            
            for (const conn of connections) {
              // Get the mentioner's name for context
              if (conn.mentionedBy && conn.mentionedBy !== String(session.userId)) {
                const mentioner = await storage.getUser(conn.mentionedBy);
                if (mentioner) {
                  connectionsAboutStudent.push({
                    mentioner: mentioner.firstName || 'Someone',
                    relationship: conn.relationshipType,
                    context: conn.pendingPersonContext || conn.relationshipDetails || '',
                  });
                }
              }
            }
            
            if (connectionsAboutStudent.length > 0) {
              console.log(`[Streaming Greeting] Found ${connectionsAboutStudent.length} connection(s) about student`);
            }
          } catch (connError: any) {
            console.log(`[Streaming Greeting] Could not fetch connections: ${connError.message}`);
          }
        }
        
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
        isResumed,
        connectionsAboutStudent
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
   * Build a simple context prompt for starting a conversation
   * 
   * Philosophy: Give Daniela context, not scripts. She decides how to open
   * the conversation based on who the student is and what they're working on.
   * This is what real tutors do - they synthesize context and make a judgment call.
   */
  private buildGreetingPrompt(
    session: StreamingSession,
    userName: string | undefined,
    actflLevel: string,
    wordsLearned: number,
    recentTopics: string[],
    classEnrollment: { className: string; curriculumLesson?: string; curriculumUnit?: string } | null,
    isResumed?: boolean,
    connectionsAboutStudent?: { mentioner: string; relationship: string; context: string }[]
  ): string {
    // Build context summary
    const contextParts: string[] = [];
    
    if (userName) {
      contextParts.push(`Student's name: ${userName}`);
    }
    
    contextParts.push(`ACTFL level: ${actflLevel}`);
    contextParts.push(`Target language: ${session.targetLanguage}`);
    contextParts.push(`Native language: ${session.nativeLanguage}`);
    
    if (wordsLearned > 0) {
      contextParts.push(`Vocabulary learned: ${wordsLearned} words`);
    }
    
    if (recentTopics.length > 0) {
      contextParts.push(`Recently practiced: ${recentTopics.join(', ')}`);
    }
    
    // Class context
    if (classEnrollment) {
      contextParts.push(`Enrolled in class: "${classEnrollment.className}"`);
      if (classEnrollment.curriculumUnit) {
        contextParts.push(`Current unit: ${classEnrollment.curriculumUnit}`);
      }
      if (classEnrollment.curriculumLesson) {
        contextParts.push(`Current lesson: ${classEnrollment.curriculumLesson}`);
      }
    } else {
      contextParts.push('Learning path: Self-directed (no class enrollment)');
    }
    
    // WARM INTRODUCTION: If someone told Daniela about this student, include that context!
    // This creates the magical "How did you know that?!" moment
    if (connectionsAboutStudent && connectionsAboutStudent.length > 0) {
      contextParts.push(`\n*** SPECIAL PERSONAL CONTEXT (from your neural network!) ***`);
      for (const conn of connectionsAboutStudent) {
        contextParts.push(`${conn.mentioner} told you about this student:`);
        contextParts.push(`- Relationship to ${conn.mentioner}: ${conn.relationship}`);
        if (conn.context) {
          contextParts.push(`- What you learned: ${conn.context}`);
        }
      }
      contextParts.push(`Use this personal knowledge naturally - mention their connection to ${connectionsAboutStudent[0].mentioner} to surprise and delight them!`);
    }
    
    // Check if this is a resumed conversation
    const hasConversationHistory = session.conversationHistory.length > 0;
    const isResumedConversation = isResumed && hasConversationHistory;
    
    if (isResumedConversation) {
      // Include brief history context for resumed sessions
      const historyPreview = session.conversationHistory
        .slice(-4)
        .map(h => `${h.role === 'user' ? 'Student' : 'You'}: ${h.content.slice(0, 80)}${h.content.length > 80 ? '...' : ''}`)
        .join('\n');
      
      contextParts.push(`\nThis is a RESUMED conversation. Recent history:\n${historyPreview}`);
    } else {
      contextParts.push('\nThis is the START of a new session.');
    }
    
    // Simple, non-prescriptive prompt with clear directive
    return `Session context:
${contextParts.join('\n')}

Using this context, speak first to the student with a natural opening message. Open the conversation based on who they are and what you know about them - just like a real tutor would. Be warm, be brief (2 sentences max), and be yourself.`;
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
   * Used for barge-in support in both push-to-talk and open mic modes
   */
  handleInterrupt(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      console.log(`[Streaming Orchestrator] Interrupt received for session: ${sessionId}`);
      
      // Set interrupted flag to stop ongoing TTS streaming
      session.isInterrupted = true;
      
      // Clear generating flag since we're aborting
      session.isGenerating = false;
      
      // Send response_complete to signal client to stop playback
      this.sendMessage(session.ws, {
        type: 'response_complete',
        timestamp: Date.now(),
        turnId: session.currentTurnId,
        totalSentences: 0,  // Indicates interrupted response
        wasInterrupted: true,
      } as StreamingResponseCompleteMessage);
      
      console.log(`[Streaming Orchestrator] Interrupt processed - TTS stopped, generation aborted`);
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
   * Process a dynamic introduction when voice/tutor is switched via button
   * The new tutor introduces themselves with an LLM-generated, persona-aware greeting
   * 
   * Uses streamSentenceAudioProgressive to properly stream audio chunks to the client
   * following the exact same protocol as normal voice responses.
   */
  async processVoiceSwitchIntro(sessionId: string, tutorName: string, tutorGender: 'male' | 'female'): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isActive) {
      console.warn(`[Streaming Orchestrator] Cannot process voice switch - session not found: ${sessionId}`);
      return;
    }
    
    // Update session with new tutor info so LLM knows the persona
    session.tutorGender = tutorGender;
    session.tutorName = tutorName;
    
    // Check if this is a cross-language switch
    const isLanguageSwitch = session.isLanguageSwitchHandoff || false;
    const previousLanguage = session.previousLanguage;
    
    console.log(`[Voice Switch] New tutor ${tutorName} (${tutorGender}) introducing themselves via LLM${isLanguageSwitch ? ` (cross-language from ${previousLanguage})` : ''}`);
    
    let contextSummary = '';
    
    if (isLanguageSwitch) {
      // Cross-language switch: Only use conversation name for context (history was cleared)
      try {
        const conversation = await storage.getConversation(session.conversationId, String(session.userId));
        const conversationTitle = conversation?.title || conversation?.topic;
        if (conversationTitle) {
          contextSummary = `\n\nCONVERSATION CONTEXT:`;
          contextSummary += `\n- Conversation topic: "${conversationTitle}"`;
          contextSummary += `\n- Student was previously learning ${previousLanguage} and is now switching to ${session.targetLanguage}`;
          contextSummary += `\n- This is a fresh start in a new language - be welcoming and excited to teach them!`;
        }
      } catch (err) {
        console.warn('[Voice Switch] Could not fetch conversation name:', err);
      }
      
      // Clear the cross-language switch flag now that we've used it
      session.isLanguageSwitchHandoff = false;
      session.previousLanguage = undefined;
    } else {
      // Same-language switch: Build context summary from recent conversation for seamless handoff
      // Take last 4 exchanges (up to 8 messages) to provide context without overwhelming
      const recentHistory = session.conversationHistory.slice(-8);
      
      // Only build context if we have at least 2 messages with alternating roles
      const userMessages = recentHistory.filter(m => m.role === 'user');
      const tutorMessages = recentHistory.filter(m => m.role === 'model');
      const hasSubstantialContext = userMessages.length >= 1 && tutorMessages.length >= 1;
      
      if (hasSubstantialContext) {
        const lastUserMessage = userMessages[userMessages.length - 1];
        const lastTutorMessage = tutorMessages[tutorMessages.length - 1];
        
        contextSummary = `\n\nCONVERSATION CONTEXT (for seamless handoff):`;
        
        // Strip whiteboard markup and clean the context snippets
        // This prevents tags like [WRITE], [DRILL], [SWITCH_TUTOR] from appearing in the handoff prompt
        const cleanContext = (text: string, maxLen: number): string => {
          let cleaned = stripWhiteboardMarkup(text)
            .replace(/\*\*/g, '')
            .replace(/\*/g, '')
            .replace(/\n+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          return cleaned.length > maxLen ? cleaned.substring(0, maxLen) + '...' : cleaned;
        };
        
        const tutorContext = cleanContext(lastTutorMessage.content, 200);
        if (tutorContext) {
          contextSummary += `\n- The previous tutor was just saying: "${tutorContext}"`;
        }
        
        const userContext = cleanContext(lastUserMessage.content, 150);
        if (userContext) {
          contextSummary += `\n- The student just said: "${userContext}"`;
        }
      }
    }
    
    // Get previous tutor name from session (stored before switch in handoff execution)
    // For cross-language switches, this will be the tutor from the previous language
    const previousTutorName = session.previousTutorName || 'your colleague';
    
    // Clear the previous tutor name now that we've used it
    session.previousTutorName = undefined;
    
    // Generate a dynamic, persona-aware greeting using the LLM
    // The prompt provides conversation context for a seamless, natural handoff
    const switchPrompt = `[TUTOR SWITCH: You are now ${tutorName}, a ${tutorGender} ${session.targetLanguage} language tutor taking over from ${previousTutorName}.

INSTRUCTIONS:
1. Greet the student warmly in 1-2 short sentences, acknowledging you're joining the conversation
2. If there was an active topic being discussed, briefly reference it to show continuity (e.g., "I see you were working on..." or "Ah, the subjunctive!")
3. Offer to continue where ${previousTutorName} left off, or ask how you can help
4. Use appropriate grammatical gender in ${session.targetLanguage} (e.g., "profesora" for female in Spanish, "sensei" in Japanese)
5. Be warm, natural, and conversational - not robotic

DO NOT: Start with a generic "Hello, I am [name]" - instead, flow naturally into the existing conversation.${contextSummary}]`;
    
    // NEW TURN: Increment turnId for voice switch intro
    session.currentTurnId++;
    const turnId = session.currentTurnId;
    const switchStartTime = Date.now();
    let fullText = '';
    let sentenceCount = 0;
    
    // Create minimal metrics for streamSentenceAudioProgressive (it expects this structure)
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
      // Use the streaming Gemini service to generate a natural greeting
      await this.geminiService.streamWithSentenceChunking({
        systemPrompt: session.systemPrompt,
        conversationHistory: session.conversationHistory,
        userMessage: switchPrompt,
        onSentence: async (chunk: SentenceChunk) => {
          // Clean text for display
          const displayText = cleanTextForDisplay(chunk.text);
          if (!displayText) return;
          
          fullText += (fullText ? ' ' : '') + displayText;
          
          // Send sentence_start first (required before streamSentenceAudioProgressive)
          // Voice switch intros don't have target language content (all native L2 speech)
          this.sendMessage(session.ws, {
            type: 'sentence_start',
            timestamp: Date.now(),
            turnId,
            sentenceIndex: chunk.index,
            text: displayText,
            hasTargetContent: true,  // Tutor greeting is in target language
            targetLanguageText: displayText,
          } as StreamingSentenceStartMessage);
          
          // Use the existing progressive streaming method for proper audio delivery
          // This ensures we follow the exact same protocol as normal voice responses
          await this.streamSentenceAudioProgressive(
            session,
            chunk,  // Use chunk directly (preserves correct index)
            displayText,
            metrics,
            turnId
          );
          
          sentenceCount++;
        },
      });
      
      // Add the greeting to conversation history so the tutor "remembers" they introduced themselves
      session.conversationHistory.push({ role: 'model', content: fullText });
      
      // Send response complete (metrics omitted - local format differs from shared type)
      const totalDurationMs = Date.now() - switchStartTime;
      this.sendMessage(session.ws, {
        type: 'response_complete',
        timestamp: Date.now(),
        turnId,
        fullText,
        totalSentences: sentenceCount,
        totalDurationMs,
      } as StreamingResponseCompleteMessage);
      
      console.log(`[Voice Switch] Introduction complete: ${tutorName} said "${fullText}"`);
      
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
