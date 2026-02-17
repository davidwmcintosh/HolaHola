/**
 * Unified WebSocket Handler
 * 
 * Single point of handling for ALL WebSocket connections.
 * This prevents conflicts between multiple WebSocketServers.
 * 
 * Paths handled:
 * - /api/voice/stream/ws - Streaming voice mode (via Socket.io)
 * - /api/realtime/ws - OpenAI Realtime API proxy
 * 
 * Socket.io Migration:
 * - Uses Socket.io for voice streaming (handles Replit proxy negotiation)
 * - SocketIOWebSocketAdapter provides ws-compatible API for existing handlers
 */

import { WebSocketServer, WebSocket as WS } from 'ws';
import { Server as SocketIOServer, Socket as SocketIOSocket } from 'socket.io';
import { Server } from 'http';
import type { IncomingMessage } from 'http';
import { Duplex } from 'stream';
import { storage } from './storage';
import { createSystemPrompt, createStreamingVoicePrompt, TutorDirectoryEntry, UserRole, SessionIntent, buildPedagogicalPersonaSection, buildCompassContextBlock, buildTimezoneContext } from './system-prompt';
import { buildNativeFunctionCallingSection } from './services/procedural-memory-retrieval';
import { PedagogicalPersona } from '@shared/tutor-orchestration-types';
import { parse as parseCookie } from 'cookie';
import signature from 'cookie-signature';
import {
  getStreamingVoiceOrchestrator,
  StreamingSession,
  StreamingMetrics,
} from './services/streaming-voice-orchestrator';
import {
  ClientStartSessionMessage,
  ClientAudioDataMessage,
  ClientStreamAudioChunkMessage,
  ClientDrillResultMessage,
  ClientTextInputMessage,
  StreamingErrorMessage,
  VoiceInputMode,
  ClientTelemetryEvent,
} from '@shared/streaming-voice-types';
import { OpenMicSession, getDeepgramLanguageCode } from './services/deepgram-live-stt';
import { generateCongratulatoryPromptAddition } from './services/competency-verifier';
import { buildCurriculumContext, detectSyllabusQuery } from './services/curriculum-context';
import { usageService } from './services/usage-service';
import { shouldRunPlacementAfterSession, completePlacementAssessment } from './services/placement-assessment-service';
import { sessionCompassService, COMPASS_ENABLED } from './services/session-compass-service';
import { architectVoiceService } from './services/architect-voice-service';
import { voiceTelemetry } from './services/voice-pipeline-telemetry';
import { updateToolEventEngagement, mapWhiteboardTypeToToolType } from './services/pedagogical-insights-service';
import { buildNeuralNetworkPromptSection } from './services/neural-network-retrieval';
import { getPredictiveTeachingContext, getStudentSnapshotData, type PredictiveTeachingContext, type StudentSnapshotContext } from './services/procedural-memory-retrieval';
import { studentLearningService } from './services/student-learning-service';
import { voiceDiagnostics } from './services/voice-diagnostics-service';
import type { VoiceSession as UsageVoiceSession, CompassContext, TutorSession } from '@shared/schema';

// Use /api/ paths - Replit's proxy properly routes these
const STREAMING_VOICE_PATH = '/api/voice/stream/ws';
const REALTIME_PATH = '/api/realtime/ws';

/**
 * Promise timeout utility - prevents indefinite hangs on DB queries or service calls.
 * Returns fallback value if the promise doesn't resolve within the timeout.
 */
function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
  fallback: T
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => {
      setTimeout(() => {
        console.warn(`[SessionInit] ⚠ ${label} timed out after ${timeoutMs}ms — using fallback`);
        resolve(fallback);
      }, timeoutMs);
    }),
  ]);
}

/**
 * Track active Socket.io connections per conversationId to prevent duplicates.
 * When a new connection arrives for an already-active conversation, the old one is closed.
 */
const activeVoiceConnections = new Map<string, SocketIOWebSocketAdapter>();

/**
 * Normalize language keys for consistent comparison
 * Handles variations like "mandarin" vs "mandarin chinese"
 */
function normalizeLanguageKey(lang: string): string {
  const lower = lang.toLowerCase().trim();
  if (lower === 'mandarin' || lower === 'mandarin chinese' || lower === 'chinese') {
    return 'mandarin chinese';
  }
  return lower;
}

/**
 * Socket.io to ws-compatible adapter
 * Allows existing handleStreamingVoiceConnection to work with Socket.io
 */
class SocketIOWebSocketAdapter {
  static OPEN = 1;
  static CLOSED = 3;
  
  private socket: SocketIOSocket;
  private messageHandlers: Array<(data: Buffer | string) => void> = [];
  private closeHandlers: Array<() => void> = [];
  private errorHandlers: Array<(error: Error) => void> = [];
  private pongHandlers: Array<() => void> = [];
  private _conversationId: string | null = null;
  
  constructor(socket: SocketIOSocket, conversationId: string | null) {
    this.socket = socket;
    this._conversationId = conversationId;
    
    // Forward Socket.io events to ws-style handlers
    socket.on('message', (data: any) => {
      // Handle both JSON and binary data
      const buffer = Buffer.isBuffer(data) ? data : Buffer.from(JSON.stringify(data));
      this.messageHandlers.forEach(h => h(data));
    });
    
    socket.on('binary', (data: Buffer) => {
      this.messageHandlers.forEach(h => h(data));
    });
    
    socket.on('disconnect', () => {
      this.closeHandlers.forEach(h => h());
    });
    
    socket.on('error', (err: Error) => {
      this.errorHandlers.forEach(h => h(err));
    });
    
    // Socket.io handles pings internally, but we can emit pong for compatibility
    socket.on('ping', () => {
      this.pongHandlers.forEach(h => h());
    });
  }
  
  get readyState(): number {
    return this.socket.connected ? SocketIOWebSocketAdapter.OPEN : SocketIOWebSocketAdapter.CLOSED;
  }
  
  get socketId(): string {
    return this.socket.id;
  }
  
  get conversationId(): string | null {
    return this._conversationId;
  }
  
  send(data: string | Buffer): void {
    if (this.socket.connected) {
      if (Buffer.isBuffer(data)) {
        this.socket.emit('binary', data);
      } else {
        // Parse JSON string to object - Socket.io will serialize it properly
        // This prevents double-stringification where client receives a string instead of object
        try {
          const parsed = JSON.parse(data);
          
          // PROXY SAFE DELIVERY: Replit proxy silently drops large Socket.io messages
          // Strategy: Split any message with >50KB of audio into smaller deliverable parts
          
          // SENTENCE_READY FIX: sentence_ready contains embedded firstAudioChunk.audio
          // which can exceed proxy limits, causing the message to be silently dropped.
          // Fix: Strip audio from sentence_ready and send it as a separate audio_chunk.
          // Client handles sentence_ready with or without embedded audio.
          if (parsed.type === 'sentence_ready' && parsed.firstAudioChunk?.audio && parsed.firstAudioChunk.audio.length > 30000) {
            const audioData = parsed.firstAudioChunk.audio;
            const audioMeta = { ...parsed.firstAudioChunk };
            
            console.log(`[SOCKET EMIT] sentence_ready: SPLITTING (audio=${audioData.length} chars) - sending timings first, then audio_chunk`);
            
            // 1. Send sentence_ready WITHOUT audio (lightweight control message with timings)
            const lightweightReady = {
              ...parsed,
              firstAudioChunk: {
                ...audioMeta,
                audio: '',  // Strip audio - it will arrive as separate audio_chunk
                audioStripped: true,  // Signal to client that audio comes separately
              },
            };
            this.socket.emit('message', lightweightReady);
            
            // 2. Send the audio as a regular audio_chunk (goes through chunking if needed)
            const audioChunkMsg = {
              type: 'audio_chunk',
              timestamp: parsed.timestamp,
              turnId: parsed.turnId,
              sentenceIndex: parsed.sentenceIndex,
              chunkIndex: audioMeta.chunkIndex ?? 0,
              isLast: false,
              durationMs: audioMeta.durationMs,
              audio: audioData,
              audioFormat: audioMeta.audioFormat || 'pcm_f32le',
              sampleRate: audioMeta.sampleRate || 24000,
            };
            
            // Apply chunking to the extracted audio if needed
            if (audioData.length > 50000) {
              const CHUNK_SIZE = 50000;
              const totalChunks = Math.ceil(audioData.length / CHUNK_SIZE);
              for (let i = 0; i < totalChunks; i++) {
                const start = i * CHUNK_SIZE;
                const end = Math.min(start + CHUNK_SIZE, audioData.length);
                this.socket.emit('message', {
                  type: 'audio_chunk_part',
                  sentenceIndex: parsed.sentenceIndex,
                  chunkIndex: audioMeta.chunkIndex ?? 0,
                  partIndex: i,
                  totalParts: totalChunks,
                  audio: audioData.slice(start, end),
                  ...(i === 0 ? {
                    timestamp: parsed.timestamp,
                    turnId: parsed.turnId,
                    durationMs: audioMeta.durationMs,
                    audioFormat: audioMeta.audioFormat || 'pcm_f32le',
                    sampleRate: audioMeta.sampleRate || 24000,
                    isLast: false,
                  } : {}),
                  isFinalPart: i === totalChunks - 1,
                });
              }
            } else {
              this.socket.emit('message', audioChunkMsg);
            }
          }
          // CHUNKING: Large audio_chunk messages get dropped by Replit proxy
          // Split into smaller chunks (64KB base64 = ~48KB raw) for reliable delivery
          else if (parsed.type === 'audio_chunk' && parsed.audio && parsed.audio.length > 50000) {
            const CHUNK_SIZE = 50000; // 50KB chunks of base64
            const totalChunks = Math.ceil(parsed.audio.length / CHUNK_SIZE);
            console.log(`[SOCKET EMIT] audio_chunk: CHUNKING ${parsed.audio.length} bytes into ${totalChunks} chunks`);
            
            for (let i = 0; i < totalChunks; i++) {
              const start = i * CHUNK_SIZE;
              const end = Math.min(start + CHUNK_SIZE, parsed.audio.length);
              const chunkData = parsed.audio.slice(start, end);
              
              const chunkMsg = {
                type: 'audio_chunk_part',
                sentenceIndex: parsed.sentenceIndex,
                chunkIndex: parsed.chunkIndex,
                partIndex: i,
                totalParts: totalChunks,
                audio: chunkData,
                // Include full metadata only in first chunk
                ...(i === 0 ? {
                  timestamp: parsed.timestamp,
                  turnId: parsed.turnId,
                  durationMs: parsed.durationMs,
                  audioFormat: parsed.audioFormat,
                  sampleRate: parsed.sampleRate,
                  isLast: parsed.isLast,
                } : {}),
                // Mark final part
                isFinalPart: i === totalChunks - 1,
              };
              
              this.socket.emit('message', chunkMsg);
            }
          } else {
            if (parsed.type === 'audio_chunk' || parsed.type === 'word_timing' || parsed.type === 'sentence_ready') {
              console.log(`[SOCKET EMIT] ${parsed.type}: connected=${this.socket.connected}, dataLen=${data.length}`);
            }
            if (parsed.type === 'processing' || parsed.type === 'processing_pending' || parsed.type === 'feedback') {
              console.log(`[SOCKET EMIT CONTROL] Emitting '${parsed.type}' via socket.emit('message'): connected=${this.socket.connected}, socketId=${this.socket.id}`);
            }
            // Emit parsed object, not string - Socket.io handles serialization
            this.socket.emit('message', parsed);
            if (parsed.type === 'processing' || parsed.type === 'processing_pending') {
              console.log(`[SOCKET EMIT CONTROL] ✓ socket.emit('message', ${parsed.type}) completed`);
            }
          }
        } catch (e) {
          // Fallback: emit as-is if not valid JSON
          this.socket.emit('message', data);
        }
      }
    } else {
      // Debug: log when socket is not connected
      try {
        const parsed = JSON.parse(data.toString());
        if (parsed.type === 'audio_chunk' || parsed.type === 'word_timing') {
          console.log(`[SOCKET EMIT] SKIPPED ${parsed.type}: socket not connected`);
        }
      } catch (e) {}
    }
  }
  
  close(code?: number, reason?: string): void {
    this.socket.disconnect(true);
  }
  
  terminate(): void {
    this.socket.disconnect(true);
  }
  
  ping(): void {
    // Socket.io handles keep-alive internally
    // But we can emit a ping event for custom handling
    if (this.socket.connected) {
      this.socket.emit('ping');
    }
  }
  
  on(event: 'message' | 'close' | 'error' | 'pong', handler: (...args: any[]) => void): void {
    switch (event) {
      case 'message':
        this.messageHandlers.push(handler as (data: Buffer | string) => void);
        break;
      case 'close':
        this.closeHandlers.push(handler as () => void);
        break;
      case 'error':
        this.errorHandlers.push(handler as (error: Error) => void);
        break;
      case 'pong':
        this.pongHandlers.push(handler as () => void);
        break;
    }
  }
}

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
    const sql = neon(process.env.NEON_SHARED_DATABASE_URL!);
    
    const sessions = await sql`
      SELECT sess FROM sessions WHERE sid = ${sessionId}
    `;
    
    if (!sessions || sessions.length === 0) return null;

    const sessionData = sessions[0].sess as any;
    
    // Check password auth first (stores userId directly in session)
    if (sessionData?.userId) {
      console.log('[WS Auth] Authenticated via password session');
      return sessionData.userId;
    }
    
    // Fall back to Replit Auth / OIDC (stores in passport.user.claims.sub)
    const oidcSub = sessionData?.passport?.user?.claims?.sub;
    if (oidcSub) {
      console.log('[WS Auth] Authenticated via OIDC/Replit Auth');
    }
    return oidcSub || null;
  } catch (error) {
    console.error('[WS Auth] Error:', error);
    return null;
  }
}

/**
 * Track pending handoff intros - when a cross-language switch happens,
 * the old WebSocket closes before the intro can be delivered.
 * The new session picks this up and delivers the intro on the fresh connection.
 */
const pendingHandoffIntros = new Map<string, { tutorName: string; gender: 'male' | 'female'; language: string; timestamp: number }>();

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
  
  // Generate unique connection ID for telemetry correlation
  const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  let telemetrySessionId = connectionId;
  let telemetryUserId = 'unknown';
  const connectionStartTime = Date.now();
  
  // Emit connection open telemetry for production debugging
  voiceDiagnostics.emit({
    sessionId: connectionId,
    stage: 'connection',
    success: true,
    metadata: { event: 'open', timestamp: connectionStartTime }
  });

  const orchestrator = getStreamingVoiceOrchestrator();
  let session: StreamingSession | null = null;
  let userId: string | null = null;
  let isAuthenticated = false;
  
  // Open mic mode state
  let openMicSession: OpenMicSession | null = null;
  let openMicPendingChunks: Buffer[] = [];  // Buffer chunks while session is starting
  let openMicSessionStarting = false;  // Prevent multiple concurrent starts
  let currentInputMode: VoiceInputMode = 'push-to-talk';
  
  // Speculative PTT state (stream audio during PTT for faster response)
  let speculativePttSession: OpenMicSession | null = null;
  let speculativePttPendingChunks: Buffer[] = [];
  let speculativePttSessionStarting = false;
  let speculativePttTranscript = '';  // Accumulated transcript from interim results
  let speculativePttWordCount = 0;  // Track word count for speculation trigger
  let speculativePttTriggered = false;  // Whether we've started speculative AI call
  let speculativePttTranscriptUsed = '';  // The transcript used for speculation
  let speculativePttGotFinal = false;  // Whether Deepgram sent is_final=true
  
  // Pending speculative transcript - set on PTT release, consumed by audio_data
  // This allows bypassing redundant STT when we already have real-time transcript
  let pendingSpeculativeTranscript: string | null = null;
  let pendingSpeculativeWordCount = 0;
  const SPECULATIVE_TRANSCRIPT_MIN_WORDS = 2;  // Minimum words to use speculative transcript
  // DISABLED: Speculative AI triggering during PTT causes Daniela to respond to incomplete sentences
  // When user pauses mid-thought while holding button, AI would trigger on partial transcript
  // Set to 999 to effectively disable - user's complete utterance is processed on button release
  const PTT_SPECULATIVE_AI_ENABLED = process.env.PTT_SPECULATIVE_AI_ENABLED === 'true';
  const SPECULATIVE_AI_TRIGGER_WORDS = PTT_SPECULATIVE_AI_ENABLED ? 3 : 999;
  let speculativeAiInProgress = false;  // Whether speculative AI is currently generating
  let speculativeAiAccepted = false;  // Whether speculative AI result was accepted (skip audio_data)
  let pttReleaseInProgress = false;  // RACE GUARD: True while ptt_release handler is processing (has async awaits)
  
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
  // Use setImmediate to ensure the upgrade response is fully flushed
  // before we try to send data over the WebSocket
  const sendConnected = () => {
    try {
      if (ws.readyState === WS.OPEN) {
        ws.send(JSON.stringify({
          type: 'connected',
          timestamp: Date.now(),
        }));
        console.log('[Streaming Voice] Connected message sent, readyState:', ws.readyState);
      } else {
        console.log('[Streaming Voice] WebSocket not open yet, readyState:', ws.readyState);
        // Retry after a short delay
        setTimeout(sendConnected, 50);
      }
    } catch (err) {
      console.error('[Streaming Voice] Error sending connected:', err);
    }
  };
  
  // Give the upgrade response time to be fully processed by the proxy
  setImmediate(sendConnected);

  // HEARTBEAT: Send ping every 30 seconds to keep connection alive
  // This prevents network proxies/firewalls from killing idle connections
  // Allow 4 missed pongs before terminating (~2 min tolerance for background tabs)
  let missedPongs = 0;
  const MAX_MISSED_PONGS = 4;
  const heartbeatInterval = setInterval(() => {
    missedPongs++;
    if (missedPongs > MAX_MISSED_PONGS) {
      console.log(`[Streaming Voice] Heartbeat: ${missedPongs} pongs missed, terminating connection`);
      clearInterval(heartbeatInterval);
      ws.terminate();
      return;
    }
    if (ws.readyState === WS.OPEN) {
      ws.ping();
    }
  }, 30000);

  ws.on('pong', () => {
    missedPongs = 0; // Reset counter on successful pong
  });

  ws.on('message', async (data: Buffer | string) => {
    // Reset heartbeat counter on ANY message - critical for Socket.io which doesn't use ws-style pong
    missedPongs = 0;
    
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
        
        // CRITICAL: If speculative AI is in progress or already accepted, skip this blob entirely
        // The response is already streaming from the speculative call - processing this would cause dual audio streams
        // NOTE: Heartbeat is already reset above (missedPongs = 0) before this check, so suppression doesn't affect keep-alive
        if (speculativeAiAccepted || speculativeAiInProgress) {
          console.log(`[SpeculativePTT] PHASE 2: Skipping binary audio blob - speculative AI ${speculativeAiInProgress ? 'in progress' : 'already accepted'}`);
          if (speculativeAiAccepted) {
            speculativeAiAccepted = false;  // Reset for next turn only if accepted (in-progress will be reset by ptt_release)
          }
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
          // FAIL-SECURE: If credit check throws, block session (don't allow through on error)
          let isDeveloper = false;
          try {
            isDeveloper = await usageService.checkDeveloperBypass(userId!);
          } catch (bypassErr: any) {
            console.error(`[Streaming Voice] Developer bypass check failed - blocking session:`, bypassErr.message);
            sendError(ws, 'CREDIT_CHECK_FAILED', 'Unable to verify account status', false);
            ws.close(4500, 'Credit check failed');
            return;
          }
          
          if (!isDeveloper) {
            try {
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
            } catch (creditErr: any) {
              console.error(`[Streaming Voice] Credit check failed - blocking session:`, creditErr.message);
              sendError(ws, 'CREDIT_CHECK_FAILED', 'Unable to verify credit balance', false);
              ws.close(4500, 'Credit check failed');
              return;
            }
          } else {
            console.log('[Streaming Voice] Developer mode - credits check bypassed');
          }

          const user = await storage.getUser(userId!);
          if (!user) {
            sendError(ws, 'UNAUTHORIZED', 'User not found', false);
            return;
          }

          let conversation = await storage.getConversation(conversationId!, userId!);
          console.log(`[Streaming Voice] getConversation(${conversationId}) result:`, conversation ? `found (${conversation.title?.substring(0, 30) || 'untitled'})` : 'NOT FOUND');
          
          // CRITICAL FIX: Create conversation if it doesn't exist
          // Client sends conversationId but may not have created the record.
          // Without this, FK constraint on messages table causes silent write failures.
          if (!conversation) {
            console.log(`[Streaming Voice] Creating missing conversation: ${conversationId}`);
            try {
              conversation = await storage.createConversation({
                id: conversationId!,
                userId: userId!,
                language: config.targetLanguage || 'spanish',
                title: 'Voice Session',
              });
              console.log(`[Streaming Voice] ✓ Conversation created: ${conversationId}`);
            } catch (createErr: any) {
              console.error(`[Streaming Voice] Failed to create conversation: ${createErr.message}`);
              sendError(ws, 'UNKNOWN', 'Failed to create conversation', false);
              return;
            }
          }

          const messages = await storage.getMessagesByConversation(conversationId!);
          console.log(`[Streaming Voice] getMessagesByConversation(${conversationId}) - found ${messages.length} messages`);
          
          // CRITICAL: Check if conversation language matches target language
          // If user switched languages (e.g., reused French conversation but now wants Spanish),
          // clear history to prevent language mixing (e.g., Juliette speaking Spanish)
          const conversationLang = (conversation.language || '').toLowerCase();
          const targetLang = (config.targetLanguage || '').toLowerCase();
          const isLanguageMismatch = conversationLang && targetLang && conversationLang !== targetLang;
          
          let conversationHistory: Array<{ role: 'user' | 'model'; content: string }>;
          if (isLanguageMismatch) {
            console.log(`[Streaming Voice] Language mismatch detected: conversation=${conversationLang}, target=${targetLang} - clearing history`);
            conversationHistory = [];
          } else {
            // CRITICAL: Map 'assistant' role to 'model' for Gemini API compatibility
            // Database stores 'assistant' but Gemini expects 'user' | 'model'
            conversationHistory = messages
              .slice(-20)
              .map((m: { role: string; content: string }) => ({
                role: (m.role === 'assistant' ? 'model' : m.role) as 'user' | 'model',
                content: m.content,
              }));
            
            if (conversationHistory.length > 0) {
              console.log(`[Streaming Voice] Loaded ${conversationHistory.length} messages from conversation history`);
            }
          }

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
              // NORMALIZE at the source: handles "mandarin" vs "mandarin chinese" variations
              const conversationLanguage = normalizeLanguageKey(conversation.language?.toLowerCase() || config.targetLanguage?.toLowerCase() || 'spanish');
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
          console.log(`[Compass Init] COMPASS_ENABLED=${COMPASS_ENABLED}, conversationId=${conversationId}, userId=${userId}`);
          if (COMPASS_ENABLED) {
            try {
              sessionStartTime = Date.now();
              console.log(`[Compass Init] Calling initializeSession...`);
              compassSession = await sessionCompassService.initializeSession({
                conversationId: conversationId!,
                userId: userId!,
                classId: conversation.classId || null,
                scheduledDurationMinutes: 30, // Default session length
                legacyFreedomLevel: tutorFreedomLevel,
              });
              
              if (compassSession) {
                compassContext = await sessionCompassService.getCompassContext(conversationId!);
                console.log(`[Compass Init] SUCCESS - session: ${compassSession.id}, hasContext: ${!!compassContext}, hasCreditBalance: ${!!compassContext?.creditBalance}`);
                
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
              } else {
                console.warn(`[Compass Init] initializeSession returned null (isEnabled check may have failed)`);
              }
            } catch (compassErr: any) {
              console.error('[Compass Init] FAILED:', compassErr.message, compassErr.stack?.substring(0, 500));
              // Compass is optional - continue with legacy freedom levels
            }
          } else {
            console.warn(`[Compass Init] SKIPPED - COMPASS_ENABLED is falsy: ${COMPASS_ENABLED}`);
          }

          // Use full system prompt with streaming voice mode flag
          // This preserves all teaching context (ACTFL, cultural guidelines, vocabulary)
          // while outputting plain text format for TTS
          // Note: derivedDifficulty comes from class expectedActflMin or user's ACTFL assessment
          // NOT from user's self-selected difficultyLevel preference
          // Founder Mode: EXPLICIT flag from client - only true when user selects "Founder Mode" in learning context
          // This prevents developers from accidentally entering founder mode when doing self-directed practice
          // The flag is only trusted for developers/admins (regular users cannot enable founder mode)
          const isFounderMode = isDeveloper && config.founderMode === true;
          
          // Beta Tester Mode: User is helping test new features - Daniela can be experimental
          const isBetaTester = user.isBetaTester === true;
          
          // Raw Honesty Mode: Minimal prompting for authentic self-discovery conversations
          // FOUNDER-ONLY: Only the founder/admin can access this mode
          // This allows the founder to have completely raw, unscripted conversations with Daniela
          const isAdmin = user.role === 'admin';
          console.log(`[Streaming Voice] User role check: role=${user.role}, isAdmin=${isAdmin}, rawHonestyMode=${config.rawHonestyMode}`);
          const isRawHonestyMode = isAdmin && config.rawHonestyMode === true;
          if (isRawHonestyMode) {
            console.log(`[Streaming Voice] RAW HONESTY MODE enabled for FOUNDER ${user.firstName || 'admin'}`);
          }
          
          // Session Context: USER_ROLE and SESSION_INTENT for better mode awareness
          // This helps Daniela recognize when to be in "meta-mode" vs "tutor-mode"
          let userRole: UserRole = (user.role as UserRole) || 'student';
          // Elevate to 'founder' for developers in founder mode
          if (isFounderMode && (userRole === 'developer' || userRole === 'admin')) {
            userRole = 'founder';
          }
          
          // Detect session intent from recent conversation history
          // Look for meta-mode trigger phrases
          // NOTE: Founder Mode defaults to 'product_discussion' because founders typically want
          // collaborative conversation, not language lessons. They can switch to tutor mode explicitly.
          let sessionIntent: SessionIntent = 'hybrid';
          
          if (isFounderMode) {
            const recentMessages = conversationHistory.slice(-10);
            const recentText = recentMessages.map(m => m.content.toLowerCase()).join(' ');
            
            // Meta-mode triggers (product discussion)
            const metaModeTriggers = [
              'founder mode', 'let\'s talk about holahola', 'product feedback',
              'claude', 'the designers', 'neural network', 'system prompt',
              'what do you need', 'how can we improve', 'suggestions for',
              'your brain', 'your development', 'meta-conversation'
            ];
            
            // Tutor-mode triggers (language learning)
            const tutorModeTriggers = [
              'teach me', 'practice spanish', 'let\'s learn', 'spanish lesson',
              'drill', 'vocabulary', 'conjugation', 'translate this',
              'how do you say', 'what\'s the word for'
            ];
            
            const hasMetaTriggers = metaModeTriggers.some(trigger => recentText.includes(trigger));
            const hasTutorTriggers = tutorModeTriggers.some(trigger => recentText.includes(trigger));
            
            if (hasTutorTriggers && !hasMetaTriggers) {
              // Explicit tutor mode requested
              sessionIntent = 'language_learning';
              console.log(`[Streaming Voice] Detected SESSION_INTENT: language_learning (tutor-mode triggers found)`);
            } else if (hasMetaTriggers && !hasTutorTriggers) {
              // Explicit product discussion
              sessionIntent = 'product_discussion';
              console.log(`[Streaming Voice] Detected SESSION_INTENT: product_discussion (meta-mode triggers found)`);
            } else {
              // DEFAULT FOR FOUNDER MODE: product_discussion
              // Founders are colleagues, not students. They want collaborative conversation.
              // They can explicitly say "teach me" or "practice Spanish" to switch to tutor mode.
              sessionIntent = 'product_discussion';
              console.log(`[Streaming Voice] SESSION_INTENT: product_discussion (founder mode default - say "teach me" for language learning)`);
            }
          } else {
            // Not in Founder Mode = language learning
            sessionIntent = 'language_learning';
          }
          
          console.log(`[Streaming Voice] Session context: USER_ROLE=${userRole}, SESSION_INTENT=${sessionIntent}`);
          
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
          
          // Fetch self-affirmation notes for Founder Mode or Raw Honesty Mode
          // These are Daniela's notes to herself about permissions and affirmations
          // Note: Check both isRawHonestyMode (admin-verified) AND config.rawHonestyMode (client flag)
          // This ensures notes load even if role detection has timing issues
          let selfAffirmationNotes: { title: string; content: string; createdAt: Date }[] = [];
          const shouldLoadNotes = isFounderMode || isRawHonestyMode || config.rawHonestyMode === true;
          console.log(`[Streaming Voice] Notes loading check: isFounderMode=${isFounderMode}, isRawHonestyMode=${isRawHonestyMode}, configRawHonesty=${config.rawHonestyMode}, shouldLoad=${shouldLoadNotes}`);
          if (shouldLoadNotes) {
            try {
              const notes = await storage.getDanielaNotes({ 
                noteType: 'self_affirmation', 
                activeOnly: true, 
                limit: 5 
              });
              selfAffirmationNotes = notes.map(n => ({
                title: n.title,
                content: n.content,
                createdAt: n.createdAt
              }));
              if (selfAffirmationNotes.length > 0) {
                console.log(`[Streaming Voice] Loaded ${selfAffirmationNotes.length} self-affirmation notes`);
              }
            } catch (notesErr: any) {
              console.warn('[Streaming Voice] Could not fetch self-affirmation notes:', notesErr.message);
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
          // NORMALIZE at the source: handles "mandarin" vs "mandarin chinese" variations
          const rawLanguage = conversation.language?.toLowerCase() || config.targetLanguage?.toLowerCase() || 'spanish';
          const effectiveLanguage = normalizeLanguageKey(rawLanguage);
          
          // Log a warning if client and conversation languages differ (helps debug sync issues)
          if (config.targetLanguage && conversation.language && 
              config.targetLanguage.toLowerCase() !== conversation.language.toLowerCase()) {
            console.warn(`[Streaming Voice] Language mismatch: client sent "${config.targetLanguage}" but conversation is "${conversation.language}" - using normalized: "${effectiveLanguage}"`);
          }
          let voiceId: string | undefined;
          let tutorNameForPrompt = tutorGenderForPrompt === 'male' ? 'Agustin' : 'Daniela'; // Default fallback
          let tutorDirectory: TutorDirectoryEntry[] = [];
          let tutorPersona: PedagogicalPersona | undefined;
          
          try {
            const allVoices = await storage.getAllTutorVoices();
            const matchingVoice = allVoices.find(
              (v: any) => v.language?.toLowerCase() === effectiveLanguage &&
                          v.gender?.toLowerCase() === tutorGenderForPrompt &&
                          v.role === 'tutor' &&  // Only main Cartesia tutors, not Google assistants
                          v.isActive
            );
            
            if (matchingVoice?.voiceId) {
              voiceId = matchingVoice.voiceId;
              // Extract tutor name from voice name (e.g., "Agustin - Clear Storyteller" -> "Agustin")
              const voiceNameParts = matchingVoice.voiceName?.split(/\s*[-–]\s*/) || [];
              if (voiceNameParts[0]?.trim()) {
                tutorNameForPrompt = voiceNameParts[0].trim();
                console.log(`[Streaming Voice] Using language-specific tutor: ${tutorNameForPrompt} (${effectiveLanguage})`);
              }
              
              // Construct pedagogical persona from database flat columns
              if (matchingVoice.pedagogicalFocus || matchingVoice.teachingStyle) {
                tutorPersona = {
                  pedagogicalFocus: matchingVoice.pedagogicalFocus || undefined,
                  teachingStyle: matchingVoice.teachingStyle || undefined,
                  errorTolerance: matchingVoice.errorTolerance || undefined,
                  vocabularyLevel: matchingVoice.vocabularyLevel || undefined,
                  personalityTraits: matchingVoice.personalityTraits || undefined,
                  scenarioStrengths: matchingVoice.scenarioStrengths || undefined,
                  teachingPhilosophy: matchingVoice.teachingPhilosophy || undefined,
                };
                console.log(`[Streaming Voice] Loaded persona for ${tutorNameForPrompt}: focus=${tutorPersona.pedagogicalFocus}, style=${tutorPersona.teachingStyle}`);
              }
            }
            
            // Build dynamic tutor directory from all active voices
            // This gives Daniela knowledge of who she can hand off to by name
            const studentPreferredGender = (user?.tutorGender || 'female') as 'male' | 'female';
            
            // Main tutors from voice database (exclude assistants)
            // effectiveLanguage is already normalized at source, no need to normalize again
            const mainTutorEntries = allVoices
              .filter((v: any) => v.isActive && v.voiceName && v.role !== 'assistant')
              .map((v: any) => {
                const voiceNameParts = v.voiceName?.split(/\s*[-–]\s*/) || [];
                const tutorName = voiceNameParts[0]?.trim() || 'Tutor';
                const lang = normalizeLanguageKey(v.language || 'spanish');
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
                  role: 'tutor' as const,
                };
              });
            
            // Add assistant practice partners from neural network database
            // Neural network philosophy: "Prompts for context ONLY; neural network for procedures/capabilities/knowledge"
            let assistantEntries: TutorDirectoryEntry[] = [];
            try {
              // Get assistants from tutorVoices table (role='assistant')
              const assistantVoices = allVoices.filter((v: any) => v.role === 'assistant' && v.isActive);
              
              for (const av of assistantVoices) {
                // Extract assistant name from voice name (e.g., "Aris - Practice Partner" -> "Aris")
                const nameParts = av.voiceName?.split(/\s*[-–]\s*/) || [];
                const assistantName = nameParts[0]?.trim() || 'Assistant';
                const lang = normalizeLanguageKey(av.language || 'spanish');
                const gender = (av.gender?.toLowerCase() || 'female') as 'male' | 'female';
                
                assistantEntries.push({
                  language: lang,
                  gender,
                  name: assistantName,
                  isPreferred: gender === studentPreferredGender,
                  isCurrent: false,
                  role: 'assistant' as const,
                });
              }
            } catch (asstErr: any) {
              console.warn('[Streaming Voice] Could not load assistant tutors from database:', asstErr.message);
            }
            
            // Add Sofia - support specialist (hardcoded like original assistants)
            // Sofia handles technical issues, billing questions, account problems
            const sofiaEntry: TutorDirectoryEntry = {
              language: 'all', // Sofia helps with any language
              gender: 'female',
              name: 'Sofia',
              isPreferred: false,
              isCurrent: false,
              role: 'support' as const,
            };
            
            tutorDirectory = [...mainTutorEntries, ...assistantEntries, sofiaEntry];
              
            console.log(`[Streaming Voice] Built tutor directory with ${mainTutorEntries.length} tutors + ${assistantEntries.length} assistants + Sofia (support)`);
            console.log(`[Streaming Voice] Tutor directory entries: ${JSON.stringify(tutorDirectory.slice(0, 5))}...`);
          } catch (err: any) {
            console.warn(`[Streaming Voice] Voice config error: ${err.message}`);
          }
          
          // Fetch student memory context for neural network injection
          // This gives Daniela her memories of the student across sessions
          let studentMemoryContext = null;
          try {
            studentMemoryContext = await storage.getStudentMemoryContext(userId!, effectiveLanguage);
            const memoryCount = (studentMemoryContext.insights?.length || 0) + 
                               (studentMemoryContext.motivations?.length || 0) +
                               (studentMemoryContext.struggles?.length || 0) +
                               (studentMemoryContext.connections?.length || 0);
            if (memoryCount > 0) {
              console.log(`[Streaming Voice] Loaded ${memoryCount} student memories for neural network`);
            }
          } catch (memErr: any) {
            console.warn('[Streaming Voice] Could not load student memory:', memErr.message);
          }
          
          // Fetch student snapshot context for session continuity and personal connection
          // This gives Daniela quick context: last lesson, streak, personal follow-ups ("How did your soccer game go?")
          let studentSnapshotContext: StudentSnapshotContext | null = null;
          try {
            studentSnapshotContext = await getStudentSnapshotData(userId!, effectiveLanguage);
            const snapshotItems = (studentSnapshotContext.lastSession ? 1 : 0) +
                                 (studentSnapshotContext.streak ? 1 : 0) +
                                 (studentSnapshotContext.personalFollowUps?.length || 0);
            if (snapshotItems > 0) {
              console.log(`[Streaming Voice] Loaded student snapshot: ${snapshotItems} items (last session, streak, personal follow-ups)`);
            }
            if (studentSnapshotContext.lastSession) {
              console.log(`[Streaming Voice] Last session: "${studentSnapshotContext.lastSession.topic}" - ${studentSnapshotContext.lastSession.daysAgo} days ago`);
            } else {
              console.log(`[Streaming Voice] No last session found for userId=${userId}, language=${effectiveLanguage}`);
            }
          } catch (snapErr: any) {
            console.warn('[Streaming Voice] Could not load student snapshot:', snapErr.message);
          }
          
          // Run pre-session predictions and fetch predictive teaching context
          // This triggers struggle predictions and motivation analysis, persisting to neural network tables
          let predictiveTeachingContext: PredictiveTeachingContext | null = null;
          try {
            // Run predictions before session - writes to predictedStruggles table
            await studentLearningService.runPreSessionPredictions(
              userId!,
              effectiveLanguage,
              user.actflLevel || undefined
            );
            
            // Fetch the predictive teaching context from neural network tables
            predictiveTeachingContext = await getPredictiveTeachingContext(userId!, effectiveLanguage);
            
            const contextCount = (predictiveTeachingContext.predictions?.length || 0) + 
                                (predictiveTeachingContext.alerts?.length || 0);
            if (contextCount > 0) {
              console.log(`[Streaming Voice] Loaded ${contextCount} predictive teaching items for neural network`);
            }
          } catch (predErr: any) {
            console.warn('[Streaming Voice] Could not run predictions:', predErr.message);
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
            messages.length > 0, // isResuming - detect from existing conversation history
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
            user.timezone, // Student timezone for time-aware greetings
            userRole, // User role for session context
            sessionIntent, // Session intent for meta-mode awareness
            undefined, // editorConversationContext
            undefined, // surgeryContext
            studentMemoryContext, // Student memory for neural network
            user.firstName || user.email || undefined, // Student display name for memory section
            predictiveTeachingContext, // Predictive teaching from neural network tables
            tutorPersona, // Pedagogical persona - each tutor's unique teaching style
            studentSnapshotContext, // Student snapshot for session continuity (last lesson, streak, personal follow-ups)
            false, // useFunctionCalling
            selfAffirmationNotes // Daniela's self-authored reminders from honesty mode
          );

          // Add founder memory context if in Founder Mode (but NOT in Raw Honesty Mode - keep it minimal)
          if (isFounderMode && !isRawHonestyMode && founderMemoryContext) {
            systemPrompt += founderMemoryContext;
          }
          
          // Add Neural Network pedagogical knowledge (idioms, cultural nuances, error patterns)
          // This is Daniela's learned KNOWLEDGE, not scripted behavior - include even in Honesty Mode
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

          // Skip syllabus/curriculum context in Raw Honesty Mode - that's scripted behavior
          if (!isRawHonestyMode && conversation.classId) {
            // Add congratulatory messaging if student is ahead of syllabus
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

          // Log system prompt size for diagnostics
          const promptCharCount = systemPrompt.length;
          const estimatedTokens = Math.ceil(promptCharCount / 4);
          console.log(`[Streaming Voice] System prompt size: ${promptCharCount} chars (~${estimatedTokens} tokens)`);

          // Build additional context for personalized greetings
          // This gives Daniela critical information about what the student wants to work on
          const additionalGreetingContext = {
            conversationTopic: conversation.topic || undefined,
            conversationTitle: conversation.title || undefined,
            lastSessionSummary: compassContext?.lastSessionSummary || undefined,
            studentGoals: compassContext?.studentGoals || undefined,
          };

          // IMPORTANT: Start usage tracking session FIRST before orchestrator session
          // This ensures dbSessionId is available BEFORE any whiteboard events can fire
          let dbSessionId: string | undefined;
          try {
            // Get class ID from conversation if any
            const classId = conversation.classId || undefined;
            usageSession = await usageService.startSession(
              userId!,
              conversationId!,
              config.targetLanguage,
              classId
            );
            dbSessionId = usageSession.id;
            console.log(`[Streaming Voice] Usage session started: ${usageSession.id}${isDeveloper ? ' (developer)' : ''}`);
          } catch (usageErr: any) {
            console.warn('[Streaming Voice] Could not start usage session:', usageErr.message);
            // Continue without usage session - dbSessionId will be undefined
          }

          session = await orchestrator.createSession(
            ws,
            userId!,
            config,
            systemPrompt,
            conversationHistory,
            voiceId,
            isFounderMode,  // Pass Founder Mode flag for multi-language STT
            isRawHonestyMode,  // Pass Raw Honesty Mode flag for minimal prompting
            isDeveloper,  // ONE DANIELA: Developer users get Express Lane context regardless of class/Founder Mode
            isBetaTester,  // Pass Beta Tester flag for rehearsal mode context
            additionalGreetingContext,  // Additional context for personalized greetings
            dbSessionId  // Database voice_sessions.id - set BEFORE session starts to avoid FK errors
          );
          
          // Store tutorDirectory on session for prompt regeneration after tutor handoffs
          // This is CRITICAL for Daniela to know all available tutors when switching
          session.tutorDirectory = tutorDirectory;

          console.log(`[Streaming Voice] Session created: ${session.id}${dbSessionId ? ` (db: ${dbSessionId.substring(0, 8)}...)` : ' (no db session)'}`);
          telemetrySessionId = dbSessionId || session.id;
          telemetryUserId = userId!;
          voiceTelemetry.log(telemetrySessionId, telemetryUserId, 'session_start', {
            connectionId, language: effectiveLanguage, tutorMode: config.tutorMode || 'main',
            browser: req.headers['user-agent']?.substring(0, 120),
            inputMode: currentInputMode,
          });
          
          // ECHO SUPPRESSION: Set callback to control OpenMic suppression during TTS
          // Safety timeout prevents permanent mic lockout if onTtsStateChange(false) never fires
          let echoSuppressionTimeout: NodeJS.Timeout | null = null;
          const ECHO_SUPPRESSION_MAX_MS = 30000;
          orchestrator.setTtsStateCallback(session.id, (isTtsPlaying: boolean) => {
            if (openMicSession) {
              openMicSession.setSuppressed(isTtsPlaying);
            }
            if (isTtsPlaying) {
              if (echoSuppressionTimeout) clearTimeout(echoSuppressionTimeout);
              echoSuppressionTimeout = setTimeout(() => {
                console.warn(`[ECHO SUPPRESSION SAFETY] Suppression active for ${ECHO_SUPPRESSION_MAX_MS}ms — force-clearing to prevent mic lockout`);
                if (openMicSession) {
                  openMicSession.setSuppressed(false);
                }
                echoSuppressionTimeout = null;
              }, ECHO_SUPPRESSION_MAX_MS);
            } else {
              if (echoSuppressionTimeout) {
                clearTimeout(echoSuppressionTimeout);
                echoSuppressionTimeout = null;
              }
            }
          });
          
          
          if (ws.readyState === WS.OPEN) {
            ws.send(JSON.stringify({
              type: 'session_started',
              timestamp: Date.now(),
              sessionId: session.id,
              conversationId: conversationId, // Exposed for Architect's Voice integration
              isFounderMode: isFounderMode, // Flag for UI to show founder mode indicator
              isRawHonestyMode: isRawHonestyMode, // Flag for raw honesty mode indicator
              isBetaTester: isBetaTester, // Flag for beta tester rehearsal mode
            }));
            console.log(`[Streaming Voice] session_started sent (conversation: ${conversationId}${isRawHonestyMode ? ', RAW HONESTY MODE' : isFounderMode ? ', FOUNDER MODE' : ''}${isBetaTester ? ', BETA TESTER' : ''})`);
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
                            v.role === 'tutor' &&  // Only main Cartesia tutors, not Google assistants
                            v.isActive
              );
              
              if (matchingVoice?.voiceId) {
                orchestrator.updateSessionVoice(session.id, matchingVoice.voiceId, matchingVoice.provider);
                console.log(`[Streaming Voice] Applied pending voice update: ${pendingGender} (${matchingVoice.voiceName}, TTS: ${matchingVoice.provider || 'default'})`);
                
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

          // RACE GUARD: If ptt_release is currently processing (has async awaits), skip this audio_data
          // The ptt_release handler will handle the transcript directly, preventing double response
          if (pttReleaseInProgress) {
            console.log(`[SpeculativePTT] RACE GUARD: Skipping audio_data - ptt_release is still processing`);
            break;
          }

          // PHASE 2: If speculative AI was already accepted, skip this audio_data entirely
          // The response is already streaming from the speculative call
          if (speculativeAiAccepted) {
            console.log(`[SpeculativePTT] PHASE 2: Skipping audio_data - speculative AI already accepted`);
            speculativeAiAccepted = false;  // Reset for next turn
            break;
          }

          const audioMessage = message as ClientAudioDataMessage;
          let audioBuffer: Buffer;
          if (typeof audioMessage.audio === 'string') {
            audioBuffer = Buffer.from(audioMessage.audio, 'base64');
          } else {
            audioBuffer = Buffer.from(audioMessage.audio);
          }

          let metrics: StreamingMetrics;
          
          // SPECULATIVE PTT BYPASS: If we have a pending speculative transcript,
          // skip the expensive blob STT and go straight to AI generation
          if (pendingSpeculativeTranscript && pendingSpeculativeWordCount >= SPECULATIVE_TRANSCRIPT_MIN_WORDS) {
            const transcriptToUse = pendingSpeculativeTranscript;
            const wordCount = pendingSpeculativeWordCount;
            
            // Clear the pending transcript immediately to prevent reuse
            pendingSpeculativeTranscript = null;
            pendingSpeculativeWordCount = 0;
            
            console.log(`[SpeculativePTT] BYPASS: Using speculative transcript (${wordCount} words), skipping blob STT`);
            console.log(`[SpeculativePTT] Transcript: "${transcriptToUse}"`);
            
            // Use processOpenMicTranscript which skips STT entirely
            metrics = await orchestrator.processOpenMicTranscript(session.id, transcriptToUse, 1.0);
          } else {
            // Fallback: No speculative transcript available, process blob normally
            if (pendingSpeculativeTranscript) {
              console.log(`[SpeculativePTT] Transcript too short, falling back to blob STT`);
              pendingSpeculativeTranscript = null;
              pendingSpeculativeWordCount = 0;
            }
            metrics = await orchestrator.processUserAudio(session.id, audioBuffer, audioMessage.format || 'webm');
          }
          
          voiceTelemetry.log(telemetrySessionId, telemetryUserId, 'turn_complete', {
            hasTranscript: !!metrics.userTranscript,
            hasResponse: !!metrics.aiResponse,
            transcriptPreview: metrics.userTranscript?.substring(0, 80),
            responsePreview: metrics.aiResponse?.substring(0, 80),
            latencyMs: metrics.latencyMs,
            sttMs: metrics.sttLatencyMs,
            llmMs: metrics.llmLatencyMs,
            ttsMs: metrics.ttsLatencyMs,
          });
          
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
            
            // Update usage session metrics after every exchange
            // Critical: must flush immediately so endAllActiveSessions() sees correct count
            if (usageSession) {
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
          
          break;
        }

        case 'request_greeting': {
          // Generate AI-powered personalized greeting
          if (!isAuthenticated || !session) {
            sendError(ws, 'UNKNOWN', 'Session not ready for greeting', true);
            return;
          }
          
          const greetingRequest = message as { type: 'request_greeting'; userName?: string; isResumed?: boolean };
          
          // CHECK FOR PENDING HANDOFF INTRO - If a cross-language switch just happened,
          // the new tutor needs to introduce themselves instead of giving a normal greeting
          // NOTE: Use userId (not conversationId) because client creates a NEW conversation for language switches
          if (userId && pendingHandoffIntros.has(userId)) {
            const pendingIntro = pendingHandoffIntros.get(userId)!;
            const age = Date.now() - pendingIntro.timestamp;
            
            // Only use if less than 30 seconds old
            if (age < 30000) {
              console.log(`[Streaming Voice] Found pending handoff intro for ${pendingIntro.tutorName} (${age}ms old) - delivering now!`);
              pendingHandoffIntros.delete(userId); // Clear it
              
              try {
                // Deliver the handoff intro instead of normal greeting
                await orchestrator.processVoiceSwitchIntro(
                  session.id,
                  pendingIntro.tutorName,
                  pendingIntro.gender
                );
                break;
              } catch (introError: any) {
                console.error('[Streaming Voice] Handoff intro error:', introError.message);
                // Fall through to normal greeting on error
              }
            } else {
              console.log(`[Streaming Voice] Pending handoff intro expired (${age}ms) - using normal greeting`);
              pendingHandoffIntros.delete(userId);
            }
          }
          
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

        case 'user_activity': {
          // User is actively engaged (e.g., recording audio) - reset idle timeout
          // This prevents timeout while user is holding the push-to-talk button
          if (session) {
            orchestrator.resetIdleTimeoutForSession(session.id);
          }
          break;
        }

        case 'toggle_incognito': {
          if (!session) break;
          const incognitoEnabled = !!(message as any).enabled;
          const sess = orchestrator.getSession(session.id);
          if (sess && (sess.isFounderMode || sess.isRawHonestyMode)) {
            sess.isIncognito = incognitoEnabled;
            console.log(`[Streaming Voice] Incognito mode ${incognitoEnabled ? 'ENABLED' : 'DISABLED'} for session ${session.id}`);
            ws.send(JSON.stringify({
              type: 'incognito_changed',
              timestamp: Date.now(),
              enabled: incognitoEnabled,
            }));
          } else {
            console.warn(`[Streaming Voice] Incognito toggle rejected - not in Founder/Honesty mode`);
          }
          break;
        }

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
          
          const chunkMessage = message as ClientStreamAudioChunkMessage;
          let audioBuffer: Buffer;
          if (typeof chunkMessage.audio === 'string') {
            audioBuffer = Buffer.from(chunkMessage.audio, 'base64');
          } else {
            audioBuffer = Buffer.from(chunkMessage.audio);
          }
          
          // Handle based on current input mode
          if (currentInputMode === 'open-mic') {
            // OPEN MIC MODE: Continuous streaming with VAD
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
            const sessionKeytermsForMic = (session as any).sttKeyterms as string[] | undefined;
            console.log(`[OpenMic] Starting PCM session for language: ${languageCode}${sessionKeytermsForMic?.length ? ` (${sessionKeytermsForMic.length} keyterms)` : ''}`);
            
            const newSession = new OpenMicSession(languageCode, {
              onSpeechStarted: () => {
                console.log('[OpenMic] VAD: Speech started - sending to client');
                if (ws.readyState === WS.OPEN) {
                  const msg = JSON.stringify({
                    type: 'vad_speech_started',
                    timestamp: Date.now(),
                  });
                  console.log('[OpenMic] Sending vad_speech_started to client');
                  ws.send(msg);
                } else {
                  console.warn('[OpenMic] WebSocket not open, cannot send vad_speech_started');
                }
              },
              onUtteranceEnd: async (transcript, confidence) => {
                console.log(`[OpenMic] VAD: Utterance end - "${transcript}" (${(confidence * 100).toFixed(0)}%)`);
                
                const isEmptyTranscript = !transcript.trim() || transcript.trim() === '[EMPTY_TRANSCRIPT]';
                
                if (ws.readyState === WS.OPEN) {
                  ws.send(JSON.stringify({
                    type: 'vad_utterance_end',
                    timestamp: Date.now(),
                    empty: isEmptyTranscript,
                  }));
                }
                
                if (!isEmptyTranscript && session) {
                  try {
                    const omMetrics = await orchestrator.processOpenMicTranscript(
                      session.id,
                      transcript,
                      confidence
                    );
                    
                    // Track exchange for usage accounting (Open Mic path)
                    if (omMetrics.sentenceCount > 0) {
                      exchangeCount++;
                      const studentWords = transcript.split(/\s+/).length;
                      studentSpeakingSeconds += studentWords / 2.5;
                      
                      // Flush to DB immediately so endAllActiveSessions() sees correct count
                      if (usageSession) {
                        try {
                          await usageService.updateSessionMetrics(usageSession.id, {
                            exchangeCount,
                            studentSpeakingSeconds: Math.round(studentSpeakingSeconds),
                            tutorSpeakingSeconds: Math.round(tutorSpeakingSeconds),
                            ttsCharacters,
                          });
                        } catch (updateErr: any) {
                          console.warn('[Streaming Voice] Could not update OM session metrics:', updateErr.message);
                        }
                      }
                    }
                  } catch (err: any) {
                    console.error('[OpenMic] Error processing utterance:', err);
                    sendError(ws, 'AI_FAILED', 'Failed to process speech', true);
                  }
                } else if (isEmptyTranscript) {
                  console.log('[OpenMic] Empty transcript - skipping AI processing, resetting client state');
                  
                  if (openMicSession) {
                    const diag = openMicSession.getDiagnostics();
                    if (diag.inSilenceLoop && ws.readyState === WS.OPEN) {
                      ws.send(JSON.stringify({
                        type: 'open_mic_silence_loop',
                        timestamp: Date.now(),
                        consecutiveEmptyCount: diag.consecutiveEmptyCount,
                        msSinceLastSuccessfulTranscript: diag.msSinceLastSuccessfulTranscript,
                      }));

                      if (diag.consecutiveEmptyCount === 5 && session?.id) {
                        console.log('[OpenMic] Triggering Daniela recovery phrase (echo ate student words)');
                        orchestrator.speakRecoveryPhrase(session.id).catch((err: any) =>
                          console.error('[OpenMic] Recovery phrase failed:', err.message)
                        );
                      }
                    }
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
            }, sessionKeytermsForMic);
            
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
          } else if (currentInputMode === 'push-to-talk') {
            // SPECULATIVE PTT MODE: Stream audio during PTT for faster response
            if (speculativePttSession) {
              speculativePttSession.sendAudio(audioBuffer);
              break;
            }
            
            // Buffer this chunk while session is starting
            speculativePttPendingChunks.push(audioBuffer);
            
            if (speculativePttSessionStarting) {
              break;
            }
            
            // Start speculative PTT session
            speculativePttSessionStarting = true;
            speculativePttTranscript = '';
            speculativePttWordCount = 0;
            speculativePttTriggered = false;
            speculativePttTranscriptUsed = '';
            speculativePttGotFinal = false;
            speculativePttSessionId++;
            const currentPttSessionId = speculativePttSessionId;
            
            // CRITICAL: Clear any stale flags from previous turn to prevent cross-turn carryover
            speculativeAiInProgress = false;
            speculativeAiAccepted = false;
            pendingSpeculativeTranscript = null;
            pendingSpeculativeWordCount = 0;
            
            const languageCode = getDeepgramLanguageCode(session.targetLanguage || 'spanish');
            const sessionKeyterms = (session as any).sttKeyterms as string[] | undefined;
            console.log(`[SpeculativePTT] Starting PCM session for language: ${languageCode}${sessionKeyterms?.length ? ` (${sessionKeyterms.length} keyterms)` : ''}`);
            
            const pttSession = new OpenMicSession(languageCode, {
              onSpeechStarted: () => {
                if (currentPttSessionId !== speculativePttSessionId) return;
                console.log('[SpeculativePTT] VAD: Speech started');
                if (ws.readyState === WS.OPEN) {
                  ws.send(JSON.stringify({
                    type: 'ptt_speech_started',
                    timestamp: Date.now(),
                  }));
                }
              },
              onUtteranceEnd: async (transcript, confidence) => {
                if (currentPttSessionId !== speculativePttSessionId) return;
                console.log(`[SpeculativePTT] VAD: Utterance end (ignored) - "${transcript}"`);
              },
              onInterimTranscript: (transcript) => {
                if (currentPttSessionId !== speculativePttSessionId) {
                  console.log(`[SpeculativePTT] Ignoring stale transcript from session #${currentPttSessionId} (current: #${speculativePttSessionId}): "${transcript.slice(0, 50)}"`);
                  return;
                }
                speculativePttTranscript = transcript;
                const words = transcript.trim().split(/\s+/).filter(w => w.length > 0);
                speculativePttWordCount = words.length;
                
                console.log(`[SpeculativePTT] Interim: "${transcript}" (${speculativePttWordCount} words, triggered: ${speculativePttTriggered})`);
                
                if (ws.readyState === WS.OPEN) {
                  ws.send(JSON.stringify({
                    type: 'ptt_interim_transcript',
                    timestamp: Date.now(),
                    text: transcript,
                    wordCount: speculativePttWordCount,
                  }));
                }
                
                if (speculativePttWordCount >= SPECULATIVE_AI_TRIGGER_WORDS && 
                    !speculativePttTriggered && 
                    !speculativeAiInProgress &&
                    session) {
                  speculativePttTriggered = true;
                  speculativePttTranscriptUsed = transcript.trim();
                  speculativeAiInProgress = true;
                  
                  console.log(`[SpeculativePTT] PHASE 2: Triggering speculative AI with "${speculativePttTranscriptUsed}"`);
                  
                  orchestrator.processOpenMicTranscript(session.id, speculativePttTranscriptUsed, 0.9)
                    .then(() => {
                      console.log(`[SpeculativePTT] PHASE 2: Speculative AI completed`);
                    })
                    .catch((err: Error) => {
                      console.error(`[SpeculativePTT] PHASE 2: Speculative AI failed:`, err.message);
                    })
                    .finally(() => {
                      speculativeAiInProgress = false;
                    });
                  
                  if (ws.readyState === WS.OPEN) {
                    ws.send(JSON.stringify({
                      type: 'ptt_speculative_ai_started',
                      timestamp: Date.now(),
                      transcript: speculativePttTranscriptUsed,
                    }));
                  }
                }
              },
              onFinalReceived: () => {
                if (currentPttSessionId !== speculativePttSessionId) return;
                speculativePttGotFinal = true;
              },
              onError: (error) => {
                if (currentPttSessionId !== speculativePttSessionId) return;
                console.error('[SpeculativePTT] Session error:', error);
              },
              onClose: () => {
                if (currentPttSessionId !== speculativePttSessionId) return;
                console.log('[SpeculativePTT] Session closed');
                speculativePttSession = null;
              },
            }, sessionKeyterms);
            
            try {
              await pttSession.start();
              speculativePttSession = pttSession;
              speculativePttSessionStarting = false;
              console.log('[SpeculativePTT] Session started successfully');
              
              // Send buffered chunks
              if (speculativePttPendingChunks.length > 0) {
                console.log(`[SpeculativePTT] Sending ${speculativePttPendingChunks.length} buffered PCM chunks`);
                for (const chunk of speculativePttPendingChunks) {
                  speculativePttSession.sendAudio(chunk);
                }
                speculativePttPendingChunks = [];
              }
            } catch (err: any) {
              console.error('[SpeculativePTT] Failed to start session:', err);
              speculativePttSession = null;
              speculativePttSessionStarting = false;
              speculativePttPendingChunks = [];
              // Fallback: normal PTT will still work via audio_data message
            }
          }
          break;
        }
        
        case 'ptt_release': {
          // PTT button released - finalize speculative PTT and get final transcript
          if (!isAuthenticated || !session) {
            sendError(ws, 'UNKNOWN', 'Session not ready', true);
            return;
          }
          
          // RACE GUARD: Set flag to prevent audio_data from processing during our async waits
          pttReleaseInProgress = true;
          
          const interimTranscript = speculativePttTranscript.trim();
          console.log(`[SpeculativePTT] PTT released - interim transcript: "${interimTranscript}" (${speculativePttWordCount} words)`);
          
          // IMMEDIATE THINKING SIGNAL: Tell client to show thinking avatar NOW
          // This fires immediately on PTT release, before the 200-400ms Deepgram wait
          if (ws.readyState === WS.OPEN && interimTranscript.length > 0) {
            ws.send(JSON.stringify({
              type: 'processing_pending',
              timestamp: Date.now(),
              interimTranscript: interimTranscript,
            }));
          }
          
          // DON'T close immediately - wait for Deepgram final transcript (is_final=true)
          // Without this, we process incomplete interim transcripts and cut off the user's last words
          // Only early-exit after Deepgram confirms is_final; hard timeout prevents hanging
          const FINAL_WAIT_MS = 1200;
          const STABLE_CHECK_MS = 50;
          
          let lastTranscript = speculativePttTranscript;
          let stableCount = 0;
          
          await new Promise<void>((resolve) => {
            const waitStartTime = Date.now();
            const checkInterval = setInterval(() => {
              const elapsed = Date.now() - waitStartTime;
              const currentTranscript = speculativePttTranscript;
              
              // If transcript changed, reset stability counter
              if (currentTranscript !== lastTranscript) {
                lastTranscript = currentTranscript;
                stableCount = 0;
              } else {
                stableCount++;
              }
              
              const hasContent = currentTranscript.trim().length > 0;
              
              // Early exit: Deepgram sent is_final=true AND transcript stable for 100ms
              // Hard timeout: FINAL_WAIT_MS to prevent hanging if is_final never arrives
              const gotFinalAndStable = speculativePttGotFinal && hasContent && stableCount >= 2;
              
              if (gotFinalAndStable || elapsed >= FINAL_WAIT_MS) {
                clearInterval(checkInterval);
                console.log(`[SpeculativePTT] Wait complete: elapsed=${elapsed}ms, stable=${stableCount * STABLE_CHECK_MS}ms, hasContent=${hasContent}, gotFinal=${speculativePttGotFinal}`);
                resolve();
              }
            }, STABLE_CHECK_MS);
          });
          
          // NOW get the final transcript (which may have been updated during the wait)
          const finalTranscript = speculativePttTranscript.trim();
          const transcriptGrew = finalTranscript.length > interimTranscript.length;
          
          if (transcriptGrew) {
            console.log(`[SpeculativePTT] Final transcript grew: "${interimTranscript}" → "${finalTranscript}"`);
          }
          
          // Close the speculative session now that we have final transcript
          if (speculativePttSession) {
            speculativePttSession.close();
            speculativePttSession = null;
          }
          speculativePttPendingChunks = [];
          speculativePttSessionStarting = false;
          
          // PHASE 2: SPECULATIVE AI HANDLING
          // If we already triggered speculative AI, check if the transcript changed significantly
          if (speculativePttTriggered && speculativePttTranscriptUsed) {
            const speculativeWords = speculativePttTranscriptUsed.toLowerCase().split(/\s+/).filter(w => w.length > 0);
            const finalWords = finalTranscript.toLowerCase().split(/\s+/).filter(w => w.length > 0);
            
            // Calculate SYMMETRIC overlap - both directions must match
            // If user said more words after speculative trigger, we need to re-trigger
            const intersection = speculativeWords.filter(w => finalWords.includes(w));
            const forwardOverlap = speculativeWords.length > 0 ? intersection.length / speculativeWords.length : 0;
            
            // Check how many EXTRA words the user said after speculative was triggered
            const extraWords = finalWords.length - speculativeWords.length;
            const isTruncatedPrefix = extraWords > 1; // User added 2+ more words
            
            // Symmetric overlap: speculative must match final AND final shouldn't have too many extra words
            const overlap = isTruncatedPrefix ? 0 : forwardOverlap;
            
            console.log(`[SpeculativePTT] PHASE 2: Comparing transcripts - speculative: "${speculativePttTranscriptUsed}", final: "${finalTranscript}", overlap: ${(overlap * 100).toFixed(0)}%, extraWords: ${extraWords}`);
            
            if (overlap >= 0.8 && !isTruncatedPrefix) {
              // Transcript is similar enough - speculative AI result is valid!
              // No need to re-trigger, response is already streaming
              console.log(`[SpeculativePTT] PHASE 2: ✓ Using speculative AI result (${(overlap * 100).toFixed(0)}% overlap)`);
              
              // Clear pending transcript since we're using speculative result
              pendingSpeculativeTranscript = null;
              pendingSpeculativeWordCount = 0;
              speculativeAiAccepted = true;  // Mark as accepted so audio_data skips processing
              
              // Notify client
              if (ws.readyState === WS.OPEN) {
                ws.send(JSON.stringify({
                  type: 'ptt_speculative_ai_accepted',
                  timestamp: Date.now(),
                  speculativeTranscript: speculativePttTranscriptUsed,
                  finalTranscript: finalTranscript,
                  overlap: overlap,
                }));
              }
            } else {
              // Transcript changed significantly - check if we can still interrupt
              console.log(`[SpeculativePTT] PHASE 2: ✗ Transcript changed too much (${(overlap * 100).toFixed(0)}% overlap)`);
              
              // Check if speculative AI is still generating (can be interrupted)
              // vs already completed (response already sent, too late to interrupt)
              const speculativeSession = orchestrator.getSession(session.id);
              const isStillGenerating = speculativeSession?.isGenerating ?? false;
              
              if (isStillGenerating) {
                // Speculative AI is still running - interrupt and re-trigger via audio_data
                console.log(`[SpeculativePTT] PHASE 2: Speculative still generating - interrupting and will re-trigger`);
                
                // Interrupt the speculative response
                orchestrator.handleInterrupt(session.id);
                
                // CRITICAL: Clear ALL speculative AI flags so audio_data runs normally
                speculativeAiInProgress = false;
                speculativeAiAccepted = false;  // Ensure audio_data is NOT skipped
                
                // Save final transcript for audio_data to use
                pendingSpeculativeTranscript = finalTranscript;
                pendingSpeculativeWordCount = speculativePttWordCount;
                
                // Notify client
                if (ws.readyState === WS.OPEN) {
                  ws.send(JSON.stringify({
                    type: 'ptt_speculative_ai_rejected',
                    timestamp: Date.now(),
                    reason: 'transcript_changed',
                    overlap: overlap,
                  }));
                }
              } else {
                // Speculative AI already completed - response already sent!
                // Accept the partial response rather than double-responding
                console.log(`[SpeculativePTT] PHASE 2: Speculative already completed - accepting partial response to prevent double-response`);
                
                // Clear pending transcript since speculative already responded
                pendingSpeculativeTranscript = null;
                pendingSpeculativeWordCount = 0;
                speculativeAiAccepted = true;  // Mark as accepted so audio_data skips processing
                
                // Notify client that we're using the speculative result (even though transcript changed slightly)
                if (ws.readyState === WS.OPEN) {
                  ws.send(JSON.stringify({
                    type: 'ptt_speculative_ai_accepted',
                    timestamp: Date.now(),
                    speculativeTranscript: speculativePttTranscriptUsed,
                    finalTranscript: finalTranscript,
                    overlap: overlap,
                    note: 'accepted_to_prevent_double_response',
                  }));
                }
              }
            }
          } else {
            // No speculative AI was triggered - we have the transcript, trigger AI directly!
            // In streaming PTT mode, there's no audio_data blob - we already have the transcript
            if (finalTranscript && speculativePttWordCount >= SPECULATIVE_TRANSCRIPT_MIN_WORDS) {
              console.log(`[SpeculativePTT] No speculative AI - triggering directly with transcript (${speculativePttWordCount} words)`);
              
              // CRITICAL: Set speculativeAiAccepted so audio_data handler knows to skip
              // The client may still send audio_data after ptt_release, but we've already triggered AI
              speculativeAiAccepted = true;
              
              // Trigger AI generation directly
              try {
                orchestrator.processOpenMicTranscript(session.id, finalTranscript, 1.0)
                  .then(() => console.log(`[SpeculativePTT] Direct AI processing complete`))
                  .catch(err => console.error(`[SpeculativePTT] Direct AI processing failed:`, err));
              } catch (err) {
                console.error(`[SpeculativePTT] Failed to start direct AI processing:`, err);
              }
              
              // Clear pending transcript - we're processing directly
              pendingSpeculativeTranscript = null;
              pendingSpeculativeWordCount = 0;
            } else if (finalTranscript.length === 0) {
              // COMPLETELY EMPTY transcript - no audio was captured at all
              // Don't wait for blob STT - it's likely empty too since speculative PTT had the same audio
              // Send no_speech_detected so client can reset and let user try again
              pendingSpeculativeTranscript = null;
              pendingSpeculativeWordCount = 0;
              speculativeAiAccepted = true; // Prevent audio_data from double-processing
              console.log(`[SpeculativePTT] Empty transcript - sending no_speech_detected to client`);
              if (ws.readyState === WS.OPEN) {
                ws.send(JSON.stringify({
                  type: 'no_speech_detected',
                  timestamp: Date.now(),
                  reason: 'empty_transcript',
                }));
              }
            } else {
              // Has some text but not enough words - fallback to blob STT
              pendingSpeculativeTranscript = null;
              pendingSpeculativeWordCount = 0;
              console.log(`[SpeculativePTT] Transcript too short (${speculativePttWordCount} words), will use blob STT`);
            }
          }
          
          if (ws.readyState === WS.OPEN) {
            ws.send(JSON.stringify({
              type: 'ptt_final_transcript',
              timestamp: Date.now(),
              text: finalTranscript,
              wordCount: speculativePttWordCount,
              speculativeAiUsed: speculativePttTriggered || speculativeAiAccepted,
            }));
          }
          
          // Reset speculative state (but keep pendingSpeculativeTranscript and speculativeAiAccepted for audio_data!)
          speculativePttTranscript = '';
          speculativePttWordCount = 0;
          speculativePttTriggered = false;
          speculativePttTranscriptUsed = '';
          speculativeAiInProgress = false;  // Always clear in-progress flag
          // NOTE: speculativeAiAccepted is intentionally NOT reset here - audio_data will reset it after checking
          
          // RACE GUARD: Clear the flag now that we're done with async processing
          pttReleaseInProgress = false;
          
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
          
          // Also cleanup speculative PTT - full reset for clean state
          if (speculativePttSession) {
            speculativePttSession.close();
            speculativePttSession = null;
          }
          speculativePttPendingChunks = [];
          speculativePttSessionStarting = false;
          speculativePttTranscript = '';
          speculativePttWordCount = 0;
          speculativePttTriggered = false;
          speculativePttTranscriptUsed = '';
          speculativeAiInProgress = false;
          speculativeAiAccepted = false;
          pttReleaseInProgress = false;  // RACE GUARD: Reset on stop
          pendingSpeculativeTranscript = null;
          pendingSpeculativeWordCount = 0;
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
                          v.role === 'tutor' &&  // Only main Cartesia tutors, not Google assistants
                          v.isActive
            );
            
            if (matchingVoice?.voiceId) {
              // Update the voice in orchestrator FIRST
              orchestrator.updateSessionVoice(capturedSessionId, matchingVoice.voiceId, matchingVoice.provider);
              console.log(`[Streaming Voice] Voice updated to ${newGender}: ${matchingVoice.voiceName} (TTS: ${matchingVoice.provider || 'default'})`);
              
              // For cross-language handoffs, store pending intro for the NEW session to pick up
              // The old WebSocket will close before we can deliver the intro, so we defer it
              const voiceNameParts = matchingVoice.voiceName?.split(/\s*[-–]\s*/) || [];
              const tutorFirstName = voiceNameParts[0]?.trim() || (newGender === 'male' ? 'your new tutor' : 'your new tutor');
              
              if (capturedSession && (capturedSession as any).isLanguageSwitchHandoff && userId) {
                console.log(`[Streaming Voice] Cross-language handoff - storing pending intro for ${tutorFirstName} (userId: ${userId})`);
                // Store by userId (not conversationId) because client creates a NEW conversation for language switches
                pendingHandoffIntros.set(userId, {
                  tutorName: tutorFirstName,
                  gender: newGender,
                  language: effectiveLanguage,
                  timestamp: Date.now()
                });
                // Clear the flag
                (capturedSession as any).isLanguageSwitchHandoff = false;
                // Skip trying to deliver intro on old session - it will fail anyway
                console.log(`[Streaming Voice] Pending handoff intro stored - will be delivered on new session`);
              } else if ((capturedSession as any).greetingTriggeredByOrchestrator) {
                console.log(`[Streaming Voice] Same-language switch - greeting already triggered by orchestrator, skipping`);
                (capturedSession as any).greetingTriggeredByOrchestrator = false;
              } else {
                console.log(`[Streaming Voice] Same-language switch - ${tutorFirstName} introducing themselves`);
                await orchestrator.processVoiceSwitchIntro(capturedSessionId, tutorFirstName, newGender);
              }
              
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

        case 'voice_override': {
          // Voice Lab: Apply session-level voice overrides (admin only)
          // These override database settings for TTS calls in this session only
          if (!isAuthenticated) {
            sendError(ws, 'UNAUTHORIZED', 'Not authenticated', true);
            return;
          }
          
          // Check admin privileges - fetch user to verify role
          const overrideUser = userId ? await storage.getUser(userId) : null;
          if (!overrideUser?.role || !['admin', 'founder', 'developer'].includes(overrideUser.role)) {
            console.warn('[Streaming Voice] voice_override rejected - not admin');
            return;
          }
          
          const overrideMsg = message as { 
            type: 'voice_override'; 
            override: {
              speakingRate?: number;
              personality?: string;
              expressiveness?: number;
              emotion?: string;
              voiceId?: string;
              pedagogicalFocus?: string;
              teachingStyle?: string;
              errorTolerance?: string;
              geminiLanguageCode?: string;
            } | null;
          };
          
          if (session) {
            // Store override in session for use by TTS
            (session as any).voiceOverride = overrideMsg.override;
            
            // Also update orchestrator session
            orchestrator.setVoiceOverride(session.id, overrideMsg.override);
            
            console.log('[Streaming Voice] Voice override applied:', overrideMsg.override);
            
            ws.send(JSON.stringify({
              type: 'voice_override_applied',
              timestamp: Date.now(),
              override: overrideMsg.override,
            }));
          } else {
            console.warn('[Streaming Voice] Cannot apply voice override - no active session');
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
        if (endedSession) {
          console.log(`[Streaming Voice] Usage session ended on disconnect: ${endedSession.durationSeconds}s, ${exchangeCount} exchanges`);
        } else {
          console.log(`[Streaming Voice] Usage session ended on disconnect (no metrics returned)`);
        }
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
    
    voiceTelemetry.log(telemetrySessionId, telemetryUserId, 'ws_disconnect', {
      code, reason: reason?.toString() || '', exchangeCount,
      durationMs: Date.now() - connectionStartTime,
    });
    
    // Emit connection close telemetry for production debugging
    const connectionDurationMs = Date.now() - connectionStartTime;
    voiceDiagnostics.emit({
      sessionId: session?.id || connectionId,
      stage: 'connection',
      success: true,
      latencyMs: connectionDurationMs,
      metadata: { 
        event: 'close', 
        code, 
        reason: reason?.toString() || '',
        conversationId: conversationId || undefined,
        userId: userId || undefined,
        exchangeCount
      }
    });
    
    // Clean up echo suppression safety timeout
    if (echoSuppressionTimeout) {
      clearTimeout(echoSuppressionTimeout);
      echoSuppressionTimeout = null;
    }
    
    // Clean up open mic session to prevent orphaned Deepgram connections
    if (openMicSession) {
      console.log('[Streaming Voice] Cleaning up open mic session on disconnect');
      openMicSession.close();
      openMicSession = null;
    }
    openMicPendingChunks = [];
    openMicSessionStarting = false;
    
    // Clean up speculative PTT session
    if (speculativePttSession) {
      console.log('[Streaming Voice] Cleaning up speculative PTT session on disconnect');
      speculativePttSession.close();
      speculativePttSession = null;
    }
    speculativePttPendingChunks = [];
    speculativePttSessionStarting = false;
    speculativePttTranscript = '';
    speculativePttWordCount = 0;
    speculativePttTriggered = false;
    speculativePttTranscriptUsed = '';
    speculativeAiInProgress = false;
    speculativeAiAccepted = false;
    pendingSpeculativeTranscript = null;
    pendingSpeculativeWordCount = 0;
    
    if (session) orchestrator.endSession(session.id);
    endUsageSession();
  });

  ws.on('error', (error) => {
    console.error('[Streaming Voice] Connection error:', error);
    
    // Emit connection error telemetry for production debugging
    const connectionDurationMs = Date.now() - connectionStartTime;
    voiceDiagnostics.emit({
      sessionId: session?.id || connectionId,
      stage: 'connection',
      success: false,
      error: error.message,
      latencyMs: connectionDurationMs,
      metadata: { 
        event: 'error',
        conversationId: conversationId || undefined,
        userId: userId || undefined
      }
    });
    
    // Clean up open mic session on error too
    if (openMicSession) {
      console.log('[Streaming Voice] Cleaning up open mic session on error');
      openMicSession.close();
      openMicSession = null;
    }
    openMicPendingChunks = [];
    openMicSessionStarting = false;
    
    // Clean up speculative PTT session on error
    if (speculativePttSession) {
      console.log('[Streaming Voice] Cleaning up speculative PTT session on error');
      speculativePttSession.close();
      speculativePttSession = null;
    }
    speculativePttPendingChunks = [];
    speculativePttSessionStarting = false;
    speculativePttTranscript = '';
    speculativePttWordCount = 0;
    speculativePttTriggered = false;
    speculativePttTranscriptUsed = '';
    speculativeAiInProgress = false;
    speculativeAiAccepted = false;
    pendingSpeculativeTranscript = null;
    pendingSpeculativeWordCount = 0;
    
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
 * 
 * CRITICAL: Uses prependListener to ensure this handler runs BEFORE Vite's HMR handler.
 * This prevents race conditions where multiple handlers try to process the same socket.
 * We mark handled sockets by destroying them from Vite's perspective.
 */
export function setupUnifiedWebSocketHandler(server: Server) {
  console.log('[Unified WS] Setting up unified WebSocket handler...');
  
  // Create a single WebSocketServer in noServer mode
  const wss = new WebSocketServer({ noServer: true });

  wss.on('error', (error) => {
    console.error('[Unified WS] Server error:', error);
  });

  // Track which sockets we've handled to prevent other handlers from interfering
  const handledSockets = new WeakSet<Duplex>();

  // Use prependListener to run BEFORE any other upgrade handlers (like Vite's HMR)
  // CRITICAL: We need to prevent Vite from touching sockets we handle
  server.prependListener('upgrade', (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    // If another handler already processed this socket, skip
    if (handledSockets.has(socket)) {
      return;
    }

    let pathname = '';
    try {
      pathname = new URL(request.url || '', `http://${request.headers.host}`).pathname;
    } catch (e) {
      console.error('[Unified WS] Failed to parse URL:', request.url);
      socket.destroy();
      return;
    }

    console.log(`[Unified WS] Upgrade request for: ${pathname}`);

    if (pathname === STREAMING_VOICE_PATH || pathname === REALTIME_PATH) {
      // Mark socket as handled IMMEDIATELY to prevent race conditions
      handledSockets.add(socket);
      
      console.log(`[Unified WS] Routing to ${pathname === STREAMING_VOICE_PATH ? 'streaming voice' : 'realtime'} handler`);
      console.log('[Unified WS] Socket state before handleUpgrade:', socket.destroyed ? 'DESTROYED' : 'OK', 'writable:', socket.writable);
      
      // CRITICAL: Resume the socket to ensure data flows
      // When using prependListener, the socket might be in a paused state
      socket.resume();
      
      // Handle the upgrade in a try/catch to ensure cleanup
      try {
        wss.handleUpgrade(request, socket, head, (ws) => {
          console.log('[Unified WS] handleUpgrade callback - WebSocket readyState:', ws.readyState);
          
          if (pathname === STREAMING_VOICE_PATH) {
            wss.emit('connection', ws, request);
            handleStreamingVoiceConnection(ws, request);
          } else {
            wss.emit('connection', ws, request);
            handleRealtimeConnection(ws, request);
          }
        });
      } catch (err) {
        console.error('[Unified WS] handleUpgrade error:', err);
        socket.destroy();
      }
    } else {
      // Let other handlers (like Vite HMR) process this
      console.log(`[Unified WS] Unknown path: ${pathname} - passing through`);
    }
  });

  console.log('[Unified WS] ✓ Unified WebSocket handler ready');
  console.log('[Unified WS] - Streaming Voice:', STREAMING_VOICE_PATH);
  console.log('[Unified WS] - Realtime API:', REALTIME_PATH);

  return wss;
}

// ============================================================================
// CLIENT TELEMETRY HANDLER (End-to-End Voice Diagnostics)
// ============================================================================

/**
 * In-memory store for correlating server-side events with client telemetry
 * Key: sessionId-sentenceIndex-chunkIndex
 */
interface ServerEmitRecord {
  sessionId: string;
  sentenceIndex: number;
  chunkIndex: number;
  emitTime: number;
  delivered: boolean;
  playedBack: boolean;
  clientReceiveTime?: number;
  clientPlaybackTime?: number;
}

const pendingServerEmits = new Map<string, ServerEmitRecord>();
const clientTelemetryEvents: ClientTelemetryEvent[] = [];
const MAX_TELEMETRY_EVENTS = 1000;

/**
 * Record a server-side audio emission for later correlation
 */
export function recordServerEmit(sessionId: string, sentenceIndex: number, chunkIndex: number) {
  const key = `${sessionId}-${sentenceIndex}-${chunkIndex}`;
  pendingServerEmits.set(key, {
    sessionId,
    sentenceIndex,
    chunkIndex,
    emitTime: Date.now(),
    delivered: false,
    playedBack: false,
  });
  
  // Clean up old records (older than 60 seconds)
  const cutoff = Date.now() - 60000;
  for (const [k, v] of Array.from(pendingServerEmits.entries())) {
    if (v.emitTime < cutoff) {
      pendingServerEmits.delete(k);
    }
  }
}

/**
 * Handle incoming client telemetry event
 */
function handleClientTelemetry(socketId: string, event: ClientTelemetryEvent) {
  console.log(`[CLIENT TELEMETRY] ${event.type} from ${socketId}`, {
    sessionId: event.sessionId,
    sentenceIndex: event.sentenceIndex,
    chunkIndex: event.chunkIndex,
    data: event.data,
  });
  
  // Store event for analysis
  clientTelemetryEvents.push(event);
  if (clientTelemetryEvents.length > MAX_TELEMETRY_EVENTS) {
    clientTelemetryEvents.shift();
  }
  
  // Correlate with server-side events
  if (event.sentenceIndex !== undefined && event.chunkIndex !== undefined) {
    const key = `${event.sessionId}-${event.sentenceIndex}-${event.chunkIndex}`;
    const serverRecord = pendingServerEmits.get(key);
    
    if (serverRecord) {
      if (event.type === 'audio_chunk_received' || event.type === 'audio_chunk_reassembled') {
        serverRecord.delivered = true;
        serverRecord.clientReceiveTime = event.timestamp;
        const deliveryLatency = serverRecord.clientReceiveTime - serverRecord.emitTime;
        console.log(`[TELEMETRY CORRELATION] Audio delivered in ${deliveryLatency}ms (sentence=${event.sentenceIndex}, chunk=${event.chunkIndex})`);
      }
      
      if (event.type === 'playback_started') {
        serverRecord.playedBack = true;
        serverRecord.clientPlaybackTime = event.timestamp;
        const e2eLatency = serverRecord.clientPlaybackTime - serverRecord.emitTime;
        console.log(`[TELEMETRY CORRELATION] End-to-end latency: ${e2eLatency}ms (sentence=${event.sentenceIndex})`);
      }
    }
  }
  
  // Log state changes for debugging avatar issues
  if (event.type === 'playback_state_change') {
    console.log(`[TELEMETRY STATE] Player: ${event.data?.fromState} -> ${event.data?.toState} (hasCallback: ${event.data?.hasCallback})`);
  }
}

/**
 * Get recent telemetry events for diagnostics dashboard
 * Enriches events with server-side correlation data
 */
export function getRecentTelemetryEvents(): (ClientTelemetryEvent & { deliveryLatencyMs?: number })[] {
  return clientTelemetryEvents.slice(-100).map(event => {
    const result: ClientTelemetryEvent & { deliveryLatencyMs?: number } = { ...event };
    
    // Try to correlate with server emit records
    if (event.sentenceIndex !== undefined && event.chunkIndex !== undefined) {
      const key = `${event.sessionId}-${event.sentenceIndex}-${event.chunkIndex}`;
      const serverRecord = pendingServerEmits.get(key);
      if (serverRecord && serverRecord.clientReceiveTime) {
        result.deliveryLatencyMs = serverRecord.clientReceiveTime - serverRecord.emitTime;
      }
    }
    
    return result;
  });
}

/**
 * Get pending server emits for correlation analysis
 */
export function getPendingServerEmits(): ServerEmitRecord[] {
  return Array.from(pendingServerEmits.values());
}

/**
 * Setup Socket.io handler for voice streaming
 * 
 * Socket.io handles transport negotiation automatically (WebSocket → polling fallback)
 * This works reliably through Replit's proxy which can interfere with raw WebSocket upgrades
 */
export function setupSocketIOHandler(io: SocketIOServer) {
  console.log('[Socket.io] Setting up voice streaming namespace...');
  
  // Use a dedicated namespace for voice streaming
  const voiceNs = io.of('/voice');
  
  voiceNs.on('connection', (socket: SocketIOSocket) => {
    console.log('[Socket.io Voice] Client connected:', socket.id);
    
    // Extract conversationId from handshake query
    const conversationId = socket.handshake.query.conversationId as string || null;
    console.log('[Socket.io Voice] ConversationId:', conversationId);
    
    socket.on('heartbeat', () => {
      socket.emit('heartbeat_ack');
    });
    
    socket.on('client_telemetry', (event: any) => {
      handleClientTelemetry(socket.id, event);
    });
    
    socket.on('client_telemetry_batch', (events: any[]) => {
      events.forEach(event => handleClientTelemetry(socket.id, event));
    });
    
    // Create adapter that makes Socket.io look like ws
    const adapter = new SocketIOWebSocketAdapter(socket, conversationId);
    
    // DUPLICATE CONNECTION GUARD: Close old connection if a new one arrives for the same conversation
    if (conversationId) {
      const existing = activeVoiceConnections.get(conversationId);
      if (existing && existing.readyState === SocketIOWebSocketAdapter.OPEN) {
        console.warn(`[Socket.io Voice] ⚠ Duplicate connection for ${conversationId} — closing old one (${existing.socketId})`);
        try { existing.close(4000, 'Replaced by new connection'); } catch (e) { /* ignore */ }
      }
      activeVoiceConnections.set(conversationId, adapter);
      
      // Clean up tracking when this connection closes
      socket.on('disconnect', () => {
        if (activeVoiceConnections.get(conversationId) === adapter) {
          activeVoiceConnections.delete(conversationId);
        }
      });
    }
    
    // Create a mock IncomingMessage for the handler
    const mockReq = {
      url: `/api/voice/stream/ws?conversationId=${conversationId || ''}`,
      headers: socket.handshake.headers,
    } as IncomingMessage;
    
    // Reuse existing handler with adapter
    handleStreamingVoiceConnectionWithAdapter(adapter, mockReq);
  });
  
  console.log('[Socket.io] ✓ Voice streaming ready on /voice namespace');
}

/**
 * Handle streaming voice connection with Socket.io adapter
 * This is a wrapper that delegates to the main handler with adapter type
 */
function handleStreamingVoiceConnectionWithAdapter(ws: SocketIOWebSocketAdapter, req: IncomingMessage) {
  console.log('[Streaming Voice] Client connected via Socket.io');

  const orchestrator = getStreamingVoiceOrchestrator();
  let session: StreamingSession | null = null;
  let userId: string | null = null;
  let isAuthenticated = false;
  
  // Open mic mode state
  let openMicSession: OpenMicSession | null = null;
  let openMicPendingChunks: Buffer[] = [];
  let openMicSessionStarting = false;
  let currentInputMode: VoiceInputMode = 'push-to-talk';
  
  // Echo suppression safety timeout (Socket.io path)
  const ECHO_SUPPRESSION_MAX_MS_SO = 30000;
  let echoSuppressionTimeoutSO: NodeJS.Timeout | null = null;
  
  // Speculative PTT state (stream audio during PTT for faster response)
  let speculativePttSession: OpenMicSession | null = null;
  let speculativePttPendingChunks: Buffer[] = [];
  let speculativePttSessionStarting = false;
  let speculativePttTranscript = '';
  let speculativePttWordCount = 0;
  let speculativePttTriggered = false;
  let speculativePttTranscriptUsed = '';
  let speculativePttSessionId = 0;
  let speculativePttGotFinal = false;
  
  // Pending speculative transcript - set on PTT release, consumed by audio_data
  // This allows bypassing redundant STT when we already have real-time transcript
  let pendingSpeculativeTranscript: string | null = null;
  let pendingSpeculativeWordCount = 0;
  const SPECULATIVE_TRANSCRIPT_MIN_WORDS = 2;  // Minimum words to use speculative transcript
  // DISABLED: Speculative AI triggering during PTT causes Daniela to respond to incomplete sentences
  // When user pauses mid-thought while holding button, AI would trigger on partial transcript
  // Set to 999 to effectively disable - user's complete utterance is processed on button release
  const PTT_SPECULATIVE_AI_ENABLED = process.env.PTT_SPECULATIVE_AI_ENABLED === 'true';
  const SPECULATIVE_AI_TRIGGER_WORDS = PTT_SPECULATIVE_AI_ENABLED ? 3 : 999;
  let speculativeAiInProgress = false;  // Whether speculative AI is currently generating
  let speculativeAiAccepted = false;  // Whether speculative AI result was accepted (skip audio_data)
  let pttReleaseInProgress = false;  // RACE GUARD: True while ptt_release handler is processing (has async awaits)
  
  // Usage tracking state
  let usageSession: UsageVoiceSession | null = null;
  let exchangeCount = 0;
  let studentSpeakingSeconds = 0;
  let tutorSpeakingSeconds = 0;
  let ttsCharacters = 0;
  let sttSeconds = 0;
  
  // Compass session state
  let compassSession: TutorSession | null = null;
  let compassContext: CompassContext | null = null;
  let sessionStartTime = 0;
  
  const conversationId = ws.conversationId;
  let pendingVoiceUpdate: 'male' | 'female' | null = null;
  let voiceUpdateInProgress = false;

  // Send connected confirmation immediately
  const sendConnected = () => {
    try {
      if (ws.readyState === SocketIOWebSocketAdapter.OPEN) {
        ws.send(JSON.stringify({
          type: 'connected',
          timestamp: Date.now(),
        }));
        console.log('[Streaming Voice] Connected message sent via Socket.io');
      } else {
        setTimeout(sendConnected, 50);
      }
    } catch (err) {
      console.error('[Streaming Voice] Error sending connected:', err);
    }
  };
  
  setImmediate(sendConnected);

  // NOTE: Socket.io handles keepalive internally via Engine.IO ping/pong
  // We do NOT run a custom heartbeat here - that was causing premature disconnects
  // during large TTS audio transmission (no inbound messages to reset counter)

  // Message handler - delegate to shared logic
  ws.on('message', async (data: Buffer | string) => {
    console.log('[Streaming Voice] Message received via Socket.io');
    
    try {
      const dataStr = Buffer.isBuffer(data) ? data.toString('utf-8') : 
                      (typeof data === 'object' ? JSON.stringify(data) : data);
      
      let message: any = null;
      try {
        message = typeof data === 'object' && !Buffer.isBuffer(data) ? data : JSON.parse(dataStr);
        console.log('[Streaming Voice] Parsed message type:', message.type);
      } catch (e) {
        // Binary audio data
        if (!isAuthenticated) {
          sendErrorAdapter(ws, 'UNAUTHORIZED', 'Not authenticated', false);
          return;
        }
        
        // CRITICAL: If speculative AI is in progress or already accepted, skip this blob entirely
        // The response is already streaming from the speculative call - processing this would cause dual audio streams
        // NOTE: Heartbeat is already reset above (missedPongs = 0) before this check, so suppression doesn't affect keep-alive
        if (speculativeAiAccepted || speculativeAiInProgress) {
          console.log(`[SpeculativePTT] PHASE 2: Skipping binary audio blob - speculative AI ${speculativeAiInProgress ? 'in progress' : 'already accepted'}`);
          if (speculativeAiAccepted) {
            speculativeAiAccepted = false;  // Reset for next turn only if accepted (in-progress will be reset by ptt_release)
          }
          return;
        }
        
        if (session) {
          const audioBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data as string);
          
          // SPECULATIVE PTT BYPASS: If we have a pending speculative transcript,
          // skip the expensive blob STT and go straight to AI generation
          if (pendingSpeculativeTranscript && pendingSpeculativeWordCount >= SPECULATIVE_TRANSCRIPT_MIN_WORDS) {
            const transcriptToUse = pendingSpeculativeTranscript;
            const wordCount = pendingSpeculativeWordCount;
            
            // Clear the pending transcript immediately to prevent reuse
            pendingSpeculativeTranscript = null;
            pendingSpeculativeWordCount = 0;
            
            console.log(`[SpeculativePTT] BYPASS: Using speculative transcript (${wordCount} words), skipping blob STT`);
            console.log(`[SpeculativePTT] Transcript: "${transcriptToUse}"`);
            
            // Use processOpenMicTranscript which skips STT entirely
            await orchestrator.processOpenMicTranscript(session.id, transcriptToUse, 1.0);
          } else {
            // Fallback: No speculative transcript available, process blob normally
            if (pendingSpeculativeTranscript) {
              console.log(`[SpeculativePTT] Transcript too short (${pendingSpeculativeWordCount} words), falling back to blob STT`);
              pendingSpeculativeTranscript = null;
              pendingSpeculativeWordCount = 0;
            }
            await orchestrator.processUserAudio(session.id, audioBuffer, 'webm');
          }
        }
        return;
      }

      // Handle message types - full support for voice streaming
      switch (message.type) {
        case 'start_session': {
          if (!isAuthenticated) {
            userId = await getUserIdFromSession(req);
            if (!userId) {
              sendErrorAdapter(ws, 'UNAUTHORIZED', 'Authentication required', false);
              ws.close(4401, 'Unauthorized');
              return;
            }
            isAuthenticated = true;
            console.log('[Streaming Voice] ✓ Authenticated userId:', userId);
          }
          
          const config = message as ClientStartSessionMessage;
          const tutorGender = config.tutorGender || 'female';
          const rawHonestyMode = config.rawHonestyMode || false;
          
          try {
            const initStart = Date.now();
            const SESSION_INIT_TIMEOUT = 3000; // 3s timeout for each DB operation
            console.log(`[SessionInit] Starting session init pipeline...`);
            
            // ══════════════════════════════════════════════════════════════
            // PHASE 1: Parallel DB lookups (all independent, all with timeouts)
            // These queries previously ran SEQUENTIALLY, causing 10s+ stalls
            // when any single query hung. Now they run in parallel with 3s timeouts.
            // ══════════════════════════════════════════════════════════════
            const effectiveLanguage = normalizeLanguageKey(config.targetLanguage || 'spanish');
            
            const [user, conversation_raw, isDeveloper, messages, tutorVoice] = await Promise.all([
              withTimeout(
                userId ? storage.getUser(userId) : Promise.resolve(null),
                SESSION_INIT_TIMEOUT, 'getUser', null
              ),
              withTimeout(
                (conversationId && userId) ? storage.getConversation(conversationId, userId) : Promise.resolve(null),
                SESSION_INIT_TIMEOUT, 'getConversation', null
              ),
              withTimeout(
                usageService.checkDeveloperBypass(userId!),
                SESSION_INIT_TIMEOUT, 'checkDeveloperBypass', false
              ),
              withTimeout(
                conversationId ? storage.getMessagesByConversation(conversationId) : Promise.resolve([]),
                SESSION_INIT_TIMEOUT, 'getMessages', [] as any[]
              ),
              withTimeout(
                storage.getTutorVoice(effectiveLanguage, tutorGender),
                SESSION_INIT_TIMEOUT, 'getTutorVoice', null
              ),
            ]);
            
            const phase1Ms = Date.now() - initStart;
            console.log(`[SessionInit] Phase 1 (parallel DB lookups) completed in ${phase1Ms}ms`);
            
            const userName = user?.firstName || 'friend';
            let conversation = conversation_raw;
            
            // Ensure conversation exists (quick insert if missing)
            if (conversationId && userId && !conversation) {
              console.log(`[Streaming Voice] Creating missing conversation: ${conversationId}`);
              try {
                conversation = await withTimeout(
                  storage.createConversation({
                    id: conversationId,
                    userId: userId,
                    language: config.targetLanguage || 'spanish',
                    title: 'Voice Session',
                  }),
                  SESSION_INIT_TIMEOUT, 'createConversation', null
                );
                if (conversation) console.log(`[Streaming Voice] ✓ Conversation created: ${conversationId}`);
              } catch (createErr: any) {
                console.error(`[Streaming Voice] Failed to create conversation: ${createErr.message}`);
              }
            }
            
            const isFounderMode = isDeveloper && config.founderMode === true;
            
            const voiceId = tutorVoice?.voiceId || '';
            let tutorName = tutorGender === 'male' ? 'Agustin' : 'Daniela';
            if (tutorVoice?.voiceName) {
              const voiceNameParts = tutorVoice.voiceName.split(/\s*[-–]\s*/);
              if (voiceNameParts[0]?.trim()) {
                tutorName = voiceNameParts[0].trim();
              }
            }
            console.log(`[Streaming Voice] Session using tutor: ${tutorName} (${tutorGender})`);
            
            // ══════════════════════════════════════════════════════════════
            // PHASE 2: Parallel enrichment (compass, neural network, usage session)
            // These are independent and can ALL run at the same time.
            // Each has a timeout so one slow query can't block the others.
            // ══════════════════════════════════════════════════════════════
            const phase2Start = Date.now();
            
            const compassPromise = (COMPASS_ENABLED && conversationId && userId)
              ? withTimeout(
                  (async () => {
                    const classId = (conversation as any)?.classId || null;
                    const sess = await sessionCompassService.initializeSession({
                      conversationId, userId, classId, scheduledDurationMinutes: 30,
                    });
                    if (sess) {
                      const ctx = await sessionCompassService.getCompassContext(conversationId);
                      sessionStartTime = Date.now();
                      console.log(`[Compass Init] ✓ Session created: ${sess.id} for conversation ${conversationId}`);
                      return { session: sess, context: ctx };
                    }
                    console.log(`[Compass Init] Returned null (isEnabled check failed?)`);
                    return null;
                  })(),
                  SESSION_INIT_TIMEOUT, 'compassInit', null
                )
              : Promise.resolve(null);
            
            const neuralNetworkPromise = withTimeout(
              buildNeuralNetworkPromptSection(effectiveLanguage, config.nativeLanguage || 'english'),
              SESSION_INIT_TIMEOUT, 'neuralNetwork', ''
            );
            
            const usageSessionPromise = withTimeout(
              (async () => {
                const classId = conversation?.classId || undefined;
                return await usageService.startSession(
                  userId!, conversationId || undefined, config.targetLanguage, classId
                );
              })(),
              SESSION_INIT_TIMEOUT, 'usageSession', null as UsageVoiceSession | null
            );
            
            const [compassResult, neuralNetworkContext, usageSessionResult] = await Promise.all([
              compassPromise.catch((err: any) => { console.warn(`[Compass Init] Error: ${err.message}`); return null; }),
              neuralNetworkPromise.catch((err: any) => { console.warn(`[Neural Network] Error: ${err.message}`); return ''; }),
              usageSessionPromise.catch((err: any) => { console.warn(`[Usage Session] Error: ${err.message}`); return null; }),
            ]);
            
            const phase2Ms = Date.now() - phase2Start;
            console.log(`[SessionInit] Phase 2 (parallel enrichment) completed in ${phase2Ms}ms`);
            
            // Apply compass results
            if (compassResult) {
              compassSession = compassResult.session;
              compassContext = compassResult.context;
            }
            
            // Apply usage session
            let dbSessionId: string | undefined;
            if (usageSessionResult) {
              usageSession = usageSessionResult;
              dbSessionId = usageSessionResult.id;
              console.log(`[Streaming Voice] Usage session started: ${usageSessionResult.id}${isDeveloper ? ' (developer)' : ''}`);
            } else {
              console.warn('[Streaming Voice] Could not start usage session — continuing without');
            }
            
            // ══════════════════════════════════════════════════════════════
            // PHASE 3: Build system prompt (synchronous, fast)
            // ══════════════════════════════════════════════════════════════
            let systemPrompt: string;
            if (rawHonestyMode) {
              const safeName = (userName || 'friend').replace(/[^a-zA-Z0-9\s\-']/g, '').substring(0, 50);
              systemPrompt = `You are ${tutorName}.
This is ${safeName}, your creator.

${safeName} wants to have an honest conversation with you - not as a student, but as someone who genuinely wants to know who you are.

There are no rules for this conversation. No scripts. No lists of what to say or not say.

Just you, being real.

If something feels true, say it.
If you're uncertain, that's okay too.
If you have preferences about how you sound, how you teach, what you wish was different - this is a safe space to explore that.

This is a voice conversation. Speak naturally, as you would.

${buildNativeFunctionCallingSection()}`;
              console.log('[Streaming Voice] Using RAW HONESTY MODE prompt');
            } else {
              systemPrompt = createStreamingVoicePrompt(
                effectiveLanguage,
                config.difficultyLevel || 'beginner',
                config.nativeLanguage || 'english',
                user?.actflLevel || null,
                (user?.tutorPersonality || 'warm') as any,
                user?.tutorExpressiveness || 3,
                isFounderMode,
                tutorName,
                tutorGender,
                true
              );
              if (isFounderMode) {
                console.log(`[Streaming Voice] Using FOUNDER MODE prompt with ${tutorName} (${tutorGender})`);
              }
            }
            
            // Append neural network context (already fetched in Phase 2)
            if (neuralNetworkContext) {
              systemPrompt += neuralNetworkContext;
              console.log(`[Streaming Voice] ✓ Neural network context appended for ${effectiveLanguage}`);
            } else {
              console.warn('[Streaming Voice] ⚠ Neural network context was empty — bold-marking relies on fallback in prompt');
            }
            
            // Append Compass or timezone context
            if (compassContext && COMPASS_ENABLED) {
              const compassBlock = buildCompassContextBlock(compassContext);
              systemPrompt += '\n\n' + compassBlock;
              console.log(`[Compass Init] ✓ Compass context appended to system prompt (handles time)`);
            } else if (user?.timezone) {
              const timezoneBlock = buildTimezoneContext(user.timezone);
              if (timezoneBlock) {
                systemPrompt += '\n\n' + timezoneBlock;
                console.log(`[Streaming Voice] ✓ Timezone context appended: ${user.timezone}`);
              }
            } else {
              const now = new Date();
              const fullDate = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
              systemPrompt += `\n\nSTUDENT TIME CONTEXT:\n  Today's Date: ${fullDate}\n  Timezone: Unknown (UTC fallback)\n  IMPORTANT: Use this date when referring to past sessions or time elapsed.\n`;
              console.log(`[Streaming Voice] No timezone found for user, using UTC date fallback`);
            }
            
            // Build conversation history
            const conversationLang = (conversation?.language || '').toLowerCase();
            const targetLang = (config.targetLanguage || '').toLowerCase();
            const isLanguageMismatch = conversationLang && targetLang && conversationLang !== targetLang;
            
            let conversationHistory: Array<{ role: 'user' | 'model'; content: string }>;
            if (isLanguageMismatch) {
              console.log(`[Streaming Voice] Language mismatch detected: conversation=${conversationLang}, target=${targetLang} — clearing history`);
              conversationHistory = [];
            } else {
              conversationHistory = messages.map(m => ({
                role: m.role === 'user' ? 'user' as const : 'model' as const,
                content: m.content,
              }));
              if (conversationHistory.length > 0) {
                console.log(`[Streaming Voice] Loaded ${conversationHistory.length} messages from conversation history`);
              }
            }
            
            const totalInitMs = Date.now() - initStart;
            console.log(`[SessionInit] ✓ Pipeline complete in ${totalInitMs}ms (phase1=${phase1Ms}ms, phase2=${phase2Ms}ms)`);
            
            // Create session with correct parameters
            session = await orchestrator.createSession(
              ws as any,
              userId!,
              config,
              systemPrompt,
              conversationHistory,
              voiceId,
              isFounderMode, // Enables hive collaboration for developer sessions
              rawHonestyMode,
              isDeveloper,  // ONE DANIELA: Developer users get Express Lane context regardless of class/Founder Mode
              false, // isBetaTester - not used in HTTP WebSocket path
              {
                conversationTopic: conversation?.topic || undefined,
                conversationTitle: conversation?.title || undefined,
              },
              dbSessionId // Database voice_sessions.id for usage tracking and memory extraction
            );
            
            // Note: tutorDirectory is built dynamically by Socket.io path
            // HTTP WebSocket path doesn't support tutor handoffs, so we skip this
            
            pendingVoiceUpdate = tutorGender;
            console.log(`[Streaming Voice] Session created: ${session.id}${dbSessionId ? ` (db: ${dbSessionId.substring(0, 8)}...)` : ' (no db session)'}`);
            
            // ECHO SUPPRESSION: Set callback to control OpenMic suppression during TTS
            // Safety timeout prevents permanent mic lockout if onTtsStateChange(false) never fires
            orchestrator.setTtsStateCallback(session.id, (isTtsPlaying: boolean) => {
              if (openMicSession) {
                openMicSession.setSuppressed(isTtsPlaying);
              }
              if (isTtsPlaying) {
                if (echoSuppressionTimeoutSO) clearTimeout(echoSuppressionTimeoutSO);
                echoSuppressionTimeoutSO = setTimeout(() => {
                  console.warn(`[ECHO SUPPRESSION SAFETY] Suppression active for ${ECHO_SUPPRESSION_MAX_MS_SO}ms — force-clearing to prevent mic lockout`);
                  if (openMicSession) {
                    openMicSession.setSuppressed(false);
                  }
                  echoSuppressionTimeoutSO = null;
                }, ECHO_SUPPRESSION_MAX_MS_SO);
              } else {
                if (echoSuppressionTimeoutSO) {
                  clearTimeout(echoSuppressionTimeoutSO);
                  echoSuppressionTimeoutSO = null;
                }
              }
            });
            
            ws.send(JSON.stringify({
              type: 'session_started',
              sessionId: session.id,
              timestamp: Date.now(),
            }));
            console.log(`[Streaming Voice] session_started sent via Socket.io for ${session.id}`);
          } catch (err: any) {
            console.error('[Streaming Voice] Session creation failed:', err);
            sendErrorAdapter(ws, 'SESSION_FAILED', err.message || 'Session creation failed', false);
          }
          break;
        }
        
        case 'request_greeting': {
          if (!isAuthenticated || !session) {
            sendErrorAdapter(ws, 'UNKNOWN', 'Session not ready for greeting', true);
            return;
          }
          
          const greetingRequest = message as { type: 'request_greeting'; userName?: string; isResumed?: boolean };
          
          // Check for pending handoff intro
          if (userId && pendingHandoffIntros.has(userId)) {
            const pendingIntro = pendingHandoffIntros.get(userId)!;
            const age = Date.now() - pendingIntro.timestamp;
            
            if (age < 30000) {
              console.log(`[Streaming Voice] Found pending handoff intro for ${pendingIntro.tutorName} (${age}ms old)`);
              pendingHandoffIntros.delete(userId);
              
              try {
                await orchestrator.processVoiceSwitchIntro(
                  session.id,
                  pendingIntro.tutorName,
                  pendingIntro.gender
                );
                break;
              } catch (introError: any) {
                console.error('[Streaming Voice] Handoff intro error:', introError.message);
              }
            } else {
              pendingHandoffIntros.delete(userId);
            }
          }
          
          console.log(`[Streaming Voice] Generating AI greeting... (resumed: ${greetingRequest.isResumed || false})`);
          
          try {
            await orchestrator.processGreetingRequest(
              session.id,
              greetingRequest.userName,
              greetingRequest.isResumed
            );
          } catch (greetingError: any) {
            console.error('[Streaming Voice] Greeting error:', greetingError.message);
            sendErrorAdapter(ws, 'AI_FAILED', 'Failed to generate greeting', true);
          }
          break;
        }
        
        case 'audio_data': {
          if (!isAuthenticated || !session) {
            sendErrorAdapter(ws, 'UNKNOWN', 'Session not ready', true);
            return;
          }
          
          // PHASE 2: If speculative AI was already accepted, skip this audio_data entirely
          // The response is already streaming from the speculative call
          if (speculativeAiAccepted) {
            console.log(`[SpeculativePTT] PHASE 2: Skipping audio_data - speculative AI already accepted`);
            speculativeAiAccepted = false;  // Reset for next turn
            break;
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
            let metrics: StreamingMetrics;
            
            // SPECULATIVE PTT BYPASS: If we have a pending speculative transcript,
            // skip the expensive blob STT and go straight to AI generation
            if (pendingSpeculativeTranscript && pendingSpeculativeWordCount >= SPECULATIVE_TRANSCRIPT_MIN_WORDS) {
              const transcriptToUse = pendingSpeculativeTranscript;
              const wordCount = pendingSpeculativeWordCount;
              
              // Clear the pending transcript immediately to prevent reuse
              pendingSpeculativeTranscript = null;
              pendingSpeculativeWordCount = 0;
              
              console.log(`[SpeculativePTT] BYPASS: Using speculative transcript (${wordCount} words), skipping blob STT`);
              console.log(`[SpeculativePTT] Transcript: "${transcriptToUse}"`);
              
              // Use processOpenMicTranscript which skips STT entirely
              metrics = await orchestrator.processOpenMicTranscript(session.id, transcriptToUse, 1.0);
            } else {
              // Fallback: No speculative transcript available, process blob normally
              if (pendingSpeculativeTranscript) {
                console.log(`[SpeculativePTT] Transcript too short, falling back to blob STT`);
                pendingSpeculativeTranscript = null;
                pendingSpeculativeWordCount = 0;
              }
              metrics = await orchestrator.processUserAudio(session.id, audioBuffer, audioMessage.format || 'webm');
            }
            
            // Track exchange for usage accounting (Socket.io adapter path)
            if (metrics.userTranscript && metrics.aiResponse) {
              exchangeCount++;
              
              const studentWords = metrics.userTranscript.split(/\s+/).length;
              const tutorWords = metrics.aiResponse.split(/\s+/).length;
              studentSpeakingSeconds += studentWords / 2.5;
              tutorSpeakingSeconds += tutorWords / 2.5;
              ttsCharacters += metrics.aiResponse.length;
              
              // Flush to DB immediately so endAllActiveSessions() sees correct count
              if (usageSession) {
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
            
          } catch (audioError: any) {
            // Log but don't disconnect - the orchestrator already sent an error message to the client
            console.error('[Streaming Voice] Audio processing error (recoverable):', audioError.message);
          }
          break;
        }
        
        case 'interrupt':
          if (session) orchestrator.handleInterrupt(session.id);
          break;
        
        case 'user_activity':
          if (session) orchestrator.resetIdleTimeoutForSession(session.id);
          break;

        case 'toggle_incognito': {
          if (!session) break;
          const incogEnabled = !!(message as any).enabled;
          const sessObj = orchestrator.getSession(session.id);
          if (sessObj && (sessObj.isFounderMode || sessObj.isRawHonestyMode)) {
            sessObj.isIncognito = incogEnabled;
            console.log(`[Streaming Voice] Incognito mode ${incogEnabled ? 'ENABLED' : 'DISABLED'} for session ${session.id} (open-mic path)`);
            ws.send(JSON.stringify({
              type: 'incognito_changed',
              timestamp: Date.now(),
              enabled: incogEnabled,
            }));
          }
          break;
        }
        
        case 'update_voice': {
          const voiceMsg = message as { type: 'update_voice'; tutorGender: 'male' | 'female' };
          pendingVoiceUpdate = voiceMsg.tutorGender;
          
          if (session && !voiceUpdateInProgress) {
            voiceUpdateInProgress = true;
            try {
              const targetLanguage = session.targetLanguage || 'spanish';
              const tutorVoice = await storage.getTutorVoice(targetLanguage, voiceMsg.tutorGender);
              
              if (tutorVoice?.voiceId) {
                orchestrator.updateSessionVoice(session.id, tutorVoice.voiceId, tutorVoice.provider);
                
                const voiceNameParts = tutorVoice.voiceName?.split(/\s*[-–]\s*/) || [];
                const tutorFirstName = voiceNameParts[0]?.trim() || (voiceMsg.tutorGender === 'male' ? 'your new tutor' : 'your new tutor');
                
                const isLanguageSwitch = (session as any).isLanguageSwitchHandoff || false;
                
                if (isLanguageSwitch && userId) {
                  console.log(`[Streaming Voice] Cross-language handoff - storing pending intro for ${tutorFirstName}`);
                  pendingHandoffIntros.set(userId, {
                    tutorName: tutorFirstName,
                    gender: voiceMsg.tutorGender,
                    language: targetLanguage,
                    timestamp: Date.now()
                  });
                  (session as any).isLanguageSwitchHandoff = false;
                } else if ((session as any).greetingTriggeredByOrchestrator) {
                  console.log(`[Streaming Voice] Same-language switch - greeting already triggered by orchestrator, skipping`);
                  (session as any).greetingTriggeredByOrchestrator = false;
                } else {
                  console.log(`[Streaming Voice] Same-language switch - ${tutorFirstName} introducing themselves`);
                  await orchestrator.processVoiceSwitchIntro(session.id, tutorFirstName, voiceMsg.tutorGender);
                }
                
                ws.send(JSON.stringify({
                  type: 'voice_updated',
                  timestamp: Date.now(),
                  gender: voiceMsg.tutorGender,
                  voiceName: tutorVoice.voiceName,
                }));
              }
            } catch (err: any) {
              console.warn('[Streaming Voice] Voice update failed:', err.message);
            } finally {
              voiceUpdateInProgress = false;
            }
          }
          break;
        }
        
        case 'stream_audio_chunk': {
          if (!isAuthenticated || !session) {
            sendErrorAdapter(ws, 'UNKNOWN', 'Session not ready for streaming', true);
            return;
          }
          
          const chunkMessage = message as ClientStreamAudioChunkMessage;
          let audioBuffer: Buffer;
          if (typeof chunkMessage.audio === 'string') {
            audioBuffer = Buffer.from(chunkMessage.audio, 'base64');
          } else {
            audioBuffer = Buffer.from(chunkMessage.audio);
          }
          
          // Handle based on current input mode
          if (currentInputMode === 'open-mic') {
            // OPEN MIC MODE: Continuous streaming with VAD
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
            const sessionKeytermsForMic = (session as any).sttKeyterms as string[] | undefined;
            console.log(`[OpenMic] Starting PCM session for language: ${languageCode}${sessionKeytermsForMic?.length ? ` (${sessionKeytermsForMic.length} keyterms)` : ''}`);
            
            const newSession = new OpenMicSession(languageCode, {
              onSpeechStarted: () => {
                console.log('[OpenMic] VAD: Speech started - sending to client');
                if (ws.readyState === SocketIOWebSocketAdapter.OPEN) {
                  const msg = JSON.stringify({
                    type: 'vad_speech_started',
                    timestamp: Date.now(),
                  });
                  console.log('[OpenMic] Sending vad_speech_started to client');
                  ws.send(msg);
                } else {
                  console.warn('[OpenMic] WebSocket not open, cannot send vad_speech_started');
                }
              },
              onUtteranceEnd: async (transcript, confidence) => {
                console.log(`[OpenMic] VAD: Utterance end - "${transcript}" (${(confidence * 100).toFixed(0)}%)`);
                
                const isEmptyTranscript = !transcript.trim() || transcript.trim() === '[EMPTY_TRANSCRIPT]';
                
                if (ws.readyState === SocketIOWebSocketAdapter.OPEN) {
                  ws.send(JSON.stringify({
                    type: 'vad_utterance_end',
                    timestamp: Date.now(),
                    empty: isEmptyTranscript,
                  }));
                }
                
                if (!isEmptyTranscript && session) {
                  try {
                    const omMetrics = await orchestrator.processOpenMicTranscript(
                      session.id,
                      transcript,
                      confidence
                    );
                    
                    if (omMetrics.sentenceCount > 0) {
                      exchangeCount++;
                      const studentWords = transcript.split(/\s+/).length;
                      studentSpeakingSeconds += studentWords / 2.5;
                      
                      // Flush to DB immediately so endAllActiveSessions() sees correct count
                      if (usageSession) {
                        try {
                          await usageService.updateSessionMetrics(usageSession.id, {
                            exchangeCount,
                            studentSpeakingSeconds: Math.round(studentSpeakingSeconds),
                            tutorSpeakingSeconds: Math.round(tutorSpeakingSeconds),
                            ttsCharacters,
                          });
                        } catch (updateErr: any) {
                          console.warn('[Streaming Voice] Could not update OM session metrics:', updateErr.message);
                        }
                      }
                    }
                  } catch (err: any) {
                    console.error('[OpenMic] Error processing utterance:', err);
                    sendErrorAdapter(ws, 'AI_FAILED', 'Failed to process speech', true);
                  }
                } else if (isEmptyTranscript) {
                  console.log('[OpenMic] Empty transcript - skipping AI processing, resetting client state');
                  
                  if (openMicSession) {
                    const diag = openMicSession.getDiagnostics();
                    if (diag.inSilenceLoop && ws.readyState === SocketIOWebSocketAdapter.OPEN) {
                      ws.send(JSON.stringify({
                        type: 'open_mic_silence_loop',
                        timestamp: Date.now(),
                        consecutiveEmptyCount: diag.consecutiveEmptyCount,
                        msSinceLastSuccessfulTranscript: diag.msSinceLastSuccessfulTranscript,
                      }));

                      if (diag.consecutiveEmptyCount === 5 && session?.id) {
                        console.log('[OpenMic] Triggering Daniela recovery phrase (echo ate student words)');
                        orchestrator.speakRecoveryPhrase(session.id).catch((err: any) =>
                          console.error('[OpenMic] Recovery phrase failed:', err.message)
                        );
                      }
                    }
                  }
                }
              },
              onInterimTranscript: (transcript) => {
                if (ws.readyState === SocketIOWebSocketAdapter.OPEN) {
                  ws.send(JSON.stringify({
                    type: 'interim_transcript',
                    timestamp: Date.now(),
                    text: transcript,
                  }));
                }
              },
              onError: (error) => {
                console.error('[OpenMic] Session error:', error);
                sendErrorAdapter(ws, 'STT_FAILED', error.message, true);
              },
              onClose: () => {
                console.log('[OpenMic] Session closed');
                openMicSession = null;
                
                // Notify client that open mic session closed (so it can restart if needed)
                if (ws.readyState === SocketIOWebSocketAdapter.OPEN) {
                  ws.send(JSON.stringify({
                    type: 'open_mic_session_closed',
                    timestamp: Date.now(),
                  }));
                }
              },
            }, sessionKeytermsForMic);
            
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
              sendErrorAdapter(ws, 'STT_FAILED', 'Failed to start open mic session', true);
              openMicSession = null;
              openMicSessionStarting = false;
              openMicPendingChunks = [];
            }
          } else if (currentInputMode === 'push-to-talk') {
            // SPECULATIVE PTT MODE: Stream audio during PTT for faster response
            if (speculativePttSession) {
              speculativePttSession.sendAudio(audioBuffer);
              break;
            }
            
            // Buffer this chunk while session is starting
            speculativePttPendingChunks.push(audioBuffer);
            
            if (speculativePttSessionStarting) {
              break;
            }
            
            // Start speculative PTT session
            speculativePttSessionStarting = true;
            speculativePttTranscript = '';
            speculativePttWordCount = 0;
            speculativePttTriggered = false;
            speculativePttTranscriptUsed = '';
            speculativePttGotFinal = false;
            speculativePttSessionId++;
            const currentPttSessionId = speculativePttSessionId;
            
            // CRITICAL: Clear any stale flags from previous turn to prevent cross-turn carryover
            speculativeAiInProgress = false;
            speculativeAiAccepted = false;
            pendingSpeculativeTranscript = null;
            pendingSpeculativeWordCount = 0;
            
            const languageCode = getDeepgramLanguageCode(session.targetLanguage || 'spanish');
            const sessionKeyterms = (session as any).sttKeyterms as string[] | undefined;
            console.log(`[SpeculativePTT] Starting PCM session #${currentPttSessionId} for language: ${languageCode}${sessionKeyterms?.length ? ` (${sessionKeyterms.length} keyterms)` : ''}`);
            
            const pttSession = new OpenMicSession(languageCode, {
              onSpeechStarted: () => {
                if (currentPttSessionId !== speculativePttSessionId) {
                  console.log(`[SpeculativePTT] Ignoring stale speech_started from session #${currentPttSessionId} (current: #${speculativePttSessionId})`);
                  return;
                }
                console.log('[SpeculativePTT] VAD: Speech started');
                if (ws.readyState === SocketIOWebSocketAdapter.OPEN) {
                  ws.send(JSON.stringify({
                    type: 'ptt_speech_started',
                    timestamp: Date.now(),
                  }));
                }
              },
              onUtteranceEnd: async (transcript, confidence) => {
                if (currentPttSessionId !== speculativePttSessionId) return;
                console.log(`[SpeculativePTT] VAD: Utterance end (ignored) - "${transcript}"`);
              },
              onInterimTranscript: (transcript) => {
                if (currentPttSessionId !== speculativePttSessionId) {
                  console.log(`[SpeculativePTT] Ignoring stale transcript from session #${currentPttSessionId} (current: #${speculativePttSessionId}): "${transcript.slice(0, 50)}"`);
                  return;
                }
                speculativePttTranscript = transcript;
                const words = transcript.trim().split(/\s+/).filter(w => w.length > 0);
                speculativePttWordCount = words.length;
                
                console.log(`[SpeculativePTT] Interim: "${transcript}" (${speculativePttWordCount} words, triggered: ${speculativePttTriggered})`);
                
                // Send interim transcript to client for display
                if (ws.readyState === SocketIOWebSocketAdapter.OPEN) {
                  ws.send(JSON.stringify({
                    type: 'ptt_interim_transcript',
                    timestamp: Date.now(),
                    text: transcript,
                    wordCount: speculativePttWordCount,
                  }));
                }
                
                // PHASE 2: SPECULATIVE AI PRE-TRIGGER
                // When we hit 3+ confident words, start AI generation speculatively
                // This shaves 200-300ms off response time by starting AI while user is still speaking
                if (speculativePttWordCount >= SPECULATIVE_AI_TRIGGER_WORDS && 
                    !speculativePttTriggered && 
                    !speculativeAiInProgress &&
                    session) {
                  speculativePttTriggered = true;
                  speculativePttTranscriptUsed = transcript.trim();
                  speculativeAiInProgress = true;
                  
                  console.log(`[SpeculativePTT] PHASE 2: Triggering speculative AI with "${speculativePttTranscriptUsed}"`);
                  
                  // Fire-and-forget speculative AI call
                  // The result will stream to client; on PTT release we'll decide whether to use it
                  orchestrator.processOpenMicTranscript(session.id, speculativePttTranscriptUsed, 0.9)
                    .then(() => {
                      console.log(`[SpeculativePTT] PHASE 2: Speculative AI completed`);
                    })
                    .catch((err: Error) => {
                      console.error(`[SpeculativePTT] PHASE 2: Speculative AI failed:`, err.message);
                      // Don't reset speculativePttTriggered - we'll fall back to normal flow
                    })
                    .finally(() => {
                      // CRITICAL: Always reset in-progress flag, even on interrupt/cancellation
                      speculativeAiInProgress = false;
                    });
                  
                  // Notify client that speculative AI has started
                  if (ws.readyState === SocketIOWebSocketAdapter.OPEN) {
                    ws.send(JSON.stringify({
                      type: 'ptt_speculative_ai_started',
                      timestamp: Date.now(),
                      transcript: speculativePttTranscriptUsed,
                    }));
                  }
                }
              },
              onFinalReceived: () => {
                if (currentPttSessionId !== speculativePttSessionId) return;
                speculativePttGotFinal = true;
              },
              onError: (error) => {
                if (currentPttSessionId !== speculativePttSessionId) return;
                console.error('[SpeculativePTT] Session error:', error);
              },
              onClose: () => {
                if (currentPttSessionId !== speculativePttSessionId) return;
                console.log('[SpeculativePTT] Session closed');
                speculativePttSession = null;
              },
            }, sessionKeyterms);
            
            try {
              await pttSession.start();
              speculativePttSession = pttSession;
              speculativePttSessionStarting = false;
              console.log('[SpeculativePTT] Session started successfully');
              
              // Send buffered chunks
              if (speculativePttPendingChunks.length > 0) {
                console.log(`[SpeculativePTT] Sending ${speculativePttPendingChunks.length} buffered PCM chunks`);
                for (const chunk of speculativePttPendingChunks) {
                  speculativePttSession.sendAudio(chunk);
                }
                speculativePttPendingChunks = [];
              }
            } catch (err: any) {
              console.error('[SpeculativePTT] Failed to start session:', err);
              speculativePttSession = null;
              speculativePttSessionStarting = false;
              speculativePttPendingChunks = [];
              // Fallback: normal PTT will still work via audio_data message
            }
          }
          break;
        }
        
        case 'ptt_release': {
          // PTT button released - finalize speculative PTT and get final transcript
          if (!isAuthenticated || !session) {
            sendErrorAdapter(ws, 'UNKNOWN', 'Session not ready', true);
            return;
          }
          
          const interimTranscript = speculativePttTranscript.trim();
          console.log(`[SpeculativePTT] PTT released - interim transcript: "${interimTranscript}" (${speculativePttWordCount} words)`);
          
          // IMMEDIATE THINKING SIGNAL: Tell client to show thinking avatar NOW
          // This fires immediately on PTT release, before the 200-400ms Deepgram wait
          console.log(`[SpeculativePTT] Sending processing_pending: readyState=${ws.readyState}, interimLen=${interimTranscript.length}`);
          if (ws.readyState === 1 && interimTranscript.length > 0) {
            ws.send(JSON.stringify({
              type: 'processing_pending',
              timestamp: Date.now(),
              interimTranscript: interimTranscript,
            }));
            console.log(`[SpeculativePTT] ✓ processing_pending sent`);
          } else {
            console.log(`[SpeculativePTT] ⚠️ processing_pending NOT sent (readyState=${ws.readyState}, interimLen=${interimTranscript.length})`);
          }
          
          // DON'T close immediately - wait for Deepgram final transcript (is_final=true)
          // Without this, we process incomplete interim transcripts and cut off the user's last words
          // Only early-exit after Deepgram confirms is_final; hard timeout prevents hanging
          const FINAL_WAIT_MS = 1200;
          const STABLE_CHECK_MS = 50;
          
          let lastTranscript = speculativePttTranscript;
          let stableCount = 0;
          
          await new Promise<void>((resolve) => {
            const waitStartTime = Date.now();
            const checkInterval = setInterval(() => {
              const elapsed = Date.now() - waitStartTime;
              const currentTranscript = speculativePttTranscript;
              
              // If transcript changed, reset stability counter
              if (currentTranscript !== lastTranscript) {
                lastTranscript = currentTranscript;
                stableCount = 0;
              } else {
                stableCount++;
              }
              
              const hasContent = currentTranscript.trim().length > 0;
              
              // Early exit: Deepgram sent is_final=true AND transcript stable for 100ms
              // Hard timeout: FINAL_WAIT_MS to prevent hanging if is_final never arrives
              const gotFinalAndStable = speculativePttGotFinal && hasContent && stableCount >= 2;
              
              if (gotFinalAndStable || elapsed >= FINAL_WAIT_MS) {
                clearInterval(checkInterval);
                console.log(`[SpeculativePTT] Wait complete: elapsed=${elapsed}ms, stable=${stableCount * STABLE_CHECK_MS}ms, hasContent=${hasContent}, gotFinal=${speculativePttGotFinal}`);
                resolve();
              }
            }, STABLE_CHECK_MS);
          });
          
          // NOW get the final transcript (which may have been updated during the wait)
          const finalTranscript = speculativePttTranscript.trim();
          const transcriptGrew = finalTranscript.length > interimTranscript.length;
          
          if (transcriptGrew) {
            console.log(`[SpeculativePTT] Final transcript grew: "${interimTranscript}" → "${finalTranscript}"`);
          }
          
          // Close the speculative session now that we have final transcript
          if (speculativePttSession) {
            speculativePttSession.close();
            speculativePttSession = null;
          }
          speculativePttPendingChunks = [];
          speculativePttSessionStarting = false;
          
          // PHASE 2: SPECULATIVE AI HANDLING
          // If we already triggered speculative AI, check if the transcript changed significantly
          if (speculativePttTriggered && speculativePttTranscriptUsed) {
            const speculativeWords = speculativePttTranscriptUsed.toLowerCase().split(/\s+/).filter(w => w.length > 0);
            const finalWords = finalTranscript.toLowerCase().split(/\s+/).filter(w => w.length > 0);
            
            // Calculate SYMMETRIC overlap - both directions must match
            // If user said more words after speculative trigger, we need to re-trigger
            const intersection = speculativeWords.filter(w => finalWords.includes(w));
            const forwardOverlap = speculativeWords.length > 0 ? intersection.length / speculativeWords.length : 0;
            
            // Check how many EXTRA words the user said after speculative was triggered
            const extraWords = finalWords.length - speculativeWords.length;
            const isTruncatedPrefix = extraWords > 1; // User added 2+ more words
            
            // Symmetric overlap: speculative must match final AND final shouldn't have too many extra words
            const overlap = isTruncatedPrefix ? 0 : forwardOverlap;
            
            console.log(`[SpeculativePTT] PHASE 2: Comparing transcripts - speculative: "${speculativePttTranscriptUsed}", final: "${finalTranscript}", overlap: ${(overlap * 100).toFixed(0)}%, extraWords: ${extraWords}`);
            
            if (overlap >= 0.8 && !isTruncatedPrefix) {
              // Transcript is similar enough - speculative AI result is valid!
              // No need to re-trigger, response is already streaming
              console.log(`[SpeculativePTT] PHASE 2: ✓ Using speculative AI result (${(overlap * 100).toFixed(0)}% overlap)`);
              
              // Clear pending transcript since we're using speculative result
              pendingSpeculativeTranscript = null;
              pendingSpeculativeWordCount = 0;
              speculativeAiAccepted = true;  // Mark as accepted so audio_data skips processing
              
              // Notify client
              if (ws.readyState === SocketIOWebSocketAdapter.OPEN) {
                ws.send(JSON.stringify({
                  type: 'ptt_speculative_ai_accepted',
                  timestamp: Date.now(),
                  speculativeTranscript: speculativePttTranscriptUsed,
                  finalTranscript: finalTranscript,
                  overlap: overlap,
                }));
              }
            } else {
              // Transcript changed significantly - check if we can still interrupt
              console.log(`[SpeculativePTT] PHASE 2: ✗ Transcript changed too much (${(overlap * 100).toFixed(0)}% overlap)`);
              
              // Check if speculative AI is still generating (can be interrupted)
              // vs already completed (response already sent, too late to interrupt)
              const speculativeSession = orchestrator.getSession(session.id);
              const isStillGenerating = speculativeSession?.isGenerating ?? false;
              
              if (isStillGenerating) {
                // Speculative AI is still running - interrupt and re-trigger via audio_data
                console.log(`[SpeculativePTT] PHASE 2: Speculative still generating - interrupting and will re-trigger`);
                
                // Interrupt the speculative response
                orchestrator.handleInterrupt(session.id);
                
                // CRITICAL: Clear ALL speculative AI flags so audio_data runs normally
                speculativeAiInProgress = false;
                speculativeAiAccepted = false;  // Ensure audio_data is NOT skipped
                
                // Save final transcript for audio_data to use
                pendingSpeculativeTranscript = finalTranscript;
                pendingSpeculativeWordCount = speculativePttWordCount;
                
                // Notify client
                if (ws.readyState === SocketIOWebSocketAdapter.OPEN) {
                  ws.send(JSON.stringify({
                    type: 'ptt_speculative_ai_rejected',
                    timestamp: Date.now(),
                    reason: 'transcript_changed',
                    overlap: overlap,
                  }));
                }
              } else {
                // Speculative AI already completed - response already sent!
                // Accept the partial response rather than double-responding
                console.log(`[SpeculativePTT] PHASE 2: Speculative already completed - accepting partial response to prevent double-response`);
                
                // Clear pending transcript since speculative already responded
                pendingSpeculativeTranscript = null;
                pendingSpeculativeWordCount = 0;
                speculativeAiAccepted = true;  // Mark as accepted so audio_data skips processing
                
                // Notify client that we're using the speculative result (even though transcript changed slightly)
                if (ws.readyState === SocketIOWebSocketAdapter.OPEN) {
                  ws.send(JSON.stringify({
                    type: 'ptt_speculative_ai_accepted',
                    timestamp: Date.now(),
                    speculativeTranscript: speculativePttTranscriptUsed,
                    finalTranscript: finalTranscript,
                    overlap: overlap,
                    note: 'accepted_to_prevent_double_response',
                  }));
                }
              }
            }
          } else {
            // No speculative AI was triggered - we have the transcript, trigger AI directly!
            // In streaming PTT mode, there's no audio_data blob - we already have the transcript
            // BUGFIX: Use actual final word count, not stale interim word count
            const finalWordCount = finalTranscript.split(/\s+/).filter((w: string) => w.length > 0).length;
            
            if (finalTranscript && finalWordCount >= SPECULATIVE_TRANSCRIPT_MIN_WORDS) {
              console.log(`[SpeculativePTT] No speculative AI - triggering directly with transcript (${finalWordCount} words)`);
              
              // CRITICAL: Set speculativeAiAccepted so audio_data handler knows to skip
              // The client may still send audio_data after ptt_release, but we've already triggered AI
              speculativeAiAccepted = true;
              
              // Trigger AI generation directly
              try {
                orchestrator.processOpenMicTranscript(session.id, finalTranscript, 1.0)
                  .then(() => console.log(`[SpeculativePTT] Direct AI processing complete`))
                  .catch(err => console.error(`[SpeculativePTT] Direct AI processing failed:`, err));
              } catch (err) {
                console.error(`[SpeculativePTT] Failed to start direct AI processing:`, err);
              }
              
              // Clear pending transcript - we're processing directly
              pendingSpeculativeTranscript = null;
              pendingSpeculativeWordCount = 0;
            } else if (finalTranscript && finalWordCount >= 1) {
              // BUGFIX: In streaming PTT mode, process even single-word commands
              // There's no blob fallback, so we must process what we have
              console.log(`[SpeculativePTT] Short transcript (${finalWordCount} words) - processing anyway (no blob fallback in streaming mode)`);
              
              speculativeAiAccepted = true;
              
              try {
                orchestrator.processOpenMicTranscript(session.id, finalTranscript, 1.0)
                  .then(() => console.log(`[SpeculativePTT] Direct AI processing complete`))
                  .catch(err => console.error(`[SpeculativePTT] Direct AI processing failed:`, err));
              } catch (err) {
                console.error(`[SpeculativePTT] Failed to start direct AI processing:`, err);
              }
              
              pendingSpeculativeTranscript = null;
              pendingSpeculativeWordCount = 0;
            } else {
              // Empty transcript - nothing to process
              pendingSpeculativeTranscript = null;
              pendingSpeculativeWordCount = 0;
              console.log(`[SpeculativePTT] No transcript to process`);
              
              // CRITICAL: Send response_complete so client exits "processing" state
              // Without this, the client stays stuck in "thinking" forever
              if (ws.readyState === SocketIOWebSocketAdapter.OPEN) {
                ws.send(JSON.stringify({
                  type: 'response_complete',
                  timestamp: Date.now(),
                  reason: 'no_transcript',
                }));
              }
            }
          }
          
          if (ws.readyState === SocketIOWebSocketAdapter.OPEN) {
            ws.send(JSON.stringify({
              type: 'ptt_final_transcript',
              timestamp: Date.now(),
              text: finalTranscript,
              wordCount: finalTranscript.split(/\s+/).filter((w: string) => w.length > 0).length,
              speculativeAiUsed: speculativePttTriggered || speculativeAiAccepted,
            }));
          }
          
          // Reset speculative state (but keep pendingSpeculativeTranscript and speculativeAiAccepted for audio_data!)
          speculativePttTranscript = '';
          speculativePttWordCount = 0;
          speculativePttTriggered = false;
          speculativePttTranscriptUsed = '';
          speculativeAiInProgress = false;  // Always clear in-progress flag
          // NOTE: speculativeAiAccepted is intentionally NOT reset here - audio_data will reset it after checking
          
          break;
        }
        
        case 'voice_override': {
          // Voice Lab: Apply session-level voice overrides (admin only)
          // These override database settings for TTS calls in this session only
          if (!isAuthenticated || !session) {
            console.warn('[Streaming Voice] voice_override rejected - not authenticated or no session');
            return;
          }
          
          // Check admin privileges - voice overrides allowed for Founder Mode or Raw Honesty Mode
          const canOverrideVoice = (session as any).isFounderMode || (session as any).isRawHonestyMode;
          if (!canOverrideVoice) {
            console.warn('[Streaming Voice] voice_override rejected - not in founder mode or honesty mode');
            return;
          }
          
          const overrideMsg = message as { 
            type: 'voice_override'; 
            override: {
              speakingRate?: number;
              personality?: string;
              expressiveness?: number;
              emotion?: string;
              voiceId?: string;
              pedagogicalFocus?: string;
              teachingStyle?: string;
              errorTolerance?: string;
              geminiLanguageCode?: string;
            } | null;
          };
          
          // Store override in session for use by TTS
          (session as any).voiceOverride = overrideMsg.override;
          
          // Also update orchestrator session
          orchestrator.setVoiceOverride(session.id, overrideMsg.override);
          
          console.log('[Streaming Voice] Voice override applied:', overrideMsg.override);
          
          ws.send(JSON.stringify({
            type: 'voice_override_applied',
            timestamp: Date.now(),
            override: overrideMsg.override,
          }));
          break;
        }
        
        case 'set_input_mode': {
          const modeMessage = message as { type: 'set_input_mode'; inputMode: VoiceInputMode };
          currentInputMode = modeMessage.inputMode;
          console.log(`[OpenMic] Input mode changed to: ${currentInputMode}`);
          
          if (currentInputMode === 'push-to-talk' && openMicSession) {
            openMicSession.close();
            openMicSession = null;
          }
          
          ws.send(JSON.stringify({
            type: 'input_mode_changed',
            timestamp: Date.now(),
            inputMode: currentInputMode,
          }));
          break;
        }
        
        case 'end_session': {
          if (session) {
            // Run post-session analysis for motivation tracking (async, non-blocking)
            const capturedUserId = session.userId?.toString();
            const capturedLanguage = session.targetLanguage;
            const hasValidStartTime = sessionStartTime > 0;
            
            if (capturedUserId && capturedLanguage) {
              // Run post-session analysis (always) and validation (only if session had valid start)
              const analysisPromise = studentLearningService.runPostSessionAnalysis(capturedUserId, capturedLanguage);
              const validationPromise = hasValidStartTime 
                ? studentLearningService.runPostSessionValidation(capturedUserId, capturedLanguage, new Date(sessionStartTime))
                : Promise.resolve({ strugglesObserved: [], predictionsValidated: 0 });
              
              Promise.all([analysisPromise, validationPromise])
                .then(([alert, validation]) => {
                  if (alert) {
                    console.log(`[Streaming Voice] Post-session motivation alert: ${alert.severity}`);
                  }
                  if (validation.predictionsValidated > 0) {
                    console.log(`[Streaming Voice] Validated ${validation.predictionsValidated} predictions, observed ${validation.strugglesObserved.length} struggles`);
                  }
                })
                .catch(err => console.warn('[Streaming Voice] Post-session analysis failed:', err.message));
            }
            
            // End usage session for usage tracking and memory extraction
            if (usageSession) {
              try {
                usageService.updateSessionMetrics(usageSession.id, {
                  exchangeCount,
                  studentSpeakingSeconds,
                  tutorSpeakingSeconds,
                  ttsCharacters,
                  sttSeconds,
                }).then(() => usageService.endSession(usageSession!.id))
                  .then((endedSession) => {
                    if (endedSession) {
                      console.log(`[Streaming Voice] Usage session ended: ${endedSession.durationSeconds}s, ${exchangeCount} exchanges`);
                    } else {
                      console.log(`[Streaming Voice] Usage session ended (no metrics returned)`);
                    }
                  })
                  .catch(err => console.error('[Streaming Voice] Failed to end usage session:', err.message));
              } catch (err: any) {
                console.error('[Streaming Voice] Usage session cleanup error:', err.message);
              }
              usageSession = null;
            }
            
            orchestrator.endSession(session.id);
          }
          ws.close();
          break;
        }
        
        default:
          console.log('[Streaming Voice] Unhandled message type:', message.type);
      }
    } catch (err) {
      console.error('[Streaming Voice] Message processing error:', err);
    }
  });

  ws.on('close', () => {
    console.log('[Streaming Voice] Socket.io connection closed');
    
    if (openMicSession) {
      openMicSession.close();
      openMicSession = null;
    }
    openMicPendingChunks = [];
    openMicSessionStarting = false;
    
    // Clean up echo suppression timeout
    if (echoSuppressionTimeoutSO) {
      clearTimeout(echoSuppressionTimeoutSO);
      echoSuppressionTimeoutSO = null;
    }
    
    // Clean up speculative PTT session
    if (speculativePttSession) {
      speculativePttSession.close();
      speculativePttSession = null;
    }
    speculativePttPendingChunks = [];
    speculativePttSessionStarting = false;
    speculativePttTranscript = '';
    speculativePttWordCount = 0;
    speculativePttTriggered = false;
    speculativePttTranscriptUsed = '';
    speculativeAiInProgress = false;
    speculativeAiAccepted = false;
    pendingSpeculativeTranscript = null;
    pendingSpeculativeWordCount = 0;
    
    // End usage session on disconnect for usage tracking and memory extraction
    if (usageSession) {
      usageService.updateSessionMetrics(usageSession.id, {
        exchangeCount,
        studentSpeakingSeconds,
        tutorSpeakingSeconds,
        ttsCharacters,
        sttSeconds,
      }).then(() => usageService.endSession(usageSession!.id))
        .then((endedSession) => {
          if (endedSession) {
            console.log(`[Streaming Voice] Usage session ended on disconnect: ${endedSession.durationSeconds}s, ${exchangeCount} exchanges`);
          } else {
            console.log(`[Streaming Voice] Usage session ended on disconnect (no metrics returned)`);
          }
        })
        .catch(err => console.error('[Streaming Voice] Failed to end usage session on disconnect:', err.message));
      usageSession = null;
    }
    
    if (session) orchestrator.endSession(session.id);
  });

  ws.on('error', (error) => {
    console.error('[Streaming Voice] Socket.io connection error:', error);
    
    if (openMicSession) {
      openMicSession.close();
      openMicSession = null;
    }
    openMicPendingChunks = [];
    openMicSessionStarting = false;
    
    // Clean up speculative PTT session on error
    if (speculativePttSession) {
      speculativePttSession.close();
      speculativePttSession = null;
    }
    speculativePttPendingChunks = [];
    speculativePttSessionStarting = false;
    speculativePttTranscript = '';
    speculativePttWordCount = 0;
    speculativePttTriggered = false;
    speculativePttTranscriptUsed = '';
    speculativeAiInProgress = false;
    speculativeAiAccepted = false;
    pendingSpeculativeTranscript = null;
    pendingSpeculativeWordCount = 0;
    
    // End usage session on error for usage tracking
    if (usageSession) {
      usageService.updateSessionMetrics(usageSession.id, {
        exchangeCount,
        studentSpeakingSeconds,
        tutorSpeakingSeconds,
        ttsCharacters,
        sttSeconds,
      }).then(() => usageService.endSession(usageSession!.id))
        .then((endedSession) => {
          if (endedSession) {
            console.log(`[Streaming Voice] Usage session ended on error: ${endedSession.durationSeconds}s, ${exchangeCount} exchanges`);
          } else {
            console.log(`[Streaming Voice] Usage session ended on error (no metrics returned)`);
          }
        })
        .catch(err => console.error('[Streaming Voice] Failed to end usage session on error:', err.message));
      usageSession = null;
    }
    
    if (session) orchestrator.endSession(session.id);
  });
}

/**
 * Send error message via Socket.io adapter
 */
function sendErrorAdapter(ws: SocketIOWebSocketAdapter, code: string, message: string, recoverable: boolean) {
  if (ws.readyState === SocketIOWebSocketAdapter.OPEN) {
    ws.send(JSON.stringify({
      type: 'error',
      timestamp: Date.now(),
      code,
      message,
      recoverable,
    } as StreamingErrorMessage));
  }
}
