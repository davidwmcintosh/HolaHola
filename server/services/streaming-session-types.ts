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
  subtitleMode: 'off' | 'target';
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
  isReadingRoom: boolean;
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
    mode?: 'tutor_mode' | 'founder_mode' | 'honesty_mode';
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
  geminiLiveResumptionHandle?: string;  // Last resumption token from Gemini Live — used to reconnect dropped sessions
  /**
   * When true the orchestrator is running a "shadow" tool-detection turn alongside
   * Gemini Live.  TTS audio dispatch and DB message persistence are suppressed so
   * the orchestrator only executes tool call side-effects (whiteboard, scenarios,
   * memory lookups, etc.) while GL handles the actual audio response.
   */
  geminiLiveToolsOnly?: boolean;
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
  // When set, tts-dispatcher auto-restores tutor voice after functionCallText is spoken
  // (used by SPEAK_CHARACTER_LINE to make character speech atomic — no resume_tutor needed)
  _restoreVoiceAfterLine?: { voiceId: string; ttsProvider: string } | null;
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
  historySearchResults?: Record<string, Array<{ content: string; role: string; createdAt: Date | null; conversationId: string }>>;
  conversationThreadResults?: Record<string, string>;
  conversationBrowseResults?: Record<string, string>;
  recallResults?: Record<string, string>;
  conversationThemeResults?: string;
  diaryReadResult?: string;
  fullSessionResults?: Record<string, string>; // keyed by conversationId
  // Proactive memory surfacing (zero-latency, next-turn injection)
  surfacedMemoryIds?: Set<string>;    // memory IDs already injected this session (dedup)
  pendingMemorySurfaces?: string[];   // formatted memory lines staged for next turn's context
  lastCommittedMemoryId?: string;     // Gap 1: ID of most recently committed real-time memory
  pendingGlContext?: string[];        // Gap 10: frontend events queued for GL context injection (flushed via tool response)
  studentPulse?: {                    // Gap 6: rolling frustration/engagement read from student messages
    frustrationScore: number;         // 0-10, decays toward 0 between messages
    signals: string[];                // recent signal descriptions (capped at 10)
    messageCount: number;             // total student messages scored this session
  };
  selfReflectionsResult?: string;
  coreSelfResult?: string;
  curiositiesResult?: string;
  personalSharesResult?: string;
  senseTimeResult?: string;
  textbookPageResult?: string;
  goalStateResult?: string;
  imageRecallResults?: Record<string, {
    text: string;
    images: Array<{ mimeType: string; data: string }>;
  }>;
  // Vision system — allows Daniela to see vocabulary images, scene backgrounds, and props
  seenImageUrls?: Set<string>; // URLs already sent as inlineData this session (session-level dedup)
  visionBuffer?: Record<string, {
    url: string;
    description: string;
    inlineData?: { mimeType: string; data: string }; // present only on first-time bytes
    sceneStateText?: string; // Tier-1 structural canvas state (open_scene / add_to_scene)
    word?: string;           // Vocab card: the target-language word shown
    definition?: string;     // Vocab card: the English definition shown
  } | Array<{              // Vocab grid: one entry per word in the grid
    word: string;
    translation: string;
    description?: string;
    inlineData?: { mimeType: string; data: string };
    mode?: string;
  }>>;
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
  // Vocab images taught so far this session — keyed by normalised word (e.g. "el_tiempo")
  // Used by the word-echo system to flash the image when the word is mentioned again.
  taughtVocab?: Map<string, { word: string; imageUrl: string; meaning?: string }>;
  // Words added to taughtVocab during the current turn — excluded from echo this turn.
  vocabAddedThisTurn?: Set<string>;
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
    patternSignalsSection?: string;  // Student grammar pattern map (wobbles, stability, drilling) — pre-injected per student
    temporalAwarenessSection?: string; // Upcoming/recent time-sensitive facts (temporal reasoning)
    coverageAuditSection?: string;     // Blind spots — topic areas Daniela knows little about yet
    goalSection?: string;              // Active learning goal + capability map for self-directed students
    teachingSkillsSection?: string;    // Available teaching skills summary (invoke_teaching_skill)
    fatContextProfile?: string;
    fatContextVocabulary?: string;
    fatContextConversations?: string;
    fatContextMemories?: string;
    fatContextRouting?: string;
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
