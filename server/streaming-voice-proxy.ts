/**
 * Streaming Voice WebSocket Proxy
 * 
 * Uses the SAME pattern as realtime-proxy.ts (which works) instead of noServer mode.
 * Path: /api/voice/stream/ws
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
  ClientRequestGreetingMessage,
  StreamingErrorMessage,
} from '@shared/streaming-voice-types';
import { sessionCompassService, COMPASS_ENABLED } from './services/session-compass-service';
import { surgeryOrchestrator } from './services/collaborative-surgery-orchestrator';

/**
 * Extract userId from authenticated session cookie
 */
async function getUserIdFromSession(req: IncomingMessage): Promise<string | null> {
  try {
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) {
      console.log('[Streaming Voice Auth] No cookies in upgrade request');
      return null;
    }

    const cookies = parseCookie(cookieHeader);
    let sessionId = cookies['connect.sid'];
    
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
 * Setup streaming voice WebSocket proxy
 * Uses the same pattern as realtime-proxy.ts
 */
export function setupStreamingVoiceProxy(server: Server) {
  console.log('[Streaming Voice] Setting up WebSocket server...');
  
  // Use path option like realtime-proxy does (known working pattern)
  const wss = new WebSocketServer({
    server,
    path: '/api/voice/stream/ws'
  });

  wss.on('error', (error) => {
    console.error('[Streaming Voice] Server error:', error);
  });

  wss.on('connection', async (ws: WS, req: IncomingMessage) => {
    console.log('[Streaming Voice] Client connected');
    
    const orchestrator = getStreamingVoiceOrchestrator();
    let session: StreamingSession | null = null;
    let userId: string | null = null;
    let isAuthenticated = false;

    // Parse query params
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
      const connectedMsg = JSON.stringify({
        type: 'connected',
        timestamp: Date.now(),
      });
      console.log('[Streaming Voice] Sending connected:', connectedMsg);
      ws.send(connectedMsg);
      console.log('[Streaming Voice] Connected message sent');
    } catch (err) {
      console.error('[Streaming Voice] Error sending connected:', err);
    }

    // Handle messages
    ws.on('message', async (data: Buffer | string) => {
      console.log('[Streaming Voice] Message received, isBuffer:', Buffer.isBuffer(data));
      
      try {
        // Handle binary audio data
        if (Buffer.isBuffer(data)) {
          if (!isAuthenticated) {
            sendError(ws, 'UNAUTHORIZED', 'Not authenticated', false);
            return;
          }
          if (session) {
            console.log(`[Streaming Voice] Audio: ${data.length} bytes`);
            await orchestrator.processUserAudio(session.id, data, 'webm');
          }
          return;
        }

        // Handle JSON messages
        const message = JSON.parse(data.toString());
        console.log('[Streaming Voice] Message type:', message.type);

        switch (message.type) {
          case 'start_session': {
            const config = message as ClientStartSessionMessage;
            console.log('[Streaming Voice] Processing start_session');

            // Authenticate on first message
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

            // Initialize Daniela's Compass for time-aware tutoring
            let compassContext = null;
            if (COMPASS_ENABLED) {
              try {
                const classId = (conversation as any).classId || null;
                await sessionCompassService.initializeSession({
                  conversationId: conversationId!,
                  userId: userId!,
                  classId,
                  scheduledDurationMinutes: 30, // Default session length
                });
                compassContext = await sessionCompassService.getCompassContext(conversationId!);
                if (compassContext) {
                  console.log('[Streaming Voice] ✓ Compass initialized with time tracking');
                }
              } catch (err: any) {
                console.warn('[Streaming Voice] Compass init error:', err.message);
              }
            }

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
              }
            } catch (err: any) {
              console.warn(`[Streaming Voice] Voice config error: ${err.message}`);
            }
            
            // Check if user has founder/developer/admin role for Founder Mode
            const userRole = user?.role || 'student';
            const isFounderMode = ['founder', 'developer', 'admin'].includes(userRole);
            const founderName = isFounderMode ? (user?.firstName || 'Developer') : undefined;
            
            // Fetch editor conversation context for founder mode users
            let editorConversationContext: string | null = null;
            if (isFounderMode) {
              try {
                const { neon } = await import('@neondatabase/serverless');
                const sql = neon(process.env.DATABASE_URL!);
                
                // Get recent editor conversations with messages
                const editorConvs = await sql`
                  SELECT c.id, c.title, c.created_at
                  FROM conversations c
                  WHERE c.user_id = ${userId}
                    AND c.conversation_type = 'editor_collaboration'
                  ORDER BY c.created_at DESC
                  LIMIT 5
                `;
                
                if (editorConvs.length > 0) {
                  const contextParts: string[] = [];
                  for (const conv of editorConvs) {
                    const recentMsgs = await sql`
                      SELECT role, content, created_at
                      FROM messages
                      WHERE conversation_id = ${conv.id}
                      ORDER BY created_at DESC
                      LIMIT 3
                    `;
                    
                    if (recentMsgs.length > 0) {
                      const convDate = new Date(conv.created_at).toLocaleDateString();
                      const msgSummary = recentMsgs.reverse().map((m: any) => 
                        `  ${m.role === 'user' ? 'Founder' : 'Daniela'}: ${m.content.slice(0, 150)}${m.content.length > 150 ? '...' : ''}`
                      ).join('\n');
                      contextParts.push(`[${convDate}] ${conv.title || 'Untitled conversation'}\n${msgSummary}`);
                    }
                  }
                  
                  if (contextParts.length > 0) {
                    editorConversationContext = contextParts.join('\n\n');
                    console.log('[Streaming Voice] ✓ Loaded editor conversation context for founder mode');
                  }
                }
              } catch (err: any) {
                console.warn('[Streaming Voice] Editor context fetch error:', err.message);
              }
            }
            
            // Fetch surgery context for founder mode users
            let surgeryContext: string | null = null;
            if (isFounderMode) {
              try {
                surgeryContext = await surgeryOrchestrator.getSurgeryContextForVoice();
                if (surgeryContext) {
                  console.log('[Streaming Voice] ✓ Loaded surgery context for founder mode');
                }
              } catch (err: any) {
                console.warn('[Streaming Voice] Surgery context fetch error:', err.message);
              }
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
              true, // isStreamingVoiceMode
              null, // curriculumContext
              'flexible_goals', // tutorFreedomLevel
              null, // targetActflLevel
              compassContext, // Pass Compass context!
              isFounderMode, // isFounderMode - dynamic based on user role
              founderName, // founderName - user's first name
              false, // isRawHonestyMode
              tutorName, // Language-specific tutor name
              tutorGender, // Tutor gender for grammatical agreement
              undefined, // tutorDirectory
              undefined, // studentTimezone
              undefined, // userRole
              undefined, // sessionIntent
              editorConversationContext, // Editor conversation context for memory continuity
              surgeryContext // Surgery Theater context for active sessions
            );

            // Create session
            session = await orchestrator.createSession(
              ws,
              parseInt(userId!),
              config,
              systemPrompt,
              conversationHistory,
              voiceId
            );

            console.log(`[Streaming Voice] Session created: ${session.id}`);
            
            // Send session_started
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

            // Wrap in try/catch to prevent STT/AI errors from disconnecting the session
            // Errors like EMPTY_TRANSCRIPT are recoverable and shouldn't close the socket
            try {
              await orchestrator.processUserAudio(session.id, audioBuffer, audioMessage.format || 'webm');
            } catch (audioError: any) {
              // Log but don't disconnect - the orchestrator already sent an error message to the client
              console.error('[Streaming Voice] Audio processing error (recoverable):', audioError.message);
            }
            break;
          }

          case 'request_greeting': {
            // Generate AI-powered personalized greeting
            if (!isAuthenticated || !session) {
              sendError(ws, 'UNKNOWN', 'Session not ready for greeting', true);
              return;
            }
            
            const greetingRequest = message as ClientRequestGreetingMessage;
            console.log('[Streaming Voice] Generating AI greeting...');
            
            try {
              await orchestrator.processGreetingRequest(
                session.id, 
                greetingRequest.userName
              );
            } catch (greetingError: any) {
              console.error('[Streaming Voice] Greeting error:', greetingError.message);
              sendError(ws, 'AI_FAILED', 'Failed to generate greeting', true);
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
  });

  console.log('[Streaming Voice] ✓ WebSocket server ready on /api/voice/stream/ws');
  return wss;
}
