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
import { StreamingAudioPlayer, StreamingAudioChunk, StreamingPlaybackState } from '../lib/audioUtils';
import { useStreamingSubtitles, UseStreamingSubtitlesReturn } from './useStreamingSubtitles';
import type { 
  StreamingClientState,
  StreamingMetrics,
  StreamingSentenceStartMessage,
  StreamingAudioChunkMessage,
  StreamingWordTimingMessage,
  StreamingResponseCompleteMessage,
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
  onResponseComplete?: (conversationId: string) => void;
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
  stop: () => void;
  isSupported: () => boolean;
  isReady: () => boolean;
  getCombinedAudioBlob: () => Blob | null;
  clearStoredAudio: () => void;
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
  
  // Helper to check if we can clear isProcessing
  // Note: Does NOT reset responseCompleteRef - that's done when new request starts
  const checkAndClearProcessing = useCallback(() => {
    const isComplete = responseCompleteRef.current;
    const noPendingAudio = pendingAudioCountRef.current === 0;
    
    if (isComplete && noPendingAudio) {
      console.log('[StreamingVoice] Response complete AND no pending audio - clearing isProcessing');
      setIsProcessingRef.current(false);
      // Don't reset responseCompleteRef here - let sendAudio do it
    } else {
      console.log(`[StreamingVoice] Not clearing: complete=${isComplete}, pending=${pendingAudioCountRef.current}`);
    }
  }, []);
  
  // Subtitle management
  const subtitles = useStreamingSubtitles();
  
  // Keep a ref to subtitles to avoid stale closure issues in audio player callbacks
  // The audio player callbacks are set once on mount but need access to latest subtitles methods
  const subtitlesRef = useRef(subtitles);
  subtitlesRef.current = subtitles;
  
  /**
   * Initialize the audio player
   */
  useEffect(() => {
    playerRef.current = new StreamingAudioPlayer();
    
    // Set up player callbacks
    // NOTE: isProcessing is only cleared when BOTH:
    // 1. Server has sent response_complete (responseCompleteRef = true)
    // 2. No pending audio chunks (pendingAudioCountRef = 0)
    // IMPORTANT: Use subtitlesRef.current to get latest subtitles (avoids stale closure)
    playerRef.current.setCallbacks({
      onStateChange: (state) => {
        console.log(`[StreamingVoice] Playback state: ${state}`);
        setPlaybackState(state);
      },
      onProgress: (currentTime, duration) => {
        // Update subtitle highlighting with actual duration for rescaling
        // Use ref to get latest subtitles (avoids stale closure from mount-time capture)
        subtitlesRef.current.updatePlaybackTime(currentTime, duration);
      },
      onSentenceStart: (sentenceIndex) => {
        console.log(`[StreamingVoice] Sentence ${sentenceIndex} started`);
        subtitlesRef.current.startPlayback(sentenceIndex);
      },
      onSentenceEnd: (sentenceIndex) => {
        console.log(`[StreamingVoice] Sentence ${sentenceIndex} ended`);
        subtitlesRef.current.completeSentence(sentenceIndex);
      },
      onComplete: () => {
        console.log('[StreamingVoice] Playback queue empty');
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
        console.log(`[StreamingVoice] Pending audio: ${count}`);
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
   * Handle sentence start message
   */
  const handleSentenceStart = useCallback((msg: StreamingSentenceStartMessage) => {
    console.log(`[StreamingVoice] Sentence ${msg.sentenceIndex}: "${msg.text.substring(0, 50)}..." (target: ${msg.targetLanguageText?.substring(0, 30) || 'none'}, mapping: ${msg.wordMapping?.length || 0} entries)`);
    subtitles.addSentence(msg.sentenceIndex, msg.text, msg.targetLanguageText, msg.wordMapping);
  }, [subtitles]);
  
  /**
   * Handle audio chunk message
   */
  const handleAudioChunk = useCallback((msg: StreamingAudioChunkMessage) => {
    if (!playerRef.current) return;
    
    // Decode base64 to ArrayBuffer
    const binaryString = atob(msg.audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    const chunk: StreamingAudioChunk = {
      sentenceIndex: msg.sentenceIndex,
      audio: bytes.buffer,
      durationMs: msg.durationMs,
      isLast: msg.isLast,
    };
    
    playerRef.current.enqueue(chunk);
  }, []);
  
  /**
   * Handle word timing message
   */
  const handleWordTiming = useCallback((msg: StreamingWordTimingMessage) => {
    subtitles.setWordTimings(msg.sentenceIndex, msg.timings, msg.expectedDurationMs);
  }, [subtitles]);
  
  /**
   * Handle response complete message
   * The server has finished streaming all audio chunks.
   * Check if we can clear isProcessing (no pending audio remaining).
   */
  const handleResponseComplete = useCallback((msg: StreamingResponseCompleteMessage) => {
    console.log('[StreamingVoice] Server signaled response complete');
    setMetrics(msg.metrics || null);
    
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
   * Connect to streaming voice service and start a session
   */
  const connect = useCallback(async (config: StreamingSessionConfig) => {
    console.log(`[StreamingVoice] Connecting for conversation ${config.conversationId}`);
    
    // Store config for callbacks (e.g., onResponseComplete)
    sessionConfigRef.current = config;
    
    try {
      // Get or create client
      clientRef.current = getStreamingVoiceClient();
      
      // Set up callbacks
      clientRef.current.on('stateChange', setConnectionState);
      clientRef.current.on('sentenceStart', handleSentenceStart);
      clientRef.current.on('audioChunk', handleAudioChunk);
      clientRef.current.on('wordTiming', handleWordTiming);
      clientRef.current.on('responseComplete', handleResponseComplete);
      clientRef.current.on('error', handleError);
      
      // Connect WebSocket
      await clientRef.current.connect(config.conversationId);
      console.log('[StreamingVoice] WebSocket connected, starting session...');
      
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
      });
      
      console.log('[StreamingVoice] Session started, waiting for ready state...');
      
    } catch (err: any) {
      console.error('[StreamingVoice] Connection failed:', err);
      setError(err.message);
      throw err;
    }
  }, [handleSentenceStart, handleAudioChunk, handleWordTiming, handleResponseComplete, handleError]);
  
  /**
   * Disconnect from streaming voice service
   */
  const disconnect = useCallback(() => {
    console.log('[StreamingVoice] Disconnecting');
    
    if (clientRef.current) {
      clientRef.current.off('stateChange', setConnectionState);
      clientRef.current.off('sentenceStart', handleSentenceStart);
      clientRef.current.off('audioChunk', handleAudioChunk);
      clientRef.current.off('wordTiming', handleWordTiming);
      clientRef.current.off('responseComplete', handleResponseComplete);
      clientRef.current.off('error', handleError);
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
  }, [handleSentenceStart, handleAudioChunk, handleWordTiming, handleResponseComplete, handleError, subtitles]);
  
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
    
    console.log(`[StreamingVoice] Sending ${audioData.byteLength} bytes of audio`);
    
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
    
    console.log(`[StreamingVoice] Requesting AI greeting... (resumed: ${isResumed || false})`);
    
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
   * Stop playback and processing
   */
  const stop = useCallback(() => {
    console.log('[StreamingVoice] Stopping');
    
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
    stop,
    isSupported,
    isReady,
    getCombinedAudioBlob,
    clearStoredAudio,
  };
}
