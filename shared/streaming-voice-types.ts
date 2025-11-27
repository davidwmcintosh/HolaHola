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
  | 'error';

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
  | 'connected'           // WebSocket connected successfully
  | 'processing'          // STT received, AI processing started
  | 'sentence_start'      // New sentence chunk starting
  | 'audio_chunk'         // Audio data for current sentence
  | 'word_timing'         // Word-level timing for subtitle sync
  | 'sentence_end'        // Current sentence complete
  | 'response_complete'   // Full AI response finished
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
 * Connection established message
 */
export interface StreamingConnectedMessage extends StreamingVoiceMessage {
  type: 'connected';
  sessionId: string;
}

/**
 * Processing started (STT received, AI generating)
 */
export interface StreamingProcessingMessage extends StreamingVoiceMessage {
  type: 'processing';
  userTranscript: string;  // What the user said
}

/**
 * New sentence starting - prepare for audio
 */
export interface StreamingSentenceStartMessage extends StreamingVoiceMessage {
  type: 'sentence_start';
  sentenceIndex: number;
  text: string;           // The sentence text (for display)
}

/**
 * Audio chunk for current sentence
 * Binary data sent separately via WebSocket binary frame
 */
export interface StreamingAudioChunkMessage extends StreamingVoiceMessage {
  type: 'audio_chunk';
  sentenceIndex: number;
  chunkIndex: number;
  isLast: boolean;        // Last chunk for this sentence
  durationMs: number;     // Duration of this chunk
  audio: string;          // Base64-encoded audio data
}

/**
 * Word-level timing for karaoke-style subtitles
 */
export interface StreamingWordTimingMessage extends StreamingVoiceMessage {
  type: 'word_timing';
  sentenceIndex: number;
  words: WordTiming[];
  timings: WordTiming[];  // Alias for words
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
  sentenceIndex: number;
  totalDurationMs: number;
}

/**
 * Full response complete
 */
export interface StreamingResponseCompleteMessage extends StreamingVoiceMessage {
  type: 'response_complete';
  totalSentences: number;
  totalDurationMs: number;
  fullText: string;       // Complete AI response text
  emotion?: string;       // Final emotion used
  metrics?: StreamingMetrics;  // Performance metrics
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
  | 'UNKNOWN';

/**
 * Union type of all streaming messages
 */
export type StreamingMessage = 
  | StreamingConnectedMessage
  | StreamingProcessingMessage
  | StreamingSentenceStartMessage
  | StreamingAudioChunkMessage
  | StreamingWordTimingMessage
  | StreamingSentenceEndMessage
  | StreamingResponseCompleteMessage
  | StreamingErrorMessage;

/**
 * Client-to-server message types
 */
export type ClientVoiceMessageType = 
  | 'start_session'       // Initialize streaming session
  | 'audio_data'          // User's audio recording
  | 'interrupt'           // User interrupted (started speaking)
  | 'end_session';        // Close session

/**
 * Client message to start a streaming session
 */
export interface ClientStartSessionMessage {
  type: 'start_session';
  conversationId: number;
  targetLanguage: string;
  nativeLanguage: string;
  difficultyLevel: string;
  subtitleMode: 'off' | 'target' | 'all';
  tutorPersonality?: string;
  tutorExpressiveness?: number;
}

/**
 * Client message with audio data
 */
export interface ClientAudioDataMessage {
  type: 'audio_data';
  audio: ArrayBuffer;     // Raw audio data (will be transcribed)
  format: 'webm' | 'wav' | 'mp3';
}

/**
 * Client interrupt message (user started speaking)
 */
export interface ClientInterruptMessage {
  type: 'interrupt';
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
} as const;
