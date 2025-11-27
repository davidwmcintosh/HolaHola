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
 * Return type for the hook
 */
export interface UseStreamingVoiceReturn {
  state: StreamingVoiceState;
  subtitles: UseStreamingSubtitlesReturn;
  connect: (conversationId: string) => Promise<void>;
  disconnect: () => void;
  sendAudio: (audioData: ArrayBuffer) => Promise<void>;
  stop: () => void;
  isSupported: () => boolean;
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
  
  // Subtitle management
  const subtitles = useStreamingSubtitles();
  
  /**
   * Initialize the audio player
   */
  useEffect(() => {
    playerRef.current = new StreamingAudioPlayer();
    
    // Set up player callbacks
    playerRef.current.setCallbacks({
      onStateChange: (state) => {
        console.log(`[StreamingVoice] Playback state: ${state}`);
        setPlaybackState(state);
      },
      onProgress: (currentTime, duration) => {
        // Update subtitle highlighting
        subtitles.updatePlaybackTime(currentTime);
      },
      onSentenceStart: (sentenceIndex) => {
        console.log(`[StreamingVoice] Sentence ${sentenceIndex} started`);
        subtitles.startPlayback(sentenceIndex);
      },
      onSentenceEnd: (sentenceIndex) => {
        console.log(`[StreamingVoice] Sentence ${sentenceIndex} ended`);
        subtitles.completeSentence(sentenceIndex);
      },
      onComplete: () => {
        console.log('[StreamingVoice] Playback complete');
        subtitles.stopPlayback();
      },
      onError: (err) => {
        console.error('[StreamingVoice] Playback error:', err);
        setError(err.message);
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
    console.log(`[StreamingVoice] Sentence ${msg.sentenceIndex}: "${msg.text.substring(0, 50)}..."`);
    subtitles.addSentence(msg.sentenceIndex, msg.text);
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
    subtitles.setWordTimings(msg.sentenceIndex, msg.timings);
  }, [subtitles]);
  
  /**
   * Handle response complete message
   */
  const handleResponseComplete = useCallback((msg: StreamingResponseCompleteMessage) => {
    console.log('[StreamingVoice] Response complete');
    setIsProcessing(false);
    setMetrics(msg.metrics || null);
  }, []);
  
  /**
   * Handle errors
   */
  const handleError = useCallback((err: Error) => {
    console.error('[StreamingVoice] Error:', err);
    setError(err.message);
    setIsProcessing(false);
  }, []);
  
  /**
   * Connect to streaming voice service
   */
  const connect = useCallback(async (conversationId: string | number) => {
    console.log(`[StreamingVoice] Connecting for conversation ${conversationId}`);
    
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
      
      // Connect (convert to number if needed)
      const convId = typeof conversationId === 'string' ? parseInt(conversationId, 10) : conversationId;
      await clientRef.current.connect(convId);
      
      console.log('[StreamingVoice] Connected');
      
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
    
    setConnectionState('disconnected');
    setIsProcessing(false);
  }, [handleSentenceStart, handleAudioChunk, handleWordTiming, handleResponseComplete, handleError, subtitles]);
  
  /**
   * Send audio for processing
   */
  const sendAudio = useCallback(async (audioData: ArrayBuffer) => {
    if (!clientRef.current || connectionState !== 'ready') {
      throw new Error('Not connected to streaming voice service');
    }
    
    console.log(`[StreamingVoice] Sending ${audioData.byteLength} bytes of audio`);
    
    setIsProcessing(true);
    setError(null);
    subtitles.reset();
    
    await clientRef.current.sendAudio(audioData);
  }, [connectionState, subtitles]);
  
  /**
   * Stop playback and processing
   */
  const stop = useCallback(() => {
    console.log('[StreamingVoice] Stopping');
    
    playerRef.current?.stop();
    subtitles.stopPlayback();
    setIsProcessing(false);
  }, [subtitles]);
  
  /**
   * Check if streaming is supported
   */
  const isSupported = useCallback(() => {
    return 'WebSocket' in window;
  }, []);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);
  
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
    stop,
    isSupported,
  };
}
