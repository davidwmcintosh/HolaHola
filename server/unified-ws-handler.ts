/**
 * Unified WebSocket Handler
 * 
 * Single point of handling for ALL WebSocket connections.
 * This prevents conflicts between multiple WebSocketServers.
 * 
 * Paths handled:
 * - /api/voice/stream/ws - Streaming voice mode
 * - /api/realtime/ws - OpenAI Realtime API proxy
 */

import { WebSocketServer, WebSocket as WS } from 'ws';
import { Server } from 'http';
import type { IncomingMessage } from 'http';
import { Duplex } from 'stream';
import { storage } from './storage';
import { createSystemPrompt, createStreamingVoicePrompt } from './system-prompt';
import { parse as parseCookie } from 'cookie';
import signature from 'cookie-signature';
import {
  getStreamingVoiceOrchestrator,
  StreamingSession,
} from './services/streaming-voice-orchestrator';
import {
  ClientStartSessionMessage,
  ClientAudioDataMessage,
  StreamingErrorMessage,
} from '@shared/streaming-voice-types';

const STREAMING_VOICE_PATH = '/api/voice/stream/ws';
const REALTIME_PATH = '/api/realtime/ws';

/**
 * Extract userId from authenticated session cookie
 */
async function getUserIdFromSession(req: IncomingMessage): Promise<string | null> {
  try {
    const cookieHeader = req.headers.cookie;
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
    return sessionData?.passport?.user?.claims?.sub || null;
  } catch (error) {
    console.error('[WS Auth] Error:', error);
    return null;
  }
}

/**
 * Send error message to WebSocket client
 */
function sendError(ws: WS, code: string, message: string, recoverable: boolean) {
  if (ws.readyState === WS.OPEN) {
    ws.send(JSON.stringify({
      type: 'error',
      timestamp: Date.now(),
      code,
      message,
      recoverable,
    } as StreamingErrorMessage));
  }
}

/**
 * Handle streaming voice WebSocket connection
 */
function handleStreamingVoiceConnection(ws: WS, req: IncomingMessage) {
  console.log('[Streaming Voice] Client connected');

  const orchestrator = getStreamingVoiceOrchestrator();
  let session: StreamingSession | null = null;
  let userId: string | null = null;
  let isAuthenticated = false;
  
  let conversationId: string | null = null;
  try {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    conversationId = url.searchParams.get('conversationId');
    console.log('[Streaming Voice] ConversationId:', conversationId);
  } catch (e) {
    console.error('[Streaming Voice] Failed to parse URL:', e);
  }

  // Send connected confirmation
  try {
    ws.send(JSON.stringify({
      type: 'connected',
      timestamp: Date.now(),
    }));
    console.log('[Streaming Voice] Connected message sent');
  } catch (err) {
    console.error('[Streaming Voice] Error sending connected:', err);
  }

  ws.on('message', async (data: Buffer | string) => {
    console.log('[Streaming Voice] Message received, length:', Buffer.isBuffer(data) ? data.length : data.length);
    
    try {
      // Convert Buffer to string for JSON parsing attempt
      const dataStr = Buffer.isBuffer(data) ? data.toString('utf-8') : data;
      
      // Try to parse as JSON first
      let message: any = null;
      try {
        message = JSON.parse(dataStr);
        console.log('[Streaming Voice] Parsed JSON message type:', message.type);
      } catch (e) {
        // Not JSON - must be binary audio data
        if (!isAuthenticated) {
          sendError(ws, 'UNAUTHORIZED', 'Not authenticated', false);
          return;
        }
        if (session) {
          const audioBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
          console.log(`[Streaming Voice] Audio: ${audioBuffer.length} bytes`);
          await orchestrator.processUserAudio(session.id, audioBuffer, 'webm');
        }
        return;
      }

      // Handle JSON message
      console.log('[Streaming Voice] Message type:', message.type);

      switch (message.type) {
        case 'start_session': {
          const config = message as ClientStartSessionMessage;
          console.log('[Streaming Voice] Processing start_session');

          if (!isAuthenticated) {
            console.log('[Streaming Voice] Authenticating...');
            userId = await getUserIdFromSession(req);
            
            if (!userId) {
              console.error('[Streaming Voice] Auth failed');
              sendError(ws, 'UNAUTHORIZED', 'Authentication required', false);
              ws.close(4401, 'Unauthorized');
              return;
            }
            isAuthenticated = true;
            console.log('[Streaming Voice] ✓ Authenticated userId:', userId);
          }

          if (!conversationId) {
            sendError(ws, 'INVALID_REQUEST', 'Missing conversationId', false);
            return;
          }

          const user = await storage.getUser(userId!);
          if (!user) {
            sendError(ws, 'UNAUTHORIZED', 'User not found', false);
            return;
          }

          const conversation = await storage.getConversation(conversationId!, userId!);
          if (!conversation) {
            sendError(ws, 'UNKNOWN', 'Conversation not found', false);
            return;
          }

          const messages = await storage.getMessagesByConversation(conversationId!);
          const conversationHistory = messages
            .slice(-20)
            .map((m: { role: string; content: string }) => ({
              role: m.role as 'user' | 'model',
              content: m.content,
            }));

          // Use full system prompt with streaming voice mode flag
          // This preserves all teaching context (ACTFL, cultural guidelines, vocabulary)
          // while outputting plain text format for TTS
          const systemPrompt = createSystemPrompt(
            config.targetLanguage,
            config.difficultyLevel,
            messages.length,
            true, // isVoiceMode
            null,
            [],
            config.nativeLanguage,
            undefined,
            undefined,
            user.actflLevel,
            false,
            messages.length,
            (user.tutorPersonality || 'warm') as any,
            user.tutorExpressiveness || 3,
            true // isStreamingVoiceMode - outputs plain text with **bold** markers
          );

          let voiceId: string | undefined;
          try {
            const allVoices = await storage.getAllTutorVoices();
            const tutorGender = user?.tutorGender || 'female';
            const effectiveLanguage = config.targetLanguage?.toLowerCase() || 'spanish';
            
            const matchingVoice = allVoices.find(
              (v: any) => v.language?.toLowerCase() === effectiveLanguage &&
                          v.gender?.toLowerCase() === tutorGender &&
                          v.isActive
            );
            
            if (matchingVoice?.voiceId) {
              voiceId = matchingVoice.voiceId;
            }
          } catch (err: any) {
            console.warn(`[Streaming Voice] Voice config error: ${err.message}`);
          }

          session = await orchestrator.createSession(
            ws,
            parseInt(userId!),
            config,
            systemPrompt,
            conversationHistory,
            voiceId
          );

          console.log(`[Streaming Voice] Session created: ${session.id}`);
          
          if (ws.readyState === WS.OPEN) {
            ws.send(JSON.stringify({
              type: 'session_started',
              timestamp: Date.now(),
              sessionId: session.id,
            }));
            console.log('[Streaming Voice] session_started sent');
          }
          break;
        }

        case 'audio_data': {
          if (!isAuthenticated || !session) {
            sendError(ws, 'UNKNOWN', 'Session not ready', true);
            return;
          }

          const audioMessage = message as ClientAudioDataMessage;
          let audioBuffer: Buffer;
          if (typeof audioMessage.audio === 'string') {
            audioBuffer = Buffer.from(audioMessage.audio, 'base64');
          } else {
            audioBuffer = Buffer.from(audioMessage.audio);
          }

          const metrics = await orchestrator.processUserAudio(session.id, audioBuffer, audioMessage.format || 'webm');
          
          // Save messages to database for history
          if (metrics.userTranscript && metrics.aiResponse && conversationId) {
            try {
              // Save user message
              await storage.createMessage({
                conversationId: conversationId,
                role: 'user',
                content: metrics.userTranscript,
              });
              
              // Save assistant message
              await storage.createMessage({
                conversationId: conversationId,
                role: 'assistant',
                content: metrics.aiResponse,
              });
              
              console.log('[Streaming Voice] Messages saved to database');
            } catch (err: any) {
              console.error('[Streaming Voice] Failed to save messages:', err.message);
            }
          }
          break;
        }

        case 'interrupt':
          if (session) orchestrator.handleInterrupt(session.id);
          break;

        case 'end_session':
          if (session) {
            orchestrator.endSession(session.id);
            session = null;
          }
          ws.close(1000, 'Session ended');
          break;
      }
    } catch (error: any) {
      console.error('[Streaming Voice] Message error:', error);
      sendError(ws, 'UNKNOWN', error.message, true);
    }
  });

  ws.on('close', (code, reason) => {
    console.log(`[Streaming Voice] Closed: ${code} - ${reason}`);
    if (session) orchestrator.endSession(session.id);
  });

  ws.on('error', (error) => {
    console.error('[Streaming Voice] Connection error:', error);
    if (session) orchestrator.endSession(session.id);
  });
}

/**
 * Handle realtime API WebSocket connection (placeholder - uses existing logic)
 */
async function handleRealtimeConnection(ws: WS, req: IncomingMessage) {
  console.log('[Realtime] Client connected');
  
  // Import and delegate to existing realtime handler logic
  const { handleRealtimeWebSocket } = await import('./realtime-handler');
  handleRealtimeWebSocket(ws, req);
}

/**
 * Setup unified WebSocket handler
 */
export function setupUnifiedWebSocketHandler(server: Server) {
  console.log('[Unified WS] Setting up unified WebSocket handler...');
  
  // Create a single WebSocketServer in noServer mode
  const wss = new WebSocketServer({ noServer: true });

  wss.on('error', (error) => {
    console.error('[Unified WS] Server error:', error);
  });

  // Handle upgrade requests manually
  server.on('upgrade', (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    let pathname = '';
    try {
      pathname = new URL(request.url || '', `http://${request.headers.host}`).pathname;
    } catch (e) {
      console.error('[Unified WS] Failed to parse URL:', request.url);
      socket.destroy();
      return;
    }

    console.log(`[Unified WS] Upgrade request for: ${pathname}`);

    if (pathname === STREAMING_VOICE_PATH) {
      console.log('[Unified WS] Routing to streaming voice handler');
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
        handleStreamingVoiceConnection(ws, request);
      });
    } else if (pathname === REALTIME_PATH) {
      console.log('[Unified WS] Routing to realtime handler');
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
        handleRealtimeConnection(ws, request);
      });
    } else {
      // Let other handlers (like Vite HMR) process this
      console.log(`[Unified WS] Unknown path: ${pathname} - passing through`);
    }
  });

  console.log('[Unified WS] ✓ Unified WebSocket handler ready');
  console.log('[Unified WS] - Streaming Voice: /api/voice/stream/ws');
  console.log('[Unified WS] - Realtime API: /api/realtime/ws');

  return wss;
}
