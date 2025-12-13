/**
 * Founder Collaboration Hook
 * 
 * Real-time sync channel for founder-Daniela collaboration.
 * Persists across dev restarts with automatic reconnection and message replay.
 * 
 * Key Features:
 * - Persistent client ID (localStorage) for reconnection identity
 * - Auto-reconnect with exponential backoff
 * - Message replay on reconnection (cursor-based)
 * - Optimistic message state management
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import type { CollaborationMessage, FounderSession } from '@shared/schema';

const NAMESPACE = '/founder-collab';
const CLIENT_ID_KEY = 'founder-collab-client-id';
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_BASE_DELAY = 1000;
const PING_INTERVAL = 30000;

type MessageRole = 'founder' | 'daniela' | 'editor' | 'system';

interface FounderMessageInput {
  role: MessageRole;
  content: string;
  metadata?: Record<string, any>;
}

interface ServerToClientEvents {
  message: (msg: CollaborationMessage) => void;
  messages_replay: (data: { messages: CollaborationMessage[]; hasMore: boolean }) => void;
  session_info: (session: FounderSession) => void;
  session_created: (session: FounderSession) => void;
  error: (error: { code: string; message: string }) => void;
  connected: (data: { clientId: string; sessionId: string }) => void;
  pong: () => void;
  // Voice events
  voice_transcript: (data: { text: string; isFinal: boolean }) => void;
  voice_processing: (data: { status: 'thinking' | 'speaking' }) => void;
  voice_audio: (data: { messageId: string; chunk: string; isLast: boolean; duration?: number }) => void;
  voice_complete: (data: { success: boolean; message?: string; messageId?: string }) => void;
  voice_error: (data: { code: string; message: string }) => void;
}

interface ClientToServerEvents {
  join_session: (data: { sessionId?: string; clientId: string }) => void;
  send_message: (data: FounderMessageInput) => void;
  request_replay: (data: { afterCursor: string }) => void;
  ack_cursor: (data: { cursor: string }) => void;
  ping: () => void;
  // Voice events
  voice_start: () => void;
  voice_chunk: (data: ArrayBuffer) => void;
  voice_stop: () => void;
  voice_replay: (data: { messageId: string }) => void;
}

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';
export type VoiceProcessingStatus = 'idle' | 'recording' | 'thinking' | 'speaking';

export interface FounderCollabState {
  connectionState: ConnectionState;
  session: FounderSession | null;
  messages: CollaborationMessage[];
  error: string | null;
  reconnectAttempt: number;
}

export interface VoiceState {
  isRecording: boolean;
  currentTranscript: string;
  processingStatus: VoiceProcessingStatus;
  voiceError: string | null;
  playingMessageId: string | null;
}

export interface UseFounderCollabReturn {
  state: FounderCollabState;
  voiceState: VoiceState;
  connect: (sessionId?: string) => void;
  disconnect: () => void;
  sendMessage: (role: MessageRole, content: string, metadata?: Record<string, any>) => void;
  clearMessages: () => void;
  startVoiceRecording: () => Promise<void>;
  stopVoiceRecording: () => void;
  replayMessage: (messageId: string) => void;
  isConnected: boolean;
  isReconnecting: boolean;
}

/**
 * Get or create a persistent client ID for reconnection
 */
function getClientId(): string {
  if (typeof window === 'undefined') return `server-${Date.now()}`;
  
  let clientId = localStorage.getItem(CLIENT_ID_KEY);
  if (!clientId) {
    clientId = `fc-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem(CLIENT_ID_KEY, clientId);
  }
  return clientId;
}

/**
 * Hook for founder collaboration with Daniela
 */
export function useFounderCollab(): UseFounderCollabReturn {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [session, setSession] = useState<FounderSession | null>(null);
  const [messages, setMessages] = useState<CollaborationMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  
  // Voice state
  const [isRecording, setIsRecording] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [processingStatus, setProcessingStatus] = useState<VoiceProcessingStatus>('idle');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  
  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
  const clientIdRef = useRef<string>(getClientId());
  const sessionIdRef = useRef<string | null>(null);
  const lastCursorRef = useRef<string | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isManualDisconnectRef = useRef(false);
  const reconnectAttemptRef = useRef(0);
  
  // Voice recording refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBufferRef = useRef<ArrayBuffer[]>([]);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  
  /**
   * Clear any pending reconnect timeout
   */
  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);
  
  /**
   * Clear ping interval
   */
  const clearPingInterval = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  }, []);
  
  /**
   * Start ping interval for connection health
   */
  const startPingInterval = useCallback(() => {
    clearPingInterval();
    pingIntervalRef.current = setInterval(() => {
      if (socketRef.current?.connected) {
        socketRef.current.emit('ping');
      }
    }, PING_INTERVAL);
  }, [clearPingInterval]);
  
  /**
   * Handle incoming message
   */
  const handleMessage = useCallback((msg: CollaborationMessage) => {
    setMessages(prev => {
      const exists = prev.some(m => m.cursor === msg.cursor);
      if (exists) return prev;
      
      const updated = [...prev, msg].sort((a, b) => a.cursor.localeCompare(b.cursor));
      lastCursorRef.current = msg.cursor;
      
      if (socketRef.current?.connected) {
        socketRef.current.emit('ack_cursor', { cursor: msg.cursor });
      }
      
      return updated;
    });
  }, []);
  
  /**
   * Handle message replay on reconnection
   */
  const handleMessagesReplay = useCallback((data: { messages: CollaborationMessage[]; hasMore: boolean }) => {
    const { messages: replayMessages, hasMore } = data;
    
    setMessages(prev => {
      const existingCursors = new Set(prev.map(m => m.cursor));
      const newMessages = replayMessages.filter(m => !existingCursors.has(m.cursor));
      
      if (newMessages.length === 0) return prev;
      
      const updated = [...prev, ...newMessages].sort((a, b) => a.cursor.localeCompare(b.cursor));
      
      if (updated.length > 0) {
        lastCursorRef.current = updated[updated.length - 1].cursor;
        if (socketRef.current?.connected) {
          socketRef.current.emit('ack_cursor', { cursor: lastCursorRef.current });
        }
      }
      
      return updated;
    });
    
    if (hasMore && socketRef.current?.connected && lastCursorRef.current) {
      socketRef.current.emit('request_replay', { afterCursor: lastCursorRef.current });
    }
    
    console.log(`[FounderCollab] Replayed ${replayMessages.length} messages, hasMore: ${hasMore}`);
  }, []);
  
  /**
   * Schedule reconnection attempt using ref to avoid stale closure
   */
  const scheduleReconnect = useCallback(() => {
    if (isManualDisconnectRef.current) return;
    
    const currentAttempt = reconnectAttemptRef.current;
    if (currentAttempt >= MAX_RECONNECT_ATTEMPTS) {
      setConnectionState('error');
      setError('Max reconnection attempts reached');
      return;
    }
    
    const delay = RECONNECT_BASE_DELAY * Math.pow(2, currentAttempt);
    console.log(`[FounderCollab] Scheduling reconnect in ${delay}ms (attempt ${currentAttempt + 1})`);
    
    setConnectionState('reconnecting');
    clearReconnectTimeout();
    
    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectAttemptRef.current = currentAttempt + 1;
      setReconnectAttempt(currentAttempt + 1);
      connectSocket(sessionIdRef.current || undefined);
    }, delay);
  }, [clearReconnectTimeout]);
  
  /**
   * Connect to the WebSocket server
   */
  const connectSocket = useCallback((targetSessionId?: string) => {
    if (socketRef.current?.connected) {
      console.log('[FounderCollab] Already connected');
      return;
    }
    
    isManualDisconnectRef.current = false;
    setConnectionState('connecting');
    setError(null);
    
    console.log('[FounderCollab] Creating socket connection to namespace:', NAMESPACE);
    
    const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(NAMESPACE, {
      path: '/socket.io',
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: false,
      timeout: 20000,
      forceNew: true,
    });
    
    socketRef.current = socket;
    
    console.log('[FounderCollab] Socket created, socket.id:', socket.id, 'connected:', socket.connected);
    
    // Helper to emit join_session
    const emitJoinSession = () => {
      console.log('[FounderCollab] Emitting join_session with clientId:', clientIdRef.current);
      socket.emit('join_session', {
        sessionId: targetSessionId,
        clientId: clientIdRef.current,
      });
    };
    
    // Monitor socket.io Manager events for debugging
    socket.io.on('open', () => {
      console.log('[FounderCollab] Transport opened, socket.connected:', socket.connected);
      // Fallback: If transport opens but connect event doesn't fire, emit after delay
      setTimeout(() => {
        if (!sessionIdRef.current && socket.connected) {
          console.log('[FounderCollab] Fallback: transport open but no session, emitting join_session');
          emitJoinSession();
        }
      }, 500);
    });
    
    socket.io.on('error', (err) => {
      console.error('[FounderCollab] Transport error:', err);
    });
    
    socket.on('connect', () => {
      console.log('[FounderCollab] CONNECT EVENT FIRED! Socket.id:', socket.id);
      emitJoinSession();
    });
    
    socket.on('connected', (data) => {
      console.log(`[FounderCollab] Joined session ${data.sessionId}`);
      sessionIdRef.current = data.sessionId;
      setConnectionState('connected');
      reconnectAttemptRef.current = 0;
      setReconnectAttempt(0);
      startPingInterval();
    });
    
    socket.on('session_info', (sessionData) => {
      setSession(sessionData);
    });
    
    socket.on('message', handleMessage);
    socket.on('messages_replay', handleMessagesReplay);
    
    socket.on('error', (err) => {
      console.error('[FounderCollab] Server error:', err);
      if (err.code === 'AUTH_FAILED') {
        setError('Authentication required. Please log in as a developer or admin.');
        setConnectionState('error');
      } else {
        setError(err.message);
      }
    });
    
    socket.on('disconnect', (reason) => {
      console.log(`[FounderCollab] Disconnected: ${reason}`);
      clearPingInterval();
      
      if (!isManualDisconnectRef.current && reason !== 'io client disconnect') {
        scheduleReconnect();
      } else {
        setConnectionState('disconnected');
      }
    });
    
    socket.on('connect_error', (err) => {
      console.error('[FounderCollab] Connection error:', err.message);
      setError(err.message);
      socket.close();
      scheduleReconnect();
    });
    
    socket.on('pong', () => {
      // Connection is healthy
    });
    
    // Voice event listeners
    socket.on('voice_transcript', (data) => {
      setCurrentTranscript(data.text);
    });
    
    socket.on('voice_processing', (data) => {
      setProcessingStatus(data.status);
    });
    
    socket.on('voice_audio', (data) => {
      // Accumulate audio chunks
      const chunk = Uint8Array.from(atob(data.chunk), c => c.charCodeAt(0));
      audioBufferRef.current.push(chunk.buffer);
      
      if (data.isLast) {
        // Combine all chunks and play
        const totalLength = audioBufferRef.current.reduce((acc, buf) => acc + buf.byteLength, 0);
        const combined = new Uint8Array(totalLength);
        let offset = 0;
        audioBufferRef.current.forEach(buf => {
          combined.set(new Uint8Array(buf), offset);
          offset += buf.byteLength;
        });
        
        // Create blob and play
        const blob = new Blob([combined], { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);
        
        if (audioPlayerRef.current) {
          audioPlayerRef.current.pause();
        }
        audioPlayerRef.current = new Audio(url);
        audioPlayerRef.current.onended = () => {
          setPlayingMessageId(null);
          setProcessingStatus('idle');
          URL.revokeObjectURL(url);
        };
        setPlayingMessageId(data.messageId);
        audioPlayerRef.current.play().catch(console.error);
        
        audioBufferRef.current = [];
      }
    });
    
    socket.on('voice_complete', (data) => {
      if (!data.success) {
        setVoiceError(data.message || 'Voice processing failed');
      }
      setIsRecording(false);
    });
    
    socket.on('voice_error', (data) => {
      console.error('[FounderCollab] Voice error:', data);
      setVoiceError(data.message);
      setIsRecording(false);
      setProcessingStatus('idle');
    });
  }, [handleMessage, handleMessagesReplay, scheduleReconnect, startPingInterval, clearPingInterval]);
  
  /**
   * Connect to a session
   */
  const connect = useCallback((sessionId?: string) => {
    sessionIdRef.current = sessionId || null;
    connectSocket(sessionId);
  }, [connectSocket]);
  
  /**
   * Disconnect from the server
   */
  const disconnect = useCallback(() => {
    isManualDisconnectRef.current = true;
    clearReconnectTimeout();
    clearPingInterval();
    
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    
    setConnectionState('disconnected');
    setSession(null);
    reconnectAttemptRef.current = 0;
    setReconnectAttempt(0);
  }, [clearReconnectTimeout, clearPingInterval]);
  
  /**
   * Send a message
   */
  const sendMessage = useCallback((
    role: MessageRole,
    content: string,
    metadata?: Record<string, any>
  ) => {
    if (!socketRef.current?.connected) {
      console.warn('[FounderCollab] Cannot send message: not connected');
      return;
    }
    
    socketRef.current.emit('send_message', { role, content, metadata });
  }, []);
  
  /**
   * Clear local messages (does not affect server)
   */
  const clearMessages = useCallback(() => {
    setMessages([]);
    lastCursorRef.current = null;
  }, []);
  
  /**
   * Start voice recording (push-to-talk)
   */
  const startVoiceRecording = useCallback(async () => {
    // Guard against duplicate starts (mobile touch + mouse events)
    if (isRecording) {
      console.log('[FounderCollab] Already recording, ignoring duplicate start');
      return;
    }
    
    if (!socketRef.current?.connected) {
      console.warn('[FounderCollab] Cannot start recording: not connected');
      return;
    }
    
    try {
      setVoiceError(null);
      setCurrentTranscript('');
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        }
      });
      
      // Create AudioContext for processing
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      const source = audioContextRef.current.createMediaStreamSource(stream);
      const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);
      
      processor.onaudioprocess = (e) => {
        if (socketRef.current?.connected) {
          const inputData = e.inputBuffer.getChannelData(0);
          // Convert Float32 to Int16
          const int16 = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            int16[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
          }
          socketRef.current.emit('voice_chunk', int16.buffer);
        }
      };
      
      source.connect(processor);
      processor.connect(audioContextRef.current.destination);
      
      // Store stream for cleanup
      mediaRecorderRef.current = { stream, processor, source } as any;
      
      // Signal server to start recording
      socketRef.current.emit('voice_start');
      setIsRecording(true);
      setProcessingStatus('recording');
      
      console.log('[FounderCollab] Voice recording started');
    } catch (err: any) {
      console.error('[FounderCollab] Failed to start recording:', err);
      setVoiceError(err.message || 'Failed to access microphone');
    }
  }, [isRecording]);
  
  /**
   * Stop voice recording
   */
  const stopVoiceRecording = useCallback(() => {
    if (!isRecording) return;
    
    // Cleanup audio resources
    if (mediaRecorderRef.current) {
      const { stream, processor, source } = mediaRecorderRef.current as any;
      if (processor) {
        processor.disconnect();
      }
      if (source) {
        source.disconnect();
      }
      if (stream) {
        stream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      }
      mediaRecorderRef.current = null;
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(console.error);
      audioContextRef.current = null;
    }
    
    // Signal server to stop and process
    if (socketRef.current?.connected) {
      socketRef.current.emit('voice_stop');
    }
    
    setIsRecording(false);
    setProcessingStatus('thinking');
    console.log('[FounderCollab] Voice recording stopped');
  }, [isRecording]);
  
  /**
   * Replay a voice message
   */
  const replayMessage = useCallback((messageId: string) => {
    if (!socketRef.current?.connected) return;
    
    setPlayingMessageId(messageId);
    socketRef.current.emit('voice_replay', { messageId });
  }, []);
  
  useEffect(() => {
    return () => {
      disconnect();
      // Cleanup audio on unmount
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current = null;
      }
    };
  }, [disconnect]);
  
  return {
    state: {
      connectionState,
      session,
      messages,
      error,
      reconnectAttempt,
    },
    voiceState: {
      isRecording,
      currentTranscript,
      processingStatus,
      voiceError,
      playingMessageId,
    },
    connect,
    disconnect,
    sendMessage,
    clearMessages,
    startVoiceRecording,
    stopVoiceRecording,
    replayMessage,
    isConnected: connectionState === 'connected',
    isReconnecting: connectionState === 'reconnecting',
  };
}
