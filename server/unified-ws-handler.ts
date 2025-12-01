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
import { generateCongratulatoryPromptAddition } from './services/competency-verifier';
import { buildCurriculumContext, detectSyllabusQuery } from './services/curriculum-context';
import { usageService } from './services/usage-service';
import { shouldRunPlacementAfterSession, completePlacementAssessment } from './services/placement-assessment-service';
import type { VoiceSession as UsageVoiceSession } from '@shared/schema';

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
  
  // Usage tracking state
  let usageSession: UsageVoiceSession | null = null;
  let exchangeCount = 0;
  let studentSpeakingSeconds = 0;
  let tutorSpeakingSeconds = 0;
  let ttsCharacters = 0;
  let sttSeconds = 0;
  
  let conversationId: string | null = null;
  let pendingVoiceUpdate: 'male' | 'female' | null = null; // Queue voice update if received before session ready
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

          // Check if user has sufficient credits before starting session
          const isDeveloper = await usageService.checkDeveloperBypass(userId!);
          if (!isDeveloper) {
            const creditCheck = await usageService.checkSufficientCredits(userId!);
            if (!creditCheck.allowed) {
              console.log(`[Streaming Voice] Insufficient credits for user ${userId}`);
              sendError(ws, 'INSUFFICIENT_CREDITS', creditCheck.message || 'Insufficient tutoring hours', false);
              
              // Send specific message for frontend to handle
              if (ws.readyState === WS.OPEN) {
                ws.send(JSON.stringify({
                  type: 'credits_exhausted',
                  timestamp: Date.now(),
                  remainingSeconds: creditCheck.remainingSeconds,
                  message: creditCheck.message,
                }));
              }
              ws.close(4402, 'Insufficient credits');
              return;
            }
            console.log(`[Streaming Voice] Credits check passed: ${Math.round(creditCheck.remainingSeconds / 60)} minutes remaining`);
          } else {
            console.log('[Streaming Voice] Developer mode - credits check bypassed');
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

          // Build curriculum context if user is enrolled in classes
          let curriculumContext = null;
          try {
            const studentName = user.firstName || 'Student';
            curriculumContext = await buildCurriculumContext(storage, userId!, studentName);
            if (curriculumContext.enrolledClasses.length > 0) {
              console.log(`[Streaming Voice] Built curriculum context for ${curriculumContext.enrolledClasses.length} classes`);
            }
          } catch (err) {
            console.warn('[Streaming Voice] Could not build curriculum context:', err);
          }

          // Determine tutor freedom/flexibility level
          // For class-assigned learning: use the class's tutorFreedomLevel
          // For self-directed learning: use the user's selfDirectedFlexibility preference
          let tutorFreedomLevel: 'guided' | 'flexible_goals' | 'open_exploration' | 'free_conversation' = 'flexible_goals';
          let targetActflLevel: string | null = null;
          
          if (conversation.classId && conversation.learningContext === 'class_assigned') {
            // Get class settings for class-assigned learning
            try {
              const classInfo = await storage.getTeacherClass(conversation.classId);
              if (classInfo?.tutorFreedomLevel) {
                tutorFreedomLevel = classInfo.tutorFreedomLevel as typeof tutorFreedomLevel;
              }
              if (classInfo?.targetActflLevel) {
                targetActflLevel = classInfo.targetActflLevel;
              }
            } catch (err) {
              console.warn('[Streaming Voice] Could not get class freedom level:', err);
            }
          } else {
            // Self-directed learning: use user's preference
            tutorFreedomLevel = (user.selfDirectedFlexibility as typeof tutorFreedomLevel) || 'flexible_goals';
          }

          // Use full system prompt with streaming voice mode flag
          // This preserves all teaching context (ACTFL, cultural guidelines, vocabulary)
          // while outputting plain text format for TTS
          let systemPrompt = createSystemPrompt(
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
            true, // isStreamingVoiceMode - outputs plain text with **bold** markers
            curriculumContext, // Add curriculum context for syllabus awareness
            tutorFreedomLevel, // Use determined flexibility level
            targetActflLevel // Target proficiency level
          );

          // Add congratulatory messaging if student is ahead of syllabus
          if (conversation.classId) {
            try {
              const congratsAddition = await generateCongratulatoryPromptAddition(userId!, conversation.classId);
              if (congratsAddition) {
                systemPrompt += '\n\n' + congratsAddition;
                console.log('[Streaming Voice] Added syllabus acknowledgment to prompt');
              }
            } catch (err) {
              console.warn('[Streaming Voice] Could not add congrats:', err);
            }
          }

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
          
          // Start usage tracking session (developers also tracked for testing/analytics)
          try {
            // Get class ID from conversation if any
            const classId = conversation.classId || undefined;
            usageSession = await usageService.startSession(
              userId!,
              conversationId!,
              config.targetLanguage,
              classId
            );
            console.log(`[Streaming Voice] Usage session started: ${usageSession.id}${isDeveloper ? ' (developer)' : ''}`);
          } catch (usageErr: any) {
            console.warn('[Streaming Voice] Could not start usage session:', usageErr.message);
          }
          
          if (ws.readyState === WS.OPEN) {
            ws.send(JSON.stringify({
              type: 'session_started',
              timestamp: Date.now(),
              sessionId: session.id,
            }));
            console.log('[Streaming Voice] session_started sent');
          }
          
          // Apply any pending voice update that was queued before session was ready
          if (pendingVoiceUpdate && session) {
            const pendingGender = pendingVoiceUpdate;
            pendingVoiceUpdate = null; // Clear the pending update immediately
            
            try {
              const allVoices = await storage.getAllTutorVoices();
              const effectiveLanguage = session.targetLanguage?.toLowerCase() || 'spanish';
              
              const matchingVoice = allVoices.find(
                (v: any) => v.language?.toLowerCase() === effectiveLanguage &&
                            v.gender?.toLowerCase() === pendingGender &&
                            v.isActive
              );
              
              if (matchingVoice?.voiceId) {
                orchestrator.updateSessionVoice(session.id, matchingVoice.voiceId);
                console.log(`[Streaming Voice] Applied pending voice update: ${pendingGender} (${matchingVoice.voiceName})`);
                
                ws.send(JSON.stringify({
                  type: 'voice_updated',
                  timestamp: Date.now(),
                  gender: pendingGender,
                  voiceName: matchingVoice.voiceName,
                }));
              } else {
                // No matching DB voice found - log and continue with default voice
                console.log(`[Streaming Voice] No matching ${pendingGender} voice found for ${effectiveLanguage}, using default voice`);
                // Still send voice_updated to acknowledge the request even if we can't switch
                ws.send(JSON.stringify({
                  type: 'voice_updated',
                  timestamp: Date.now(),
                  gender: pendingGender,
                  voiceName: `Default ${pendingGender}`,
                }));
              }
            } catch (err: any) {
              console.warn('[Streaming Voice] Could not apply pending voice update:', err.message);
              // Still acknowledge the update attempt
              ws.send(JSON.stringify({
                type: 'voice_updated',
                timestamp: Date.now(),
                gender: pendingGender,
                voiceName: `Default ${pendingGender}`,
              }));
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

          const metrics = await orchestrator.processUserAudio(session.id, audioBuffer, audioMessage.format || 'webm');
          
          // Track exchange for usage accounting
          if (metrics.userTranscript && metrics.aiResponse) {
            exchangeCount++;
            
            // Estimate speaking time from transcript length (rough: ~150 words/min = ~2.5 words/sec)
            const studentWords = metrics.userTranscript.split(/\s+/).length;
            const tutorWords = metrics.aiResponse.split(/\s+/).length;
            studentSpeakingSeconds += studentWords / 2.5;
            tutorSpeakingSeconds += tutorWords / 2.5;
            
            // Track TTS characters (for cost calculation)
            ttsCharacters += metrics.aiResponse.length;
            
            // Update usage session metrics periodically (every 5 exchanges)
            if (usageSession && exchangeCount % 5 === 0) {
              try {
                await usageService.updateSessionMetrics(usageSession.id, {
                  exchangeCount,
                  studentSpeakingSeconds: Math.round(studentSpeakingSeconds),
                  tutorSpeakingSeconds: Math.round(tutorSpeakingSeconds),
                  ttsCharacters,
                });
              } catch (updateErr: any) {
                console.warn('[Streaming Voice] Could not update session metrics:', updateErr.message);
              }
            }
          }
          
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

        case 'request_greeting': {
          // Generate AI-powered personalized greeting
          if (!isAuthenticated || !session) {
            sendError(ws, 'UNKNOWN', 'Session not ready for greeting', true);
            return;
          }
          
          const greetingRequest = message as { type: 'request_greeting'; userName?: string; isResumed?: boolean };
          console.log(`[Streaming Voice] Generating AI greeting... (resumed: ${greetingRequest.isResumed || false})`);
          
          try {
            await orchestrator.processGreetingRequest(
              session.id, 
              greetingRequest.userName,
              greetingRequest.isResumed
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

        case 'update_voice': {
          // Update voice mid-session when user changes tutor
          if (!isAuthenticated) {
            sendError(ws, 'UNAUTHORIZED', 'Not authenticated', true);
            return;
          }
          
          const updateMsg = message as { type: 'update_voice'; tutorGender?: 'male' | 'female' };
          const newGender = updateMsg.tutorGender || 'female';
          
          // If session isn't ready yet, queue the voice update for later
          if (!session) {
            pendingVoiceUpdate = newGender;
            console.log(`[Streaming Voice] Session not ready - queued voice update: ${pendingVoiceUpdate}`);
            return;
          }
          const effectiveLanguage = session.targetLanguage?.toLowerCase() || 'spanish';
          
          try {
            const allVoices = await storage.getAllTutorVoices();
            const matchingVoice = allVoices.find(
              (v: any) => v.language?.toLowerCase() === effectiveLanguage &&
                          v.gender?.toLowerCase() === newGender &&
                          v.isActive
            );
            
            if (matchingVoice?.voiceId) {
              orchestrator.updateSessionVoice(session.id, matchingVoice.voiceId);
              console.log(`[Streaming Voice] Voice updated to ${newGender}: ${matchingVoice.voiceName}`);
              
              ws.send(JSON.stringify({
                type: 'voice_updated',
                timestamp: Date.now(),
                gender: newGender,
                voiceName: matchingVoice.voiceName,
              }));
              
              // Have the new tutor introduce themselves with a brief greeting
              // Extract first name from voice name (e.g., "Daniela - Relaxed Woman" -> "Daniela")
              // Voice names can be "Name - Description" or "Language Name" format
              const voiceNameParts = matchingVoice.voiceName?.split(/\s*[-–]\s*/) || [];
              const tutorFirstName = voiceNameParts[0]?.trim() || (newGender === 'male' ? 'your new tutor' : 'your new tutor');
              console.log(`[Streaming Voice] New tutor introducing themselves: ${tutorFirstName}`);
              
              // Trigger a voice switch introduction
              await orchestrator.processVoiceSwitchIntro(session.id, tutorFirstName);
            } else {
              console.warn(`[Streaming Voice] No matching voice found for ${effectiveLanguage}/${newGender}`);
            }
          } catch (err: any) {
            console.error('[Streaming Voice] Failed to update voice:', err.message);
          }
          break;
        }

        case 'end_session':
          if (session) {
            orchestrator.endSession(session.id);
            session = null;
          }
          // End usage session and record consumption
          if (usageSession) {
            try {
              // Update final metrics
              await usageService.updateSessionMetrics(usageSession.id, {
                exchangeCount,
                studentSpeakingSeconds: Math.round(studentSpeakingSeconds),
                tutorSpeakingSeconds: Math.round(tutorSpeakingSeconds),
                ttsCharacters,
              });
              // End session (this also records consumption)
              const endedSession = await usageService.endSession(usageSession.id);
              console.log(`[Streaming Voice] Usage session ended: ${endedSession.durationSeconds}s, ${exchangeCount} exchanges`);
            } catch (endErr: any) {
              console.error('[Streaming Voice] Could not end usage session:', endErr.message);
            }
            usageSession = null;
          }
          // Check if placement assessment is needed for Level 2+ class enrollments
          if (userId && conversationId) {
            try {
              const placementCheck = await shouldRunPlacementAfterSession(userId, conversationId);
              if (placementCheck.shouldRun && placementCheck.enrollmentId) {
                console.log(`[Streaming Voice] Running placement assessment for user ${userId}`);
                const result = await completePlacementAssessment(userId, placementCheck.enrollmentId, conversationId);
                if (result) {
                  console.log(`[Streaming Voice] Placement complete: ${result.assessedLevel} (delta: ${result.delta})`);
                }
              }
            } catch (placementErr: any) {
              console.error('[Streaming Voice] Placement assessment error:', placementErr.message);
            }
          }
          ws.close(1000, 'Session ended');
          break;
      }
    } catch (error: any) {
      console.error('[Streaming Voice] Message error:', error);
      sendError(ws, 'UNKNOWN', error.message, true);
    }
  });

  // Helper to end usage session on disconnect
  const endUsageSession = async () => {
    if (usageSession) {
      try {
        await usageService.updateSessionMetrics(usageSession.id, {
          exchangeCount,
          studentSpeakingSeconds: Math.round(studentSpeakingSeconds),
          tutorSpeakingSeconds: Math.round(tutorSpeakingSeconds),
          ttsCharacters,
        });
        const endedSession = await usageService.endSession(usageSession.id);
        console.log(`[Streaming Voice] Usage session ended on disconnect: ${endedSession.durationSeconds}s, ${exchangeCount} exchanges`);
      } catch (endErr: any) {
        console.error('[Streaming Voice] Could not end usage session:', endErr.message);
      }
      usageSession = null;
    }
    // Check if placement assessment is needed for Level 2+ class enrollments
    if (userId && conversationId) {
      try {
        const placementCheck = await shouldRunPlacementAfterSession(userId, conversationId);
        if (placementCheck.shouldRun && placementCheck.enrollmentId) {
          console.log(`[Streaming Voice] Running placement assessment on disconnect for user ${userId}`);
          const result = await completePlacementAssessment(userId, placementCheck.enrollmentId, conversationId);
          if (result) {
            console.log(`[Streaming Voice] Placement complete on disconnect: ${result.assessedLevel} (delta: ${result.delta})`);
          }
        }
      } catch (placementErr: any) {
        console.error('[Streaming Voice] Placement assessment error on disconnect:', placementErr.message);
      }
    }
  };

  ws.on('close', (code, reason) => {
    console.log(`[Streaming Voice] Closed: ${code} - ${reason}`);
    if (session) orchestrator.endSession(session.id);
    endUsageSession();
  });

  ws.on('error', (error) => {
    console.error('[Streaming Voice] Connection error:', error);
    if (session) orchestrator.endSession(session.id);
    endUsageSession();
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
