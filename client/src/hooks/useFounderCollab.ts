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
}

interface ClientToServerEvents {
  join_session: (data: { sessionId?: string; clientId: string }) => void;
  send_message: (data: FounderMessageInput) => void;
  request_replay: (data: { afterCursor: string }) => void;
  ack_cursor: (data: { cursor: string }) => void;
  ping: () => void;
}

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

export interface FounderCollabState {
  connectionState: ConnectionState;
  session: FounderSession | null;
  messages: CollaborationMessage[];
  error: string | null;
  reconnectAttempt: number;
}

export interface UseFounderCollabReturn {
  state: FounderCollabState;
  connect: (sessionId?: string) => void;
  disconnect: () => void;
  sendMessage: (role: MessageRole, content: string, metadata?: Record<string, any>) => void;
  clearMessages: () => void;
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
  
  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
  const clientIdRef = useRef<string>(getClientId());
  const sessionIdRef = useRef<string | null>(null);
  const lastCursorRef = useRef<string | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isManualDisconnectRef = useRef(false);
  const reconnectAttemptRef = useRef(0);
  
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
  
  useEffect(() => {
    return () => {
      disconnect();
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
    connect,
    disconnect,
    sendMessage,
    clearMessages,
    isConnected: connectionState === 'connected',
    isReconnecting: connectionState === 'reconnecting',
  };
}
