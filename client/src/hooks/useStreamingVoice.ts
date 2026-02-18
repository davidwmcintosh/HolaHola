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
import { logAudioChunkReceived, updateDebugTimingState, trackWsMessage } from '../lib/debugTimingState';
import { setGlobalPlaybackState, getGlobalPlaybackState } from '../lib/playbackStateStore';
import { diagSetSession, diagSetHookRefs, diagEvent, diagMarkConnect, diagMarkFirstAudio, diagMarkResponseComplete, diagMarkDisconnect, diagMarkTurnStart, diagMarkError, diagMarkTtsError, diagMarkFailsafe, reportDiagnostic, startLockoutWatchdog, startGreetingSilenceWatchdog } from '../lib/lockoutDiagnostics';
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
  isSwitchingTutor: boolean;  // True during tutor handoff - mic should stay locked
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
  founderMode?: boolean;  // Explicit founder mode flag - only true when user selects "Founder Mode" context
  onResponseComplete?: (conversationId: string) => void;
  /** Called when server detects no speech during PTT - resets processing state */
  onNoSpeechDetected?: () => void;
  /** Called when server sends whiteboard updates (e.g., enriched WORD_MAP items) */
  onWhiteboardUpdate?: (items: any[], shouldClear: boolean) => void;
  /** Called when VAD detects speech start (open mic mode) */
  onVadSpeechStarted?: () => void;
  /** Called when VAD detects utterance end (open mic mode) */
  onVadUtteranceEnd?: (transcript: string, empty?: boolean) => void;
  /** Called when interim transcript available (open mic mode) */
  onInterimTranscript?: (transcript: string) => void;
  /** Called when open mic session closes (e.g., Deepgram timeout) */
  onOpenMicSessionClosed?: () => void;
  /** Called when OpenMic detects consecutive empty transcripts (silence loop) */
  onOpenMicSilenceLoop?: (consecutiveEmptyCount: number, msSinceLastSuccessfulTranscript: number) => void;
  /** Called when connection is successfully restored after a drop */
  onReconnected?: () => void;
  /** 
   * Called when voice-initiated tutor handoff occurs (student asked to switch tutors)
   * Supports both intra-language (gender only) and cross-language (gender + language) handoffs
   */
  onTutorHandoff?: (handoff: TutorHandoffInfo) => void;
  /** Called when pronunciation coaching feedback is received from Deepgram word-level analysis */
  onPronunciationCoaching?: (coaching: PronunciationCoachingData) => void;
  /** Called when server commands a subtitle mode change (tutor [SUBTITLE on/off/target] command) */
  onSubtitleModeChange?: (mode: 'off' | 'all' | 'target') => void;
  /** Called when server commands a custom overlay show/hide (tutor [SHOW: text] / [HIDE] commands) */
  onCustomOverlay?: (action: 'show' | 'hide', text?: string) => void;
  /** Called when server requests text input from student (tutor [TEXT_INPUT: prompt] command) */
  onTextInputRequest?: (prompt: string) => void;
  /** Called when an immersive scenario is loaded from the library */
  onScenarioLoaded?: (scenario: any) => void;
  /** Called when the active scenario ends */
  onScenarioEnded?: (data: { scenarioId?: string; scenarioSlug?: string; performanceNotes?: string }) => void;
}

/**
 * Pronunciation coaching data from word-level confidence analysis
 */
export interface PronunciationCoachingData {
  overallScore: number;
  wordFeedback: Array<{
    word: string;
    confidence: number;
    status: 'excellent' | 'good' | 'needs_work' | 'difficult';
    suggestion?: string;
  }>;
  coachingTips: string[];
  encouragement: string;
  lowConfidenceWords: string[];
  phonemeHints: Array<{
    phoneme: string;
    word: string;
    tip: string;
  }>;
}

/**
 * Information about a tutor handoff (intra-language or cross-language)
 */
export interface TutorHandoffInfo {
  targetGender: 'male' | 'female';
  targetLanguage?: string;    // For cross-language handoffs (e.g., "japanese")
  tutorName?: string;         // New tutor's name (e.g., "Sayuri")
  isLanguageSwitch: boolean;  // True if this is a cross-language handoff
  requiresGreeting?: boolean; // True if client should request greeting after reconnecting
  isAssistant?: boolean;      // True if switching to assistant tutor (navigate to practice page)
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
  sendStreamingChunk: (audioData: ArrayBuffer, sequenceId: number) => boolean;
  stopStreaming: () => void;
  setInputMode: (mode: 'push-to-talk' | 'open-mic') => void;
  sendInterrupt: () => void;
  sendUserActivity: () => void;
  sendPttRelease: () => void;
  sendDrillResult: (drillId: string, drillType: string, isCorrect: boolean, responseTimeMs: number, toolContent?: string) => void;
  sendTextInput: (itemId: string, response: string) => void;
  sendVoiceOverride: (override: {
    speakingRate?: number;
    personality?: string;
    expressiveness?: number;
    emotion?: string;
    geminiLanguageCode?: string;
  } | null) => void;
  sendToggleIncognito: (enabled: boolean) => void;
  forceResetProcessing: () => void;
}

/**
 * Hook for streaming voice functionality
 */
export function useStreamingVoice(): UseStreamingVoiceReturn {
  // State
  const [connectionState, setConnectionState] = useState<StreamingClientState>('disconnected');
  const [playbackState, setPlaybackState] = useState<StreamingPlaybackState>('idle');
  const [isProcessing, setIsProcessing] = useState(false);
  const isProcessingRef = useRef(false);
  isProcessingRef.current = isProcessing;
  const [isSwitchingTutor, setIsSwitchingTutor] = useState(false);  // Mic lockout during tutor handoff
  const isSwitchingTutorRef = useRef(false);
  isSwitchingTutorRef.current = isSwitchingTutor;
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<StreamingMetrics | null>(null);
  
  // Ref for tutor switch timeout (error recovery)
  const tutorSwitchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Ref for processing timeout (stuck thinking recovery)
  // If no activity for 30+ seconds while isProcessing=true, reset state
  // Increased from 15s to 25s Jan 2026 to handle server delays from RAM pressure
  const processingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const PROCESSING_TIMEOUT_MS = 60000;  // 60 seconds max "thinking" time (Gemini TTS can take 40-50s for long responses)

  // Refs
  const clientRef = useRef<StreamingVoiceClient | null>(null);
  const playerRef = useRef<StreamingAudioPlayer | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  
  // Track orchestrator response completion and pending audio
  // isProcessing should only be cleared when BOTH:
  // 1. Server has sent response_complete (responseCompleteRef = true)
  // 2. No pending audio chunks (pendingAudioCount = 0)
  // 3. Audio has actually started playing (or no audio was sent)
  const responseCompleteRef = useRef(false);
  const pendingAudioCountRef = useRef(0);
  const setIsProcessingRef = useRef(setIsProcessing);
  setIsProcessingRef.current = setIsProcessing;
  
  // Turn counter: prevents stale failsafe timers from old turns from firing during
  // new turns. Each timer captures the turn number at creation time and bails if
  // the current turn has advanced. Without this, old 45s timers see
  // responseCompleteRef=true (set by a NEWER turn) and incorrectly fire, calling
  // player.stop() which cuts off audio mid-sentence and triggers Sofia popups.
  const turnCounterRef = useRef(0);
  
  // Track whether audio has been received in the current turn
  // When true, isProcessing should stay true until playback actually starts
  // This prevents the thinking→listening flash when response_complete arrives
  // before the audio player has transitioned to 'playing' state
  const audioReceivedInTurnRef = useRef(false);
  
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
    const audioReceived = audioReceivedInTurnRef.current;
    
    console.log(`[StreamingVoice] checkAndClearProcessing: complete=${isComplete}, pending=${pendingAudioCountRef.current}, audioReceived=${audioReceived}`);
    
    if (isComplete && noPendingAudio) {
      if (audioReceived) {
        console.log('[StreamingVoice] Response complete but audio was received - deferring isProcessing clear until playback starts');
        // SAFETY: If playback never starts (decode error, autoplay block, etc),
        // onSentenceStart never fires and mic stays locked forever. Schedule a
        // deferred clear — if onSentenceStart fires in time, it will clear
        // audioReceivedInTurnRef and the next checkAndClearProcessing call will
        // handle cleanup normally. This 10s timeout is a safety net only.
        setTimeout(() => {
          if (audioReceivedInTurnRef.current && responseCompleteRef.current && pendingAudioCountRef.current === 0) {
            const ctxState = playerRef.current?.getAudioContextState?.() || 'unknown';
            console.log(`[StreamingVoice] audioReceived guard timeout: playback never started after 10s — force-clearing (ctxState=${ctxState})`);
            audioReceivedInTurnRef.current = false;
            setIsProcessingRef.current(false);
            setGlobalPlaybackState('idle');
            playerRef.current?.stop?.();
          }
        }, 10000);
      } else {
        console.log('[StreamingVoice] Response complete AND no pending audio (no audio turn) - clearing isProcessing');
        setIsProcessingRef.current(false);
      }
    }
  }, []);
  
  // Subtitle management with ACTFL-level-aware timing
  const subtitles = useStreamingSubtitles({ difficultyLevel });
  
  // Keep a ref to subtitles to avoid stale closure issues in audio player callbacks
  // The audio player callbacks are set once on mount but need access to latest subtitles methods
  const subtitlesRef = useRef(subtitles);
  subtitlesRef.current = subtitles;
  
  // Generate a unique callback ID for this component instance
  const callbackIdRef = useRef(`cb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
  
  // Track the setPlaybackState function in a ref for stable reference
  const setPlaybackStateRef = useRef(setPlaybackState);
  setPlaybackStateRef.current = setPlaybackState;
  
  /**
   * Initialize the audio player and SUBSCRIBE to callbacks
   * CRITICAL: Use subscribe/unsubscribe pattern to survive Vite HMR
   * Each component instance gets a unique subscriber ID and properly cleans up
   */
  useEffect(() => {
    const player = getStreamingAudioPlayer();
    playerRef.current = player;
    const subscriberId = callbackIdRef.current;
    
    console.log(`[CALLBACK SETUP] Subscribing with ID: ${subscriberId}`);
    
    // Subscribe to player callbacks with unique ID
    // NOTE: isProcessing is only cleared when BOTH:
    // 1. Server has sent response_complete (responseCompleteRef = true)
    // 2. No pending audio chunks (pendingAudioCountRef = 0)
    // IMPORTANT: Use refs to get latest values (avoids stale closure)
    player.subscribe(subscriberId, {
      onStateChange: (state) => {
        // CRITICAL DEBUG: Log and trace every callback invocation
        // Also store in window for DevTools inspection
        (window as any).__lastPlaybackCallback = {
          timestamp: Date.now(),
          state,
          subscriberId,
          setPlaybackStateRefType: typeof setPlaybackStateRef.current
        };
        console.log(`[PLAYBACK CALLBACK ${subscriberId}] onStateChange: ${state}`, (window as any).__lastPlaybackCallback);
        
        // Verify the ref is valid before calling
        if (typeof setPlaybackStateRef.current !== 'function') {
          console.error('[PLAYBACK CALLBACK] setPlaybackStateRef.current is NOT a function!', setPlaybackStateRef.current);
          return;
        }
        
        // Use ref to ensure we always call the current setPlaybackState
        setPlaybackStateRef.current(state);
        (window as any).__playbackStateSetCount = ((window as any).__playbackStateSetCount || 0) + 1;
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
        // Audio is now actually playing - clear the audioReceived guard
        // so that onComplete/checkAndClearProcessing can clear isProcessing
        audioReceivedInTurnRef.current = false;
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
        setIsProcessingRef.current(false);
        setGlobalPlaybackState('idle');
        playerRef.current?.stop?.();
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
      // CRITICAL: Unsubscribe to remove stale callbacks
      console.log(`[CALLBACK CLEANUP] Unsubscribing ID: ${subscriberId}`);
      player.unsubscribe(subscriberId);
      player.destroy();
    };
  }, []);
  
  /**
   * DOM Event Bridge: Parallel path for receiving playback state changes
   * This ensures state updates even if the callback closure becomes stale during HMR
   */
  useEffect(() => {
    const handlePlaybackStateEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ state: StreamingPlaybackState; timestamp: number; subscriberCount: number }>;
      const { state, timestamp, subscriberCount } = customEvent.detail;
      
      console.log(`[DOM EVENT BRIDGE] Received state: ${state}, subscribers: ${subscriberCount}, ts: ${timestamp}`);
      
      // Update state via direct setter (fresh closure, not the ref)
      setPlaybackState(state);
    };
    
    window.addEventListener('streaming-playback-state', handlePlaybackStateEvent);
    console.log('[DOM EVENT BRIDGE] Listener registered');
    
    return () => {
      window.removeEventListener('streaming-playback-state', handlePlaybackStateEvent);
      console.log('[DOM EVENT BRIDGE] Listener removed');
    };
  }, []);
  
  /**
   * Mobile AudioContext recovery — two layers:
   * 
   * 1. visibilitychange: When user returns from screen lock / app switch,
   *    resume AudioContext immediately and clear stuck processing state.
   * 
   * 2. User interaction fallback (touchstart/click): If the AudioContext is
   *    still suspended after visibility resume (Chrome requires a user gesture),
   *    the next tap will resume it. This also catches the greeting-silence case
   *    where audio was generated but never played because the context was suspended.
   */
  useEffect(() => {
    let needsInteractionResume = false;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[StreamingVoice] App became visible — resuming AudioContext');
        
        if (playerRef.current) {
          playerRef.current.resumeAudioContext().then(() => {
            const state = playerRef.current?.getAudioContextState?.();
            if (state === 'suspended') {
              needsInteractionResume = true;
              console.log('[StreamingVoice] AudioContext still suspended after resume — will retry on next user tap');
            }
          }).catch(() => {
            needsInteractionResume = true;
          });
        }
        
        setTimeout(() => {
          if (responseCompleteRef.current && pendingAudioCountRef.current === 0) {
            console.log('[StreamingVoice] Visibility recovery: response was complete, clearing stuck isProcessing');
            audioReceivedInTurnRef.current = false;
            setIsProcessingRef.current(false);
          } else if (responseCompleteRef.current) {
            console.log('[StreamingVoice] Visibility recovery: response complete but pendingAudio > 0, force-clearing');
            pendingAudioCountRef.current = 0;
            audioReceivedInTurnRef.current = false;
            setIsProcessingRef.current(false);
          }
        }, 500);
      }
    };

    const handleUserInteraction = () => {
      if (!needsInteractionResume) return;
      needsInteractionResume = false;
      if (playerRef.current) {
        const state = playerRef.current.getAudioContextState?.();
        if (state === 'suspended' || state === 'uninitialized') {
          console.log('[StreamingVoice] User gesture detected — resuming AudioContext');
          playerRef.current.resumeAudioContext().catch(() => {});
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('touchstart', handleUserInteraction, { passive: true });
    document.addEventListener('click', handleUserInteraction);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('touchstart', handleUserInteraction);
      document.removeEventListener('click', handleUserInteraction);
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
    
    // CRITICAL: Set processing state when server indicates new turn is processing
    // This ensures thinking indicator shows for server-initiated responses (tutor handoffs, etc.)
    setIsProcessing(true);
    
    // Reset audio received flag for new turn
    audioReceivedInTurnRef.current = false;
    
    // Store turnId for use in callbacks
    currentTurnIdRef.current = msg.turnId;
    
    // Start processing timeout (stuck thinking recovery) - applies to BOTH PTT and open mic
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current);
    }
    processingTimeoutRef.current = setTimeout(() => {
      console.log('[StreamingVoice] Processing timeout - resetting stuck thinking state + playback');
      setIsProcessing(false);
      setError('Response timeout - please try again');
      setGlobalPlaybackState('idle');
      playerRef.current?.stop?.();
    }, PROCESSING_TIMEOUT_MS);
    
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
   * Handle processing_pending message - IMMEDIATE thinking signal
   * This fires right when PTT is released, before Deepgram finalization wait.
   * Triggers thinking avatar immediately for better perceived responsiveness.
   */
  const handleProcessingPending = useCallback((msg: { type: string; timestamp: number; interimTranscript: string }) => {
    console.log(`[StreamingVoice] Processing pending: "${msg.interimTranscript.substring(0, 30)}..."`);
    
    // IMMEDIATELY show thinking indicator
    setIsProcessing(true);
    audioReceivedInTurnRef.current = false;
    
    // Start processing timeout (same as handleProcessing)
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current);
    }
    processingTimeoutRef.current = setTimeout(() => {
      console.log('[StreamingVoice] Processing timeout (pending) - resetting stuck thinking state + playback');
      setIsProcessing(false);
      setError('Response timeout - please try again');
      setGlobalPlaybackState('idle');
      playerRef.current?.stop?.();
    }, PROCESSING_TIMEOUT_MS);
  }, []);

  const handleNoSpeechDetected = useCallback(() => {
    console.log('[StreamingVoice] No speech detected - resetting to idle');
    setIsProcessing(false);
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current);
      processingTimeoutRef.current = null;
    }
    if (sessionConfigRef.current?.onNoSpeechDetected) {
      sessionConfigRef.current.onNoSpeechDetected();
    }
  }, []);
  
  /**
   * Handle sentence start message
   * Now includes turnId and hasTargetContent for server-driven subtitle state
   * 
   * CRITICAL: Uses subtitlesRef.current to avoid stale closure issues.
   */
  const handleSentenceStart = useCallback((msg: StreamingSentenceStartMessage) => {
    // ALWAYS log sentence_start for debugging subtitle issues
    console.log(`[SENTENCE_START] sentence=${msg.sentenceIndex}, hasTarget=${msg.hasTargetContent}, targetText="${(msg.targetLanguageText || '').substring(0, 40)}..."`);
    
    if (isVerboseLoggingEnabled()) {
      console.log(`[StreamingVoice] Sentence ${msg.sentenceIndex} (turn ${msg.turnId}): "${msg.text.substring(0, 40)}..." hasTarget=${msg.hasTargetContent}`);
    }
    
    // Activity detected - extend the safety timeout since audio generation is underway
    // 45s is enough for even long multi-sentence TTS to complete (reduced from 180s
    // which left mobile users stuck for 3 minutes when AudioContext suspended)
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current);
      processingTimeoutRef.current = setTimeout(() => {
        console.log('[StreamingVoice] Processing timeout - resetting stuck thinking state');
        setIsProcessing(false);
        setError('Response timeout - please try again');
      }, 45000);
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
    console.log('[HOOK handleAudioChunk] CALLED! sentence=', msg.sentenceIndex, 'chunk=', msg.chunkIndex, 'audioLen=', msg.audio?.length || 0);
    
    diagMarkFirstAudio();
    
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
    
    // ALWAYS log sentence_ready receipt for diagnostics (this was a critical silent failure)
    const audioStripped = (firstAudioChunk as any)?.audioStripped === true;
    const hasAudio = firstAudioChunk?.audio && firstAudioChunk.audio.length > 0;
    console.log(`[SENTENCE_READY] Received: sentence=${sentenceIndex}, turn=${turnId}, timings=${firstWordTimings?.length || 0}, hasAudio=${hasAudio}, audioStripped=${audioStripped}`);
    
    // Mark that audio has been received in this turn
    // This prevents checkAndClearProcessing from clearing isProcessing
    // before the audio player has actually started playing
    audioReceivedInTurnRef.current = true;
    
    // Audio is arriving - clear the "thinking" timeout since we have proof the response is being generated
    // Use a safety net timeout (45s) to handle multi-segment TTS responses
    // 45s is sufficient for even long responses while preventing extended mobile lockout
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current);
    }
    processingTimeoutRef.current = setTimeout(() => {
      console.log('[StreamingVoice] Safety timeout after sentence_ready - resetting stuck state + playback');
      setIsProcessing(false);
      setError('Response timeout - please try again');
      setGlobalPlaybackState('idle');
      playerRef.current?.stop?.();
    }, 45000);
    
    // TUTOR SWITCH: If we were switching tutors, clear the flag now that audio is ready
    setIsSwitchingTutor(false);
    if (tutorSwitchTimeoutRef.current) {
      clearTimeout(tutorSwitchTimeoutRef.current);
      tutorSwitchTimeoutRef.current = null;
    }
    
    const hasTimings = firstWordTimings && firstWordTimings.length > 0;
    
    if (!hasTimings) {
      console.log(`[SENTENCE_READY] Sentence ${sentenceIndex} has no timings yet (silent intro)`);
    }
    
    const reconstructedText = hasTimings 
      ? firstWordTimings.map(t => t.word).join(' ') 
      : '';
    subtitlesRef.current.addSentence(
      sentenceIndex,
      reconstructedText,
      turnId,
      false,
      undefined,
      undefined
    );
    
    // 1. Register all word timings with the player FIRST (before audio plays)
    if (playerRef.current && hasTimings) {
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
    if (hasTimings) {
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
    }
    
    // 3. Enqueue the first audio chunk for playback
    // PROXY FIX: If audioStripped=true, audio was too large for the proxy and will
    // arrive as a separate audio_chunk message. Skip enqueue here - handleAudioChunk handles it.
    if (playerRef.current && hasAudio && !audioStripped) {
      logAudioChunkReceived(sentenceIndex);
      
      const binaryString = atob(firstAudioChunk.audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      if (isVerboseLoggingEnabled()) {
        console.error(`[SENTENCE_READY] Enqueueing first audio chunk: ${bytes.buffer.byteLength} bytes`);
      }
      
      if (firstAudioChunk.audioFormat === 'pcm_f32le') {
        const normalizedChunkIndex = typeof firstAudioChunk.chunkIndex === 'number' 
          ? firstAudioChunk.chunkIndex 
          : parseInt(firstAudioChunk.chunkIndex as any, 10) || 0;
        playerRef.current.enqueueProgressivePcmChunk(
          sentenceIndex,
          normalizedChunkIndex,
          bytes.buffer,
          firstAudioChunk.durationMs,
          false,
          firstAudioChunk.sampleRate
        );
      } else {
        console.log(`[SENTENCE_READY] MP3 audio embedded - enqueueing via traditional path: ${bytes.buffer.byteLength} bytes`);
        const chunk: StreamingAudioChunk = {
          sentenceIndex,
          audio: bytes.buffer,
          durationMs: firstAudioChunk.durationMs,
          isLast: false,
          audioFormat: firstAudioChunk.audioFormat || 'mp3',
          sampleRate: firstAudioChunk.sampleRate || 24000,
        };
        playerRef.current.enqueue(chunk);
      }
    } else if (audioStripped) {
      console.log(`[SENTENCE_READY] Audio stripped by proxy adapter - will arrive as separate audio_chunk`);
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
      // Clear processing timeout on interrupt
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current);
        processingTimeoutRef.current = null;
      }
      setIsProcessing(false);
      return; // Don't do normal completion handling
    }
    
    trackWsMessage('response_complete');
    diagMarkResponseComplete(msg.totalSentences || 0);
    
    console.log(`[StreamingVoice] response_complete received: sentences=${msg.totalSentences}, pending=${pendingAudioCountRef.current}, wasComplete=${responseCompleteRef.current}`);
    
    // CRITICAL: Tell the audio player how many sentences this turn has
    // This prevents premature loop termination when early sentences finish
    // before later sentences have even arrived
    if (playerRef.current && msg.totalSentences !== undefined) {
      playerRef.current.setExpectedSentenceCount(msg.totalSentences);
    }
    
    // Mark response as complete
    responseCompleteRef.current = true;
    
    // Clear processing timeout (response received successfully)
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current);
      processingTimeoutRef.current = null;
    }
    
    // Call the onResponseComplete callback to refresh messages
    // Messages are persisted server-side, so we need to refetch
    if (sessionConfigRef.current?.onResponseComplete && sessionConfigRef.current?.conversationId) {
      sessionConfigRef.current.onResponseComplete(sessionConfigRef.current.conversationId);
    }
    
    // Check if we can clear isProcessing (no pending audio)
    checkAndClearProcessing();
    
    // Increment turn counter so stale failsafe timers from previous turns bail out.
    // Without this, a 45s timer from Turn 1 fires during Turn 3, sees
    // responseCompleteRef=true (set by Turn 3), and incorrectly stops audio.
    const thisTurn = ++turnCounterRef.current;
    
    // FAILSAFE: If checkAndClearProcessing didn't clear isProcessing (e.g., due to
    // pendingAudioCount stuck > 0 from a previous bug), schedule a delayed force-clear.
    setTimeout(() => {
      if (turnCounterRef.current !== thisTurn) return;
      if (responseCompleteRef.current && pendingAudioCountRef.current === 0) {
        audioReceivedInTurnRef.current = false;
        setIsProcessingRef.current(false);
      }
    }, 1000);
    
    // TIERED HARD FAILSAFE: Two tiers to cover both mobile and desktop lockout.
    // Each timer checks turnCounterRef to avoid acting on a stale turn.
    //
    // Tier 1 (20s): AudioContext-aware — catches mobile suspension where audio callbacks
    // never fire because the OS suspended the AudioContext.
    setTimeout(() => {
      if (turnCounterRef.current !== thisTurn) return;
      if (!responseCompleteRef.current) return;
      const player = playerRef.current;
      const ctxState = player?.getAudioContextState?.() || 'unknown';
      if (ctxState === 'suspended' || ctxState === 'closed' || ctxState === 'uninitialized') {
        console.log(`[StreamingVoice] Tier-1 failsafe (20s): AudioContext ${ctxState} — force-clearing (turn=${thisTurn}, pending=${pendingAudioCountRef.current})`);
        diagMarkFailsafe('tier1_20s', { ctxState, pending: pendingAudioCountRef.current });
        reportDiagnostic('failsafe_tier1_20s', { failsafeTier: 'tier1_20s' });
        pendingAudioCountRef.current = 0;
        audioReceivedInTurnRef.current = false;
        setIsProcessingRef.current(false);
        setGlobalPlaybackState('idle');
        player?.stop?.();
      }
    }, 20000);
    
    // Tier 2 (45s): Catches stuck states where AudioContext is "running" but audio
    // callbacks silently failed. Playback-aware: if audio is actively playing or
    // buffering, defer to 90s instead of force-stopping.
    setTimeout(() => {
      if (turnCounterRef.current !== thisTurn) return;
      if (!responseCompleteRef.current) return;
      const player = playerRef.current;
      const ctxState = player?.getAudioContextState?.() || 'unknown';
      const currentPlayback = getGlobalPlaybackState();
      
      if (currentPlayback === 'playing' || currentPlayback === 'buffering') {
        console.log(`[StreamingVoice] Tier-2 failsafe (45s): audio active (${currentPlayback}) — deferring to 90s, unlocking mic (turn=${thisTurn})`);
        pendingAudioCountRef.current = 0;
        audioReceivedInTurnRef.current = false;
        setIsProcessingRef.current(false);
        
        setTimeout(() => {
          if (turnCounterRef.current !== thisTurn) return;
          if (!responseCompleteRef.current) return;
          const finalPlayback = getGlobalPlaybackState();
          const finalCtxState = player?.getAudioContextState?.() || 'unknown';
          console.log(`[StreamingVoice] Tier-2 extended failsafe (90s): force-clear (playback=${finalPlayback}, ctxState=${finalCtxState}, turn=${thisTurn})`);
          diagMarkFailsafe('tier2_90s', { ctxState: finalCtxState, pending: pendingAudioCountRef.current });
          reportDiagnostic('failsafe_tier2_45s', { failsafeTier: 'tier2_90s' });
          pendingAudioCountRef.current = 0;
          audioReceivedInTurnRef.current = false;
          setIsProcessingRef.current(false);
          setGlobalPlaybackState('idle');
          player?.stop?.();
        }, 45000);
      } else {
        console.log(`[StreamingVoice] Tier-2 failsafe (45s): audio NOT active (${currentPlayback}) — force-clear (turn=${thisTurn}, pending=${pendingAudioCountRef.current})`);
        diagMarkFailsafe('tier2_45s', { ctxState, pending: pendingAudioCountRef.current });
        reportDiagnostic('failsafe_tier2_45s', { failsafeTier: 'tier2_45s' });
        pendingAudioCountRef.current = 0;
        audioReceivedInTurnRef.current = false;
        setIsProcessingRef.current(false);
        setGlobalPlaybackState('idle');
        player?.stop?.();
      }
    }, 45000);
    
    startLockoutWatchdog();
  }, [checkAndClearProcessing]);

  const handleExpectedSentenceCount = useCallback((data: { count: number }) => {
    if (playerRef.current) {
      console.log(`[StreamingVoice] Early sentence count: ${data.count} sentences expected`);
      playerRef.current.setExpectedSentenceCount(data.count);
    }
  }, []);

  /**
   * Handle errors - also clears tutor switch state to prevent mic lockout
   */
  const handleTtsError = useCallback((data: { code: string; message: string }) => {
    diagMarkTtsError(data.code, data.message);
    if (import.meta.env.DEV) {
      console.warn(`[StreamingVoice] TTS audio failed (dev-only): ${data.message}`);
    }
  }, []);

  const handleError = useCallback((err: Error) => {
    console.error('[StreamingVoice] Error:', err);
    diagMarkError('ws_error', err.message);
    const isCreditsError = err.message?.includes('credits have been used up') || err.message?.includes('Insufficient tutoring hours');
    if (!isCreditsError) {
      reportDiagnostic('error');
    }
    setError(err.message);
    setIsProcessing(false);
    setGlobalPlaybackState('idle');
    playerRef.current?.stop?.();
    
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current);
      processingTimeoutRef.current = null;
    }
    
    // Clear tutor switch state to prevent mic lockout on errors
    if (tutorSwitchTimeoutRef.current) {
      clearTimeout(tutorSwitchTimeoutRef.current);
      tutorSwitchTimeoutRef.current = null;
    }
    setIsSwitchingTutor(false);
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
   * Handle pronunciation coaching feedback from server
   * Provides real-time feedback based on Deepgram word-level confidence scores
   */
  const handlePronunciationCoaching = useCallback((message: {
    type: string;
    timestamp: number;
    turnId: string;
    coaching: {
      overallScore: number;
      wordFeedback: Array<{
        word: string;
        confidence: number;
        status: 'excellent' | 'good' | 'needs_work' | 'difficult';
        suggestion?: string;
      }>;
      coachingTips: string[];
      encouragement: string;
      lowConfidenceWords: string[];
      phonemeHints: Array<{
        phoneme: string;
        word: string;
        tip: string;
      }>;
    };
  }) => {
    console.log(`[StreamingVoice] Pronunciation coaching: ${message.coaching.overallScore}% score, ${message.coaching.lowConfidenceWords.length} words need attention`);
    
    if (sessionConfigRef.current?.onPronunciationCoaching) {
      sessionConfigRef.current.onPronunciationCoaching(message.coaching);
    }
  }, []);
  
  /**
   * Handle VAD speech started event (open mic mode)
   */
  const handleVadSpeechStarted = useCallback((message: { type: string }) => {
    // ALWAYS log VAD events for barge-in debugging
    console.log('[StreamingVoice] VAD speech started - triggering onVadSpeechStarted callback');
    sessionConfigRef.current?.onVadSpeechStarted?.();
  }, []);
  
  /**
   * Handle VAD utterance end event (open mic mode)
   */
  const handleVadUtteranceEnd = useCallback((message: { type: string; transcript?: string; empty?: boolean }) => {
    if (isVerboseLoggingEnabled()) {
      console.log('[StreamingVoice] VAD utterance end, transcript:', message.transcript, 'empty:', message.empty);
    }
    sessionConfigRef.current?.onVadUtteranceEnd?.(message.transcript || '', message.empty);
  }, []);
  
  /**
   * Handle interim transcript (open mic mode)
   * NOTE: Server sends "text" field, not "transcript"
   */
  const handleInterimTranscript = useCallback((message: { type: string; text?: string; transcript?: string }) => {
    // Server sends "text" field, but support "transcript" as fallback
    const transcript = message.text || message.transcript || '';
    if (isVerboseLoggingEnabled()) {
      console.log('[StreamingVoice] Interim transcript:', transcript);
    }
    sessionConfigRef.current?.onInterimTranscript?.(transcript);
  }, []);
  
  /**
   * Handle open mic session closed (e.g., Deepgram timeout)
   */
  const handleOpenMicSessionClosed = useCallback(() => {
    console.log('[StreamingVoice] Open mic session closed - client should restart if in open mic mode');
    sessionConfigRef.current?.onOpenMicSessionClosed?.();
  }, []);
  
  const handleOpenMicSilenceLoop = useCallback((message: { consecutiveEmptyCount: number; msSinceLastSuccessfulTranscript: number }) => {
    console.warn(`[StreamingVoice] Silence loop: ${message.consecutiveEmptyCount} empty transcripts, ${message.msSinceLastSuccessfulTranscript}ms since last speech`);
    sessionConfigRef.current?.onOpenMicSilenceLoop?.(message.consecutiveEmptyCount, message.msSinceLastSuccessfulTranscript);
  }, []);

  const handleReconnected = useCallback((_message: { timestamp: number }) => {
    console.log('[StreamingVoice] Successfully reconnected after connection drop');
    sessionConfigRef.current?.onReconnected?.();
  }, []);
  
  /**
   * Handle subtitle mode change from server (tutor [SUBTITLE on/off/target] command)
   */
  const handleSubtitleModeChange = useCallback((message: { type: string; mode: 'off' | 'all' | 'target'; timestamp: number }) => {
    const { mode } = message;
    console.log('[StreamingVoice] Subtitle mode change from tutor:', mode);
    sessionConfigRef.current?.onSubtitleModeChange?.(mode);
  }, []);
  
  /**
   * Handle custom overlay from server (tutor [SHOW: text] / [HIDE] commands)
   */
  const handleCustomOverlay = useCallback((message: { type: string; action: 'show' | 'hide'; text?: string; timestamp: number }) => {
    const { action, text } = message;
    console.log('[StreamingVoice] Custom overlay from tutor:', action, text?.substring(0, 50));
    sessionConfigRef.current?.onCustomOverlay?.(action, text);
  }, []);
  
  /**
   * Handle text input request from server (tutor [TEXT_INPUT: prompt] command)
   */
  const handleTextInputRequest = useCallback((message: { type: string; prompt: string; timestamp: number }) => {
    const { prompt } = message;
    console.log('[StreamingVoice] Text input request from tutor:', prompt?.substring(0, 50));
    sessionConfigRef.current?.onTextInputRequest?.(prompt);
  }, []);

  const handleScenarioLoaded = useCallback((message: any) => {
    console.log('[StreamingVoice] Scenario loaded:', message.scenario?.title);
    sessionConfigRef.current?.onScenarioLoaded?.(message.scenario);
  }, []);

  const handleScenarioEnded = useCallback((message: any) => {
    console.log('[StreamingVoice] Scenario ended:', message.scenarioSlug);
    sessionConfigRef.current?.onScenarioEnded?.({
      scenarioId: message.scenarioId,
      scenarioSlug: message.scenarioSlug,
      performanceNotes: message.performanceNotes,
    });
  }, []);
  
  /**
   * Handle tutor handoff - triggered after current tutor says goodbye
   * Automatically switches voice to new tutor and triggers their introduction
   * Supports both intra-language (gender only) and cross-language (gender + language) handoffs
   * 
   * MIC LOCKOUT: During handoff, mic stays locked until new tutor starts speaking
   * to prevent user from accidentally interrupting the transition
   */
  const handleTutorHandoff = useCallback((message: { 
    type: string; 
    targetGender: 'male' | 'female'; 
    targetLanguage?: string;
    tutorName?: string;
    isLanguageSwitch: boolean;
    requiresGreeting?: boolean;
    isAssistant?: boolean;
    timestamp: number;
  }) => {
    const { targetGender, targetLanguage, tutorName, isLanguageSwitch, requiresGreeting, isAssistant } = message;
    
    if (isAssistant) {
      console.log(`[StreamingVoice] Assistant handoff to ${tutorName} (${targetGender}) - navigate to practice page`);
    } else if (isLanguageSwitch && targetLanguage) {
      console.log(`[StreamingVoice] Cross-language handoff to ${tutorName} (${targetGender}) in ${targetLanguage}`);
      // For cross-language handoffs, the server will skip intro generation
      // and the client will request greeting after reconnecting with new language
    } else {
      console.log(`[StreamingVoice] Tutor handoff to ${tutorName || targetGender} tutor`);
    }
    
    // MIC LOCKOUT: Lock mic during tutor switch
    // This prevents user from speaking during the transition
    console.log('[StreamingVoice] Tutor switching - locking mic');
    setIsSwitchingTutor(true);
    
    // Error recovery: If something goes wrong, unlock mic after 15 seconds
    // This ensures user isn't permanently locked out if the switch fails
    if (tutorSwitchTimeoutRef.current) {
      clearTimeout(tutorSwitchTimeoutRef.current);
    }
    tutorSwitchTimeoutRef.current = setTimeout(() => {
      console.log('[StreamingVoice] Tutor switch timeout - unlocking mic (error recovery)');
      setIsSwitchingTutor(false);
    }, 15000);  // 15 second timeout for error recovery
    
    // Notify parent component to update UI state (avatar, buttons)
    // Pass full handoff info for cross-language and assistant support
    sessionConfigRef.current?.onTutorHandoff?.({
      targetGender,
      targetLanguage,
      tutorName,
      isLanguageSwitch,
      requiresGreeting,
      isAssistant,
    });
    
    // Call updateVoice to complete the handoff workflow
    // For cross-language switches, server will skip intro generation (isLanguageSwitchHandoff flag)
    // but we still need to call this to complete the handoff gracefully
    // NOTE: For assistant switches, we don't update voice here - the parent will navigate away
    if (clientRef.current?.isReady() && !isAssistant) {
      clientRef.current.updateVoice(targetGender);
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
    
    // CRITICAL: Pre-warm AudioContext in user gesture context
    // This MUST happen during the click handler, not later when audio chunks arrive
    // Otherwise browsers will block audio playback due to autoplay policy
    try {
      const player = getStreamingAudioPlayer();
      await player.resumeAudioContext();
      console.log('[StreamingVoice] AudioContext pre-warmed during user gesture');
    } catch (warmErr) {
      console.warn('[StreamingVoice] Failed to pre-warm AudioContext:', warmErr);
    }
    
    try {
      // Get or create client
      clientRef.current = getStreamingVoiceClient();
      
      // Set up callbacks
      clientRef.current.on('stateChange', setConnectionState);
      clientRef.current.on('processing', handleProcessing);
      clientRef.current.on('processing_pending', handleProcessingPending);  // Immediate thinking signal
      clientRef.current.on('sentenceStart', handleSentenceStart);
      clientRef.current.on('expectedSentenceCount', handleExpectedSentenceCount);
      clientRef.current.on('sentenceReady', handleSentenceReady);  // NEW: Atomic first audio + timing
      clientRef.current.on('audioChunk', handleAudioChunk);
      clientRef.current.on('wordTiming', handleWordTiming);
      clientRef.current.on('wordTimingDelta', handleWordTimingDelta);  // Progressive streaming
      clientRef.current.on('wordTimingFinal', handleWordTimingFinal);  // Progressive streaming
      clientRef.current.on('responseComplete', handleResponseComplete);
      clientRef.current.on('whiteboardUpdate', handleWhiteboardUpdate);  // Enriched whiteboard items
      clientRef.current.on('pronunciationCoaching', handlePronunciationCoaching);  // Live pronunciation feedback
      clientRef.current.on('error', handleError);
      clientRef.current.on('ttsError', handleTtsError);
      clientRef.current.on('noSpeechDetected', handleNoSpeechDetected);  // Empty PTT reset
      clientRef.current.on('vadSpeechStarted', handleVadSpeechStarted);  // Open mic VAD
      clientRef.current.on('vadUtteranceEnd', handleVadUtteranceEnd);  // Open mic VAD
      clientRef.current.on('interimTranscript', handleInterimTranscript);  // Open mic interim
      clientRef.current.on('openMicSessionClosed', handleOpenMicSessionClosed);  // Open mic session ended
      clientRef.current.on('openMicSilenceLoop', handleOpenMicSilenceLoop);  // Open mic silence loop detection
      clientRef.current.on('reconnected', handleReconnected);  // Successful reconnection after drop
      clientRef.current.on('tutorHandoff', handleTutorHandoff);  // Voice-initiated tutor switch
      clientRef.current.on('subtitleModeChange', handleSubtitleModeChange);  // Server subtitle mode command
      clientRef.current.on('customOverlay', handleCustomOverlay);  // Server custom overlay command
      clientRef.current.on('textInputRequest', handleTextInputRequest);  // Server text input request
      clientRef.current.on('scenarioLoaded', handleScenarioLoaded);
      clientRef.current.on('scenarioEnded', handleScenarioEnded);
      
      // Connect WebSocket
      await clientRef.current.connect(config.conversationId);
      if (isVerboseLoggingEnabled()) {
        console.log('[StreamingVoice] WebSocket connected, starting session...');
      }
      
      diagSetSession({
        conversationId: config.conversationId,
        userId: null,
        language: config.targetLanguage,
        inputMode: config.inputMode,
      });
      diagSetHookRefs({
        isProcessingFn: () => isProcessingRef.current,
        pendingAudioCountFn: () => pendingAudioCountRef.current,
        audioReceivedInTurnFn: () => audioReceivedInTurnRef.current,
        responseCompleteFn: () => responseCompleteRef.current,
        isSwitchingTutorFn: () => isSwitchingTutorRef.current,
      });
      diagMarkConnect();
      startGreetingSilenceWatchdog();
      
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
        founderMode: config.founderMode,  // Explicit founder mode flag
      });
      
      if (isVerboseLoggingEnabled()) {
        console.log('[StreamingVoice] Session started, waiting for ready state...');
      }
      
    } catch (err: any) {
      console.error('[StreamingVoice] Connection failed:', err);
      setError(err.message);
      throw err;
    }
  }, [handleProcessing, handleProcessingPending, handleNoSpeechDetected, handleSentenceStart, handleExpectedSentenceCount, handleSentenceReady, handleAudioChunk, handleWordTiming, handleWordTimingDelta, handleWordTimingFinal, handleResponseComplete, handleWhiteboardUpdate, handlePronunciationCoaching, handleError, handleVadSpeechStarted, handleVadUtteranceEnd, handleInterimTranscript, handleOpenMicSilenceLoop, handleReconnected, handleSubtitleModeChange, handleCustomOverlay, handleTextInputRequest, handleScenarioLoaded, handleScenarioEnded]);
  
  /**
   * Disconnect from streaming voice service
   */
  const disconnect = useCallback(() => {
    diagMarkDisconnect('user_disconnect');
    if (isVerboseLoggingEnabled()) {
      console.log('[StreamingVoice] Disconnecting');
    }
    
    if (clientRef.current) {
      clientRef.current.off('stateChange', setConnectionState);
      clientRef.current.off('processing', handleProcessing);
      clientRef.current.off('processing_pending', handleProcessingPending);  // Immediate thinking signal
      clientRef.current.off('sentenceStart', handleSentenceStart);
      clientRef.current.off('expectedSentenceCount', handleExpectedSentenceCount);
      clientRef.current.off('sentenceReady', handleSentenceReady);  // NEW: Atomic first audio + timing
      clientRef.current.off('audioChunk', handleAudioChunk);
      clientRef.current.off('wordTiming', handleWordTiming);
      clientRef.current.off('wordTimingDelta', handleWordTimingDelta);  // Progressive streaming
      clientRef.current.off('wordTimingFinal', handleWordTimingFinal);  // Progressive streaming
      clientRef.current.off('responseComplete', handleResponseComplete);
      clientRef.current.off('whiteboardUpdate', handleWhiteboardUpdate);  // Enriched whiteboard items
      clientRef.current.off('pronunciationCoaching', handlePronunciationCoaching);  // Live pronunciation feedback
      clientRef.current.off('error', handleError);
      clientRef.current.off('noSpeechDetected', handleNoSpeechDetected);  // Empty PTT reset
      clientRef.current.off('vadSpeechStarted', handleVadSpeechStarted);  // Open mic VAD
      clientRef.current.off('vadUtteranceEnd', handleVadUtteranceEnd);  // Open mic VAD
      clientRef.current.off('interimTranscript', handleInterimTranscript);  // Open mic interim
      clientRef.current.off('openMicSilenceLoop', handleOpenMicSilenceLoop);  // Open mic silence loop
      clientRef.current.off('reconnected', handleReconnected);  // Successful reconnection
      clientRef.current.off('subtitleModeChange', handleSubtitleModeChange);  // Server subtitle mode command
      clientRef.current.off('customOverlay', handleCustomOverlay);  // Server custom overlay command
      clientRef.current.off('textInputRequest', handleTextInputRequest);  // Server text input request
      clientRef.current.off('scenarioLoaded', handleScenarioLoaded);
      clientRef.current.off('scenarioEnded', handleScenarioEnded);
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
    setError(null);
    
    // Clear processing timeout (prevents stale timeout from old session firing after reconnect)
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current);
      processingTimeoutRef.current = null;
    }
    
    // Clear tutor switch state and timeout
    if (tutorSwitchTimeoutRef.current) {
      clearTimeout(tutorSwitchTimeoutRef.current);
      tutorSwitchTimeoutRef.current = null;
    }
    setIsSwitchingTutor(false);
  }, [handleProcessing, handleSentenceStart, handleSentenceReady, handleAudioChunk, handleWordTiming, handleWordTimingDelta, handleWordTimingFinal, handleResponseComplete, handleWhiteboardUpdate, handlePronunciationCoaching, handleError, handleVadSpeechStarted, handleVadUtteranceEnd, handleInterimTranscript, handleOpenMicSilenceLoop, handleReconnected, handleSubtitleModeChange, handleCustomOverlay, handleTextInputRequest, subtitles]);
  
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
    diagMarkTurnStart();
    responseCompleteRef.current = false;
    pendingAudioCountRef.current = 0;
    setIsProcessing(true);
    setError(null);
    subtitles.reset();
    
    // Start processing timeout (stuck thinking recovery)
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current);
    }
    processingTimeoutRef.current = setTimeout(() => {
      console.log('[StreamingVoice] Processing timeout (sendAudio) - resetting stuck thinking state + playback');
      setIsProcessing(false);
      setError('Response timeout - please try again');
      setGlobalPlaybackState('idle');
      playerRef.current?.stop?.();
    }, PROCESSING_TIMEOUT_MS);
    
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
  const sendStreamingChunk = useCallback((audioData: ArrayBuffer, sequenceId: number): boolean => {
    return clientRef.current?.sendStreamingChunk(audioData, sequenceId) ?? false;
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
   * Send user activity signal to prevent idle timeout
   * Called when user starts recording (push-to-talk button pressed)
   * This prevents session timeout while user is actively recording
   * Also holds audio playback to prevent AI speaking while user records
   */
  const sendUserActivity = useCallback(() => {
    // Hold audio playback while user is recording
    // This prevents AI from speaking while user is still holding PTT
    playerRef.current?.holdPlayback();
    clientRef.current?.sendUserActivity();
  }, []);
  
  /**
   * Send PTT release signal to finalize speculative transcript
   * Called when user releases the push-to-talk button
   * Also releases audio playback to start playing buffered audio
   */
  const sendPttRelease = useCallback(() => {
    // Release audio playback - any buffered audio will now play
    playerRef.current?.releasePlayback();
    clientRef.current?.sendPttRelease();
  }, []);

  const sendToggleIncognito = useCallback((enabled: boolean) => {
    clientRef.current?.sendToggleIncognito(enabled);
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
    
    // Start processing timeout (stuck thinking recovery for greetings too)
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current);
    }
    processingTimeoutRef.current = setTimeout(() => {
      console.log('[StreamingVoice] Greeting timeout - resetting stuck thinking state + playback');
      setIsProcessing(false);
      setError('Response timeout - please try again');
      setGlobalPlaybackState('idle');
      playerRef.current?.stop?.();
    }, PROCESSING_TIMEOUT_MS);
    
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
  
  /**
   * Send voice override settings (Voice Lab - admin only)
   * These session-level overrides apply to the next TTS call
   */
  const sendVoiceOverride = useCallback((override: {
    speakingRate?: number;
    personality?: string;
    expressiveness?: number;
    emotion?: string;
    geminiLanguageCode?: string;
  } | null) => {
    if (clientRef.current) {
      clientRef.current.sendVoiceOverride(override);
    }
  }, []);
  
  const forceResetProcessing = useCallback(() => {
    console.warn('[StreamingVoice] forceResetProcessing called — clearing all audio and processing state');
    setIsProcessing(false);
    setError(null);
    setGlobalPlaybackState('idle');
    playerRef.current?.stop?.();
    responseCompleteRef.current = false;
    pendingAudioCountRef.current = 0;
    audioReceivedInTurnRef.current = false;
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current);
      processingTimeoutRef.current = null;
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
      isSwitchingTutor,  // Mic lockout during tutor handoff
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
    sendUserActivity,
    sendPttRelease,
    sendToggleIncognito,
    sendDrillResult,
    sendTextInput,
    sendVoiceOverride,
    forceResetProcessing,
  };
}
