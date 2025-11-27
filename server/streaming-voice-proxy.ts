/**
 * Streaming Voice WebSocket Server
 * 
 * Handles WebSocket connections for streaming voice mode.
 * Path: /api/voice/stream/ws
 * 
 * Protocol:
 * 1. Client connects with auth cookie
 * 2. Client sends 'start_session' with config
 * 3. Client sends 'audio_data' with recorded audio
 * 4. Server streams back sentence-by-sentence audio
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
 * (Same auth pattern as realtime-proxy.ts)
 */
async function getUserIdFromSession(req: IncomingMessage): Promise<string | null> {
  try {
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) {
      console.log('[Streaming Voice Auth] No cookies in upgrade request');
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

    console.log('[Streaming Voice Auth] ✓ Authenticated WebSocket connection');
    return userId;
  } catch (error) {
    console.error('[Streaming Voice Auth] Error:', error);
    return null;
  }
}

/**
 * Setup streaming voice WebSocket server
 */
export function setupStreamingVoiceProxy(server: Server) {
  const wss = new WebSocketServer({ noServer: true });

  // Handle upgrade requests routed from routes.ts
  server.on('upgrade', (request, socket, head) => {
    const { pathname } = new URL(request.url!, `http://${request.headers.host}`);
    
    if (pathname === '/api/voice/stream/ws') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });
  
  console.log('[Streaming Voice] WebSocket server initialized on /api/voice/stream/ws');

  const orchestrator = getStreamingVoiceOrchestrator();

  wss.on('connection', async (clientWs: WS, req) => {
    console.log('[Streaming Voice] Client connected');

    let session: StreamingSession | null = null;
    let userId: string | null = null;
    let conversationId: string | null = null;
    let authComplete = false;
    const pendingMessages: Array<Buffer | string> = [];

    // Message processing function
    const processMessage = async (data: Buffer | string) => {
      try {
        // Convert to string if Buffer (WebSocket may send text as Buffer)
        const dataStr = Buffer.isBuffer(data) ? data.toString('utf8') : data;
        
        // Try to parse as JSON first - control messages are JSON
        let message: any = null;
        try {
          // Check if it looks like JSON (starts with '{')
          const trimmed = dataStr.trim();
          if (trimmed.startsWith('{')) {
            message = JSON.parse(trimmed);
          }
        } catch {
          // Not valid JSON - treat as binary audio
        }
        
        // If not JSON, treat as binary audio data
        if (!message) {
          const audioBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
          if (session) {
            console.log(`[Streaming Voice] Received ${audioBuffer.length} bytes of audio`);
            await orchestrator.processUserAudio(session.id, audioBuffer, 'webm');
          } else {
            console.warn('[Streaming Voice] Audio received but no session');
          }
          return;
        }

        // Handle JSON message
        console.log(`[Streaming Voice] Received message type: ${message.type}`);
        
        switch (message.type) {
          case 'start_session': {
            const config = message as ClientStartSessionMessage;
            
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
              .slice(-20) // Last 20 messages for context
              .map((m: { role: string; content: string }) => ({
                role: m.role as 'user' | 'model',
                content: m.content,
              }));

            // Build system prompt (matches signature in system-prompt.ts)
            const systemPrompt = createSystemPrompt(
              config.targetLanguage, // language
              config.difficultyLevel, // difficulty
              messages.length, // messageCount
              true, // isVoiceMode
              null, // topic
              [], // previousConversations
              config.nativeLanguage, // nativeLanguage
              undefined, // dueVocabulary
              undefined, // sessionVocabulary
              null, // actflLevel
              false, // isResuming
              messages.length, // totalMessageCount
              (user.tutorPersonality || 'warm') as any, // tutorPersonality
              user.tutorExpressiveness || 3, // tutorExpressiveness
            );

            // Resolve voice ID from tutor_voices table (matches REST mode behavior)
            let voiceId: string | undefined;
            try {
              const allVoices = await storage.getAllTutorVoices();
              const tutorGender = user?.tutorGender || 'female';
              const effectiveLanguage = config.targetLanguage?.toLowerCase() || 'spanish';
              
              // Find matching voice for user's language and gender preferences
              const matchingVoice = allVoices.find(
                (v: any) => v.language?.toLowerCase() === effectiveLanguage &&
                            v.gender?.toLowerCase() === tutorGender &&
                            v.isActive
              );
              
              if (matchingVoice?.voiceId) {
                voiceId = matchingVoice.voiceId;
                console.log(`[Streaming Voice] Using voice: ${matchingVoice.voiceName} (${voiceId?.substring(0, 8)}...)`);
              } else {
                // Fall back to any voice for this language
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
            break;
          }

          case 'audio_data': {
            if (!session) {
              sendError(clientWs, 'UNKNOWN', 'Session not started', true);
              return;
            }

            const audioMessage = message as ClientAudioDataMessage;
            
            // Convert base64 audio to buffer if needed
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
    };

    // Set up message listener IMMEDIATELY to capture messages during auth
    clientWs.on('message', async (data: Buffer | string) => {
      // Queue messages until auth is complete
      if (!authComplete) {
        console.log('[Streaming Voice] Queuing message during auth');
        pendingMessages.push(data);
        return;
      }
      
      await processMessage(data);
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

    // Perform authentication (async)
    try {
      userId = await getUserIdFromSession(req);
      
      if (!userId) {
        console.error('[Streaming Voice] Unauthorized connection');
        clientWs.close(4401, 'Unauthorized: Authentication required');
        return;
      }

      // Parse query params
      const url = new URL(req.url!, `http://${req.headers.host}`);
      conversationId = url.searchParams.get('conversationId');

      if (!conversationId) {
        clientWs.close(4400, 'Missing conversationId parameter');
        return;
      }

      // Auth complete - process any queued messages
      authComplete = true;
      console.log(`[Streaming Voice] Auth complete, processing ${pendingMessages.length} queued messages`);
      
      for (const msg of pendingMessages) {
        await processMessage(msg);
      }
      pendingMessages.length = 0; // Clear queue

    } catch (error: any) {
      console.error('[Streaming Voice] Connection error:', error);
      clientWs.close(4500, 'Internal server error');
    }
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
