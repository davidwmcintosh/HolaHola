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
import { createSystemPrompt, createStreamingVoicePrompt, TutorDirectoryEntry } from './system-prompt';
import { parse as parseCookie } from 'cookie';
import signature from 'cookie-signature';
import {
  getStreamingVoiceOrchestrator,
  StreamingSession,
} from './services/streaming-voice-orchestrator';
import {
  ClientStartSessionMessage,
  ClientAudioDataMessage,
  ClientStreamAudioChunkMessage,
  ClientDrillResultMessage,
  ClientTextInputMessage,
  StreamingErrorMessage,
  VoiceInputMode,
} from '@shared/streaming-voice-types';
import { OpenMicSession, getDeepgramLanguageCode } from './services/deepgram-live-stt';
import { generateCongratulatoryPromptAddition } from './services/competency-verifier';
import { buildCurriculumContext, detectSyllabusQuery } from './services/curriculum-context';
import { usageService } from './services/usage-service';
import { shouldRunPlacementAfterSession, completePlacementAssessment } from './services/placement-assessment-service';
import { sessionCompassService, COMPASS_ENABLED } from './services/session-compass-service';
import { architectVoiceService } from './services/architect-voice-service';
import { updateToolEventEngagement, mapWhiteboardTypeToToolType } from './services/pedagogical-insights-service';
import { buildNeuralNetworkPromptSection } from './services/neural-network-retrieval';
import type { VoiceSession as UsageVoiceSession, CompassContext, TutorSession } from '@shared/schema';

const STREAMING_VOICE_PATH = '/api/voice/stream/ws';
const REALTIME_PATH = '/api/realtime/ws';

/**
 * Convert ACTFL level to legacy difficulty level for system prompt compatibility
 * This bridges the organic ACTFL-based system with the legacy beginner/intermediate/advanced prompts
 */
function actflToDifficulty(actflLevel: string | null | undefined): 'beginner' | 'intermediate' | 'advanced' {
  if (!actflLevel) return 'beginner';
  const level = actflLevel.toLowerCase();
  
  if (level.includes('novice')) return 'beginner';
  if (level.includes('intermediate')) return 'intermediate';
  if (level.includes('advanced') || level.includes('superior') || level.includes('distinguished')) return 'advanced';
  
  return 'beginner'; // Safe default
}

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
  
  // Open mic mode state
  let openMicSession: OpenMicSession | null = null;
  let openMicPendingChunks: Buffer[] = [];  // Buffer chunks while session is starting
  let openMicSessionStarting = false;  // Prevent multiple concurrent starts
  let currentInputMode: VoiceInputMode = 'push-to-talk';
  
  // Usage tracking state
  let usageSession: UsageVoiceSession | null = null;
  let exchangeCount = 0;
  let studentSpeakingSeconds = 0;
  let tutorSpeakingSeconds = 0;
  let ttsCharacters = 0;
  let sttSeconds = 0;
  
  // Compass session state (time-aware tutoring)
  let compassSession: TutorSession | null = null;
  let compassContext: CompassContext | null = null;
  let sessionStartTime = 0;
  
  let conversationId: string | null = null;
  let pendingVoiceUpdate: 'male' | 'female' | null = null; // Queue voice update if received before session ready
  let voiceUpdateInProgress = false; // Lock to prevent end_session during voice switch intro
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

  // HEARTBEAT: Send ping every 20 seconds to keep connection alive
  // This prevents network proxies/firewalls from killing idle connections
  let isAlive = true;
  const heartbeatInterval = setInterval(() => {
    if (!isAlive) {
      console.log('[Streaming Voice] Heartbeat: No pong received, terminating connection');
      clearInterval(heartbeatInterval);
      ws.terminate();
      return;
    }
    isAlive = false;
    if (ws.readyState === WS.OPEN) {
      ws.ping();
    }
  }, 20000);

  ws.on('pong', () => {
    isAlive = true;
  });

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

          // Determine tutor freedom/flexibility level and initial difficulty
          // For class-assigned learning: use the class's settings (tutorFreedomLevel, expectedActflMin)
          // For self-directed learning: use the user's ACTFL assessment or placement result
          // IMPORTANT: derivedDifficulty starts at 'beginner' (safe default), NOT from user self-selection
          // This ensures we never fall back to arbitrary user preferences
          let tutorFreedomLevel: 'guided' | 'flexible_goals' | 'open_exploration' | 'free_conversation' = 'flexible_goals';
          let targetActflLevel: string | null = null;
          let derivedDifficulty: 'beginner' | 'intermediate' | 'advanced' = 'beginner'; // Safe default, tutor adapts
          
          if (conversation.classId && conversation.learningContext === 'class_assigned') {
            // Get class settings for class-assigned learning
            // Difficulty derived from class's expected ACTFL range, not user self-selection
            try {
              const classInfo = await storage.getTeacherClass(conversation.classId);
              if (classInfo?.tutorFreedomLevel) {
                tutorFreedomLevel = classInfo.tutorFreedomLevel as typeof tutorFreedomLevel;
              }
              if (classInfo?.targetActflLevel) {
                targetActflLevel = classInfo.targetActflLevel;
              }
              // Use class's expected starting level for initial difficulty assumption
              // This replaces user's self-selected difficulty for class contexts
              if (classInfo?.expectedActflMin) {
                derivedDifficulty = actflToDifficulty(classInfo.expectedActflMin);
                console.log(`[Streaming Voice] Class-derived difficulty: ${derivedDifficulty} (from expectedActflMin: ${classInfo.expectedActflMin})`);
              } else if (classInfo?.targetActflLevel) {
                // Fallback: use target level as starting point
                derivedDifficulty = actflToDifficulty(classInfo.targetActflLevel);
                console.log(`[Streaming Voice] Class-derived difficulty (fallback): ${derivedDifficulty} (from targetActflLevel: ${classInfo.targetActflLevel})`);
              }
            } catch (err) {
              console.warn('[Streaming Voice] Could not get class settings:', err);
              console.log(`[Streaming Voice] Using safe default difficulty: beginner (error fetching class data)`);
            }
          } else {
            // Self-directed learning: derive difficulty from ACTFL assessment, not user self-selection
            // Also use per-language flexibility preferences
            try {
              // IMPORTANT: Trust conversation.language over client's config.targetLanguage
              // This prevents stale localStorage on client from overriding the conversation's actual language
              // (e.g., after tutor handoff + page reload, client may send wrong language)
              const conversationLanguage = conversation.language?.toLowerCase() || config.targetLanguage?.toLowerCase() || 'spanish';
              const langPrefs = await storage.getLanguagePreferences(userId!, conversationLanguage);
              
              // Get ACTFL progress to derive difficulty organically
              const actflProgress = await storage.getOrCreateActflProgress(conversationLanguage, userId!);
              const actflLevel = actflProgress?.currentActflLevel;
              
              // Derive difficulty from ACTFL assessment (organic) instead of user preference (arbitrary)
              if (actflLevel) {
                derivedDifficulty = actflToDifficulty(actflLevel);
                console.log(`[Streaming Voice] ACTFL-derived difficulty: ${derivedDifficulty} (from ${actflLevel})`);
              } else {
                // No ACTFL assessment yet - default to beginner (tutor will adapt)
                derivedDifficulty = 'beginner';
                console.log(`[Streaming Voice] No ACTFL assessment - defaulting to beginner`);
              }
              
              // Determine flexibility level
              if (langPrefs?.selfDirectedFlexibility) {
                tutorFreedomLevel = langPrefs.selfDirectedFlexibility as typeof tutorFreedomLevel;
                console.log(`[Streaming Voice] Using per-language flexibility for ${conversationLanguage}: ${tutorFreedomLevel}`);
              } else if (user.selfDirectedFlexibility) {
                // Fallback to global preference (legacy support)
                tutorFreedomLevel = user.selfDirectedFlexibility as typeof tutorFreedomLevel;
                console.log(`[Streaming Voice] Using global flexibility fallback: ${tutorFreedomLevel}`);
              } else {
                // Use smart default based on ACTFL level for this language
                const level = actflLevel?.toLowerCase() || '';
                if (level.includes('novice')) {
                  tutorFreedomLevel = 'guided';
                } else if (level.includes('advanced') || level.includes('superior') || level.includes('distinguished')) {
                  tutorFreedomLevel = 'free_conversation';
                } else {
                  tutorFreedomLevel = 'flexible_goals';
                }
                console.log(`[Streaming Voice] Using smart default flexibility: ${tutorFreedomLevel} (based on ACTFL: ${actflLevel || 'none'})`);
              }
            } catch (err) {
              console.warn('[Streaming Voice] Could not get language preferences:', err);
              // Fall back to default flexibility - derivedDifficulty stays at 'beginner' (safe default)
              tutorFreedomLevel = (user.selfDirectedFlexibility as typeof tutorFreedomLevel) || 'flexible_goals';
              console.log(`[Streaming Voice] Using safe default difficulty: beginner (error fetching ACTFL data)`);
            }
          }

          // Initialize Daniela's Compass session (time-aware tutoring)
          // Gives the tutor real-time context instead of preset flexibility levels
          if (COMPASS_ENABLED) {
            try {
              sessionStartTime = Date.now();
              compassSession = await sessionCompassService.initializeSession({
                conversationId: conversationId!,
                userId: userId!,
                classId: conversation.classId || null,
                scheduledDurationMinutes: 30, // Default session length
                legacyFreedomLevel: tutorFreedomLevel,
              });
              
              if (compassSession) {
                compassContext = await sessionCompassService.getCompassContext(conversationId!);
                console.log(`[Streaming Voice] Compass session initialized: ${compassSession.id}`);
                
                // Periodic elapsed time updates (every 30 seconds)
                // Keeps Compass context fresh for API consumers and post-session analytics
                const compassTickInterval = setInterval(async () => {
                  if (compassSession && conversationId && sessionStartTime > 0) {
                    const elapsedSeconds = Math.round((Date.now() - sessionStartTime) / 1000);
                    await sessionCompassService.updateElapsedTime(conversationId, elapsedSeconds);
                  }
                }, 30000);
                
                // Store interval for cleanup
                (ws as any).__compassTickInterval = compassTickInterval;
              }
            } catch (compassErr: any) {
              console.warn('[Streaming Voice] Could not initialize Compass session:', compassErr.message);
              // Compass is optional - continue with legacy freedom levels
            }
          }

          // Use full system prompt with streaming voice mode flag
          // This preserves all teaching context (ACTFL, cultural guidelines, vocabulary)
          // while outputting plain text format for TTS
          // Note: derivedDifficulty comes from class expectedActflMin or user's ACTFL assessment
          // NOT from user's self-selected difficultyLevel preference
          // Founder Mode: Developer/admin users in non-class conversations get open collaboration mode
          // This gives Daniela full freedom to discuss HolaHola itself, teaching tools, etc.
          const isFounderMode = isDeveloper && !conversation.classId;
          
          // Raw Honesty Mode: Minimal prompting for authentic self-discovery conversations
          // Only available to founders, strips away all behavioral scripts
          const isRawHonestyMode = isFounderMode && config.rawHonestyMode === true;
          if (isRawHonestyMode) {
            console.log(`[Streaming Voice] RAW HONESTY MODE enabled for ${user.firstName || 'developer'}`);
          }
          
          let founderMemoryContext = '';
          
          if (isFounderMode) {
            console.log(`[Streaming Voice] Founder Mode enabled for ${user.firstName || 'developer'}`);
            
            // Build memory from recent founder conversations
            // This helps Daniela remember context from previous sessions
            try {
              const recentConversations = await storage.getUserConversations(userId!);
              const founderConvos = recentConversations
                .filter((c: any) => !c.classId) // Non-class conversations only
                .filter((c: any) => c.id !== conversationId) // Exclude current
                .slice(0, 3); // Last 3 conversations
              
              if (founderConvos.length > 0) {
                const memorySnippets: string[] = [];
                for (const convo of founderConvos) {
                  const convoMessages = await storage.getMessagesByConversation(convo.id);
                  const recentExchanges = convoMessages.slice(-6); // Last 3 exchanges
                  if (recentExchanges.length > 0) {
                    const date = new Date(convo.createdAt).toLocaleDateString();
                    const snippet = recentExchanges
                      .map((m: any) => `  ${m.role === 'user' ? 'Founder' : 'Daniela'}: ${m.content.slice(0, 150)}${m.content.length > 150 ? '...' : ''}`)
                      .join('\n');
                    memorySnippets.push(`[${date}]\n${snippet}`);
                  }
                }
                
                if (memorySnippets.length > 0) {
                  founderMemoryContext = `

═══════════════════════════════════════════════════════════════════
📝 MEMORY FROM RECENT CONVERSATIONS
═══════════════════════════════════════════════════════════════════

Here's context from your recent conversations together:

${memorySnippets.join('\n\n')}

Use this context naturally - you're building an ongoing relationship.
Reference past discussions when relevant, but don't force it.
`;
                  console.log(`[Streaming Voice] Built founder memory from ${memorySnippets.length} conversations`);
                }
              }
            } catch (memErr: any) {
              console.warn('[Streaming Voice] Could not build founder memory:', memErr.message);
            }
          }
          
          // In Founder Mode or Raw Honesty Mode, don't pass curriculum context
          // This prevents class enrollments from bleeding into developer conversations
          const effectiveCurriculumContext = (isFounderMode || isRawHonestyMode) ? null : curriculumContext;
          
          // Look up voice configuration FIRST to get language-specific tutor name
          const tutorGenderForPrompt = (config.tutorGender || user?.tutorGender || 'female') as 'male' | 'female';
          // IMPORTANT: Trust conversation.language over client's config.targetLanguage
          // This prevents stale localStorage on client from overriding the conversation's actual language
          // (e.g., after tutor handoff + page reload, client may send wrong language)
          const effectiveLanguage = conversation.language?.toLowerCase() || config.targetLanguage?.toLowerCase() || 'spanish';
          
          // Log a warning if client and conversation languages differ (helps debug sync issues)
          if (config.targetLanguage && conversation.language && 
              config.targetLanguage.toLowerCase() !== conversation.language.toLowerCase()) {
            console.warn(`[Streaming Voice] Language mismatch: client sent "${config.targetLanguage}" but conversation is "${conversation.language}" - using conversation language`);
          }
          let voiceId: string | undefined;
          let tutorNameForPrompt = tutorGenderForPrompt === 'male' ? 'Agustin' : 'Daniela'; // Default fallback
          let tutorDirectory: TutorDirectoryEntry[] = [];
          
          try {
            const allVoices = await storage.getAllTutorVoices();
            const matchingVoice = allVoices.find(
              (v: any) => v.language?.toLowerCase() === effectiveLanguage &&
                          v.gender?.toLowerCase() === tutorGenderForPrompt &&
                          v.isActive
            );
            
            if (matchingVoice?.voiceId) {
              voiceId = matchingVoice.voiceId;
              // Extract tutor name from voice name (e.g., "Sayuri - Peppy Colleague" -> "Sayuri")
              const voiceNameParts = matchingVoice.voiceName?.split(/\s*[-–]\s*/) || [];
              if (voiceNameParts[0]?.trim()) {
                tutorNameForPrompt = voiceNameParts[0].trim();
                console.log(`[Streaming Voice] Using language-specific tutor: ${tutorNameForPrompt} (${effectiveLanguage})`);
              }
            }
            
            // Build dynamic tutor directory from all active voices
            // This gives Daniela knowledge of who she can hand off to by name
            const studentPreferredGender = (user?.tutorGender || 'female') as 'male' | 'female';
            
            tutorDirectory = allVoices
              .filter((v: any) => v.isActive && v.voiceName)
              .map((v: any) => {
                const voiceNameParts = v.voiceName?.split(/\s*[-–]\s*/) || [];
                const tutorName = voiceNameParts[0]?.trim() || 'Tutor';
                const lang = v.language?.toLowerCase() || 'spanish';
                const gender = (v.gender?.toLowerCase() || 'female') as 'male' | 'female';
                
                // Mark current tutor (current language + current gender)
                const isCurrent = lang === effectiveLanguage && gender === tutorGenderForPrompt;
                
                // Mark preferred: student's gender preference for EACH language
                // This marks the voice they'd want if switching to that language
                const isPreferred = gender === studentPreferredGender;
                
                return {
                  language: lang,
                  gender,
                  name: tutorName,
                  isCurrent,
                  isPreferred: !isCurrent && isPreferred, // Don't mark current as preferred
                };
              });
              
            console.log(`[Streaming Voice] Built tutor directory with ${tutorDirectory.length} tutors`);
          } catch (err: any) {
            console.warn(`[Streaming Voice] Voice config error: ${err.message}`);
          }
          
          let systemPrompt = createSystemPrompt(
            config.targetLanguage,
            derivedDifficulty, // Use organically-derived difficulty, not user self-selection
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
            effectiveCurriculumContext, // Skip curriculum in special modes
            tutorFreedomLevel, // Use determined flexibility level
            targetActflLevel, // Target proficiency level
            compassContext, // Daniela's Compass context (time-aware tutoring)
            isFounderMode, // Founder Mode for developer conversations
            user.firstName || undefined, // Founder name for personalization
            isRawHonestyMode, // Raw Honesty Mode - minimal prompting
            tutorNameForPrompt, // Tutor name (Daniela or Agustin)
            tutorGenderForPrompt, // Tutor gender for grammatical agreement
            tutorDirectory, // Dynamic tutor directory for handoffs
            user.timezone // Student timezone for time-aware greetings
          );

          // Add founder memory context if in Founder Mode
          if (isFounderMode && founderMemoryContext) {
            systemPrompt += founderMemoryContext;
          }
          
          // Add Neural Network pedagogical knowledge (idioms, cultural nuances, error patterns)
          try {
            const neuralNetworkContext = await buildNeuralNetworkPromptSection(
              effectiveLanguage,
              config.nativeLanguage || 'english'
            );
            if (neuralNetworkContext) {
              systemPrompt += neuralNetworkContext;
              console.log(`[Streaming Voice] Added neural network context for ${effectiveLanguage}`);
            }
          } catch (nnErr: any) {
            console.warn('[Streaming Voice] Could not build neural network context:', nnErr.message);
          }

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

          // Build additional context for personalized greetings
          // This gives Daniela critical information about what the student wants to work on
          const additionalGreetingContext = {
            conversationTopic: conversation.topic || undefined,
            conversationTitle: conversation.title || undefined,
            lastSessionSummary: compassContext?.lastSessionSummary || undefined,
            studentGoals: compassContext?.studentGoals || undefined,
          };

          session = await orchestrator.createSession(
            ws,
            parseInt(userId!),
            config,
            systemPrompt,
            conversationHistory,
            voiceId,
            isFounderMode,  // Pass Founder Mode flag for multi-language STT
            isRawHonestyMode,  // Pass Raw Honesty Mode flag for minimal prompting
            additionalGreetingContext  // Additional context for personalized greetings
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
              conversationId: conversationId, // Exposed for Architect's Voice integration
              isFounderMode: isFounderMode, // Flag for UI to show founder mode indicator
              isRawHonestyMode: isRawHonestyMode, // Flag for raw honesty mode indicator
            }));
            console.log(`[Streaming Voice] session_started sent (conversation: ${conversationId}${isRawHonestyMode ? ', RAW HONESTY MODE' : isFounderMode ? ', FOUNDER MODE' : ''})`);
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

        case 'set_input_mode': {
          const modeMessage = message as { type: 'set_input_mode'; inputMode: VoiceInputMode };
          currentInputMode = modeMessage.inputMode;
          console.log(`[Streaming Voice] Input mode changed to: ${currentInputMode}`);
          
          // Close existing open mic session if switching to push-to-talk
          if (currentInputMode === 'push-to-talk' && openMicSession) {
            openMicSession.close();
            openMicSession = null;
            openMicPendingChunks = [];
            openMicSessionStarting = false;
          }
          
          ws.send(JSON.stringify({
            type: 'input_mode_changed',
            timestamp: Date.now(),
            inputMode: currentInputMode,
          }));
          break;
        }

        case 'drill_result': {
          // PEDAGOGICAL TRACKING: Record drill completion for effectiveness analysis
          const drillMessage = message as ClientDrillResultMessage;
          console.log(`[Pedagogical] Drill result: ${drillMessage.drillType} - ${drillMessage.isCorrect ? 'correct' : 'incorrect'} (${drillMessage.responseTimeMs}ms)`);
          
          // Update the tool event with engagement data
          // Note: We use drillId as eventId since drills are tracked individually
          updateToolEventEngagement(drillMessage.drillId, {
            studentResponseTime: drillMessage.responseTimeMs,
            drillResult: drillMessage.isCorrect ? 'correct' : 'incorrect',
            durationMs: drillMessage.responseTimeMs,
          });
          break;
        }

        case 'text_input': {
          // TEXT_INPUT WHITEBOARD TOOL: Process student's typed response
          if (!isAuthenticated || !session) {
            sendError(ws, 'UNKNOWN', 'Session not ready for text input', true);
            return;
          }
          
          const textInputMessage = message as ClientTextInputMessage;
          console.log(`[TEXT_INPUT] Student submitted response: "${textInputMessage.response.substring(0, 50)}${textInputMessage.response.length > 50 ? '...' : ''}"`);
          
          try {
            // Update the tool event with engagement data
            updateToolEventEngagement(textInputMessage.itemId, {
              durationMs: Date.now() - (session.lastActivityTime || Date.now()),
            });
            
            // Process the text input as if it were a transcript - Daniela will respond
            await orchestrator.processOpenMicTranscript(
              session.id,
              `[Student written response]: ${textInputMessage.response}`,
              1.0 // High confidence since it's typed
            );
          } catch (err: any) {
            console.error('[TEXT_INPUT] Error processing text input:', err);
            sendError(ws, 'AI_FAILED', 'Failed to process text input', true);
          }
          break;
        }

        case 'stream_audio_chunk': {
          if (!isAuthenticated || !session) {
            sendError(ws, 'UNKNOWN', 'Session not ready for streaming', true);
            return;
          }
          
          if (currentInputMode !== 'open-mic') {
            console.warn('[Streaming Voice] Received stream_audio_chunk but not in open-mic mode');
            return;
          }
          
          const chunkMessage = message as ClientStreamAudioChunkMessage;
          let audioBuffer: Buffer;
          if (typeof chunkMessage.audio === 'string') {
            audioBuffer = Buffer.from(chunkMessage.audio, 'base64');
          } else {
            audioBuffer = Buffer.from(chunkMessage.audio);
          }
          
          // If session exists and is ready, send directly (raw PCM - no headers needed)
          if (openMicSession) {
            openMicSession.sendAudio(audioBuffer);
            break;
          }
          
          // Buffer this chunk while session is starting
          openMicPendingChunks.push(audioBuffer);
          
          // If already starting, just buffer and wait
          if (openMicSessionStarting) {
            break;
          }
          
          // Start new session
          openMicSessionStarting = true;
          const languageCode = getDeepgramLanguageCode(session.targetLanguage || 'spanish');
          console.log(`[OpenMic] Starting PCM session for language: ${languageCode}`);
          
          const newSession = new OpenMicSession(languageCode, {
            onSpeechStarted: () => {
              console.log('[OpenMic] VAD: Speech started');
              if (ws.readyState === WS.OPEN) {
                ws.send(JSON.stringify({
                  type: 'vad_speech_started',
                  timestamp: Date.now(),
                }));
              }
            },
            onUtteranceEnd: async (transcript, confidence) => {
              console.log(`[OpenMic] VAD: Utterance end - "${transcript}" (${(confidence * 100).toFixed(0)}%)`);
              
              if (ws.readyState === WS.OPEN) {
                ws.send(JSON.stringify({
                  type: 'vad_utterance_end',
                  timestamp: Date.now(),
                }));
              }
              
              if (transcript.trim() && session) {
                try {
                  await orchestrator.processOpenMicTranscript(
                    session.id,
                    transcript,
                    confidence
                  );
                } catch (err: any) {
                  console.error('[OpenMic] Error processing utterance:', err);
                  sendError(ws, 'AI_FAILED', 'Failed to process speech', true);
                }
              }
            },
            onInterimTranscript: (transcript) => {
              if (ws.readyState === WS.OPEN) {
                ws.send(JSON.stringify({
                  type: 'interim_transcript',
                  timestamp: Date.now(),
                  text: transcript,
                }));
              }
            },
            onError: (error) => {
              console.error('[OpenMic] Session error:', error);
              sendError(ws, 'STT_FAILED', error.message, true);
            },
            onClose: () => {
              console.log('[OpenMic] Session closed');
              openMicSession = null;
              
              // Notify client that open mic session closed (so it can restart if needed)
              if (ws.readyState === WS.OPEN) {
                ws.send(JSON.stringify({
                  type: 'open_mic_session_closed',
                  timestamp: Date.now(),
                }));
              }
            },
          });
          
          try {
            await newSession.start();
            openMicSession = newSession;
            openMicSessionStarting = false;
            console.log('[OpenMic] Session started successfully');
            
            // Send all buffered PCM chunks (no header needed for raw PCM)
            if (openMicPendingChunks.length > 0) {
              console.log(`[OpenMic] Sending ${openMicPendingChunks.length} buffered PCM chunks`);
              for (const chunk of openMicPendingChunks) {
                openMicSession.sendAudio(chunk);
              }
              openMicPendingChunks = [];
            }
          } catch (err: any) {
            console.error('[OpenMic] Failed to start session:', err);
            sendError(ws, 'STT_FAILED', 'Failed to start open mic session', true);
            openMicSession = null;
            openMicSessionStarting = false;
            openMicPendingChunks = [];
          }
          break;
        }

        case 'stop_streaming': {
          console.log('[Streaming Voice] Stop streaming received');
          if (openMicSession) {
            openMicSession.close();
            openMicSession = null;
          }
          openMicPendingChunks = [];
          openMicSessionStarting = false;
          break;
        }

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
          
          // LOCK: Prevent end_session from killing the session while intro is generating
          voiceUpdateInProgress = true;
          console.log(`[Streaming Voice] Voice update started - session protected from early termination`);
          
          // Capture session info before any async operations to avoid race conditions
          const capturedSessionId = session.id;
          const capturedSession = session; // Keep reference even if end_session tries to null it
          const effectiveLanguage = session.targetLanguage?.toLowerCase() || 'spanish';
          
          try {
            const allVoices = await storage.getAllTutorVoices();
            
            const matchingVoice = allVoices.find(
              (v: any) => v.language?.toLowerCase() === effectiveLanguage &&
                          v.gender?.toLowerCase() === newGender &&
                          v.isActive
            );
            
            if (matchingVoice?.voiceId) {
              // Update the voice in orchestrator FIRST
              orchestrator.updateSessionVoice(capturedSessionId, matchingVoice.voiceId);
              console.log(`[Streaming Voice] Voice updated to ${newGender}: ${matchingVoice.voiceName}`);
              
              // For cross-language handoffs, the session is still active and ready
              // System prompt was already regenerated with new tutor persona
              // Voice was already updated - so we CAN call processVoiceSwitchIntro now!
              if (capturedSession && (capturedSession as any).isLanguageSwitchHandoff) {
                console.log(`[Streaming Voice] Cross-language handoff - new tutor will introduce themselves now`);
                // Clear the flag since we're handling it
                (capturedSession as any).isLanguageSwitchHandoff = false;
              }
              
              // CRITICAL: Generate intro BEFORE sending voice_updated to client
              // If we send voice_updated first, client disconnects before intro audio arrives!
              // The new tutor must finish speaking before we tell the client the switch is complete.
              const voiceNameParts = matchingVoice.voiceName?.split(/\s*[-–]\s*/) || [];
              const tutorFirstName = voiceNameParts[0]?.trim() || (newGender === 'male' ? 'your new tutor' : 'your new tutor');
              console.log(`[Streaming Voice] New tutor introducing themselves: ${tutorFirstName} (${newGender})`);
              
              // WAIT for intro to complete - this streams audio to client while connection is still open
              await orchestrator.processVoiceSwitchIntro(capturedSessionId, tutorFirstName, newGender);
              
              // NOW send voice_updated - client can safely disconnect after hearing the intro
              ws.send(JSON.stringify({
                type: 'voice_updated',
                timestamp: Date.now(),
                gender: newGender,
                voiceName: matchingVoice.voiceName,
              }));
            } else {
              console.warn(`[Streaming Voice] No matching voice found for ${effectiveLanguage}/${newGender}`);
            }
          } catch (err: any) {
            console.error('[Streaming Voice] Failed to update voice:', err.message);
          } finally {
            // UNLOCK: Allow end_session to proceed now that intro is complete
            voiceUpdateInProgress = false;
            console.log(`[Streaming Voice] Voice update complete - session protection released`);
          }
          break;
        }

        case 'end_session':
          // If voice update is in progress, wait for it to complete before ending session
          // This prevents killing the session while the new tutor is introducing themselves
          if (voiceUpdateInProgress) {
            console.log(`[Streaming Voice] end_session received but voice update in progress - waiting...`);
            // Wait up to 15 seconds for voice update to complete
            const maxWait = 15000;
            const checkInterval = 100;
            let waited = 0;
            while (voiceUpdateInProgress && waited < maxWait) {
              await new Promise(resolve => setTimeout(resolve, checkInterval));
              waited += checkInterval;
            }
            if (voiceUpdateInProgress) {
              console.warn(`[Streaming Voice] Timeout waiting for voice update - proceeding with end_session`);
            } else {
              console.log(`[Streaming Voice] Voice update completed after ${waited}ms - proceeding with end_session`);
            }
          }
          
          if (session) {
            orchestrator.endSession(session.id);
            session = null;
          }
          
          // Clear Compass tick interval
          if ((ws as any).__compassTickInterval) {
            clearInterval((ws as any).__compassTickInterval);
            (ws as any).__compassTickInterval = null;
          }
          
          // End Compass session (time-aware tutoring)
          if (compassSession && conversationId) {
            try {
              const elapsedSeconds = sessionStartTime > 0 
                ? Math.round((Date.now() - sessionStartTime) / 1000) 
                : 0;
              await sessionCompassService.updateElapsedTime(conversationId, elapsedSeconds);
              
              // Generate session summary for Daniela's memory
              const sessionSummary = await sessionCompassService.generateSessionSummary(conversationId);
              await sessionCompassService.endSession(conversationId, sessionSummary || undefined);
              console.log(`[Streaming Voice] Compass session ended: ${Math.round(elapsedSeconds / 60)}min`);
            } catch (compassErr: any) {
              console.warn('[Streaming Voice] Could not end Compass session:', compassErr.message);
            }
            compassSession = null;
            compassContext = null;
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
    // Clear Compass tick interval
    if ((ws as any).__compassTickInterval) {
      clearInterval((ws as any).__compassTickInterval);
      (ws as any).__compassTickInterval = null;
    }
    
    // End Compass session on disconnect
    if (compassSession && conversationId) {
      try {
        const elapsedSeconds = sessionStartTime > 0 
          ? Math.round((Date.now() - sessionStartTime) / 1000) 
          : 0;
        await sessionCompassService.updateElapsedTime(conversationId, elapsedSeconds);
        
        // Generate session summary for Daniela's memory
        const sessionSummary = await sessionCompassService.generateSessionSummary(conversationId);
        await sessionCompassService.endSession(conversationId, sessionSummary || undefined);
        console.log(`[Streaming Voice] Compass session ended on disconnect: ${Math.round(elapsedSeconds / 60)}min`);
      } catch (compassErr: any) {
        console.warn('[Streaming Voice] Could not end Compass session on disconnect:', compassErr.message);
      }
      compassSession = null;
      compassContext = null;
    }
    
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
    clearInterval(heartbeatInterval);  // Clean up heartbeat
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
