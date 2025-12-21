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
    __streamingVoiceClient: StreamingVoiceClient | null;
    __svcInstanceId: number;
  }
}

// Initialize debug tracking (access via window._wsDebug in browser console)
if (typeof window !== 'undefined') {
  window._wsDebug = {
    messageCount: 0,
    byType: {},
    lastMessage: null,
    lastError: null,
    wsState: null
  };
}

import { io, Socket } from 'socket.io-client';
import {
  StreamingMessage,
  StreamingConnectedMessage,
  StreamingProcessingMessage,
  StreamingSentenceStartMessage,
  StreamingSentenceReadyMessage,
  StreamingAudioChunkMessage,
  StreamingWordTimingMessage,
  StreamingWordTimingDeltaMessage,
  StreamingWordTimingFinalMessage,
  StreamingSentenceEndMessage,
  StreamingResponseCompleteMessage,
  StreamingWhiteboardMessage,
  StreamingErrorMessage,
  ClientStartSessionMessage,
  WordTiming,
  AUDIO_STREAMING_CONFIG,
} from '../../../shared/streaming-voice-types';
import { isVerboseLoggingEnabled } from './audioUtils';

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
  | 'reconnecting' // Auto-reconnecting after unexpected disconnect
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
  rawHonestyMode?: boolean;  // Minimal prompting for authentic conversation with Daniela
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
  | 'sentenceReady'      // NEW: Atomic first audio + first timing (prevents timing race)
  | 'audioChunk'
  | 'wordTiming'
  | 'wordTimingDelta'    // Progressive streaming: incremental word timing
  | 'wordTimingFinal'    // Progressive streaming: final reconciliation
  | 'sentenceEnd'
  | 'vadSpeechStarted'   // Open mic: VAD detected speech start
  | 'vadUtteranceEnd'    // Open mic: VAD detected utterance end
  | 'interimTranscript'  // Open mic: Real-time interim transcript
  | 'openMicSessionClosed' // Open mic: Server session closed (e.g., Deepgram timeout)
  | 'inputModeChanged'   // Input mode switched
  | 'responseComplete'
  | 'feedback'
  | 'voiceUpdated'
  | 'whiteboardUpdate'   // Visual teaching aids from tutor
  | 'tutorHandoff'       // Voice-initiated tutor switch
  | 'error';

/**
 * Streaming Voice Client
 * Manages WebSocket connection for ultra-low-latency voice chat
 */
export class StreamingVoiceClient {
  private socket: Socket | null = null;
  private sessionId: string | null = null;
  private callbacks: Partial<StreamingVoiceCallbacks> = {};
  private state: StreamingConnectionState = 'disconnected';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private pendingBinaryData: ArrayBuffer | null = null;
  private currentSentenceIndex = -1;
  private eventListeners: Map<StreamingEventType, Set<EventListener>> = new Map();
  
  // Connection ID to prevent race conditions when reconnecting
  // Events from old sockets are ignored if connectionId doesn't match
  private connectionId = 0;
  
  // Auto-reconnect state
  private lastConversationId: string | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalDisconnect = false;  // Track if disconnect was user-initiated
  
  constructor() {
    // Initialization complete
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
          if (isVerboseLoggingEnabled()) {
            console.error(`[StreamingVoiceClient] Error in ${event} listener:`, e);
          }
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
    // State can be 'connected' (socket open) or 'ready' (session started) or 'processing' (handling audio)
    const validStates: StreamingConnectionState[] = ['connected', 'ready', 'processing'];
    return validStates.includes(this.state) && (this.socket?.connected ?? false);
  }
  
  /**
   * Connect to streaming voice via Socket.io
   * Socket.io handles transport negotiation (WebSocket → polling fallback)
   * This works reliably through Replit's proxy
   */
  async connect(conversationId: string): Promise<void> {
    if (this.socket?.connected) {
      return;
    }
    
    // Store conversationId for potential reconnection
    this.lastConversationId = conversationId;
    this.intentionalDisconnect = false;
    
    // Clear any pending reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    // Increment connection ID to invalidate any pending events from old connections
    this.connectionId++;
    const currentConnectionId = this.connectionId;
    
    this.setState('connecting');
    
    try {
      console.log('[StreamingVoice] Creating Socket.io connection to /voice namespace...');
      
      // Connect to the /voice namespace with conversationId in query
      // Use polling first - works more reliably through Replit's proxy
      this.socket = io('/voice', {
        query: { conversationId },
        transports: ['polling', 'websocket'],  // Polling first, then upgrade to WebSocket
        upgrade: true,  // Allow upgrade to websocket after polling connects
        reconnection: false,  // We handle reconnection manually
      });
      
      // Create a promise that resolves when connection is ready
      const connectionPromise = new Promise<void>((resolve, reject) => {
        const socket = this.socket!;
        let resolved = false;
        let connectionTimeout: ReturnType<typeof setTimeout> | null = null;
        
        const completeConnection = (source: string) => {
          if (resolved) return;
          resolved = true;
          console.log('[StreamingVoice] Connection complete via:', source);
          if (connectionTimeout) {
            clearTimeout(connectionTimeout);
            connectionTimeout = null;
          }
          if (this.connectionId !== currentConnectionId) {
            console.log('[StreamingVoice] Connection ID mismatch, ignoring');
            return;
          }
          this.reconnectAttempts = 0;
          this.intentionalDisconnect = false;
          this.setState('connected');
          resolve();
        };
        
        // Socket.io event handlers
        socket.on('connect', () => {
          console.log('[StreamingVoice] Socket.io connect event fired!');
          completeConnection('connect');
        });
        
        socket.on('connect_error', (err) => {
          console.log('[StreamingVoice] Socket.io connect_error:', err.message);
          if (!resolved) {
            if (connectionTimeout) {
              clearTimeout(connectionTimeout);
              connectionTimeout = null;
            }
            reject(new Error('Socket.io connection failed: ' + err.message));
          }
        });
        
        // Handle JSON messages from server
        socket.on('message', (data: any) => {
          // First message = connection confirmed (even if connect didn't fire)
          if (!resolved) {
            console.log('[StreamingVoice] First message received (connection confirmed)');
            completeConnection('first-message');
          }
          // Process the message
          if (this.connectionId === currentConnectionId) {
            this.handleSocketMessage(data);
          }
        });
        
        // Handle binary data from server
        socket.on('binary', (data: ArrayBuffer) => {
          if (this.connectionId === currentConnectionId) {
            this.handleBinaryData(data);
          }
        });
        
        socket.on('disconnect', (reason) => {
          console.log('[StreamingVoice] Socket.io disconnect:', reason);
          if (!resolved) {
            if (connectionTimeout) {
              clearTimeout(connectionTimeout);
              connectionTimeout = null;
            }
            reject(new Error('Socket.io disconnected before connection complete'));
          }
          if (this.connectionId === currentConnectionId) {
            this.handleDisconnect();
          }
        });
        
        // Check if already connected (shouldn't happen, but just in case)
        if (socket.connected) {
          console.log('[StreamingVoice] Socket.io already connected!');
          completeConnection('already-connected');
          return;
        }
        
        connectionTimeout = setTimeout(() => {
          if (resolved) return;
          console.log('[StreamingVoice] Socket.io connection timeout');
          reject(new Error('Socket.io connection timeout'));
        }, 30000);  // 30 seconds for Replit proxy negotiation
      });
      
      await connectionPromise;
      
    } catch (error: any) {
      if (isVerboseLoggingEnabled()) {
        console.error('[StreamingVoiceClient] Connection failed:', error);
      }
      this.setState('error');
      throw error;
    }
  }
  
  /**
   * Start a streaming session
   */
  startSession(config: StreamingSessionConfig): void {
    if (!this.isReady()) {
      throw new Error('Socket.io not connected');
    }
    
    const message: ClientStartSessionMessage = {
      type: 'start_session',
      ...config,
    };
    
    this.socket!.emit('message', message);
  }
  
  /**
   * Send recorded audio for processing
   */
  sendAudio(audioData: ArrayBuffer, format: 'webm' | 'wav' | 'mp3' = 'webm'): void {
    if (!this.isReady()) {
      throw new Error('Socket.io not connected');
    }
    this.setState('processing');
    
    // Send binary audio data via 'binary' event
    this.socket!.emit('binary', audioData);
  }
  
  /**
   * Send streaming audio chunk for open mic mode
   * Returns true if chunk was sent, false if socket not ready
   * @param audioData - Audio chunk to stream
   * @param sequenceId - Sequence number for ordering
   */
  sendStreamingChunk(audioData: ArrayBuffer, sequenceId: number): boolean {
    if (!this.isReady()) {
      return false;
    }
    
    try {
      // Convert to base64 for JSON transport
      const base64Audio = this.arrayBufferToBase64(audioData);
      this.socket!.emit('message', {
        type: 'stream_audio_chunk',
        audio: base64Audio,
        format: 'pcm16',  // Linear16 PCM at 16kHz from AudioContext
        sequenceId,
      });
      return true;
    } catch (err) {
      return false;
    }
  }
  
  /**
   * Stop streaming audio (open mic mode)
   */
  stopStreaming(): void {
    if (this.socket?.connected) {
      this.socket.emit('message', { type: 'stop_streaming' });
    }
  }
  
  /**
   * Set input mode (push-to-talk or open-mic)
   */
  setInputMode(mode: 'push-to-talk' | 'open-mic'): void {
    if (this.socket?.connected) {
      this.socket.emit('message', { type: 'set_input_mode', inputMode: mode });
    }
  }
  
  /**
   * Send interrupt signal (user started speaking - stop TTS)
   */
  sendInterrupt(): void {
    if (this.socket?.connected) {
      this.socket.emit('message', { type: 'interrupt' });
    }
  }
  
  /**
   * Send user activity signal to prevent idle timeout
   * Called when user is actively engaged (e.g., recording audio)
   * This prevents the session from timing out while the user is holding
   * the push-to-talk button but hasn't released it yet
   */
  sendUserActivity(): void {
    if (this.socket?.connected) {
      this.socket.emit('message', { type: 'user_activity' });
    }
  }
  
  /**
   * Send PTT release signal to finalize speculative transcript
   * Called when user releases the push-to-talk button
   * Server will close the speculative Deepgram session and return final transcript
   */
  sendPttRelease(): void {
    if (this.socket?.connected) {
      this.socket.emit('message', { type: 'ptt_release' });
    }
  }
  
  /**
   * Convert ArrayBuffer to base64 string
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
  
  /**
   * Request AI-generated personalized greeting
   * Called when starting a new conversation or resuming a previous one
   * @param userName - Optional student name for personalization
   * @param isResumed - True if resuming a previous conversation (triggers context-aware welcome back)
   */
  requestGreeting(userName?: string, isResumed?: boolean): void {
    if (!this.isReady()) {
      throw new Error('Socket.io not ready for greeting');
    }
    
    this.socket!.emit('message', { 
      type: 'request_greeting',
      userName,
      isResumed,
    });
  }
  
  /**
   * Send interrupt signal (user started speaking)
   */
  interrupt(): void {
    if (this.isReady()) {
      this.socket!.emit('message', { type: 'interrupt' });
    }
  }
  
  /**
   * Send drill result for pedagogical tracking
   * @param drillId - Unique identifier for the drill
   * @param drillType - Type of drill (repeat, translate, match, fill_blank, sentence_order)
   * @param isCorrect - Whether the student answered correctly
   * @param responseTimeMs - Time taken to respond in milliseconds
   * @param toolContent - Optional content that was displayed for the drill
   */
  sendDrillResult(drillId: string, drillType: string, isCorrect: boolean, responseTimeMs: number, toolContent?: string): void {
    if (this.socket?.connected) {
      this.socket.emit('message', {
        type: 'drill_result',
        drillId,
        drillType,
        isCorrect,
        responseTimeMs,
        toolContent,
      });
    }
  }
  
  /**
   * Send a text input response (from TEXT_INPUT whiteboard tool)
   * This sends the student's written response as input to the voice conversation
   * @param itemId - The whiteboard item ID
   * @param response - The student's typed response
   */
  sendTextInput(itemId: string, response: string): void {
    if (this.socket?.connected) {
      this.socket.emit('message', {
        type: 'text_input',
        itemId,
        response,
      });
    }
  }
  
  /**
   * Update the voice mid-session (when user changes tutor)
   */
  updateVoice(tutorGender: 'male' | 'female'): void {
    if (this.isReady()) {
      this.socket!.emit('message', { 
        type: 'update_voice',
        tutorGender,
      });
    }
  }
  
  /**
   * Request a voice handoff - current tutor says goodbye, then new tutor introduces themselves
   * This provides a natural transition between tutors
   */
  requestVoiceHandoff(newTutorGender: 'male' | 'female', currentTutorName: string, newTutorName: string): void {
    if (this.isReady()) {
      this.socket!.emit('message', { 
        type: 'request_voice_handoff',
        newTutorGender,
        currentTutorName,
        newTutorName,
      });
    }
  }
  
  /**
   * Disconnect and cleanup (user-initiated)
   */
  disconnect(): void {
    // Mark as intentional to prevent auto-reconnect
    this.intentionalDisconnect = true;
    this.reconnectAttempts = 0;
    
    // Clear any pending reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.socket) {
      // Send end session message
      if (this.socket.connected) {
        this.socket.emit('message', { type: 'end_session' });
      }
      this.socket.disconnect();
      this.socket = null;
    }
    this.sessionId = null;
    this.setState('disconnected');
  }
  
  /**
   * Handle binary data from Socket.io 'binary' event
   */
  private handleBinaryData(data: ArrayBuffer): void {
    // GLOBAL DEBUG: Track binary messages
    if (typeof window !== 'undefined') {
      const win = window as any;
      win._wsDebug = win._wsDebug || { messageCount: 0, byType: {} };
      win._wsDebug.messageCount++;
      win._wsDebug.byType['binary'] = (win._wsDebug.byType['binary'] || 0) + 1;
    }
    
    this.callbacks.onAudioReady?.(
      this.currentSentenceIndex,
      data,
      0 // Duration will be in the preceding metadata message
    );
  }
  
  /**
   * Handle incoming Socket.io message (JSON data)
   */
  private handleSocketMessage(data: any): void {
    // GLOBAL DEBUG: Track all messages with persistent counter
    if (typeof window !== 'undefined') {
      const win = window as any;
      win._wsDebug = win._wsDebug || { messageCount: 0, byType: {} };
      win._wsDebug.messageCount++;
    }
    
    // JSON message - minimal processing on hot path
    try {
      // Socket.io delivers parsed objects directly (no need to JSON.parse)
      const message = (typeof data === 'string') ? JSON.parse(data) : data as { type: string; [key: string]: any };
      const win = window as any;
      
      // Single lightweight counter update
      win._wsDebug.byType[message.type] = (win._wsDebug.byType[message.type] || 0) + 1;
      
      switch (message.type) {
        case 'connected':
          // Initial connection confirmed (no session yet)
          break;
          
        case 'session_started':
          this.handleSessionStarted(message as { type: string; sessionId: string; timestamp: number });
          break;
          
        case 'processing':
          this.handleProcessing(message as StreamingProcessingMessage);
          break;
          
        case 'sentence_start':
          this.handleSentenceStart(message as StreamingSentenceStartMessage);
          break;
          
        case 'sentence_ready':
          // Atomic first audio + first timing (prevents timing race)
          this.handleSentenceReady(message as StreamingSentenceReadyMessage);
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
          this.emit('feedback', message as { type: string; feedbackType: string; message: string });
          break;
          
        case 'pronunciation_coaching':
          // Live pronunciation coaching feedback with word-level analysis
          this.emit('pronunciationCoaching', message as {
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
          });
          break;
          
        case 'voice_updated':
          // Voice switch confirmation
          this.emit('voiceUpdated', message as { type: string; gender: string; voiceName: string; timestamp: number });
          break;
          
        case 'tutor_handoff':
          // Tutor handoff - current tutor said goodbye, switch to new tutor
          // Supports both intra-language (gender only) and cross-language (gender + language) handoffs
          this.emit('tutorHandoff', message as { 
            type: string; 
            targetGender: 'male' | 'female'; 
            targetLanguage?: string;  // For cross-language handoffs
            tutorName?: string;       // New tutor's name (e.g., "Sayuri")
            isLanguageSwitch: boolean;
            requiresGreeting?: boolean; // True if client should request greeting after reconnecting
            timestamp: number;
          });
          break;
          
        case 'whiteboard_update':
          // Whiteboard content from tutor
          this.emit('whiteboardUpdate', message as StreamingWhiteboardMessage);
          break;
          
        case 'vad_speech_started':
          this.emit('vadSpeechStarted', message);
          break;
          
        case 'vad_utterance_end':
          this.emit('vadUtteranceEnd', message);
          break;
          
        case 'interim_transcript':
          this.emit('interimTranscript', message);
          break;
          
        case 'input_mode_changed':
          this.emit('inputModeChanged', message);
          break;
          
        case 'open_mic_session_closed':
          this.emit('openMicSessionClosed', message);
          break;
          
        default:
          // Unknown message types - no logging on hot path
      }
    } catch (error) {
      if (isVerboseLoggingEnabled()) {
        console.error('[StreamingVoiceClient] Failed to parse message:', error);
      }
      // Track parse errors at window level for debugging
      if (typeof window !== 'undefined') {
        const win = window as any;
        win._parseErrors = win._parseErrors || [];
        win._parseErrors.push({ error: String(error), time: Date.now() });
      }
    }
  }
  
  private handleSessionStarted(message: { type: string; sessionId: string; timestamp: number }): void {
    this.sessionId = message.sessionId;
    this.setState('ready');
    this.callbacks.onSessionStart?.(message.sessionId);
    this.emit('sessionStart', message.sessionId);
  }
  
  private handleProcessing(message: StreamingProcessingMessage): void {
    this.setState('processing');
    this.callbacks.onProcessing?.(message.userTranscript);
    this.emit('processing', message);
  }
  
  private handleSentenceStart(message: StreamingSentenceStartMessage): void {
    this.currentSentenceIndex = message.sentenceIndex;
    this.setState('streaming');
    this.callbacks.onSentenceStart?.(message.sentenceIndex, message.text, message.targetLanguageText);
    this.emit('sentenceStart', message);
  }
  
  /**
   * NEW: Handle atomic sentence_ready message
   * Server sends this when BOTH first audio chunk AND first word timing are ready.
   * This prevents the timing race condition where playback starts before timings arrive.
   * 
   * The message contains:
   * - firstAudioChunk: The first audio chunk (can start playback)
   * - firstWordTimings: All word timings received so far (at least 1)
   * 
   * Client should use this as the signal to start playback - guaranteed to have timing data.
   */
  private handleSentenceReady(message: StreamingSentenceReadyMessage): void {
    const { sentenceIndex, firstWordTimings } = message;
    
    // Update sentence index
    this.currentSentenceIndex = sentenceIndex;
    this.setState('streaming');
    
    // Emit the atomic message - listeners can use both audio and timing together
    this.emit('sentenceReady', message);
  }
  
  private handleAudioChunk(message: StreamingAudioChunkMessage): void {
    // Store metadata for the upcoming binary frame
    this.currentSentenceIndex = message.sentenceIndex;
    // Emit audio chunk with embedded base64 data (no logging on hot path)
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
    // Emit immediately - no logging or tracking on hot path
    this.emit('wordTimingDelta', message);
  }
  
  /**
   * PROGRESSIVE STREAMING: Handle final word timing reconciliation
   * Sent when sentence synthesis completes with authoritative timings
   */
  private handleWordTimingFinal(message: StreamingWordTimingFinalMessage): void {
    // Emit immediately - no logging on hot path
    this.emit('wordTimingFinal', message);
  }
  
  private handleSentenceEnd(message: StreamingSentenceEndMessage): void {
    this.callbacks.onSentenceEnd?.(message.sentenceIndex, message.totalDurationMs);
    this.emit('sentenceEnd', message);
  }
  
  private handleResponseComplete(message: StreamingResponseCompleteMessage): void {
    // Transition back to 'ready' so client can send more audio
    this.setState('ready');
    this.callbacks.onResponseComplete?.(message.fullText ?? '', message.totalSentences);
    this.emit('responseComplete', message);
  }
  
  private handleError(message: StreamingErrorMessage): void {
    // Always emit error callback first so UI can show the error message
    this.callbacks.onError?.(message.code, message.message, message.recoverable);
    this.emit('error', new Error(message.message));
    
    if (!message.recoverable) {
      // 1. First transition to 'error' state so UI can show error message
      this.setState('error');
      
      // 2. Clear any pending reconnection timers to prevent stale reconnects
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      this.reconnectAttempts = 0;  // Reset reconnect counter
      
      // 3. Mark as intentional disconnect to skip auto-reconnect in handleDisconnect
      this.intentionalDisconnect = true;
      
      // 4. Close socket cleanly
      if (this.socket) {
        this.socket.disconnect();
        this.socket = null;
        this.sessionId = null;
      }
      
      // 5. Allow a brief moment for UI to observe error state before transitioning
      // This ensures error messages can be displayed before the "start new session" state
      setTimeout(() => {
        // Transition to 'disconnected' so user can start fresh
        this.setState('disconnected');
      }, 100);  // 100ms is enough for React to re-render with error message
    } else {
      // RECOVERABLE ERROR (e.g., EMPTY_TRANSCRIPT): Go back to 'ready' state
      // This unlocks the mic so user can try speaking again
      this.setState('ready');
    }
  }
  
  private setState(state: StreamingConnectionState): void {
    if (this.state !== state) {
      this.state = state;
      this.callbacks.onConnectionStateChange?.(state);
      this.emit('stateChange', state);
    }
  }
  
  private handleDisconnect(): void {
    this.socket = null;
    this.sessionId = null;
    
    // Skip auto-reconnect if disconnect was user-initiated
    if (this.intentionalDisconnect) {
      this.setState('disconnected');
      return;
    }
    
    // Skip if no conversationId to reconnect to
    if (!this.lastConversationId) {
      this.setState('disconnected');
      return;
    }
    
    // Attempt auto-reconnect with exponential backoff
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.pow(2, this.reconnectAttempts - 1) * 1000;
      
      this.setState('reconnecting');
      
      // Emit error event so UI can show reconnecting message
      this.emit('error', { 
        code: 'RECONNECTING', 
        message: `Connection lost. Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`,
        recoverable: true 
      });
      
      this.reconnectTimer = setTimeout(async () => {
        this.reconnectTimer = null;
        try {
          await this.connect(this.lastConversationId!);
          this.reconnectAttempts = 0;
          this.intentionalDisconnect = false;
        } catch (err) {
          // handleDisconnect will be called again, triggering next attempt
        }
      }, delay);
    } else {
      this.reconnectAttempts = 0;
      this.setState('disconnected');
      
      // Emit final error to UI
      this.emit('error', { 
        code: 'CONNECTION_FAILED', 
        message: 'Connection lost. Please restart the voice chat.',
        recoverable: false 
      });
    }
  }
}

/**
 * Singleton instance - stored on window to survive duplicate module bundling
 * This is CRITICAL: Vite/bundlers may create multiple copies of this module,
 * each with their own module-scoped variables. By storing on window, we ensure
 * ALL imports get the SAME instance, preventing the bug where:
 * - Instance #1 owns the WebSocket connection
 * - Instance #2 has the React listeners
 * - Messages never reach the UI
 */

export function getStreamingVoiceClient(): StreamingVoiceClient {
  // Use window storage to ensure single instance across all module copies
  // This is CRITICAL for preventing the dual-instance WebSocket bug where:
  // - Vite bundles may create multiple module copies
  // - Each copy would have its own module-scoped singleton variable
  // - Instance #1 owns the WebSocket, Instance #2 has React listeners
  // - By storing on window, ALL imports share the SAME instance
  if (typeof window !== 'undefined') {
    // REUSE existing instance if present
    if (window.__streamingVoiceClient) {
      return window.__streamingVoiceClient;
    }
    
    // Create new instance only when none exists
    window.__streamingVoiceClient = new StreamingVoiceClient();
    return window.__streamingVoiceClient;
  }
  
  // Fallback for SSR (shouldn't happen in this app)
  return new StreamingVoiceClient();
}

/**
 * Force create a fresh client instance - use sparingly!
 * This disconnects any existing connection and creates a new one.
 * Only use when you need to reset connection state completely.
 */
export function resetStreamingVoiceClient(): StreamingVoiceClient {
  if (typeof window !== 'undefined' && window.__streamingVoiceClient) {
    window.__streamingVoiceClient.disconnect();
    window.__streamingVoiceClient = null;
  }
  return getStreamingVoiceClient();
}
