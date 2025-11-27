/**
 * Streaming Voice WebSocket Server
 * 
 * Handles WebSocket connections for streaming voice mode.
 * Path: /api/voice/stream/ws
 * 
 * Protocol:
 * 1. Client connects (NO AUTH during handshake - Replit proxy times out on async)
 * 2. Client sends 'start_session' with config
 * 3. Server authenticates from session cookie (deferred async)
 * 4. Client sends 'audio_data' with recorded audio
 * 5. Server streams back sentence-by-sentence audio
 * 
 * CRITICAL: Connection handler must be SYNCHRONOUS to avoid Replit proxy timeout
 */

import { WebSocketServer, WebSocket as WS } from 'ws';
import { Server } from 'http';
import type { IncomingMessage } from 'http';
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

/**
 * Extract userId from authenticated session cookie
 * DEFERRED: Called after connection is established, not during handshake
 */
async function getUserIdFromSession(req: IncomingMessage): Promise<string | null> {
  try {
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) {
      console.log('[Streaming Voice Auth] No cookies in request');
      return null;
    }

    const cookies = parseCookie(cookieHeader);
    const sessionCookieName = 'connect.sid';
    let sessionId = cookies[sessionCookieName];
    
    if (!sessionId) {
      console.log('[Streaming Voice Auth] No session cookie found');
      return null;
    }

    if (sessionId.startsWith('s:')) {
      sessionId = sessionId.slice(2);
      const unsigned = signature.unsign(sessionId, process.env.SESSION_SECRET!);
      if (unsigned === false) {
        console.log('[Streaming Voice Auth] Invalid session signature');
        return null;
      }
      sessionId = unsigned;
    }

    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(process.env.DATABASE_URL!);
    
    const sessions = await sql`
      SELECT sess FROM sessions WHERE sid = ${sessionId}
    `;
    
    if (!sessions || sessions.length === 0) {
      console.log('[Streaming Voice Auth] No session found in database');
      return null;
    }

    const sessionData = sessions[0].sess as any;
    const userId = sessionData?.passport?.user?.claims?.sub;
    
    if (!userId) {
      console.log('[Streaming Voice Auth] No user ID in session data');
      return null;
    }

    console.log('[Streaming Voice Auth] ✓ Authenticated');
    return userId;
  } catch (error) {
    console.error('[Streaming Voice Auth] Error:', error);
    return null;
  }
}

/**
 * Setup streaming voice WebSocket server
 * CRITICAL: Connection handler is SYNCHRONOUS - all async work deferred to message handlers
 */
export function setupStreamingVoiceProxy(server: Server) {
  const wss = new WebSocketServer({ 
    server,
    path: '/api/voice/stream/ws'
  });
  
  const orchestrator = getStreamingVoiceOrchestrator();

  console.log('[Streaming Voice] WebSocket server initialized on /api/voice/stream/ws');

  wss.on('error', (error) => {
    console.error('[Streaming Voice] WebSocket Server error:', error);
  });

  // CRITICAL: This handler must be SYNCHRONOUS
  // No awaits, no async operations - just set up lightweight handlers
  wss.on('connection', (clientWs: WS, req: IncomingMessage) => {
    // Log immediately - this proves connection succeeded
    console.log('[Streaming Voice] Client connected - handshake complete');

    // State stored per connection
    let session: StreamingSession | null = null;
    let userId: string | null = null;
    let isAuthenticated = false;
    
    // Store request for later auth (synchronous - just a reference)
    const savedReq = req;
    
    // Parse query params synchronously
    let conversationId: string | null = null;
    try {
      const url = new URL(req.url!, `http://${req.headers.host}`);
      conversationId = url.searchParams.get('conversationId');
    } catch (e) {
      console.error('[Streaming Voice] Failed to parse URL:', e);
    }

    // Send connected confirmation immediately
    if (clientWs.readyState === WS.OPEN) {
      clientWs.send(JSON.stringify({
        type: 'connected',
        timestamp: Date.now(),
      }));
    }

    // Handle incoming messages - async work happens here, AFTER connection
    clientWs.on('message', async (data: Buffer | string) => {
      try {
        // Check if binary (audio data)
        if (Buffer.isBuffer(data)) {
          if (!isAuthenticated) {
            sendError(clientWs, 'UNAUTHORIZED', 'Not authenticated', false);
            return;
          }
          if (session) {
            console.log(`[Streaming Voice] Received ${data.length} bytes of audio`);
            await orchestrator.processUserAudio(session.id, data, 'webm');
          } else {
            console.warn('[Streaming Voice] Audio received but no session');
          }
          return;
        }

        // Parse JSON message
        const message = JSON.parse(data.toString());
        
        switch (message.type) {
          case 'start_session': {
            const config = message as ClientStartSessionMessage;
            
            // DEFERRED AUTH: Authenticate now, after connection is established
            if (!isAuthenticated) {
              console.log('[Streaming Voice] Authenticating connection...');
              userId = await getUserIdFromSession(savedReq);
              
              if (!userId) {
                console.error('[Streaming Voice] Authentication failed');
                sendError(clientWs, 'UNAUTHORIZED', 'Authentication required', false);
                clientWs.close(4401, 'Unauthorized');
                return;
              }
              isAuthenticated = true;
              console.log('[Streaming Voice] ✓ Authentication successful');
            }

            if (!conversationId) {
              sendError(clientWs, 'INVALID_REQUEST', 'Missing conversationId', false);
              return;
            }
            
            // Fetch user data
            const user = await storage.getUser(userId!);
            if (!user) {
              sendError(clientWs, 'UNAUTHORIZED', 'User not found', false);
              return;
            }

            // Fetch conversation with message history
            const conversation = await storage.getConversation(
              conversationId!,
              userId!
            );
            
            if (!conversation) {
              sendError(clientWs, 'UNKNOWN', 'Conversation not found', false);
              return;
            }

            // Get message history
            const messages = await storage.getMessagesByConversation(conversationId!);
            const conversationHistory = messages
              .slice(-20)
              .map((m: { role: string; content: string }) => ({
                role: m.role as 'user' | 'model',
                content: m.content,
              }));

            // Build system prompt
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
            );

            // Resolve voice ID
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
                console.log(`[Streaming Voice] Using voice: ${matchingVoice.voiceName} (${voiceId?.substring(0, 8)}...)`);
              } else {
                const languageVoice = allVoices.find(
                  (v: any) => v.language?.toLowerCase() === effectiveLanguage && v.isActive
                );
                if (languageVoice?.voiceId) {
                  voiceId = languageVoice.voiceId;
                  console.log(`[Streaming Voice] Using fallback voice: ${languageVoice.voiceName}`);
                }
              }
            } catch (err: any) {
              console.warn(`[Streaming Voice] Could not fetch voice config: ${err.message}`);
            }

            // Create streaming session
            session = orchestrator.createSession(
              clientWs,
              parseInt(userId!),
              config,
              systemPrompt,
              conversationHistory,
              voiceId
            );

            console.log(`[Streaming Voice] Session started: ${session.id}`);
            
            // Confirm session started
            if (clientWs.readyState === WS.OPEN) {
              clientWs.send(JSON.stringify({
                type: 'session_started',
                timestamp: Date.now(),
                sessionId: session.id,
              }));
            }
            break;
          }

          case 'audio_data': {
            if (!isAuthenticated) {
              sendError(clientWs, 'UNAUTHORIZED', 'Not authenticated', false);
              return;
            }
            if (!session) {
              sendError(clientWs, 'UNKNOWN', 'Session not started', true);
              return;
            }

            const audioMessage = message as ClientAudioDataMessage;
            
            let audioBuffer: Buffer;
            if (typeof audioMessage.audio === 'string') {
              audioBuffer = Buffer.from(audioMessage.audio, 'base64');
            } else {
              audioBuffer = Buffer.from(audioMessage.audio);
            }

            console.log(`[Streaming Voice] Processing ${audioBuffer.length} bytes`);
            await orchestrator.processUserAudio(
              session.id,
              audioBuffer,
              audioMessage.format || 'webm'
            );
            break;
          }

          case 'interrupt': {
            if (session) {
              orchestrator.handleInterrupt(session.id);
            }
            break;
          }

          case 'end_session': {
            if (session) {
              orchestrator.endSession(session.id);
              session = null;
            }
            clientWs.close(1000, 'Session ended');
            break;
          }

          default:
            console.warn(`[Streaming Voice] Unknown message type: ${message.type}`);
        }
      } catch (error: any) {
        console.error('[Streaming Voice] Message handling error:', error);
        sendError(clientWs, 'UNKNOWN', error.message, true);
      }
    });

    // Handle connection close
    clientWs.on('close', (code, reason) => {
      console.log(`[Streaming Voice] Connection closed: ${code} - ${reason}`);
      if (session) {
        orchestrator.endSession(session.id);
      }
    });

    // Handle errors
    clientWs.on('error', (error) => {
      console.error('[Streaming Voice] WebSocket error:', error);
      if (session) {
        orchestrator.endSession(session.id);
      }
    });
  });

  return wss;
}

/**
 * Send error message to client
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
