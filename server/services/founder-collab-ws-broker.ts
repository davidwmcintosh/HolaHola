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
  pong: () => void;
}

interface ClientToServerEvents {
  join_session: (data: { sessionId?: string; clientId: string }) => void;
  send_message: (data: FounderMessageInput) => void;
  request_replay: (data: { afterCursor: string }) => void;
  ack_cursor: (data: { cursor: string }) => void;
  ping: () => void;
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
      const sql = neon(process.env.DATABASE_URL!);
      
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
    socket.on('join_session', async (data) => {
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
        
        socket.emit('session_info', session);
        socket.emit('connected', { clientId, sessionId: session.id });
        
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
        
        this.clients.delete(socket.id);
        console.log(`[FounderCollabWS] Client ${client.clientId} disconnected`);
      }
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
