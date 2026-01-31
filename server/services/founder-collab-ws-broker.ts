/**
 * Founder Collaboration WebSocket Broker
 * 
 * Real-time communication layer for founder-Daniela collaboration.
 * Handles:
 * - Client connection with automatic resume token management
 * - Message broadcasting to all connected clients
 * - Reconnection with message replay
 * - Heartbeat/ping-pong for connection health
 * 
 * Uses Socket.io for reliable delivery through Replit's proxy.
 */

import { Server as SocketIOServer, Socket, Namespace } from 'socket.io';
import { founderCollabService, type FounderMessageInput } from './founder-collaboration-service';
import type { CollaborationMessage, FounderSession } from '@shared/schema';
import { parse as parseCookie } from 'cookie';
import signature from 'cookie-signature';
import {
  startVoiceSession,
  startRecording,
  processAudioChunk,
  stopRecording,
  replayVoiceMessage,
  endVoiceSession,
} from './sync-channel-voice';

const NAMESPACE = '/founder-collab';

interface ConnectedClient {
  socket: Socket;
  clientId: string;
  founderId: string;
  sessionId: string;
  lastCursor: string | null;
}

interface ServerToClientEvents {
  message: (msg: CollaborationMessage) => void;
  messages_replay: (data: { messages: CollaborationMessage[]; hasMore: boolean }) => void;
  session_info: (session: FounderSession) => void;
  session_created: (session: FounderSession) => void;
  error: (error: { code: string; message: string }) => void;
  connected: (data: { clientId: string; sessionId: string }) => void;
  ready: () => void;  // Emitted when handlers are set up and client can send join_session
  pong: () => void;
}

interface ClientToServerEvents {
  join_session: (data: { sessionId?: string; clientId: string }) => void;
  send_message: (data: FounderMessageInput) => void;
  request_replay: (data: { afterCursor: string }) => void;
  ack_cursor: (data: { cursor: string }) => void;
  ping: () => void;
  // Voice events
  voice_start: () => void;
  voice_chunk: (data: Buffer) => void;
  voice_stop: () => void;
  voice_replay: (data: { messageId: string }) => void;
}

class FounderCollabWSBroker {
  private io: SocketIOServer | null = null;
  private namespace: Namespace<ClientToServerEvents, ServerToClientEvents> | null = null;
  private clients: Map<string, ConnectedClient> = new Map();
  private sessionClients: Map<string, Set<string>> = new Map();
  
  /**
   * Initialize the WebSocket broker on an existing Socket.io server instance
   * Attaches as a namespace to share the same underlying server
   */
  initialize(io: SocketIOServer): void {
    this.io = io;
    this.namespace = io.of(NAMESPACE) as Namespace<ClientToServerEvents, ServerToClientEvents>;
    
    this.namespace.on('connection', async (socket) => {
      console.log(`[FounderCollabWS] Client connected: ${socket.id}`);
      
      const founderId = await this.authenticateSocket(socket);
      if (!founderId) {
        socket.emit('error', { code: 'AUTH_FAILED', message: 'Authentication required' });
        socket.disconnect(true);
        return;
      }
      
      this.setupSocketHandlers(socket, founderId);
      
      // Emit ready event so client knows it can send join_session
      console.log(`[FounderCollabWS] Handlers ready, emitting 'ready' event to ${socket.id}`);
      socket.emit('ready');
    });
    
    console.log(`[FounderCollabWS] Broker initialized on namespace ${NAMESPACE}`);
  }
  
  /**
   * Authenticate socket connection using session cookie
   */
  private async authenticateSocket(socket: Socket): Promise<string | null> {
    try {
      const cookieHeader = socket.handshake.headers.cookie;
      if (!cookieHeader) return null;
      
      const cookies = parseCookie(cookieHeader);
      let sessionId = cookies['connect.sid'];
      
      if (!sessionId) return null;
      
      if (sessionId.startsWith('s:')) {
        sessionId = sessionId.slice(2);
        const unsigned = signature.unsign(sessionId, process.env.SESSION_SECRET!);
        if (unsigned === false) return null;
        sessionId = unsigned;
      }
      
      const { neon } = await import('@neondatabase/serverless');
      const sql = neon(process.env.NEON_SHARED_DATABASE_URL || process.env.DATABASE_URL!);
      
      const sessions = await sql`
        SELECT sess FROM sessions WHERE sid = ${sessionId}
      `;
      
      if (!sessions || sessions.length === 0) return null;
      
      const sessionData = sessions[0].sess as any;
      const userId = sessionData?.passport?.user?.claims?.sub;
      
      if (!userId) return null;
      
      const userRole = await sql`
        SELECT role FROM users WHERE id = ${userId}
      `;
      
      if (!userRole || userRole.length === 0) return null;
      
      const role = userRole[0].role;
      if (role !== 'developer' && role !== 'admin') {
        console.log(`[FounderCollabWS] User ${userId} is not a developer/admin (role: ${role})`);
        return null;
      }
      
      return userId;
    } catch (error) {
      console.error('[FounderCollabWS] Auth error:', error);
      return null;
    }
  }
  
  /**
   * Set up event handlers for a connected socket
   */
  private setupSocketHandlers(socket: Socket, founderId: string): void {
    console.log(`[FounderCollabWS] Setting up handlers for socket ${socket.id}, founderId: ${founderId}`);
    
    socket.on('join_session', async (data) => {
      console.log(`[FounderCollabWS] Received join_session event:`, JSON.stringify(data));
      try {
        const { sessionId, clientId } = data;
        
        let session: FounderSession;
        if (sessionId) {
          const existing = await founderCollabService.getSession(sessionId);
          if (existing && existing.founderId === founderId) {
            session = existing;
          } else {
            session = await founderCollabService.getOrCreateActiveSession(founderId);
          }
        } else {
          session = await founderCollabService.getOrCreateActiveSession(founderId);
        }
        
        await founderCollabService.registerClient(clientId, session.id);
        
        const client: ConnectedClient = {
          socket,
          clientId,
          founderId,
          sessionId: session.id,
          lastCursor: null,
        };
        this.clients.set(socket.id, client);
        
        if (!this.sessionClients.has(session.id)) {
          this.sessionClients.set(session.id, new Set());
        }
        this.sessionClients.get(session.id)!.add(socket.id);
        
        socket.join(`session:${session.id}`);
        
        console.log(`[FounderCollabWS] Emitting session_info and connected events for session ${session.id}`);
        socket.emit('session_info', session);
        socket.emit('connected', { clientId, sessionId: session.id });
        console.log(`[FounderCollabWS] Connected event emitted successfully`);
        
        const replay = await founderCollabService.getReplayMessagesForClient(clientId, session.id);
        if (replay.messages.length > 0) {
          socket.emit('messages_replay', {
            messages: replay.messages,
            hasMore: replay.hasMore,
          });
        }
        
        console.log(`[FounderCollabWS] Client ${clientId} joined session ${session.id}`);
      } catch (error) {
        console.error('[FounderCollabWS] Error joining session:', error);
        socket.emit('error', { code: 'JOIN_FAILED', message: 'Failed to join session' });
      }
    });
    
    socket.on('send_message', async (data) => {
      const client = this.clients.get(socket.id);
      if (!client) {
        socket.emit('error', { code: 'NOT_JOINED', message: 'Not joined to a session' });
        return;
      }
      
      try {
        const message = await founderCollabService.addMessage(client.sessionId, data);
        
        this.broadcastToSession(client.sessionId, 'message', message);
        
        console.log(`[FounderCollabWS] Message sent in session ${client.sessionId}`);
        
        // HIVE CONSCIOUSNESS: Let Daniela and Wren hear the message and potentially respond
        // Import dynamically to avoid circular dependency
        const { hiveConsciousnessService } = await import('./hive-consciousness-service');
        hiveConsciousnessService.processMessage(client.sessionId, message).catch(err => {
          console.error('[FounderCollabWS] Hive consciousness error:', err);
        });
      } catch (error) {
        console.error('[FounderCollabWS] Error sending message:', error);
        socket.emit('error', { code: 'SEND_FAILED', message: 'Failed to send message' });
      }
    });
    
    socket.on('request_replay', async (data) => {
      const client = this.clients.get(socket.id);
      if (!client) {
        socket.emit('error', { code: 'NOT_JOINED', message: 'Not joined to a session' });
        return;
      }
      
      try {
        const replay = await founderCollabService.getMessagesAfterCursor(
          client.sessionId,
          data.afterCursor
        );
        
        socket.emit('messages_replay', {
          messages: replay.messages,
          hasMore: replay.hasMore,
        });
      } catch (error) {
        console.error('[FounderCollabWS] Error replaying messages:', error);
        socket.emit('error', { code: 'REPLAY_FAILED', message: 'Failed to replay messages' });
      }
    });
    
    socket.on('ack_cursor', async (data) => {
      const client = this.clients.get(socket.id);
      if (!client) return;
      
      try {
        await founderCollabService.updateClientCursor(
          client.clientId,
          client.sessionId,
          data.cursor
        );
        client.lastCursor = data.cursor;
      } catch (error) {
        console.error('[FounderCollabWS] Error acknowledging cursor:', error);
      }
    });
    
    socket.on('ping', () => {
      socket.emit('pong');
    });
    
    socket.on('disconnect', async () => {
      const client = this.clients.get(socket.id);
      if (client) {
        await founderCollabService.disconnectClient(client.clientId, client.sessionId);
        
        const sessionSockets = this.sessionClients.get(client.sessionId);
        if (sessionSockets) {
          sessionSockets.delete(socket.id);
          if (sessionSockets.size === 0) {
            this.sessionClients.delete(client.sessionId);
          }
        }
        
        // End voice session if active
        endVoiceSession(socket.id);
        
        this.clients.delete(socket.id);
        console.log(`[FounderCollabWS] Client ${client.clientId} disconnected`);
      }
    });
    
    // Voice event handlers
    socket.on('voice_start', async () => {
      const client = this.clients.get(socket.id);
      if (!client) {
        socket.emit('error', { code: 'NOT_JOINED', message: 'Not joined to a session' });
        return;
      }
      
      // Initialize voice session if needed
      await startVoiceSession(socket, client.sessionId, client.founderId);
      
      // Start recording
      const started = await startRecording(socket.id);
      if (started) {
        console.log(`[FounderCollabWS] Voice recording started for ${client.clientId}`);
      }
    });
    
    socket.on('voice_chunk', (data: Buffer) => {
      processAudioChunk(socket.id, data);
    });
    
    socket.on('voice_stop', async () => {
      const client = this.clients.get(socket.id);
      if (!client) return;
      
      await stopRecording(socket.id);
      console.log(`[FounderCollabWS] Voice recording stopped for ${client.clientId}`);
    });
    
    socket.on('voice_replay', async (data: { messageId: string }) => {
      await replayVoiceMessage(socket.id, data.messageId);
    });
  }
  
  /**
   * Broadcast a message to all clients in a session
   */
  private broadcastToSession(
    sessionId: string,
    event: keyof ServerToClientEvents,
    data: any
  ): void {
    if (!this.namespace) return;
    
    (this.namespace.to(`session:${sessionId}`) as any).emit(event, data);
  }
  
  /**
   * Add a message from external source (e.g., API, Daniela response)
   * and broadcast to all connected clients
   */
  async addAndBroadcastMessage(
    sessionId: string,
    input: FounderMessageInput
  ): Promise<CollaborationMessage | null> {
    try {
      const message = await founderCollabService.addMessage(sessionId, input);
      this.broadcastToSession(sessionId, 'message', message);
      return message;
    } catch (error) {
      console.error('[FounderCollabWS] Error adding/broadcasting message:', error);
      return null;
    }
  }
  
  /**
   * Public method to emit a message to all clients in a session
   * Used for broadcasting messages that have already been saved to the database
   */
  emitToSession(sessionId: string, event: keyof ServerToClientEvents, data: any): void {
    this.broadcastToSession(sessionId, event, data);
  }
  
  /**
   * Get connection stats
   */
  getStats(): {
    connectedClients: number;
    activeSessions: number;
  } {
    return {
      connectedClients: this.clients.size,
      activeSessions: this.sessionClients.size,
    };
  }
  
  /**
   * Check if the broker is initialized
   */
  isInitialized(): boolean {
    return this.io !== null;
  }
}

export const founderCollabWSBroker = new FounderCollabWSBroker();
