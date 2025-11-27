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
  ClientAudioChunkMessage,
  ClientAudioEndMessage,
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
// Export the WebSocket server for unified upgrade handling
export let streamingWss: WS.Server | null = null;

export function setupStreamingVoiceProxy(server: Server) {
  console.log('[Streaming Voice] Setting up WebSocket server...');
  
  // Use noServer: true for coordinated upgrade handling with other WebSocket servers
  const wss = new WebSocketServer({ noServer: true });
  streamingWss = wss;
  
  console.log('[Streaming Voice] WebSocket server created (noServer mode)');

  const orchestrator = getStreamingVoiceOrchestrator();

  wss.on('connection', async (clientWs: WS, req) => {
    console.log('[Streaming Voice] Client connected');

    let session: StreamingSession | null = null;
    let userId: string | null = null;
    let conversationId: string | null = null;
    let isAuthenticated = false;
    
    // Buffer to hold messages that arrive before auth completes
    const messageBuffer: Array<Buffer | ArrayBuffer | Buffer[]> = [];
    
    // Process a single message (used for both buffered and live messages)
    const processMessage = async (rawData: Buffer | ArrayBuffer | Buffer[]) => {
      try {
        // Convert to Buffer if needed
        let data: Buffer;
        if (Buffer.isBuffer(rawData)) {
          data = rawData;
        } else if (rawData instanceof ArrayBuffer) {
          data = Buffer.from(rawData);
        } else if (Array.isArray(rawData)) {
          data = Buffer.concat(rawData);
        } else {
          console.error('[Streaming Voice] Unknown data type:', typeof rawData);
          return;
        }
        
        console.log(`[Streaming Voice] Raw message received: ${data.length} bytes`);
        
        // Try to detect if it's JSON (text) or binary audio
        // JSON messages will start with '{'
        const firstByte = data[0];
        const isLikelyJson = firstByte === 123; // '{' = 123 in ASCII
        
        if (!isLikelyJson) {
          // Binary audio data
          if (session) {
            console.log(`[Streaming Voice] Processing binary audio: ${data.length} bytes`);
            await orchestrator.processUserAudio(session.id, data, 'webm');
          } else {
            console.warn('[Streaming Voice] Audio received but no session');
          }
          return;
        }

        // Parse JSON message
        const messageStr = data.toString('utf8');
        console.log(`[Streaming Voice] Received JSON message: ${messageStr.substring(0, 150)}`);
        const message = JSON.parse(messageStr);
        
        switch (message.type) {
          case 'start_session': {
            console.log('[Streaming Voice] Processing start_session request...');
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

          case 'start_recording': {
            if (!session) {
              sendError(clientWs, 'UNKNOWN', 'Session not started', true);
              return;
            }
            
            console.log(`[Streaming Voice] Starting real-time recording for session: ${session.id}`);
            await orchestrator.startRecording(session.id);
            break;
          }

          case 'audio_chunk': {
            if (!session) {
              sendError(clientWs, 'UNKNOWN', 'Session not started', true);
              return;
            }

            const chunkMessage = message as ClientAudioChunkMessage;
            
            const audioBuffer = Buffer.from(chunkMessage.audio, 'base64');
            orchestrator.handleAudioChunk(session.id, audioBuffer);
            break;
          }

          case 'audio_end': {
            if (!session) {
              sendError(clientWs, 'UNKNOWN', 'Session not started', true);
              return;
            }

            const endMessage = message as ClientAudioEndMessage;
            console.log(`[Streaming Voice] Recording ended, ${endMessage.totalChunks} chunks received`);
            
            await orchestrator.handleAudioEnd(session.id);
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
    
    // CRITICAL: Register message handler IMMEDIATELY to capture messages during async auth
    // Without this, messages sent before auth completes would be lost
    clientWs.on('message', async (rawData: Buffer | ArrayBuffer | Buffer[]) => {
      if (!isAuthenticated) {
        // Buffer messages until auth completes
        console.log('[Streaming Voice] Buffering message during auth...');
        messageBuffer.push(rawData);
        return;
      }
      
      // Process message normally after auth
      await processMessage(rawData);
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

    try {
      // Authenticate connection (async, but message handler is already registered)
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

      // Mark as authenticated
      isAuthenticated = true;
      console.log('[Streaming Voice] Auth complete, processing buffered messages:', messageBuffer.length);
      
      // Process any buffered messages
      for (const bufferedData of messageBuffer) {
        await processMessage(bufferedData);
      }
      messageBuffer.length = 0; // Clear buffer

    } catch (error: any) {
      console.error('[Streaming Voice] Connection error:', error);
      clientWs.close(4500, 'Internal server error');
    }
  });

  console.log('[Streaming Voice] WebSocket server initialized on /api/streaming/ws');
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
