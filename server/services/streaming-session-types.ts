import { WebSocket as WS } from "ws";
import type { TutorPersonality } from "./tts-service";
import type { VoiceSpeedOption } from "./voice-speed-config";
import type { ExtractedFunctionCall, ConversationHistoryEntry } from "./gemini-streaming";
import type { TutorDirectoryEntry } from "../system-prompt";

export interface StreamingSession {
  id: string;
  userId: string;
  conversationId: string;
  targetLanguage: string;
  nativeLanguage: string;
  difficultyLevel: string;
  subtitleMode: 'off' | 'target' | 'all';
  tutorPersonality: TutorPersonality;
  tutorExpressiveness: number;
  voiceSpeed: VoiceSpeedOption;
  voiceId?: string;
  geminiLanguageCode?: string;
  ttsProvider?: 'elevenlabs' | 'cartesia' | 'google' | 'gemini';
  tutorGender: 'male' | 'female';
  tutorName: string;
  systemPrompt: string;
  conversationHistory: Array<ConversationHistoryEntry>;
  ws: WS;
  startTime: number;
  isActive: boolean;
  isFounderMode: boolean;
  isRawHonestyMode: boolean;
  isIncognito: boolean;
  isDeveloperUser: boolean;
  isBetaTester: boolean;
  idleTimeoutId?: NodeJS.Timeout;
  creditCheckIntervalId?: NodeJS.Timeout;
  contextRefreshTimeoutId?: NodeJS.Timeout;
  lastContextRefreshTime: number;
  lastActivityTime: number;
  currentTurnId: number;
  warmupPromise?: Promise<void>;
  isInterrupted: boolean;
  lastTurnWasInterrupted: boolean;
  isGenerating: boolean;
  pendingTutorSwitch?: {
    targetGender: 'male' | 'female';
    targetLanguage?: string;
    targetRole?: 'tutor' | 'assistant';
  };
  previousTutorName?: string;
  /**
   * Gemini 3 thought signatures from current turn's function calls
   * MUST be passed back to API in subsequent requests for multi-step function calling
   */
  currentTurnThoughtSignatures?: string[];
  /**
   * Function calls from current turn (for proper bundling of parallel function calls)
   */
  currentTurnFunctionCalls?: ExtractedFunctionCall[];
  /**
   * Dynamic context preamble entries for current turn
   * MUST be cleared at start of each new turn to prevent stale context bleed
   */
  currentTurnPreamble?: ConversationHistoryEntry[];
  isLanguageSwitchHandoff?: boolean;
  previousLanguage?: string;
  switchTutorTriggered?: boolean;
  crossLanguageTransferBlocked?: boolean;
  pendingSupportHandoff?: {
    category: 'technical' | 'account' | 'billing' | 'content' | 'feedback' | 'other';
    reason: string;
    priority: 'low' | 'normal' | 'high' | 'critical';
    context?: string;
  };
  pendingAssistantHandoff?: {
    drillType: 'repeat' | 'translate' | 'match' | 'fill_blank' | 'sentence_order';
    focus: string;
    items: string[];
    priority?: 'low' | 'medium' | 'high';
  };
  isAssistantActive?: boolean;
  cachedMainTutorVoiceId?: string;
  cachedMainTutorGender?: 'male' | 'female';
  conversationTopic?: string;
  conversationTitle?: string;
  lastSessionSummary?: string;
  studentGoals?: string;
  dbSessionId?: string;
  classId?: string;
  toolsUsedSession: string[];
  hiveChannelId?: string;
  pendingArchitectNoteIds: string[];
  onTtsStateChange?: (isTtsPlaying: boolean) => void;
  postTtsSuppressionTimer?: NodeJS.Timeout | null;
  // Adaptive Speech Rate tracking
  recentSttConfidences: number[];
  sessionStruggleCount: number;
  adaptiveSpeedEnabled: boolean;
  // Phoneme analytics tracking
  sessionWordAnalyses: Array<{ word: string; confidence: number }>;
  // Azure Pronunciation Assessment
  sessionAudioChunks: Buffer[];
  sessionTranscripts: Array<{ text: string; timestamp: number }>;
  tutorDirectory?: TutorDirectoryEntry[];
  voiceDefaults?: {
    speakingRate: number;
    personality: TutorPersonality;
    emotion: string;
    expressiveness: number;
  };
  tutorPersona?: {
    pedagogicalFocus?: string;
    teachingStyle?: string;
    errorTolerance?: string;
    vocabularyLevel?: string;
    personalityTraits?: string;
    scenarioStrengths?: string;
    teachingPhilosophy?: string;
  };
  // FC OpenMic: Flags for coordinating function call TTS with main pipeline
  earlyTtsActive?: boolean;
  functionCallText?: string;
  voiceAdjustText?: string;
  accumulatedBoldWords?: string[];
  // ElevenLabs voice settings
  elStability?: number;
  elSimilarityBoost?: number;
  elStyle?: number;
  elSpeakerBoost?: boolean;
  // STT keyword biasing
  sttKeyterms?: string[];
  // Diagnostic counters
  _ttsTurnCallCount?: number;
  // Whiteboard/overlay state
  customOverlayText?: string;
  pendingTextInput?: { prompt: string };
  commandParserClear?: boolean;
  commandParserHold?: boolean;
  // Greeting lifecycle flags
  __greetingInProgress?: boolean;
  __greetingDelivered?: boolean;
  greetingTriggeredByOrchestrator?: boolean;
  // Active secondary character (multi-character voice)
  activeCharacter?: {
    id: string;
    displayName: string;
    role: string;
    gender: 'male' | 'female';
    voiceId: string;
    ttsProvider: 'cartesia' | 'elevenlabs' | 'google' | 'gemini';
  } | null;
  // Saved tutor voice before a character switch (restored on resume_tutor)
  _tutorVoiceBeforeCharacter?: string;
  // Scenario immersion state
  activeScenario?: Record<string, any> | null;
  studentActflLevel?: string;
  voiceGender?: string;
  // Cached data from function call handlers
  lastSyllabusData?: Record<string, any>;
  lastLoadedLesson?: Record<string, any>;
  lastVocabSet?: Record<string, any>;
  lastRecommendation?: Record<string, any>;
  lastDueVocab?: any[];
  lastCreditCheck?: Record<string, any>;
  creditContextInjected?: boolean;
  // Drill session state
  drillSession?: Record<string, any>;
  lastDrillSessionData?: Record<string, any>;
  // Dynamic key support for recovery timestamps and active TTS tracking
  [key: string]: any;
  // Deduplication: Track sent audio chunks
  sentAudioChunks: Set<string>;
  sentAudioHashes: Map<string, number>;
  lastProcessedTranscriptHash?: string;
  lastProcessedTranscriptTime?: number;
  lastResponseCompletedTime?: number;
  // Lesson Bundle Context
  lessonBundleContext?: {
    lessonId: string;
    lessonName: string;
    hasBundledDrills: boolean;
    bundleId?: string;
    linkedDrillLessonId?: string;
    drillsProvisioned: boolean;
    provisionedDrillCount?: number;
  };
  // Message checkpointing
  checkpointedUserMessageId?: string;
  checkpointedUserTranscript?: string;
  // Memory lookup results
  memoryLookupResults?: Record<string, string>;
  expressLaneLookupResults?: Record<string, string>;
  imageRecallResults?: Record<string, {
    text: string;
    images: Array<{ mimeType: string; data: string }>;
  }>;
  pendingMemoryLookupPromises?: Promise<void>[];
  // Voice Lab override settings
  voiceOverride?: {
    speakingRate?: number;
    emotion?: string;
    personality?: TutorPersonality;
    expressiveness?: number;
    reason?: string;
  };
  // Pending word emphases
  pendingWordEmphases?: Array<{
    word: string;
    style: 'stress' | 'slow' | 'both';
  }>;
  expressLaneSessionId?: string;
  activeTutorVoiceId?: string;
  tutorVoiceId?: string;
  pendingWhiteboardUpdates?: Array<{
    type: 'whiteboard_update';
    timestamp: number;
    items: any[];
  }>;
  firstAudioSent?: boolean;
  classroomWhiteboardItems?: Array<{ type: string; content?: string; label?: string }>;
  classroomSessionImages?: string[];
  // Pre-cached context from session start
  cachedContext?: {
    architectContext?: string;
    architectNoteIds?: string[];
    studentLearningSection?: string;
    studentLearningData?: { struggles?: any[]; effectiveStrategies?: any[] };
    hiveContextSection?: string;
    expressLaneSection?: string;
    identityMemoriesSection?: string;
    textChatSection?: string;
    editorFeedbackSection?: string;
    editorFeedbackIds?: string[];
    growthMemoriesSection?: string;  // Cindy's personal teaching growth log — pre-injected for all sessions
    fatContextProfile?: string;
    fatContextVocabulary?: string;
    fatContextConversations?: string;
    fatContextTokenEstimate?: number;
    textbookChapterContext?: string;
    courseTOC?: string;
    pedagogyDocContext?: string;
    lastFetchTime: number;
  };
  contextCacheReady?: Promise<void>;
  // SESSION ECONOMICS TELEMETRY
  telemetryTtsCharacters: number;
  telemetrySttSeconds: number;
  telemetryExchangeCount: number;
  telemetryStudentSpeakingMs: number;
  telemetryTutorSpeakingMs: number;
  telemetryLlmInputTokens: number;   // Accumulated Gemini input tokens for this session
  telemetryLlmOutputTokens: number;  // Accumulated Gemini output tokens for this session
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
  audioChunkCount: number;
  userTranscript?: string;
  aiResponse?: string;
  // Streaming function call metrics (Gemini 3)
  earlyIntentDetectedAt?: number;
  functionCallStreamingMs?: number;
}
