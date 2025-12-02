/**
 * Streaming Voice Client
 * 
 * Manages WebSocket connection for streaming voice mode.
 * Handles: audio recording → server → AI → TTS → progressive playback
 * 
 * Target: < 1 second time to first audio byte
 */

// GLOBAL DEBUG: Track message counts (check via window._wsDebug in browser console)
declare global {
  interface Window {
    _wsDebug: {
      messageCount: number;
      byType: Record<string, number>;
      lastMessage: any;
      lastError: string | null;
      wsState: number | null;
    };
  }
}

if (typeof window !== 'undefined') {
  window._wsDebug = {
    messageCount: 0,
    byType: {},
    lastMessage: null,
    lastError: null,
    wsState: null
  };
}

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
  StreamingErrorMessage,
  ClientStartSessionMessage,
  WordTiming,
  AUDIO_STREAMING_CONFIG,
} from '../../../shared/streaming-voice-types';

/**
 * Connection states
 */
export type StreamingConnectionState = 
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'ready'       // Session established, ready to send audio
  | 'processing'
  | 'streaming'
  | 'error';

/**
 * Callbacks for streaming events
 */
export interface StreamingVoiceCallbacks {
  onConnectionStateChange: (state: StreamingConnectionState) => void;
  onSessionStart: (sessionId: string) => void;
  onProcessing: (transcript: string) => void;
  onSentenceStart: (index: number, text: string, targetLanguageText?: string) => void;
  onAudioReady: (sentenceIndex: number, audio: ArrayBuffer, duration: number) => void;
  onWordTimings: (sentenceIndex: number, timings: WordTiming[]) => void;
  onSentenceEnd: (index: number, duration: number) => void;
  onResponseComplete: (fullText: string, sentenceCount: number) => void;
  onError: (code: string, message: string, recoverable: boolean) => void;
}

/**
 * Session configuration
 */
export interface StreamingSessionConfig {
  conversationId: string;  // UUID string
  targetLanguage: string;
  nativeLanguage: string;
  difficultyLevel: string;
  subtitleMode: 'off' | 'target' | 'all';
  tutorPersonality?: string;
  tutorExpressiveness?: number;
  tutorGender?: 'male' | 'female';
  voiceSpeed?: 'normal' | 'slow';
}

/**
 * Event listener type
 */
type EventListener<T = any> = (data: T) => void;

/**
 * Event types for the streaming client
 */
type StreamingEventType = 
  | 'stateChange'
  | 'sessionStart'
  | 'processing'
  | 'sentenceStart'
  | 'audioChunk'
  | 'wordTiming'
  | 'wordTimingDelta'    // Progressive streaming: incremental word timing
  | 'wordTimingFinal'    // Progressive streaming: final reconciliation
  | 'sentenceEnd'
  | 'responseComplete'
  | 'feedback'
  | 'voiceUpdated'
  | 'error';

/**
 * Streaming Voice Client
 * Manages WebSocket connection for ultra-low-latency voice chat
 */
export class StreamingVoiceClient {
  private ws: WebSocket | null = null;
  private sessionId: string | null = null;
  private callbacks: Partial<StreamingVoiceCallbacks> = {};
  private state: StreamingConnectionState = 'disconnected';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private pendingBinaryData: ArrayBuffer | null = null;
  private currentSentenceIndex = -1;
  private eventListeners: Map<StreamingEventType, Set<EventListener>> = new Map();
  
  // Connection ID to prevent race conditions when reconnecting
  // Events from old WebSockets are ignored if connectionId doesn't match
  private connectionId = 0;
  
  constructor() {
    console.log('[StreamingVoiceClient] Initialized');
  }
  
  /**
   * Add event listener
   */
  on<T = any>(event: StreamingEventType, listener: EventListener<T>): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(listener);
  }
  
  /**
   * Remove event listener
   */
  off<T = any>(event: StreamingEventType, listener: EventListener<T>): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(listener);
    }
  }
  
  /**
   * Emit event to all listeners
   */
  private emit<T = any>(event: StreamingEventType, data: T): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(data);
        } catch (e) {
          console.error(`[StreamingVoiceClient] Error in ${event} listener:`, e);
        }
      });
    }
  }
  
  /**
   * Set event callbacks
   */
  setCallbacks(callbacks: Partial<StreamingVoiceCallbacks>): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }
  
  /**
   * Get current connection state
   */
  getState(): StreamingConnectionState {
    return this.state;
  }
  
  /**
   * Check if connected and ready
   */
  isReady(): boolean {
    // State can be 'connected' (WS open) or 'ready' (session started) or 'processing' (handling audio)
    const validStates: StreamingConnectionState[] = ['connected', 'ready', 'processing'];
    return validStates.includes(this.state) && this.ws?.readyState === WebSocket.OPEN;
  }
  
  /**
   * Connect to streaming voice WebSocket
   */
  async connect(conversationId: string): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('[StreamingVoiceClient] Already connected');
      return;
    }
    
    // Increment connection ID to invalidate any pending events from old connections
    this.connectionId++;
    const currentConnectionId = this.connectionId;
    
    this.setState('connecting');
    
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/voice/stream/ws?conversationId=${conversationId}`;
      
      console.log('[StreamingVoiceClient] Connecting to:', wsUrl, `(connId: ${currentConnectionId})`);
      
      this.ws = new WebSocket(wsUrl);
      this.ws.binaryType = 'arraybuffer';
      
      // Setup event handlers - check connectionId to ignore events from old connections
      this.ws.onopen = () => {
        if (this.connectionId !== currentConnectionId) {
          console.log('[StreamingVoiceClient] Ignoring onopen from stale connection');
          return;
        }
        console.log('[StreamingVoiceClient] ✓ WebSocket connected');
        this.reconnectAttempts = 0;
        this.setState('connected');
      };
      
      this.ws.onmessage = (event) => {
        if (this.connectionId !== currentConnectionId) {
          console.log('[StreamingVoiceClient] Ignoring message from stale connection');
          return;
        }
        this.handleMessage(event);
      };
      
      this.ws.onclose = (event) => {
        if (this.connectionId !== currentConnectionId) {
          console.log('[StreamingVoiceClient] Ignoring onclose from stale connection');
          return;
        }
        console.log(`[StreamingVoiceClient] WebSocket closed: ${event.code} - ${event.reason}`);
        this.handleDisconnect();
      };
      
      this.ws.onerror = (error) => {
        if (this.connectionId !== currentConnectionId) {
          console.log('[StreamingVoiceClient] Ignoring onerror from stale connection');
          return;
        }
        console.error('[StreamingVoiceClient] WebSocket error:', error);
        this.callbacks.onError?.('CONNECTION_FAILED', 'WebSocket connection failed', true);
      };
      
      // Wait for connection
      await this.waitForOpen();
      
    } catch (error: any) {
      console.error('[StreamingVoiceClient] Connection failed:', error);
      this.setState('error');
      throw error;
    }
  }
  
  /**
   * Start a streaming session
   */
  startSession(config: StreamingSessionConfig): void {
    if (!this.isReady()) {
      throw new Error('WebSocket not connected');
    }
    
    const message: ClientStartSessionMessage = {
      type: 'start_session',
      ...config,
    };
    
    console.log('[StreamingVoiceClient] Starting session:', config);
    this.ws!.send(JSON.stringify(message));
  }
  
  /**
   * Send recorded audio for processing
   */
  sendAudio(audioData: ArrayBuffer, format: 'webm' | 'wav' | 'mp3' = 'webm'): void {
    if (!this.isReady()) {
      throw new Error('WebSocket not connected');
    }
    
    console.log(`[StreamingVoiceClient] Sending ${audioData.byteLength} bytes of audio`);
    this.setState('processing');
    
    // Send binary audio data directly
    this.ws!.send(audioData);
  }
  
  /**
   * Request AI-generated personalized greeting
   * Called when starting a new conversation or resuming a previous one
   * @param userName - Optional student name for personalization
   * @param isResumed - True if resuming a previous conversation (triggers context-aware welcome back)
   */
  requestGreeting(userName?: string, isResumed?: boolean): void {
    if (!this.isReady()) {
      throw new Error('WebSocket not ready for greeting');
    }
    
    console.log(`[StreamingVoiceClient] Requesting AI greeting... (resumed: ${isResumed || false})`);
    this.ws!.send(JSON.stringify({ 
      type: 'request_greeting',
      userName,
      isResumed,
    }));
  }
  
  /**
   * Send interrupt signal (user started speaking)
   */
  interrupt(): void {
    if (this.isReady()) {
      this.ws!.send(JSON.stringify({ type: 'interrupt' }));
    }
  }
  
  /**
   * Update the voice mid-session (when user changes tutor)
   */
  updateVoice(tutorGender: 'male' | 'female'): void {
    if (this.isReady()) {
      console.log(`[StreamingVoiceClient] Updating voice to ${tutorGender}`);
      this.ws!.send(JSON.stringify({ 
        type: 'update_voice',
        tutorGender,
      }));
    }
  }
  
  /**
   * Disconnect and cleanup
   */
  disconnect(): void {
    if (this.ws) {
      // Send end session message
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'end_session' }));
      }
      this.ws.close();
      this.ws = null;
    }
    this.sessionId = null;
    this.setState('disconnected');
    console.log('[StreamingVoiceClient] Disconnected');
  }
  
  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(event: MessageEvent): void {
    // GLOBAL DEBUG: Track all messages
    if (typeof window !== 'undefined' && window._wsDebug) {
      window._wsDebug.messageCount++;
      window._wsDebug.wsState = this.ws?.readyState ?? null;
    }
    
    // Binary data = audio chunk
    if (event.data instanceof ArrayBuffer) {
      if (typeof window !== 'undefined' && window._wsDebug) {
        window._wsDebug.byType['binary_audio'] = (window._wsDebug.byType['binary_audio'] || 0) + 1;
      }
      console.log(`[StreamingVoiceClient] Received BINARY audio: ${event.data.byteLength} bytes`);
      this.callbacks.onAudioReady?.(
        this.currentSentenceIndex,
        event.data,
        0 // Duration will be in the preceding metadata message
      );
      return;
    }
    
    // JSON message
    try {
      const message: StreamingMessage = JSON.parse(event.data);
      
      // CRITICAL DEBUG: Log ALL message types to trace flow
      console.log(`[WS MESSAGE] type=${message.type}`);
      
      // GLOBAL DEBUG: Track by message type
      if (typeof window !== 'undefined' && window._wsDebug) {
        window._wsDebug.byType[message.type] = (window._wsDebug.byType[message.type] || 0) + 1;
        window._wsDebug.lastMessage = { type: message.type, time: Date.now() };
      }
      
      // Log important message types
      if (message.type === 'audio_chunk') {
        console.log(`[WS] audio_chunk received: sentence=${(message as any).sentenceIndex}, chunk=${(message as any).chunkIndex}`);
      }
      
      switch (message.type) {
        case 'connected':
          // Initial connection confirmed (no session yet)
          console.log('[StreamingVoiceClient] ✓ Connection confirmed by server');
          break;
          
        case 'session_started':
          this.handleSessionStarted(message);
          break;
          
        case 'processing':
          this.handleProcessing(message as StreamingProcessingMessage);
          break;
          
        case 'sentence_start':
          this.handleSentenceStart(message as StreamingSentenceStartMessage);
          break;
          
        case 'audio_chunk':
          this.handleAudioChunk(message as StreamingAudioChunkMessage);
          break;
          
        case 'word_timing':
          this.handleWordTiming(message as StreamingWordTimingMessage);
          break;
          
        case 'word_timing_delta':
          this.handleWordTimingDelta(message as StreamingWordTimingDeltaMessage);
          break;
          
        case 'word_timing_final':
          this.handleWordTimingFinal(message as StreamingWordTimingFinalMessage);
          break;
          
        case 'sentence_end':
          this.handleSentenceEnd(message as StreamingSentenceEndMessage);
          break;
          
        case 'response_complete':
          this.handleResponseComplete(message as StreamingResponseCompleteMessage);
          break;
          
        case 'error':
          this.handleError(message as StreamingErrorMessage);
          break;
          
        case 'feedback':
          // Pedagogical feedback (one-word rule, pronunciation tips, etc.)
          // Non-blocking - just log for now, could display UI notifications
          const feedbackMsg = message as { type: string; feedbackType: string; message: string };
          console.log(`[StreamingVoiceClient] Feedback (${feedbackMsg.feedbackType}):`, feedbackMsg.message);
          this.emit('feedback', feedbackMsg);
          break;
          
        case 'voice_updated':
          // Voice switch confirmation - the server has changed the tutor voice
          const voiceMsg = message as { type: string; gender: string; voiceName: string; timestamp: number };
          console.log(`[StreamingVoiceClient] Voice updated to ${voiceMsg.gender}: ${voiceMsg.voiceName}`);
          this.emit('voiceUpdated', voiceMsg);
          break;
          
        default:
          console.warn('[StreamingVoiceClient] Unknown message type:', (message as any).type);
      }
    } catch (error) {
      console.error('[StreamingVoiceClient] Failed to parse message:', error);
    }
  }
  
  private handleSessionStarted(message: { type: string; sessionId: string; timestamp: number }): void {
    this.sessionId = message.sessionId;
    console.log('[StreamingVoiceClient] Session started:', this.sessionId);
    // Transition to 'ready' state - now client can send audio
    this.setState('ready');
    this.callbacks.onSessionStart?.(message.sessionId);
    this.emit('sessionStart', message.sessionId);
  }
  
  private handleProcessing(message: StreamingProcessingMessage): void {
    console.log(`[StreamingVoiceClient] Processing (turn ${message.turnId}):`, message.userTranscript);
    this.setState('processing');
    this.callbacks.onProcessing?.(message.userTranscript);
    // Emit full message so clients can access turnId for subtitle packet ordering
    this.emit('processing', message);
  }
  
  private handleSentenceStart(message: StreamingSentenceStartMessage): void {
    console.log(`[StreamingVoiceClient] Sentence ${message.sentenceIndex}: "${message.text.substring(0, 50)}..."`);
    this.currentSentenceIndex = message.sentenceIndex;
    this.setState('streaming');
    this.callbacks.onSentenceStart?.(message.sentenceIndex, message.text, message.targetLanguageText);
    this.emit('sentenceStart', message);
  }
  
  private handleAudioChunk(message: StreamingAudioChunkMessage): void {
    // Store metadata for the upcoming binary frame
    this.currentSentenceIndex = message.sentenceIndex;
    
    // DEBUG: Log audio chunk receipt with details
    const audioSize = message.audio?.length || 0;
    console.log(`[StreamingVoiceClient] Audio chunk received: turn=${message.turnId}, sentence=${message.sentenceIndex}, chunk=${message.chunkIndex}, size=${audioSize} chars (base64), isLast=${message.isLast}`);
    
    // Emit audio chunk with embedded base64 data
    this.emit('audioChunk', message);
  }
  
  private handleWordTiming(message: StreamingWordTimingMessage): void {
    this.callbacks.onWordTimings?.(message.sentenceIndex, message.words);
    this.emit('wordTiming', message);
  }
  
  /**
   * PROGRESSIVE STREAMING: Handle incremental word timing update
   * These arrive as words are timestamped during progressive TTS
   */
  private handleWordTimingDelta(message: StreamingWordTimingDeltaMessage): void {
    // CRITICAL DEBUG: Use console.error to ensure visibility in logs
    console.error(`[WORD DELTA] sentence=${message.sentenceIndex}, word=${message.wordIndex} "${message.word}" ${message.startTime.toFixed(3)}-${message.endTime.toFixed(3)}s, listeners=${this.eventListeners.get('wordTimingDelta')?.size || 0}`);
    this.emit('wordTimingDelta', message);
  }
  
  /**
   * PROGRESSIVE STREAMING: Handle final word timing reconciliation
   * Sent when sentence synthesis completes with authoritative timings
   */
  private handleWordTimingFinal(message: StreamingWordTimingFinalMessage): void {
    console.log(`[StreamingVoiceClient] Word timing final: sentence=${message.sentenceIndex}, ${message.words.length} words, ${message.actualDurationMs}ms`);
    this.emit('wordTimingFinal', message);
  }
  
  private handleSentenceEnd(message: StreamingSentenceEndMessage): void {
    console.log(`[StreamingVoiceClient] Sentence ${message.sentenceIndex} complete (${message.totalDurationMs}ms)`);
    this.callbacks.onSentenceEnd?.(message.sentenceIndex, message.totalDurationMs);
    this.emit('sentenceEnd', message);
  }
  
  private handleResponseComplete(message: StreamingResponseCompleteMessage): void {
    console.log(`[StreamingVoiceClient] Response complete: ${message.totalSentences} sentences in ${message.totalDurationMs}ms`);
    // Transition back to 'ready' so client can send more audio
    this.setState('ready');
    this.callbacks.onResponseComplete?.(message.fullText, message.totalSentences);
    this.emit('responseComplete', message);
  }
  
  private handleError(message: StreamingErrorMessage): void {
    console.error(`[StreamingVoiceClient] Error: ${message.code} - ${message.message}`);
    this.callbacks.onError?.(message.code, message.message, message.recoverable);
    this.emit('error', new Error(message.message));
    if (!message.recoverable) {
      this.setState('error');
    }
  }
  
  private setState(state: StreamingConnectionState): void {
    if (this.state !== state) {
      console.log(`[StreamingVoiceClient] State: ${this.state} → ${state}`);
      this.state = state;
      this.callbacks.onConnectionStateChange?.(state);
      this.emit('stateChange', state);
    }
  }
  
  private handleDisconnect(): void {
    this.ws = null;
    this.sessionId = null;
    
    // Attempt reconnection if not intentional
    if (this.reconnectAttempts < this.maxReconnectAttempts && this.state !== 'disconnected') {
      this.reconnectAttempts++;
      console.log(`[StreamingVoiceClient] Reconnecting (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      // Would need conversationId to reconnect - caller should handle this
    }
    
    this.setState('disconnected');
  }
  
  private waitForOpen(): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = this.ws;
      if (!ws) {
        reject(new Error('WebSocket not initialized'));
        return;
      }
      
      if (ws.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }
      
      const timeout = setTimeout(() => {
        reject(new Error('WebSocket connection timeout'));
      }, 10000);
      
      const originalOnOpen = ws.onopen;
      ws.onopen = (event) => {
        clearTimeout(timeout);
        if (originalOnOpen) {
          originalOnOpen.call(ws, event);
        }
        resolve();
      };
      
      const originalOnError = ws.onerror;
      ws.onerror = (event) => {
        clearTimeout(timeout);
        if (originalOnError) {
          originalOnError.call(ws, event);
        }
        reject(new Error('WebSocket connection failed'));
      };
    });
  }
}

/**
 * Singleton instance - DEPRECATED: Now creates fresh instance per session
 * to avoid event listener leaks and stale state issues
 */
let clientInstance: StreamingVoiceClient | null = null;

export function getStreamingVoiceClient(): StreamingVoiceClient {
  // CRITICAL FIX: Always create a fresh client instance per session
  // The singleton pattern was causing event listener leaks where:
  // 1. disconnect() removed listeners from the singleton
  // 2. Reconnecting reused the same instance with cleared listeners
  // 3. New listeners weren't properly registered due to stale state
  // 
  // Creating a fresh instance ensures clean event listener state
  if (clientInstance) {
    // Clean up old instance completely
    clientInstance.disconnect();
  }
  clientInstance = new StreamingVoiceClient();
  return clientInstance;
}
