/**
 * Unified WebSocket Gateway
 * 
 * CRITICAL: Replit's proxy requires a single upgrade handler that runs before Vite's HMR.
 * This gateway routes all WebSocket paths to their respective handlers.
 * 
 * Paths handled:
 * - /api/voice/stream/ws - Streaming voice mode
 * - /api/realtime/ws - OpenAI Realtime API proxy (if used)
 */

import { WebSocketServer, WebSocket as WS } from 'ws';
import { Server } from 'http';
import type { IncomingMessage } from 'http';
import { Duplex } from 'stream';
import { storage } from './storage';
import { createSystemPrompt } from './system-prompt';
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

// WebSocket paths
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
    const sql = neon(process.env.NEON_SHARED_DATABASE_URL!);
    
    const sessions = await sql`
      SELECT sess FROM sessions WHERE sid = ${sessionId}
    `;
    
    if (!sessions || sessions.length === 0) return null;

    const sessionData = sessions[0].sess as any;
    return sessionData?.passport?.user?.claims?.sub || null;
  } catch (error) {
    console.error('[WS Gateway Auth] Error:', error);
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
  
  // Parse query params synchronously
  let conversationId: string | null = null;
  try {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    conversationId = url.searchParams.get('conversationId');
  } catch (e) {
    console.error('[Streaming Voice] Failed to parse URL:', e);
  }

  // Set up message handler FIRST before sending anything
  let messageHandlerReady = false;

  // Handle incoming messages
  ws.on('message', async (data: Buffer | string) => {
    console.log('[Streaming Voice] Received message, type:', typeof data, 'isBuffer:', Buffer.isBuffer(data), 'length:', Buffer.isBuffer(data) ? data.length : (data as string).length);
    try {
      if (Buffer.isBuffer(data)) {
        if (!isAuthenticated) {
          sendError(ws, 'UNAUTHORIZED', 'Not authenticated', false);
          return;
        }
        if (session) {
          console.log(`[Streaming Voice] Received ${data.length} bytes of audio`);
          // Wrap in try/catch to prevent STT/AI errors from disconnecting the session
          try {
            await orchestrator.processUserAudio(session.id, data, 'webm');
          } catch (audioError: any) {
            console.error('[Streaming Voice] Audio processing error (recoverable):', audioError.message);
          }
        }
        return;
      }

      const message = JSON.parse(data.toString());
      console.log('[Streaming Voice] Parsed message type:', message.type);
      
      switch (message.type) {
        case 'start_session': {
          console.log('[Streaming Voice] Processing start_session...');
          const config = message as ClientStartSessionMessage;
          
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
            console.log('[Streaming Voice] ✓ Authenticated');
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

          // Look up voice configuration FIRST to get language-specific tutor name
          const tutorGender = (user?.tutorGender || 'female') as 'male' | 'female';
          const effectiveLanguage = config.targetLanguage?.toLowerCase() || 'spanish';
          let voiceId: string | undefined;
          let tutorName = tutorGender === 'male' ? 'Agustin' : 'Daniela'; // Default fallback
          
          try {
            const allVoices = await storage.getAllTutorVoices();
            const matchingVoice = allVoices.find(
              (v: any) => v.language?.toLowerCase() === effectiveLanguage &&
                          v.gender?.toLowerCase() === tutorGender &&
                          v.role === 'tutor' &&  // Only main Cartesia tutors, not Google assistants
                          v.isActive
            );
            
            if (matchingVoice?.voiceId) {
              voiceId = matchingVoice.voiceId;
              // Extract tutor name from voice name (e.g., "Agustin - Clear Storyteller" -> "Agustin")
              const voiceNameParts = matchingVoice.voiceName?.split(/\s*[-–]\s*/) || [];
              if (voiceNameParts[0]?.trim()) {
                tutorName = voiceNameParts[0].trim();
              }
              console.log(`[Streaming Voice] ✓ Voice lookup: ${tutorName} (${effectiveLanguage}, ${tutorGender}) → voiceId: ${voiceId.substring(0, 8)}...`);
            } else {
              console.warn(`[Streaming Voice] ⚠️ No matching voice found for ${effectiveLanguage}/${tutorGender} - will use Cartesia default`);
            }
          } catch (err: any) {
            console.warn(`[Streaming Voice] Voice config error: ${err.message}`);
          }
          
          const systemPrompt = createSystemPrompt(
            config.targetLanguage,
            config.difficultyLevel,
            messages.length,
            true,
            null,
            [],
            config.nativeLanguage,
            undefined,
            undefined,
            null,
            false,
            messages.length,
            (user.tutorPersonality || 'warm') as any,
            user.tutorExpressiveness || 3,
            false, // isStreamingVoiceMode
            null, // curriculumContext
            'flexible_goals', // tutorFreedomLevel
            null, // targetActflLevel
            null, // compassContext
            false, // isFounderMode
            undefined, // founderName
            false, // isRawHonestyMode
            tutorName, // Language-specific tutor name
            tutorGender // Tutor gender for grammatical agreement
          );

          session = orchestrator.createSession(
            ws,
            parseInt(userId!),
            config,
            systemPrompt,
            conversationHistory,
            voiceId
          );

          console.log(`[Streaming Voice] Session started: ${session.id}`);
          
          if (ws.readyState === WS.OPEN) {
            try {
              const sessionMsg = JSON.stringify({
                type: 'session_started',
                timestamp: Date.now(),
                sessionId: session.id,
              });
              console.log('[Streaming Voice] Sending session_started:', sessionMsg);
              ws.send(sessionMsg);
              console.log('[Streaming Voice] session_started sent successfully');
            } catch (err) {
              console.error('[Streaming Voice] Error sending session_started:', err);
            }
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

          // Wrap in try/catch to prevent STT/AI errors from disconnecting the session
          try {
            await orchestrator.processUserAudio(session.id, audioBuffer, audioMessage.format || 'webm');
          } catch (audioError: any) {
            console.error('[Streaming Voice] Audio processing error (recoverable):', audioError.message);
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
      console.error('[Streaming Voice] Error:', error);
      sendError(ws, 'UNKNOWN', error.message, true);
    }
  });

  ws.on('close', (code, reason) => {
    console.log(`[Streaming Voice] Closed: ${code} - ${reason}`);
    if (session) orchestrator.endSession(session.id);
  });

  ws.on('error', (error) => {
    console.error('[Streaming Voice] Error:', error);
    if (session) orchestrator.endSession(session.id);
  });

  // Mark handler as ready and send connected confirmation
  messageHandlerReady = true;
  
  // Defer sending connected message to next tick to ensure handler is fully set up
  setImmediate(() => {
    if (ws.readyState === WS.OPEN) {
      try {
        const connectedMsg = JSON.stringify({
          type: 'connected',
          timestamp: Date.now(),
        });
        console.log('[Streaming Voice] Sending connected message (deferred):', connectedMsg);
        ws.send(connectedMsg);
        console.log('[Streaming Voice] Connected message sent successfully');
      } catch (err) {
        console.error('[Streaming Voice] Error sending connected message:', err);
      }
    } else {
      console.log('[Streaming Voice] WebSocket not open when trying to send connected, state:', ws.readyState);
    }
  });
}

/**
 * Setup unified WebSocket gateway
 * CRITICAL: Must be called BEFORE setupVite to intercept upgrades first
 */
export function setupWebSocketGateway(server: Server) {
  // Create WebSocket servers for each path (noServer mode)
  const streamingVoiceWss = new WebSocketServer({ noServer: true });

  console.log('[WS Gateway] Initializing unified WebSocket gateway');

  streamingVoiceWss.on('error', (error) => {
    console.error('[WS Gateway] Streaming Voice WSS error:', error);
  });

  // Single unified upgrade handler - MUST run before Vite's HMR
  server.on('upgrade', (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    let pathname = '';
    try {
      pathname = new URL(request.url || '', `http://${request.headers.host}`).pathname;
    } catch (e) {
      console.error('[WS Gateway] Failed to parse URL:', request.url);
      socket.destroy();
      return;
    }

    console.log(`[WS Gateway] Upgrade request: ${pathname}`);

    if (pathname === STREAMING_VOICE_PATH) {
      console.log('[WS Gateway] Routing to streaming voice handler');
      streamingVoiceWss.handleUpgrade(request, socket, head, (ws) => {
        handleStreamingVoiceConnection(ws, request);
      });
    } else if (pathname === REALTIME_PATH) {
      // Let realtime-proxy handle this if needed
      console.log('[WS Gateway] Realtime path - delegating to realtime-proxy');
      // Don't destroy socket - let other handlers process it
    } else {
      // Let Vite HMR or other handlers process this
      console.log(`[WS Gateway] Unknown path ${pathname} - passing to other handlers`);
      // Don't destroy socket - let other handlers process it
    }
  });

  console.log('[WS Gateway] ✓ Unified gateway ready');
  console.log('[WS Gateway] - Streaming Voice: /api/voice/stream/ws');

  return { streamingVoiceWss };
}
