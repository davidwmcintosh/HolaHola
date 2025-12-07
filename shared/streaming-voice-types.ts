/**
 * Streaming Voice Mode Types & Constants
 * 
 * Architecture: Gemini streaming → Sentence chunker → Cartesia WebSocket → Progressive audio
 * Target: Reduce voice response latency from 5-7 seconds to < 1 second TTFT
 */

/**
 * Client connection states
 */
export type StreamingClientState = 
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'ready'
  | 'processing'
  | 'reconnecting'  // Auto-reconnecting after unexpected disconnect
  | 'error';

/**
 * Voice input mode for recording
 * - push-to-talk: User holds button/key to record (default)
 * - open-mic: Continuous listening with VAD-triggered auto-submit
 */
export type VoiceInputMode = 'push-to-talk' | 'open-mic';

/**
 * Open mic state for visual feedback
 * - idle: Mic is open but no speech detected
 * - listening: Speech detected, actively capturing
 * - processing: Audio submitted, waiting for response
 */
export type OpenMicState = 'idle' | 'listening' | 'processing';

/**
 * Streaming performance metrics
 */
export interface StreamingMetrics {
  sttLatencyMs: number;
  aiFirstTokenMs: number;
  ttsFirstChunkMs: number;
  totalTtfbMs: number;
  sentenceCount: number;
  totalDurationMs: number;
}

/**
 * Streaming voice message types sent from server to client
 */
export type StreamingVoiceMessageType = 
  | 'connected'           // WebSocket connected successfully (handshake complete)
  | 'session_started'     // Session authenticated and ready
  | 'processing'          // STT received, AI processing started
  | 'sentence_start'      // New sentence chunk starting
  | 'sentence_ready'      // NEW: First audio + first timing bundled (prevents timing race)
  | 'audio_chunk'         // Audio data for current sentence
  | 'word_timing'         // Word-level timing for subtitle sync (buffered mode)
  | 'word_timing_delta'   // Progressive: Incremental word timing update
  | 'word_timing_final'   // Progressive: Final timing reconciliation
  | 'sentence_end'        // Current sentence complete
  | 'response_complete'   // Full AI response finished
  | 'feedback'            // Pedagogical feedback (non-blocking)
  | 'whiteboard_update'   // Visual teaching aids (vocabulary, drills, images)
  | 'voice_updated'       // Voice switch confirmation (tutor voice changed)
  | 'vad_speech_started'  // Open mic: User started speaking (VAD detected speech)
  | 'vad_utterance_end'   // Open mic: User stopped speaking (VAD detected silence)
  | 'interim_transcript'  // Open mic: Real-time interim transcript for feedback
  | 'input_mode_changed'  // Input mode switched (push-to-talk ↔ open-mic)
  | 'error';              // Error occurred

/**
 * Base message structure for all streaming events
 */
export interface StreamingVoiceMessage {
  type: StreamingVoiceMessageType;
  timestamp: number;
  sequenceId?: number;  // For ordering chunks
}

/**
 * Connection established message (handshake complete, no auth yet)
 */
export interface StreamingConnectedMessage extends StreamingVoiceMessage {
  type: 'connected';
}

/**
 * Session started message (authentication complete, ready for audio)
 */
export interface StreamingSessionStartedMessage extends StreamingVoiceMessage {
  type: 'session_started';
  sessionId: string;
}

/**
 * Processing started (STT received, AI generating)
 * Includes turnId so client knows which response to expect
 */
export interface StreamingProcessingMessage extends StreamingVoiceMessage {
  type: 'processing';
  turnId: number;         // Monotonic ID for this response turn
  userTranscript: string;  // What the user said
}

/**
 * New sentence starting - prepare for audio
 * 
 * NEW ARCHITECTURE (v2): Server is the single source of truth for subtitle state.
 * - turnId: Monotonic ID for each assistant response (increments on new user input)
 * - hasTargetContent: Explicit flag - if false, client hides subtitles immediately (no fallback)
 * - Client should discard any packet with older turnId than current render context
 */
export interface StreamingSentenceStartMessage extends StreamingVoiceMessage {
  type: 'sentence_start';
  turnId: number;         // Monotonic ID for this assistant turn (prevents phantom subtitles)
  sentenceIndex: number;
  text: string;           // The sentence text (for display)
  hasTargetContent: boolean;  // Explicit flag: true = show subtitles, false = hide immediately
  targetLanguageText?: string;  // Target language only (if hasTargetContent is true)
  wordMapping?: [number, number][];  // Maps fullTextWordIndex -> targetTextWordIndex for karaoke in Target mode
}

/**
 * NEW: Sentence ready - First audio chunk bundled with first word timing
 * 
 * ARCHITECTURE: Prevents timing race condition where audio playback starts
 * before word timings arrive. Server buffers until BOTH are available,
 * then sends them atomically in one message.
 * 
 * - firstAudioChunk: The first PCM audio chunk (can start playback)
 * - firstWordTiming: Word timing for index 0 (can initialize subtitle timeline)
 * - Client should NOT start playback until receiving this message
 * - Subsequent audio_chunk and word_timing_delta messages follow normally
 */
export interface StreamingSentenceReadyMessage extends StreamingVoiceMessage {
  type: 'sentence_ready';
  turnId: number;
  sentenceIndex: number;
  // First audio chunk data
  firstAudioChunk: {
    chunkIndex: number;
    durationMs: number;
    audio: string;  // Base64-encoded
    audioFormat: AudioFormat;
    sampleRate: number;
  };
  // First word timing (at minimum word index 0)
  firstWordTimings: WordTiming[];  // All timings received so far (at least 1)
  estimatedTotalDuration?: number;
}

/**
 * Audio format types
 * - mp3: Standard MP3 audio (plays via HTMLAudioElement)
 * - pcm_f32le: Raw 32-bit float PCM, little-endian (plays via Web Audio API)
 */
export type AudioFormat = 'mp3' | 'pcm_f32le';

/**
 * Audio chunk for current sentence
 * Binary data sent separately via WebSocket binary frame
 */
export interface StreamingAudioChunkMessage extends StreamingVoiceMessage {
  type: 'audio_chunk';
  turnId: number;         // For packet ordering/filtering
  sentenceIndex: number;
  chunkIndex: number;
  isLast: boolean;        // Last chunk for this sentence
  durationMs: number;     // Duration of this chunk
  audio: string;          // Base64-encoded audio data
  audioFormat?: AudioFormat;  // Audio format (default: 'mp3' for backwards compatibility)
  sampleRate?: number;    // Sample rate for PCM (default: 24000)
}

/**
 * Word-level timing for karaoke-style subtitles
 */
export interface StreamingWordTimingMessage extends StreamingVoiceMessage {
  type: 'word_timing';
  turnId: number;         // For packet ordering/filtering
  sentenceIndex: number;
  words: WordTiming[];
  timings: WordTiming[];  // Alias for words
  expectedDurationMs?: number;  // For client-side rescaling if actual differs
}

/**
 * PROGRESSIVE STREAMING: Incremental word timing update
 * Sent as word timestamps arrive from Cartesia during progressive streaming.
 * Client should accumulate these until word_timing_final arrives.
 */
export interface StreamingWordTimingDeltaMessage extends StreamingVoiceMessage {
  type: 'word_timing_delta';
  turnId: number;
  sentenceIndex: number;
  wordIndex: number;        // Which word this timing is for
  word: string;             // The word text
  startTime: number;        // Seconds from sentence start
  endTime: number;          // Seconds from sentence start
  estimatedTotalDuration?: number;  // Current estimate of total sentence duration
}

/**
 * PROGRESSIVE STREAMING: Final word timing reconciliation
 * Sent when sentence synthesis completes. Contains authoritative timings.
 * Client should use this to correct any timing drift from delta messages.
 */
export interface StreamingWordTimingFinalMessage extends StreamingVoiceMessage {
  type: 'word_timing_final';
  turnId: number;
  sentenceIndex: number;
  words: WordTiming[];      // All word timings (authoritative)
  actualDurationMs: number; // Actual sentence duration for rescaling
}

/**
 * Word timing data (matches existing TTSService interface)
 */
export interface WordTiming {
  word: string;
  startTime: number;  // Seconds from sentence start
  endTime: number;    // Seconds from sentence start
}

/**
 * Sentence complete
 */
export interface StreamingSentenceEndMessage extends StreamingVoiceMessage {
  type: 'sentence_end';
  turnId: number;         // For packet ordering/filtering
  sentenceIndex: number;
  totalDurationMs: number;
}

/**
 * Full response complete
 */
export interface StreamingResponseCompleteMessage extends StreamingVoiceMessage {
  type: 'response_complete';
  turnId: number;         // Which turn this completes
  totalSentences: number;
  totalDurationMs?: number;
  fullText?: string;       // Complete AI response text
  emotion?: string;       // Final emotion used
  metrics?: StreamingMetrics;  // Performance metrics
  wasInterrupted?: boolean;  // True if response was interrupted (barge-in)
}

/**
 * Feedback message (pedagogical guidance, non-blocking)
 */
export interface StreamingFeedbackMessage extends StreamingVoiceMessage {
  type: 'feedback';
  feedbackType: 'one_word_rule' | 'pronunciation_tip' | 'encouragement' | 'actfl_advancement';
  message: string;
  severity?: string;
  details?: {
    currentLevel?: string;
    nextLevel?: string;
    progress?: number;
    reason?: string;
  };
}

/**
 * Whiteboard update message - sends visual teaching aids to the client
 * The tutor uses markup like [WRITE], [IMAGE], [DRILL] to create visual content
 */
export interface StreamingWhiteboardMessage extends StreamingVoiceMessage {
  type: 'whiteboard_update';
  turnId: number;
  items: import('./whiteboard-types').WhiteboardItem[];
  shouldClear?: boolean;
}

/**
 * Error message
 */
export interface StreamingErrorMessage extends StreamingVoiceMessage {
  type: 'error';
  code: StreamingErrorCode;
  message: string;
  recoverable: boolean;   // Can client retry?
}

/**
 * VAD speech started message - User started speaking (open mic mode)
 * Sent from server when Deepgram detects speech start
 */
export interface StreamingVADSpeechStartedMessage extends StreamingVoiceMessage {
  type: 'vad_speech_started';
}

/**
 * VAD utterance end message - User stopped speaking (open mic mode)
 * Sent from server when Deepgram detects utterance end
 * This triggers auto-submit in open mic mode
 */
export interface StreamingVADUtteranceEndMessage extends StreamingVoiceMessage {
  type: 'vad_utterance_end';
}

/**
 * Error codes for streaming voice
 */
export type StreamingErrorCode = 
  | 'CONNECTION_FAILED'
  | 'STT_FAILED'
  | 'AI_FAILED'
  | 'TTS_FAILED'
  | 'RATE_LIMITED'
  | 'UNAUTHORIZED'
  | 'TIMEOUT'
  | 'EMPTY_TRANSCRIPT'
  | 'CONTENT_REJECTED'
  | 'UNKNOWN';

/**
 * Union type of all streaming messages
 */
export type StreamingMessage = 
  | StreamingConnectedMessage
  | StreamingSessionStartedMessage
  | StreamingProcessingMessage
  | StreamingSentenceStartMessage
  | StreamingSentenceReadyMessage
  | StreamingAudioChunkMessage
  | StreamingWordTimingMessage
  | StreamingWordTimingDeltaMessage
  | StreamingWordTimingFinalMessage
  | StreamingSentenceEndMessage
  | StreamingResponseCompleteMessage
  | StreamingFeedbackMessage
  | StreamingWhiteboardMessage
  | StreamingErrorMessage
  | StreamingVADSpeechStartedMessage
  | StreamingVADUtteranceEndMessage;

/**
 * Client-to-server message types
 */
export type ClientVoiceMessageType = 
  | 'start_session'       // Initialize streaming session
  | 'audio_data'          // User's audio recording (push-to-talk)
  | 'stream_audio_chunk'  // Streaming audio chunk (open-mic)
  | 'stop_streaming'      // Stop open-mic streaming
  | 'request_greeting'    // Request AI-generated personalized greeting
  | 'interrupt'           // User interrupted (started speaking)
  | 'set_input_mode'      // Switch between push-to-talk and open-mic
  | 'end_session';        // Close session

/**
 * Client message to start a streaming session
 */
export interface ClientStartSessionMessage {
  type: 'start_session';
  conversationId: string;  // UUID string
  targetLanguage: string;
  nativeLanguage: string;
  difficultyLevel: string;
  subtitleMode: 'off' | 'target' | 'all';
  tutorPersonality?: string;
  tutorExpressiveness?: number;
  tutorGender?: 'male' | 'female';
  voiceSpeed?: 'slower' | 'slow' | 'normal' | 'fast' | 'faster';
  inputMode?: VoiceInputMode;  // Push-to-talk (default) or open-mic
}

/**
 * Client message with audio data (push-to-talk: complete recording)
 */
export interface ClientAudioDataMessage {
  type: 'audio_data';
  audio: ArrayBuffer;     // Raw audio data (will be transcribed)
  format: 'webm' | 'wav' | 'mp3';
}

/**
 * Client message with streaming audio chunk (open-mic: real-time streaming)
 * Audio is streamed continuously while mic is active, VAD detects speech boundaries
 */
export interface ClientStreamAudioChunkMessage {
  type: 'stream_audio_chunk';
  audio: ArrayBuffer;     // Audio chunk for real-time streaming
  format: 'webm' | 'wav';
  sequenceId: number;     // For ordering chunks
}

/**
 * Client message to stop open-mic streaming
 */
export interface ClientStopStreamingMessage {
  type: 'stop_streaming';
}

/**
 * Client interrupt message (user started speaking)
 */
export interface ClientInterruptMessage {
  type: 'interrupt';
}

/**
 * Client message to request AI-generated greeting
 * Used when starting a new conversation - generates personalized, ACTFL-aware greeting
 */
export interface ClientRequestGreetingMessage {
  type: 'request_greeting';
  userName?: string;  // Student's name for personalization
}

/**
 * Client message to switch input mode mid-session
 * Used when user toggles between push-to-talk and open-mic
 */
export interface ClientSetInputModeMessage {
  type: 'set_input_mode';
  inputMode: VoiceInputMode;
}

/**
 * Sentence chunking configuration
 */
export const SENTENCE_CHUNKING_CONFIG = {
  /** Minimum characters before considering a sentence break */
  MIN_SENTENCE_LENGTH: 20,
  
  /** Maximum characters before forcing a chunk (prevents long waits) */
  MAX_SENTENCE_LENGTH: 200,
  
  /** Punctuation that marks sentence boundaries */
  SENTENCE_ENDINGS: ['.', '!', '?', '。', '！', '？'],
  
  /** Punctuation that can break long sentences */
  CLAUSE_BREAKS: [',', ';', ':', '—', '–', '、', '，'],
  
  /** Maximum time to wait for more tokens before forcing chunk (ms) */
  CHUNK_TIMEOUT_MS: 500,
  
  /** Heartbeat interval to keep connection alive (ms) */
  HEARTBEAT_INTERVAL_MS: 30000,
} as const;

/**
 * Audio streaming configuration
 */
export const AUDIO_STREAMING_CONFIG = {
  /** Cartesia sample rate */
  SAMPLE_RATE: 44100,
  
  /** Audio container format */
  CONTAINER: 'mp3',
  
  /** Bit rate for quality */
  BIT_RATE: 128000,
  
  /** Minimum buffer before playback starts (ms) */
  MIN_BUFFER_MS: 100,
  
  /** Maximum buffer size before backpressure (ms) */
  MAX_BUFFER_MS: 5000,
  
  /** Cross-fade duration between sentences (ms) */
  CROSSFADE_MS: 50,
} as const;

/**
 * Latency targets
 */
export const LATENCY_TARGETS = {
  /** Target time to first audio byte */
  TTFB_MS: 800,
  
  /** Maximum acceptable TTFB before warning */
  TTFB_WARNING_MS: 1500,
  
  /** STT processing target */
  STT_TARGET_MS: 500,
  
  /** AI first token target */
  AI_TTFT_MS: 200,
  
  /** TTS first chunk target */
  TTS_FIRST_CHUNK_MS: 100,
} as const;

/**
 * Feature flags for gradual rollout
 */
export const STREAMING_FEATURE_FLAGS = {
  /** Enable streaming mode (can be disabled for fallback) */
  ENABLED: true,
  
  /** Use Cartesia WebSocket (vs chunked bytes API) */
  USE_CARTESIA_WEBSOCKET: true,
  
  /** Enable word-level timestamps from Cartesia */
  ENABLE_WORD_TIMESTAMPS: true,
  
  /** Enable sentence-level chunking (vs full response) */
  ENABLE_SENTENCE_CHUNKING: true,
  
  /** 
   * PROGRESSIVE STREAMING
   * When enabled, audio chunks are sent to client as they arrive from Cartesia
   * instead of buffering the full sentence. Reduces time-to-first-audio by ~2s.
   * 
   * DISABLED: Buffered mode guarantees bulletproof subtitle sync because:
   * - All word timings arrive BEFORE audio playback starts
   * - No race conditions between timing data and playback
   * - Single source of truth: AudioContext.currentTime
   * 
   * Trade-off: ~100-200ms extra latency per sentence (still well under 3s target)
   */
  PROGRESSIVE_AUDIO_STREAMING: false,
} as const;
