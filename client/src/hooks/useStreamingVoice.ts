/**
 * Streaming Voice Hook
 * 
 * Unified hook that integrates:
 * - StreamingVoiceClient (WebSocket connection)
 * - StreamingAudioPlayer (progressive audio playback)
 * - StreamingSubtitles (karaoke-style word highlighting)
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { getStreamingVoiceClient, StreamingVoiceClient } from '../lib/streamingVoiceClient';
import { getStreamingAudioPlayer, StreamingAudioPlayer, StreamingAudioChunk, StreamingPlaybackState, isVerboseLoggingEnabled } from '../lib/audioUtils';
import { useStreamingSubtitles, UseStreamingSubtitlesReturn } from './useStreamingSubtitles';
import { logAudioChunkReceived, updateDebugTimingState } from '../lib/debugTimingState';
import { 
  STREAMING_FEATURE_FLAGS,
  type StreamingClientState,
  type StreamingMetrics,
  type StreamingProcessingMessage,
  type StreamingSentenceStartMessage,
  type StreamingSentenceReadyMessage,
  type StreamingAudioChunkMessage,
  type StreamingWordTimingMessage,
  type StreamingWordTimingDeltaMessage,
  type StreamingWordTimingFinalMessage,
  type StreamingResponseCompleteMessage,
  type StreamingWhiteboardMessage,
} from '../../../shared/streaming-voice-types';

/**
 * Streaming voice state
 */
export interface StreamingVoiceState {
  connectionState: StreamingClientState;
  playbackState: StreamingPlaybackState;
  isConnecting: boolean;
  isProcessing: boolean;
  isPlaying: boolean;
  currentText: string;
  currentWordIndex: number;
  visibleWordCount: number;
  error: string | null;
  metrics: StreamingMetrics | null;
}

/**
 * Session configuration for streaming voice
 */
export interface StreamingSessionConfig {
  conversationId: string;
  targetLanguage: string;
  nativeLanguage: string;
  difficultyLevel: string;
  subtitleMode: 'off' | 'target' | 'all';
  tutorPersonality?: string;
  tutorExpressiveness?: number;
  tutorGender?: 'male' | 'female';
  voiceSpeed?: 'normal' | 'slow';
  rawHonestyMode?: boolean;  // Minimal prompting for authentic conversation with Daniela
  onResponseComplete?: (conversationId: string) => void;
  /** Called when server sends whiteboard updates (e.g., enriched WORD_MAP items) */
  onWhiteboardUpdate?: (items: any[], shouldClear: boolean) => void;
  /** Called when VAD detects speech start (open mic mode) */
  onVadSpeechStarted?: () => void;
  /** Called when VAD detects utterance end (open mic mode) */
  onVadUtteranceEnd?: (transcript: string) => void;
  /** Called when interim transcript available (open mic mode) */
  onInterimTranscript?: (transcript: string) => void;
  /** Called when open mic session closes (e.g., Deepgram timeout) */
  onOpenMicSessionClosed?: () => void;
}

/**
 * Return type for the hook
 */
export interface UseStreamingVoiceReturn {
  state: StreamingVoiceState;
  subtitles: UseStreamingSubtitlesReturn;
  connect: (config: StreamingSessionConfig) => Promise<void>;
  disconnect: () => void;
  sendAudio: (audioData: ArrayBuffer) => Promise<void>;
  requestGreeting: (userName?: string, isResumed?: boolean) => void;
  updateVoice: (tutorGender: 'male' | 'female') => void;
  stop: () => void;
  isSupported: () => boolean;
  isReady: () => boolean;
  getCombinedAudioBlob: () => Blob | null;
  clearStoredAudio: () => void;
  sendStreamingChunk: (audioData: ArrayBuffer, sequenceId: number) => void;
  stopStreaming: () => void;
  setInputMode: (mode: 'push-to-talk' | 'open-mic') => void;
  sendInterrupt: () => void;
  sendDrillResult: (drillId: string, drillType: string, isCorrect: boolean, responseTimeMs: number, toolContent?: string) => void;
  sendTextInput: (itemId: string, response: string) => void;
}

/**
 * Hook for streaming voice functionality
 */
export function useStreamingVoice(): UseStreamingVoiceReturn {
  // State
  const [connectionState, setConnectionState] = useState<StreamingClientState>('disconnected');
  const [playbackState, setPlaybackState] = useState<StreamingPlaybackState>('idle');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<StreamingMetrics | null>(null);
  
  // Refs
  const clientRef = useRef<StreamingVoiceClient | null>(null);
  const playerRef = useRef<StreamingAudioPlayer | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  
  // Track orchestrator response completion and pending audio
  // isProcessing should only be cleared when BOTH:
  // 1. Server has sent response_complete (responseCompleteRef = true)
  // 2. No pending audio chunks (pendingAudioCount = 0)
  const responseCompleteRef = useRef(false);
  const pendingAudioCountRef = useRef(0);
  const setIsProcessingRef = useRef(setIsProcessing);
  setIsProcessingRef.current = setIsProcessing;
  
  // Store current session config for callbacks
  const sessionConfigRef = useRef<StreamingSessionConfig | null>(null);
  
  // Track current turn ID for subtitle packet ordering (prevents phantom subtitles)
  const currentTurnIdRef = useRef(0);
  
  // Track difficulty level for ACTFL-aware subtitle timing
  const [difficultyLevel, setDifficultyLevel] = useState<string>('beginner');
  
  // Helper to check if we can clear isProcessing
  // Note: Does NOT reset responseCompleteRef - that's done when new request starts
  const checkAndClearProcessing = useCallback(() => {
    const isComplete = responseCompleteRef.current;
    const noPendingAudio = pendingAudioCountRef.current === 0;
    
    if (isComplete && noPendingAudio) {
      if (isVerboseLoggingEnabled()) {
        console.log('[StreamingVoice] Response complete AND no pending audio - clearing isProcessing');
      }
      setIsProcessingRef.current(false);
      // Don't reset responseCompleteRef here - let sendAudio do it
    } else if (isVerboseLoggingEnabled()) {
      console.log(`[StreamingVoice] Not clearing: complete=${isComplete}, pending=${pendingAudioCountRef.current}`);
    }
  }, []);
  
  // Subtitle management with ACTFL-level-aware timing
  const subtitles = useStreamingSubtitles({ difficultyLevel });
  
  // Keep a ref to subtitles to avoid stale closure issues in audio player callbacks
  // The audio player callbacks are set once on mount but need access to latest subtitles methods
  const subtitlesRef = useRef(subtitles);
  subtitlesRef.current = subtitles;
  
  /**
   * Initialize the audio player
   * CRITICAL: Use getStreamingAudioPlayer() singleton to prevent Vite duplicate module issue
   * Without this, one instance receives chunks while another runs timing loop
   */
  useEffect(() => {
    playerRef.current = getStreamingAudioPlayer();
    
    // Set up player callbacks
    // NOTE: isProcessing is only cleared when BOTH:
    // 1. Server has sent response_complete (responseCompleteRef = true)
    // 2. No pending audio chunks (pendingAudioCountRef = 0)
    // IMPORTANT: Use subtitlesRef.current to get latest subtitles (avoids stale closure)
    playerRef.current.setCallbacks({
      onStateChange: (state) => {
        if (isVerboseLoggingEnabled()) {
          console.log(`[StreamingVoice] Playback state: ${state}`);
        }
        setPlaybackState(state);
      },
      onProgress: (currentTime, duration) => {
        // Update subtitle highlighting with actual duration for rescaling
        // Use ref to get latest subtitles (avoids stale closure from mount-time capture)
        subtitlesRef.current.updatePlaybackTime(currentTime, duration);
      },
      onSentenceStart: (sentenceIndex) => {
        if (isVerboseLoggingEnabled()) {
          console.log(`[StreamingVoice] Sentence ${sentenceIndex} started (turn ${currentTurnIdRef.current})`);
        }
        // Update debug state for tracking
        updateDebugTimingState({ lastOnSentenceStartFired: sentenceIndex });
        // Pass turnId for subtitle packet ordering (prevents phantom subtitles)
        subtitlesRef.current.startPlayback(sentenceIndex, currentTurnIdRef.current);
      },
      onSentenceEnd: (sentenceIndex) => {
        if (isVerboseLoggingEnabled()) {
          console.log(`[StreamingVoice] Sentence ${sentenceIndex} ended (turn ${currentTurnIdRef.current})`);
        }
        // Update debug state for tracking
        updateDebugTimingState({ lastOnSentenceEndFired: sentenceIndex });
        subtitlesRef.current.completeSentence(sentenceIndex, currentTurnIdRef.current);
      },
      onComplete: () => {
        if (isVerboseLoggingEnabled()) {
          console.log('[StreamingVoice] Playback queue empty');
        }
        // Only stop subtitles when response is truly complete
        // Don't stop during buffer gaps between sentences
        if (responseCompleteRef.current && pendingAudioCountRef.current === 0) {
          subtitlesRef.current.stopPlayback();
        }
        // Check if we can clear isProcessing
        checkAndClearProcessing();
      },
      onError: (err) => {
        console.error('[StreamingVoice] Playback error:', err);
        setError(err.message);
        // On error, clear everything immediately
        setIsProcessingRef.current(false);
        // Note: Don't reset refs here - player.stop() will handle that
      },
      onPendingAudioChange: (count) => {
        if (isVerboseLoggingEnabled()) {
          console.log(`[StreamingVoice] Pending audio: ${count}`);
        }
        pendingAudioCountRef.current = count;
        // If no pending audio and response complete, clear isProcessing
        if (count === 0) {
          checkAndClearProcessing();
        }
      },
    });
    
    return () => {
      playerRef.current?.destroy();
    };
  }, []);
  
  /**
   * Handle processing message (new turn started)
   * This sets the turnId for subtitle packet ordering, preventing phantom subtitles
   * 
   * CRITICAL: Uses subtitlesRef.current to avoid stale closure issues.
   * CRITICAL: Must reset audio player to clear previous turn's schedule,
   * preventing stale onSentenceStart callbacks from mixing with new turn.
   */
  const handleProcessing = useCallback((msg: StreamingProcessingMessage) => {
    if (isVerboseLoggingEnabled()) {
      console.log(`[StreamingVoice] Processing turn ${msg.turnId}: "${msg.userTranscript.substring(0, 30)}..."`);
    }
    
    // Store turnId for use in callbacks
    currentTurnIdRef.current = msg.turnId;
    
    // CRITICAL FIX: Reset audio player for new turn
    // This clears the previous turn's sentence/word schedule, preventing
    // stale callbacks from firing when new audio starts playing
    if (playerRef.current) {
      playerRef.current.resetForNewTurn();
    }
    
    // Initialize subtitle state for new turn
    subtitlesRef.current.setCurrentTurnId(msg.turnId);
  }, []);
  
  /**
   * Handle sentence start message
   * Now includes turnId and hasTargetContent for server-driven subtitle state
   * 
   * CRITICAL: Uses subtitlesRef.current to avoid stale closure issues.
   */
  const handleSentenceStart = useCallback((msg: StreamingSentenceStartMessage) => {
    if (isVerboseLoggingEnabled()) {
      console.log(`[StreamingVoice] Sentence ${msg.sentenceIndex} (turn ${msg.turnId}): "${msg.text.substring(0, 40)}..." hasTarget=${msg.hasTargetContent}`);
    }
    
    // Store turnId for callbacks (in case processing message wasn't received)
    if (msg.turnId > currentTurnIdRef.current) {
      currentTurnIdRef.current = msg.turnId;
    }
    
    // Use new v2 API with turnId and hasTargetContent
    subtitlesRef.current.addSentence(
      msg.sentenceIndex, 
      msg.text, 
      msg.turnId,
      msg.hasTargetContent,
      msg.targetLanguageText, 
      msg.wordMapping
    );
  }, []);
  
  /**
   * Handle audio chunk message
   * Supports both MP3 (HTMLAudioElement) and raw PCM (Web Audio API)
   * 
   * PROGRESSIVE STREAMING: When audioFormat is 'pcm_f32le', route to
   * progressive playback which schedules chunks for gapless playback
   * as they arrive. This eliminates the ~2s sentence buffering delay.
   */
  const handleAudioChunk = useCallback((msg: StreamingAudioChunkMessage) => {
    // CRITICAL DEBUG: Track chunks via debug panel state (reliable visibility)
    logAudioChunkReceived(msg.sentenceIndex);
    
    // CRITICAL DEBUG: Track chunks at window level for debugging
    if (typeof window !== 'undefined') {
      const w = window as any;
      if (!w._chunkStats) w._chunkStats = { total: 0, bySentence: {} };
      w._chunkStats.total++;
      w._chunkStats.bySentence[msg.sentenceIndex] = (w._chunkStats.bySentence[msg.sentenceIndex] || 0) + 1;
      w._lastChunk = { s: msg.sentenceIndex, c: msg.chunkIndex, t: Date.now() };
    }
    
    // Force log with console.error to ensure capture - only when verbose
    if (isVerboseLoggingEnabled()) {
      console.error(`[CHUNK RECEIVED] sentence=${msg.sentenceIndex}, chunk=${msg.chunkIndex}, format=${msg.audioFormat}, isLast=${msg.isLast}, audioLen=${msg.audio?.length || 0}`);
    }
    
    // CRITICAL DEBUG: Track empty chunks specifically
    if (msg.isLast && (!msg.audio || msg.audio.length === 0) && isVerboseLoggingEnabled()) {
      console.error(`[EMPTY CHUNK RECEIVED] sentence=${msg.sentenceIndex}, chunk=${msg.chunkIndex} - THIS IS A SENTENCE-END MARKER`);
    }
    
    if (!playerRef.current) {
      console.warn('[StreamingVoice] Audio chunk received but no player - DROPPING AUDIO');
      return;
    }
    
    const formatLabel = msg.audioFormat === 'pcm_f32le' ? 'PCM' : 'MP3';
    // Ensure chunkIndex is a number, not a string
    const chunkIndex = typeof msg.chunkIndex === 'number' ? msg.chunkIndex : parseInt(msg.chunkIndex as any, 10) || 0;
    if (isVerboseLoggingEnabled()) {
      console.log(`[StreamingVoice] Processing audio chunk (${formatLabel}): turn=${msg.turnId}, sentence=${msg.sentenceIndex}, chunk=${chunkIndex}, base64Len=${msg.audio?.length || 0}, isLast=${msg.isLast}`);
    }
    
    // Decode base64 to ArrayBuffer
    const binaryString = atob(msg.audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    if (isVerboseLoggingEnabled()) {
      console.log(`[StreamingVoice] Audio decoded: ${bytes.buffer.byteLength} bytes (${formatLabel}) for sentence ${msg.sentenceIndex}`);
    }
    
    // PROGRESSIVE STREAMING: Use progressive playback for PCM chunks
    // This schedules audio for gapless playback as chunks arrive,
    // eliminating the ~2s delay from waiting for full sentence synthesis
    if (msg.audioFormat === 'pcm_f32le') {
      const sampleRate = msg.sampleRate || 24000;
      playerRef.current.enqueueProgressivePcmChunk(
        msg.sentenceIndex,
        chunkIndex,
        bytes.buffer,
        msg.durationMs,
        msg.isLast,
        sampleRate
      );
      return;
    }
    
    // Traditional playback for MP3 (full sentence buffering)
    const chunk: StreamingAudioChunk = {
      sentenceIndex: msg.sentenceIndex,
      audio: bytes.buffer,
      durationMs: msg.durationMs,
      isLast: msg.isLast,
      audioFormat: msg.audioFormat || 'mp3',  // Default to MP3 for backwards compatibility
      sampleRate: msg.sampleRate || 24000,
    };
    
    playerRef.current.enqueue(chunk);
  }, []);
  
  /**
   * Handle word timing message (BUFFERED MODE ONLY)
   * 
   * In buffered mode (PROGRESSIVE_AUDIO_STREAMING: false), all word timings
   * arrive BEFORE the audio chunk. This guarantees karaoke highlighting
   * is properly synchronized because:
   * 1. Timings are registered with audio player FIRST
   * 2. Audio plays AFTER, using AudioContext.currentTime as truth
   * 
   * IMPORTANT: Only register with audio player in BUFFERED mode.
   * In progressive mode, handleWordTimingDelta handles registration to avoid duplicates.
   * 
   * CRITICAL: Uses subtitlesRef.current to avoid stale closure issues.
   */
  const handleWordTiming = useCallback((msg: StreamingWordTimingMessage) => {
    const isBufferedMode = !STREAMING_FEATURE_FLAGS.PROGRESSIVE_AUDIO_STREAMING;
    if (isVerboseLoggingEnabled()) {
      console.log(`[WORD_TIMING] Sentence ${msg.sentenceIndex}: ${msg.timings.length} words received (mode: ${isBufferedMode ? 'buffered' : 'progressive'})`);
    }
    
    // BUFFERED MODE ONLY: Register ALL word timings with the audio player for karaoke highlighting
    // This populates wordSchedule BEFORE audio playback starts
    // In progressive mode, handleWordTimingDelta handles this to avoid duplicate registrations
    if (isBufferedMode && playerRef.current && msg.timings && msg.timings.length > 0) {
      for (let i = 0; i < msg.timings.length; i++) {
        const timing = msg.timings[i];
        playerRef.current.registerWordTiming(
          msg.sentenceIndex,
          i,
          timing.word,
          timing.startTime,
          timing.endTime
        );
      }
      if (isVerboseLoggingEnabled()) {
        console.log(`[WORD_TIMING] Registered ${msg.timings.length} timings with audio player (buffered mode)`);
      }
    }
    
    // Always update subtitle hook for UI state (both modes)
    subtitlesRef.current.setWordTimings(msg.sentenceIndex, msg.turnId, msg.timings, msg.expectedDurationMs);
  }, []);
  
  /**
   * PROGRESSIVE STREAMING: Handle incremental word timing update
   * These arrive as words are timestamped during progressive TTS
   * 
   * CRITICAL: Uses subtitlesRef.current to avoid stale closure issues.
   * Without this, the callback registered in connect() would use a stale
   * subtitles object, and progressive word timings would be lost.
   */
  const handleWordTimingDelta = useCallback((msg: StreamingWordTimingDeltaMessage) => {
    if (isVerboseLoggingEnabled()) {
      console.log(`[DELTA RECEIVED] sentence=${msg.sentenceIndex}, word=${msg.wordIndex} "${msg.word}"`);
    }
    
    // WORD-BASED TIMING: Register word with ABSOLUTE AudioContext times
    // This enables direct word matching in the timing loop
    if (playerRef.current) {
      playerRef.current.registerWordTiming(
        msg.sentenceIndex,
        msg.wordIndex,
        msg.word,
        msg.startTime,  // Relative to sentence start
        msg.endTime     // Relative to sentence start
      );
    }
    
    // Add the word timing incrementally for progressive display
    subtitlesRef.current.addProgressiveWordTiming(
      msg.sentenceIndex,
      msg.turnId,
      msg.wordIndex,
      msg.word,
      msg.startTime,
      msg.endTime,
      msg.estimatedTotalDuration
    );
  }, []);
  
  /**
   * NEW: Handle atomic sentence_ready message
   * 
   * This message contains BOTH the first audio chunk AND the first word timings,
   * sent atomically by the server to prevent the timing race condition where
   * playback starts before timings arrive.
   * 
   * Client should use this as the signal to start playback - guaranteed to have timing data.
   */
  const handleSentenceReady = useCallback((msg: StreamingSentenceReadyMessage) => {
    const { sentenceIndex, turnId, firstAudioChunk, firstWordTimings, estimatedTotalDuration } = msg;
    
    if (isVerboseLoggingEnabled()) {
      console.error(`[SENTENCE_READY HANDLER] sentence=${sentenceIndex}, turn=${turnId}, timings=${firstWordTimings.length} words`);
    }
    
    // SAFETY CHECK: Verify we have timing data before starting playback
    // This should never happen if server is correctly buffering, but belt-and-suspenders
    if (!firstWordTimings || firstWordTimings.length === 0) {
      console.error(`[SENTENCE_READY] WARNING: Received sentence_ready with no timings! Deferring playback.`);
      // Don't enqueue audio yet - wait for word_timing_delta messages
      return;
    }
    
    // 1. Register all word timings with the player FIRST (before audio plays)
    if (playerRef.current && firstWordTimings.length > 0) {
      for (let i = 0; i < firstWordTimings.length; i++) {
        const timing = firstWordTimings[i];
        playerRef.current.registerWordTiming(
          sentenceIndex,
          i,
          timing.word,
          timing.startTime,
          timing.endTime
        );
      }
    }
    
    // 2. Add word timings to subtitles for progressive display
    for (let i = 0; i < firstWordTimings.length; i++) {
      const timing = firstWordTimings[i];
      subtitlesRef.current.addProgressiveWordTiming(
        sentenceIndex,
        turnId,
        i,
        timing.word,
        timing.startTime,
        timing.endTime,
        estimatedTotalDuration
      );
    }
    
    // 3. Enqueue the first audio chunk for playback
    if (playerRef.current && firstAudioChunk.audio) {
      logAudioChunkReceived(sentenceIndex);
      
      // Decode base64 to ArrayBuffer
      const binaryString = atob(firstAudioChunk.audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      if (isVerboseLoggingEnabled()) {
        console.error(`[SENTENCE_READY] Enqueueing first audio chunk: ${bytes.buffer.byteLength} bytes`);
      }
      
      // Enqueue for progressive playback
      if (firstAudioChunk.audioFormat === 'pcm_f32le') {
        playerRef.current.enqueueProgressivePcmChunk(
          sentenceIndex,
          firstAudioChunk.chunkIndex,
          bytes.buffer,
          firstAudioChunk.durationMs,
          false,  // Not last chunk
          firstAudioChunk.sampleRate
        );
      }
    }
  }, []);
  
  /**
   * PROGRESSIVE STREAMING: Handle final word timing reconciliation
   * Sent when sentence synthesis completes with authoritative timings
   * 
   * CRITICAL: Uses subtitlesRef.current to avoid stale closure issues.
   */
  const handleWordTimingFinal = useCallback((msg: StreamingWordTimingFinalMessage) => {
    // Update with authoritative timings for perfect sync
    subtitlesRef.current.finalizeWordTimings(
      msg.sentenceIndex,
      msg.turnId,
      msg.words,
      msg.actualDurationMs
    );
  }, []);
  
  /**
   * Handle response complete message
   * The server has finished streaming all audio chunks.
   * Check if we can clear isProcessing (no pending audio remaining).
   * 
   * CRITICAL FIX: Pass totalSentences to audio player so it knows how many
   * sentences to expect before allowing playback to stop. This prevents
   * premature timing loop termination between sentences.
   */
  const handleResponseComplete = useCallback((msg: StreamingResponseCompleteMessage) => {
    if (isVerboseLoggingEnabled()) {
      console.log(`[StreamingVoice] Server signaled response complete: ${msg.totalSentences} sentences${msg.wasInterrupted ? ' (INTERRUPTED)' : ''}`);
    }
    setMetrics(msg.metrics || null);
    
    // BARGE-IN: If response was interrupted, immediately stop audio playback
    // This prevents overlapping audio when user speaks while AI is responding
    if (msg.wasInterrupted) {
      console.log('[StreamingVoice] Response interrupted by user - stopping audio immediately');
      playerRef.current?.stop();
      subtitlesRef.current.stopPlayback();
      subtitlesRef.current.reset();
      responseCompleteRef.current = true;
      pendingAudioCountRef.current = 0;
      setIsProcessing(false);
      return; // Don't do normal completion handling
    }
    
    // CRITICAL: Tell the audio player how many sentences this turn has
    // This prevents premature loop termination when early sentences finish
    // before later sentences have even arrived
    if (playerRef.current && msg.totalSentences !== undefined) {
      playerRef.current.setExpectedSentenceCount(msg.totalSentences);
    }
    
    // Mark response as complete
    responseCompleteRef.current = true;
    
    // Call the onResponseComplete callback to refresh messages
    // Messages are persisted server-side, so we need to refetch
    if (sessionConfigRef.current?.onResponseComplete && sessionConfigRef.current?.conversationId) {
      sessionConfigRef.current.onResponseComplete(sessionConfigRef.current.conversationId);
    }
    
    // Check if we can clear isProcessing (no pending audio)
    checkAndClearProcessing();
  }, [checkAndClearProcessing]);
  
  /**
   * Handle errors
   */
  const handleError = useCallback((err: Error) => {
    console.error('[StreamingVoice] Error:', err);
    setError(err.message);
    setIsProcessing(false);
  }, []);
  
  /**
   * Handle whiteboard updates from server (e.g., enriched WORD_MAP items)
   */
  const handleWhiteboardUpdate = useCallback((message: StreamingWhiteboardMessage) => {
    if (isVerboseLoggingEnabled()) {
      console.log('[StreamingVoice] Whiteboard update received:', message.items?.length || 0, 'items');
    }
    
    if (sessionConfigRef.current?.onWhiteboardUpdate && message.items) {
      sessionConfigRef.current.onWhiteboardUpdate(message.items, message.shouldClear || false);
    }
  }, []);
  
  /**
   * Handle VAD speech started event (open mic mode)
   */
  const handleVadSpeechStarted = useCallback((message: { type: string }) => {
    if (isVerboseLoggingEnabled()) {
      console.log('[StreamingVoice] VAD speech started');
    }
    sessionConfigRef.current?.onVadSpeechStarted?.();
  }, []);
  
  /**
   * Handle VAD utterance end event (open mic mode)
   */
  const handleVadUtteranceEnd = useCallback((message: { type: string; transcript?: string }) => {
    if (isVerboseLoggingEnabled()) {
      console.log('[StreamingVoice] VAD utterance end, transcript:', message.transcript);
    }
    sessionConfigRef.current?.onVadUtteranceEnd?.(message.transcript || '');
  }, []);
  
  /**
   * Handle interim transcript (open mic mode)
   */
  const handleInterimTranscript = useCallback((message: { type: string; transcript: string }) => {
    if (isVerboseLoggingEnabled()) {
      console.log('[StreamingVoice] Interim transcript:', message.transcript);
    }
    sessionConfigRef.current?.onInterimTranscript?.(message.transcript);
  }, []);
  
  /**
   * Handle open mic session closed (e.g., Deepgram timeout)
   */
  const handleOpenMicSessionClosed = useCallback(() => {
    console.log('[StreamingVoice] Open mic session closed - client should restart if in open mic mode');
    sessionConfigRef.current?.onOpenMicSessionClosed?.();
  }, []);
  
  /**
   * Handle tutor handoff - triggered after current tutor says goodbye
   * Automatically switches voice to new tutor and triggers their introduction
   */
  const handleTutorHandoff = useCallback((message: { type: string; targetGender: 'male' | 'female'; timestamp: number }) => {
    console.log(`[StreamingVoice] Tutor handoff received - switching to ${message.targetGender} tutor`);
    
    // Call updateVoice to complete the switch - this triggers the new tutor's intro
    if (clientRef.current?.isReady()) {
      clientRef.current.updateVoice(message.targetGender);
    }
  }, []);
  
  /**
   * Connect to streaming voice service and start a session
   */
  const connect = useCallback(async (config: StreamingSessionConfig) => {
    if (isVerboseLoggingEnabled()) {
      console.log(`[StreamingVoice] Connecting for conversation ${config.conversationId}`);
    }
    
    // Store config for callbacks (e.g., onResponseComplete)
    sessionConfigRef.current = config;
    
    // Update difficulty level for ACTFL-aware subtitle timing
    setDifficultyLevel(config.difficultyLevel);
    
    try {
      // Get or create client
      clientRef.current = getStreamingVoiceClient();
      
      // Set up callbacks
      clientRef.current.on('stateChange', setConnectionState);
      clientRef.current.on('processing', handleProcessing);
      clientRef.current.on('sentenceStart', handleSentenceStart);
      clientRef.current.on('sentenceReady', handleSentenceReady);  // NEW: Atomic first audio + timing
      clientRef.current.on('audioChunk', handleAudioChunk);
      clientRef.current.on('wordTiming', handleWordTiming);
      clientRef.current.on('wordTimingDelta', handleWordTimingDelta);  // Progressive streaming
      clientRef.current.on('wordTimingFinal', handleWordTimingFinal);  // Progressive streaming
      clientRef.current.on('responseComplete', handleResponseComplete);
      clientRef.current.on('whiteboardUpdate', handleWhiteboardUpdate);  // Enriched whiteboard items
      clientRef.current.on('error', handleError);
      clientRef.current.on('vadSpeechStarted', handleVadSpeechStarted);  // Open mic VAD
      clientRef.current.on('vadUtteranceEnd', handleVadUtteranceEnd);  // Open mic VAD
      clientRef.current.on('interimTranscript', handleInterimTranscript);  // Open mic interim
      clientRef.current.on('openMicSessionClosed', handleOpenMicSessionClosed);  // Open mic session ended
      clientRef.current.on('tutorHandoff', handleTutorHandoff);  // Voice-initiated tutor switch
      
      // Connect WebSocket
      await clientRef.current.connect(config.conversationId);
      if (isVerboseLoggingEnabled()) {
        console.log('[StreamingVoice] WebSocket connected, starting session...');
      }
      
      // Start session with config - this triggers server to send 'connected' message
      // which will transition state to 'ready'
      clientRef.current.startSession({
        conversationId: config.conversationId,
        targetLanguage: config.targetLanguage,
        nativeLanguage: config.nativeLanguage,
        difficultyLevel: config.difficultyLevel,
        subtitleMode: config.subtitleMode,
        tutorPersonality: config.tutorPersonality,
        tutorExpressiveness: config.tutorExpressiveness,
        tutorGender: config.tutorGender,
        voiceSpeed: config.voiceSpeed,
        rawHonestyMode: config.rawHonestyMode,  // Minimal prompting mode
      });
      
      if (isVerboseLoggingEnabled()) {
        console.log('[StreamingVoice] Session started, waiting for ready state...');
      }
      
    } catch (err: any) {
      console.error('[StreamingVoice] Connection failed:', err);
      setError(err.message);
      throw err;
    }
  }, [handleProcessing, handleSentenceStart, handleSentenceReady, handleAudioChunk, handleWordTiming, handleWordTimingDelta, handleWordTimingFinal, handleResponseComplete, handleWhiteboardUpdate, handleError, handleVadSpeechStarted, handleVadUtteranceEnd, handleInterimTranscript]);
  
  /**
   * Disconnect from streaming voice service
   */
  const disconnect = useCallback(() => {
    if (isVerboseLoggingEnabled()) {
      console.log('[StreamingVoice] Disconnecting');
    }
    
    if (clientRef.current) {
      clientRef.current.off('stateChange', setConnectionState);
      clientRef.current.off('processing', handleProcessing);
      clientRef.current.off('sentenceStart', handleSentenceStart);
      clientRef.current.off('sentenceReady', handleSentenceReady);  // NEW: Atomic first audio + timing
      clientRef.current.off('audioChunk', handleAudioChunk);
      clientRef.current.off('wordTiming', handleWordTiming);
      clientRef.current.off('wordTimingDelta', handleWordTimingDelta);  // Progressive streaming
      clientRef.current.off('wordTimingFinal', handleWordTimingFinal);  // Progressive streaming
      clientRef.current.off('responseComplete', handleResponseComplete);
      clientRef.current.off('whiteboardUpdate', handleWhiteboardUpdate);  // Enriched whiteboard items
      clientRef.current.off('error', handleError);
      clientRef.current.off('vadSpeechStarted', handleVadSpeechStarted);  // Open mic VAD
      clientRef.current.off('vadUtteranceEnd', handleVadUtteranceEnd);  // Open mic VAD
      clientRef.current.off('interimTranscript', handleInterimTranscript);  // Open mic interim
      clientRef.current.disconnect();
      clientRef.current = null;
    }
    
    // Stop playback
    playerRef.current?.stop();
    subtitles.reset();
    
    // Reset state
    responseCompleteRef.current = false;
    pendingAudioCountRef.current = 0;
    setConnectionState('disconnected');
    setIsProcessing(false);
  }, [handleProcessing, handleSentenceStart, handleSentenceReady, handleAudioChunk, handleWordTiming, handleWordTimingDelta, handleWordTimingFinal, handleResponseComplete, handleWhiteboardUpdate, handleError, handleVadSpeechStarted, handleVadUtteranceEnd, handleInterimTranscript, subtitles]);
  
  /**
   * Send audio for processing
   */
  const sendAudio = useCallback(async (audioData: ArrayBuffer) => {
    // Check client's actual state, not React state (avoid stale closure)
    const actualState = clientRef.current?.getState();
    if (!clientRef.current || !clientRef.current.isReady()) {
      console.error('[StreamingVoice] Cannot send audio - not ready. Client state:', actualState);
      throw new Error('Not connected to streaming voice service');
    }
    
    if (isVerboseLoggingEnabled()) {
      console.log(`[StreamingVoice] Sending ${audioData.byteLength} bytes of audio`);
    }
    
    // Reset state for new request
    responseCompleteRef.current = false;
    pendingAudioCountRef.current = 0;
    setIsProcessing(true);
    setError(null);
    subtitles.reset();
    
    // Clear stored audio from previous response before new request
    playerRef.current?.clearStoredAudio();
    
    await clientRef.current.sendAudio(audioData);
  }, [connectionState, subtitles]);
  
  /**
   * Get combined audio blob for replay
   */
  const getCombinedAudioBlob = useCallback((): Blob | null => {
    return playerRef.current?.getCombinedAudioBlob() ?? null;
  }, []);
  
  /**
   * Clear stored audio for replay
   */
  const clearStoredAudio = useCallback(() => {
    playerRef.current?.clearStoredAudio();
  }, []);
  
  /**
   * Send streaming audio chunk for open mic mode
   */
  const sendStreamingChunk = useCallback((audioData: ArrayBuffer, sequenceId: number) => {
    clientRef.current?.sendStreamingChunk(audioData, sequenceId);
  }, []);
  
  /**
   * Stop streaming audio (open mic mode)
   */
  const stopStreaming = useCallback(() => {
    clientRef.current?.stopStreaming();
  }, []);
  
  /**
   * Set input mode (push-to-talk or open-mic)
   */
  const setInputMode = useCallback((mode: 'push-to-talk' | 'open-mic') => {
    clientRef.current?.setInputMode(mode);
  }, []);
  
  /**
   * Send interrupt signal (user started speaking - stop TTS)
   */
  const sendInterrupt = useCallback(() => {
    clientRef.current?.sendInterrupt();
  }, []);
  
  /**
   * Request AI-generated personalized greeting
   * Called when starting a new conversation or resuming a previous one
   * @param userName - Optional student name for personalization
   * @param isResumed - True if resuming a previous conversation (triggers context-aware welcome back)
   */
  const requestGreeting = useCallback((userName?: string, isResumed?: boolean) => {
    if (!clientRef.current || !clientRef.current.isReady()) {
      console.error('[StreamingVoice] Cannot request greeting - not ready');
      return;
    }
    
    if (isVerboseLoggingEnabled()) {
      console.log(`[StreamingVoice] Requesting AI greeting... (resumed: ${isResumed || false})`);
    }
    
    // Reset state for greeting
    responseCompleteRef.current = false;
    pendingAudioCountRef.current = 0;
    setIsProcessing(true);
    setError(null);
    subtitles.reset();
    
    // Clear stored audio
    playerRef.current?.clearStoredAudio();
    
    // Request greeting from server
    clientRef.current.requestGreeting(userName, isResumed);
  }, [subtitles]);
  
  /**
   * Update voice mid-session (when user changes tutor)
   */
  const updateVoice = useCallback((tutorGender: 'male' | 'female') => {
    if (!clientRef.current || !clientRef.current.isReady()) {
      console.warn('[StreamingVoice] Cannot update voice - not connected');
      return;
    }
    
    if (isVerboseLoggingEnabled()) {
      console.log(`[StreamingVoice] Updating voice to ${tutorGender}`);
    }
    clientRef.current.updateVoice(tutorGender);
  }, []);
  
  /**
   * Stop playback and processing
   */
  const stop = useCallback(() => {
    if (isVerboseLoggingEnabled()) {
      console.log('[StreamingVoice] Stopping');
    }
    
    playerRef.current?.stop();
    subtitles.stopPlayback();
    responseCompleteRef.current = false;
    pendingAudioCountRef.current = 0;
    setIsProcessing(false);
  }, [subtitles]);
  
  /**
   * Check if streaming is supported
   */
  const isSupported = useCallback(() => {
    return 'WebSocket' in window;
  }, []);
  
  /**
   * Check if client is ready to send audio (checks actual client state, not React state)
   */
  const isReady = useCallback(() => {
    return clientRef.current?.isReady() ?? false;
  }, []);
  
  /**
   * Send drill result for pedagogical tracking
   */
  const sendDrillResult = useCallback((drillId: string, drillType: string, isCorrect: boolean, responseTimeMs: number, toolContent?: string) => {
    if (clientRef.current) {
      clientRef.current.sendDrillResult(drillId, drillType, isCorrect, responseTimeMs, toolContent);
    }
  }, []);
  
  /**
   * Send text input response (from TEXT_INPUT whiteboard tool)
   */
  const sendTextInput = useCallback((itemId: string, response: string) => {
    if (clientRef.current) {
      clientRef.current.sendTextInput(itemId, response);
    }
  }, []);
  
  // Store disconnect in a ref so cleanup can use latest version without dependency
  const disconnectRef = useRef(disconnect);
  disconnectRef.current = disconnect;
  
  // Cleanup on unmount only (empty dependency array)
  useEffect(() => {
    return () => {
      disconnectRef.current();
    };
  }, []);
  
  return {
    state: {
      connectionState,
      playbackState,
      isConnecting: connectionState === 'connecting',
      isProcessing,
      isPlaying: playbackState === 'playing',
      currentText: subtitles.state.fullText,
      currentWordIndex: subtitles.state.currentWordIndex,
      visibleWordCount: subtitles.state.visibleWordCount,
      error,
      metrics,
    },
    subtitles,
    connect,
    disconnect,
    sendAudio,
    requestGreeting,
    updateVoice,
    stop,
    isSupported,
    isReady,
    getCombinedAudioBlob,
    clearStoredAudio,
    sendStreamingChunk,
    stopStreaming,
    setInputMode,
    sendInterrupt,
    sendDrillResult,
    sendTextInput,
  };
}
