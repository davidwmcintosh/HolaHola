/**
 * Streaming Voice Client
 * 
 * Manages WebSocket connection for streaming voice mode.
 * Handles: audio recording → server → AI → TTS → progressive playback
 * 
 * Target: < 1 second time to first audio byte
 */

import {
  StreamingMessage,
  StreamingConnectedMessage,
  StreamingProcessingMessage,
  StreamingSentenceStartMessage,
  StreamingAudioChunkMessage,
  StreamingWordTimingMessage,
  StreamingSentenceEndMessage,
  StreamingResponseCompleteMessage,
  StreamingInterimTranscriptMessage,
  StreamingErrorMessage,
  ClientStartSessionMessage,
  ClientAudioChunkMessage,
  ClientAudioEndMessage,
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
  onInterimTranscript: (transcript: string, confidence: number, isFinal: boolean) => void;
  onProcessing: (transcript: string) => void;
  onSentenceStart: (index: number, text: string) => void;
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
  | 'interimTranscript'
  | 'processing'
  | 'sentenceStart'
  | 'audioChunk'
  | 'wordTiming'
  | 'sentenceEnd'
  | 'responseComplete'
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
  private isStreamingAudio = false;
  private audioChunkCount = 0;
  
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
   * Check if connected and ready to send audio
   */
  isReady(): boolean {
    // State is 'connected' after WebSocket opens, 'ready' after session is established
    return (this.state === 'connected' || this.state === 'ready') && this.ws?.readyState === WebSocket.OPEN;
  }
  
  /**
   * Connect to streaming voice WebSocket
   */
  async connect(conversationId: string): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('[StreamingVoiceClient] Already connected');
      return;
    }
    
    this.setState('connecting');
    
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/streaming/ws?conversationId=${conversationId}`;
      
      console.log('[StreamingVoiceClient] Connecting to:', wsUrl);
      
      this.ws = new WebSocket(wsUrl);
      this.ws.binaryType = 'arraybuffer';
      
      // Setup event handlers
      this.ws.onopen = () => {
        console.log('[StreamingVoiceClient] ✓ WebSocket connected');
        this.reconnectAttempts = 0;
        this.setState('connected');
      };
      
      this.ws.onmessage = (event) => {
        this.handleMessage(event);
      };
      
      this.ws.onclose = (event) => {
        console.log(`[StreamingVoiceClient] WebSocket closed: ${event.code} - ${event.reason}`);
        this.handleDisconnect();
      };
      
      this.ws.onerror = (error) => {
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
   * Send recorded audio for processing (legacy batch mode)
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
   * Start streaming audio recording
   * Call this when the user starts speaking to initialize real-time STT
   */
  startStreamingAudio(): void {
    if (!this.isReady()) {
      throw new Error('WebSocket not connected');
    }
    
    if (this.isStreamingAudio) {
      console.warn('[StreamingVoiceClient] Already streaming audio');
      return;
    }
    
    console.log('[StreamingVoiceClient] Starting streaming audio');
    this.isStreamingAudio = true;
    this.audioChunkCount = 0;
    
    this.ws!.send(JSON.stringify({ type: 'start_recording' }));
  }
  
  /**
   * Send audio chunk during recording
   * PCM16 audio data encoded as base64
   */
  sendAudioChunk(audioData: ArrayBuffer): void {
    if (!this.isReady() || !this.isStreamingAudio) {
      return;
    }
    
    this.audioChunkCount++;
    
    const base64Audio = this.arrayBufferToBase64(audioData);
    
    const message: ClientAudioChunkMessage = {
      type: 'audio_chunk',
      audio: base64Audio,
      chunkIndex: this.audioChunkCount,
      format: 'pcm16',
    };
    
    this.ws!.send(JSON.stringify(message));
  }
  
  /**
   * End streaming audio recording
   * Call this when the user stops speaking
   */
  endStreamingAudio(): void {
    if (!this.isReady()) {
      return;
    }
    
    if (!this.isStreamingAudio) {
      console.warn('[StreamingVoiceClient] Not streaming audio');
      return;
    }
    
    console.log(`[StreamingVoiceClient] Ending streaming audio (${this.audioChunkCount} chunks)`);
    this.setState('processing');
    
    const message: ClientAudioEndMessage = {
      type: 'audio_end',
      totalChunks: this.audioChunkCount,
    };
    
    this.ws!.send(JSON.stringify(message));
    this.isStreamingAudio = false;
  }
  
  /**
   * Check if currently streaming audio
   */
  isStreamingRecording(): boolean {
    return this.isStreamingAudio;
  }
  
  /**
   * Convert ArrayBuffer to base64 string
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
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
    // Binary data = audio chunk
    if (event.data instanceof ArrayBuffer) {
      console.log(`[StreamingVoiceClient] Received audio: ${event.data.byteLength} bytes`);
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
      
      switch (message.type) {
        case 'connected':
          this.handleConnected(message as StreamingConnectedMessage);
          break;
          
        case 'interim_transcript':
          this.handleInterimTranscript(message as StreamingInterimTranscriptMessage);
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
          
        case 'sentence_end':
          this.handleSentenceEnd(message as StreamingSentenceEndMessage);
          break;
          
        case 'response_complete':
          this.handleResponseComplete(message as StreamingResponseCompleteMessage);
          break;
          
        case 'error':
          this.handleError(message as StreamingErrorMessage);
          break;
          
        default:
          console.warn('[StreamingVoiceClient] Unknown message type:', (message as any).type);
      }
    } catch (error) {
      console.error('[StreamingVoiceClient] Failed to parse message:', error);
    }
  }
  
  private handleConnected(message: StreamingConnectedMessage): void {
    this.sessionId = message.sessionId;
    console.log('[StreamingVoiceClient] Session started:', this.sessionId);
    // Transition to 'ready' state - now client can send audio
    this.setState('ready');
    this.callbacks.onSessionStart?.(message.sessionId);
    this.emit('sessionStart', message.sessionId);
  }
  
  private handleInterimTranscript(message: StreamingInterimTranscriptMessage): void {
    const prefix = message.isFinal ? '[Final]' : '[Interim]';
    console.log(`${prefix} ${message.transcript} (${Math.round(message.confidence * 100)}%)`);
    this.callbacks.onInterimTranscript?.(message.transcript, message.confidence, message.isFinal);
    this.emit('interimTranscript', message);
  }
  
  private handleProcessing(message: StreamingProcessingMessage): void {
    console.log('[StreamingVoiceClient] Processing:', message.userTranscript);
    this.setState('processing');
    this.callbacks.onProcessing?.(message.userTranscript);
    this.emit('processing', message.userTranscript);
  }
  
  private handleSentenceStart(message: StreamingSentenceStartMessage): void {
    console.log(`[StreamingVoiceClient] Sentence ${message.sentenceIndex}: "${message.text.substring(0, 50)}..."`);
    this.currentSentenceIndex = message.sentenceIndex;
    this.setState('streaming');
    this.callbacks.onSentenceStart?.(message.sentenceIndex, message.text);
    this.emit('sentenceStart', message);
  }
  
  private handleAudioChunk(message: StreamingAudioChunkMessage): void {
    // Store metadata for the upcoming binary frame
    this.currentSentenceIndex = message.sentenceIndex;
    // Emit audio chunk with embedded base64 data
    this.emit('audioChunk', message);
  }
  
  private handleWordTiming(message: StreamingWordTimingMessage): void {
    this.callbacks.onWordTimings?.(message.sentenceIndex, message.words);
    this.emit('wordTiming', message);
  }
  
  private handleSentenceEnd(message: StreamingSentenceEndMessage): void {
    console.log(`[StreamingVoiceClient] Sentence ${message.sentenceIndex} complete (${message.totalDurationMs}ms)`);
    this.callbacks.onSentenceEnd?.(message.sentenceIndex, message.totalDurationMs);
    this.emit('sentenceEnd', message);
  }
  
  private handleResponseComplete(message: StreamingResponseCompleteMessage): void {
    console.log(`[StreamingVoiceClient] Response complete: ${message.totalSentences} sentences in ${message.totalDurationMs}ms`);
    this.setState('connected');
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
 * Singleton instance
 */
let clientInstance: StreamingVoiceClient | null = null;

export function getStreamingVoiceClient(): StreamingVoiceClient {
  if (!clientInstance) {
    clientInstance = new StreamingVoiceClient();
  }
  return clientInstance;
}
