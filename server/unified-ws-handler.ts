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
import { OpenMicSession, OpenMicEvents, getDeepgramLanguageCode } from './services/deepgram-live-stt';
import { GeminiLiveSession, createGeminiLiveSession, GEMINI_LIVE_VOICE_ENABLED } from './services/gemini-live-session';
import { DANIELA_FUNCTION_DECLARATIONS } from './services/daniela-function-registry';
import { generateCongratulatoryPromptAddition } from './services/competency-verifier';
import { buildCurriculumContext, detectSyllabusQuery } from './services/curriculum-context';
import { usageService } from './services/usage-service';
import { shouldRunPlacementAfterSession, completePlacementAssessment } from './services/placement-assessment-service';
import { sessionCompassService, COMPASS_ENABLED } from './services/session-compass-service';
import { architectVoiceService } from './services/architect-voice-service';
import { voiceTelemetry } from './services/voice-pipeline-telemetry';
import { updateToolEventEngagement, mapWhiteboardTypeToToolType } from './services/pedagogical-insights-service';
import { buildNeuralNetworkPromptSection } from './services/neural-network-retrieval';
import { buildEvelynSystemPrompt, buildGeneSystemPrompt, EVELYN_NAME, GENE_NAME, EVELYN_VOICE_CONFIG, GENE_VOICE_CONFIG, isBiologySession } from './services/biology-persona';
import { buildClioSystemPrompt, buildMarcusSystemPrompt, CLIO_NAME, MARCUS_NAME, CLIO_VOICE_CONFIG, MARCUS_VOICE_CONFIG, isHistorySession } from './services/history-persona';
import { buildAdaSystemPrompt, buildLeoSystemPrompt, ADA_NAME, LEO_NAME, ADA_VOICE_CONFIG, LEO_VOICE_CONFIG, isMathSession } from './services/math-persona';
import { buildMorganSystemPrompt, buildSterlingSystemPrompt, MORGAN_NAME, STERLING_NAME, MORGAN_VOICE_CONFIG, STERLING_VOICE_CONFIG, isBusinessSession } from './services/business-persona';
import { getPredictiveTeachingContext, buildPredictiveTeachingSection, getStudentSnapshotData, buildStudentSnapshotSection, buildStudentMemoryAwarenessSection, type PredictiveTeachingContext, type StudentSnapshotContext } from './services/procedural-memory-retrieval';
import { founderCollabService } from './services/founder-collaboration-service';
import { studentLearningService } from './services/student-learning-service';
import { voiceDiagnostics } from './services/voice-diagnostics-service';
import type { VoiceSession as UsageVoiceSession, CompassContext, TutorSession } from '@shared/schema';
import { voiceGracePeriods } from '@shared/schema';
import { db } from './db';
import { eq, and, gt, lt } from 'drizzle-orm';

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
const activeVoiceConnections = new Map<string, VoiceWSConnection>();

/**
 * Reconnection Grace Period System
 * 
 * When a WebSocket drops (infrastructure timeout, network hiccup), we DON'T immediately
 * end the usage session. Instead, we store it in this map with a grace timer.
 * If the client reconnects within the grace period, the session is RESUMED seamlessly
 * (same usage session, accumulated metrics carried over).
 * If the grace period expires without reconnection, the session is ended normally.
 */
interface PendingReconnectData {
  usageSessionId: string;
  compassSessionActive: boolean;
  exchangeCount: number;
  studentSpeakingSeconds: number;
  tutorSpeakingSeconds: number;
  ttsCharacters: number;
  sttSeconds: number;
  sessionStartTime: number;
  userId: string;
  conversationId: string;
  timer: NodeJS.Timeout;
}
const RECONNECT_GRACE_PERIOD_MS = 15000;
const pendingReconnectSessions = new Map<string, PendingReconnectData>();

function armReconnectTimer(
  conversationId: string,
  pending: PendingReconnectData,
  delayMs: number
): NodeJS.Timeout {
  return setTimeout(async () => {
    const current = pendingReconnectSessions.get(conversationId);
    if (!current) return;
    pendingReconnectSessions.delete(conversationId);
    db.delete(voiceGracePeriods).where(eq(voiceGracePeriods.conversationId, conversationId)).catch(() => {});
    console.log(`[Reconnect Grace] Grace period expired for ${conversationId.substring(0, 8)} — ending session`);
    try {
      await usageService.updateSessionMetrics(current.usageSessionId, {
        exchangeCount: current.exchangeCount,
        studentSpeakingSeconds: current.studentSpeakingSeconds,
        tutorSpeakingSeconds: current.tutorSpeakingSeconds,
        ttsCharacters: current.ttsCharacters,
        sttSeconds: current.sttSeconds,
      });
      const endedSession = await usageService.endSession(current.usageSessionId);
      if (endedSession) {
        console.log(`[Reconnect Grace] Usage session ended: ${endedSession.durationSeconds}s, ${current.exchangeCount} exchanges`);
      }
    } catch (err: any) {
      console.error('[Reconnect Grace] Failed to end session:', err.message);
    }
    if (current.compassSessionActive) {
      try {
        await sessionCompassService.endSession(conversationId);
      } catch (err: any) {
        console.warn('[Reconnect Grace] Failed to end compass session:', err.message);
      }
    }
  }, delayMs);
}

function storePendingReconnect(
  conversationId: string,
  data: Omit<PendingReconnectData, 'timer' | 'conversationId'>
): void {
  const existing = pendingReconnectSessions.get(conversationId);
  if (existing) {
    clearTimeout(existing.timer);
  }

  const entry: PendingReconnectData = { ...data, conversationId, timer: null as any };
  entry.timer = armReconnectTimer(conversationId, entry, RECONNECT_GRACE_PERIOD_MS);
  pendingReconnectSessions.set(conversationId, entry);
  console.log(`[Reconnect Grace] Stored pending session for ${conversationId.substring(0, 8)} (${RECONNECT_GRACE_PERIOD_MS / 1000}s grace)`);

  // Persist to DB for server-restart resilience (fire-and-forget)
  db.insert(voiceGracePeriods).values({
    conversationId,
    usageSessionId: data.usageSessionId,
    compassSessionActive: data.compassSessionActive,
    exchangeCount: data.exchangeCount,
    studentSpeakingSeconds: data.studentSpeakingSeconds,
    tutorSpeakingSeconds: data.tutorSpeakingSeconds,
    ttsCharacters: data.ttsCharacters,
    sttSeconds: data.sttSeconds,
    sessionStartTime: data.sessionStartTime,
    userId: data.userId,
    expiresAt: new Date(Date.now() + RECONNECT_GRACE_PERIOD_MS),
  }).onConflictDoUpdate({
    target: voiceGracePeriods.conversationId,
    set: {
      usageSessionId: data.usageSessionId,
      compassSessionActive: data.compassSessionActive,
      exchangeCount: data.exchangeCount,
      studentSpeakingSeconds: data.studentSpeakingSeconds,
      tutorSpeakingSeconds: data.tutorSpeakingSeconds,
      ttsCharacters: data.ttsCharacters,
      sttSeconds: data.sttSeconds,
      sessionStartTime: data.sessionStartTime,
      userId: data.userId,
      expiresAt: new Date(Date.now() + RECONNECT_GRACE_PERIOD_MS),
    },
  }).catch((err: Error) => {
    console.warn('[Reconnect Grace] DB write failed (in-memory path still active):', err.message);
  });
}

async function claimPendingReconnect(conversationId: string, userId: string): Promise<PendingReconnectData | null> {
  // Fast path: check in-memory map first
  const pending = pendingReconnectSessions.get(conversationId);
  if (pending) {
    if (pending.userId !== userId) {
      console.warn(`[Reconnect Grace] User mismatch for ${conversationId.substring(0, 8)}: expected ${pending.userId}, got ${userId}`);
      return null;
    }
    clearTimeout(pending.timer);
    pendingReconnectSessions.delete(conversationId);
    db.delete(voiceGracePeriods).where(eq(voiceGracePeriods.conversationId, conversationId)).catch(() => {});
    console.log(`[Reconnect Grace] RESUMED session for ${conversationId.substring(0, 8)} — carrying ${pending.exchangeCount} exchanges`);
    return pending;
  }

  // DB fallback: handles server-restart scenario where in-memory map was cleared
  try {
    const rows = await db.select().from(voiceGracePeriods).where(
      and(
        eq(voiceGracePeriods.conversationId, conversationId),
        eq(voiceGracePeriods.userId, userId),
        gt(voiceGracePeriods.expiresAt, new Date())
      )
    );
    if (rows.length === 0) return null;
    const row = rows[0];
    await db.delete(voiceGracePeriods).where(eq(voiceGracePeriods.conversationId, conversationId));
    console.log(`[Reconnect Grace] RESUMED session from DB for ${conversationId.substring(0, 8)} after server restart — carrying ${row.exchangeCount} exchanges`);
    return {
      conversationId: row.conversationId,
      usageSessionId: row.usageSessionId,
      compassSessionActive: row.compassSessionActive,
      exchangeCount: row.exchangeCount,
      studentSpeakingSeconds: row.studentSpeakingSeconds,
      tutorSpeakingSeconds: row.tutorSpeakingSeconds,
      ttsCharacters: row.ttsCharacters,
      sttSeconds: row.sttSeconds,
      sessionStartTime: row.sessionStartTime,
      userId: row.userId,
      timer: null as any,
    };
  } catch (err: any) {
    console.error('[Reconnect Grace] DB claim failed:', err.message);
    return null;
  }
}

async function hydratePendingReconnectsFromDb(): Promise<void> {
  try {
    const now = new Date();
    // Clean up expired entries first
    await db.delete(voiceGracePeriods).where(lt(voiceGracePeriods.expiresAt, now));

    // Load any unexpired entries (e.g., from before a server restart)
    const rows = await db.select().from(voiceGracePeriods).where(
      gt(voiceGracePeriods.expiresAt, now)
    );

    for (const row of rows) {
      const remainingMs = row.expiresAt.getTime() - Date.now();
      if (remainingMs <= 0) continue;
      const entry: PendingReconnectData = {
        conversationId: row.conversationId,
        usageSessionId: row.usageSessionId,
        compassSessionActive: row.compassSessionActive,
        exchangeCount: row.exchangeCount,
        studentSpeakingSeconds: row.studentSpeakingSeconds,
        tutorSpeakingSeconds: row.tutorSpeakingSeconds,
        ttsCharacters: row.ttsCharacters,
        sttSeconds: row.sttSeconds,
        sessionStartTime: row.sessionStartTime,
        userId: row.userId,
        timer: null as any,
      };
      entry.timer = armReconnectTimer(row.conversationId, entry, remainingMs);
      pendingReconnectSessions.set(row.conversationId, entry);
    }

    if (rows.length > 0) {
      console.log(`[Reconnect Grace] Hydrated ${rows.length} pending session(s) from DB after restart`);
    }
  } catch (err: any) {
    console.error('[Reconnect Grace] DB hydration failed (non-fatal):', err.message);
  }
}

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
class SocketIOWebSocketAdapter implements VoiceWSConnection {
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
 * Shared readyState constant for both transports.
 * SocketIOWebSocketAdapter.OPEN === NativeWSAdapter.OPEN === WS.OPEN === 1
 */
const WS_OPEN = 1;

/**
 * Common interface for both native WS and Socket.IO voice connections.
 * Allows handleStreamingVoiceConnectionShared to work with either transport.
 */
interface VoiceWSConnection {
  readonly readyState: number;
  readonly socketId: string;
  readonly conversationId: string | null;
  send(data: string | Buffer): void;
  close(code?: number, reason?: string): void;
  terminate(): void;
  ping(): void;
  on(event: 'message' | 'close' | 'error' | 'pong', handler: (...args: any[]) => void): void;
}

/**
 * Thin adapter that wraps a native WebSocket to satisfy VoiceWSConnection.
 * No message chunking needed — native WS bypasses the Replit proxy 50KB limit.
 */
class NativeWSAdapter implements VoiceWSConnection {
  static OPEN = WS.OPEN;   // = 1
  static CLOSED = WS.CLOSED; // = 3

  private ws: WS;
  private _conversationId: string | null;
  private _socketId: string;

  constructor(ws: WS, conversationId: string | null) {
    this.ws = ws;
    this._conversationId = conversationId;
    this._socketId = `native-ws-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  }

  get readyState(): number { return this.ws.readyState; }
  get socketId(): string { return this._socketId; }
  get conversationId(): string | null { return this._conversationId; }

  send(data: string | Buffer): void {
    if (this.ws.readyState === WS.OPEN) this.ws.send(data);
  }
  close(code?: number, reason?: string): void { this.ws.close(code, reason); }
  terminate(): void { this.ws.terminate(); }
  ping(): void { this.ws.ping(); }

  on(event: 'message' | 'close' | 'error' | 'pong', handler: (...args: any[]) => void): void {
    this.ws.on(event as any, handler as any);
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

// Canonical tutor names per language + gender.
// These override any raw voice-name that may be stored in the voiceName field
// (e.g. "Aoede", "Erinome") — raw voice names must never leak into tutor identity.
const LANGUAGE_TUTOR_NAMES: Record<string, { female: string; male: string }> = {
  spanish:            { female: 'Daniela',  male: 'Agustin'  },
  english:            { female: 'Cindy',    male: 'Blake'    },
  french:             { female: 'Juliette', male: 'Vincent'  },
  german:             { female: 'Greta',    male: 'Lukas'    },
  italian:            { female: 'Liv',      male: 'Luca'     },
  portuguese:         { female: 'Isabel',   male: 'Camilo'   },
  japanese:           { female: 'Sayuri',   male: 'Daisuke'  },
  'mandarin chinese': { female: 'Hua',      male: 'Tao'      },
  korean:             { female: 'Jihyun',   male: 'Minho'    },
  hebrew:             { female: 'Noa',      male: 'Eitan'    },
};

/**
 * Handle streaming voice WebSocket connection (native WS path).
 * All voice logic is unified in handleStreamingVoiceConnectionWithAdapter.
 * This thin shim wraps the native WS in NativeWSAdapter and delegates.
 */
function handleStreamingVoiceConnection(ws: WS, req: IncomingMessage) {
  let conversationId: string | null = null;
  try {
    const url = new URL(req.url || '', 'http://localhost');
    conversationId = url.searchParams.get('conversationId');
  } catch { /* ignore URL parse errors */ }
  const adapter = new NativeWSAdapter(ws, conversationId);
  handleStreamingVoiceConnectionWithAdapter(adapter, req);
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
  hydratePendingReconnectsFromDb().catch((err: Error) => {
    console.error('[Reconnect Grace] Hydration failed on startup:', err.message);
  });

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
 * Handle streaming voice connection — unified handler for all transports.
 * Called by both the native WS path (via NativeWSAdapter) and the Socket.IO path
 * (via SocketIOWebSocketAdapter). All voice logic lives here; transport differences
 * are encapsulated entirely in the adapter layer.
 */
function handleStreamingVoiceConnectionWithAdapter(ws: VoiceWSConnection, req: IncomingMessage) {
  console.log('[Streaming Voice] Client connected');

  const orchestrator = getStreamingVoiceOrchestrator();
  let session: StreamingSession | null = null;
  let userId: string | null = null;
  let isAuthenticated = false;
  
  // Gemini Live voice session (feature-flagged via GEMINI_LIVE_VOICE=true)
  let geminiLiveSession: GeminiLiveSession | null = null;
  // Cached system prompt for the Gemini Live session — needed to restart with a new voice
  let geminiLiveSystemPromptCache = '';
  // Prevent duplicate greeting triggers — client may retry if audio is slow
  let geminiLiveGreetingSent = false;

  // Open mic mode state
  let openMicSession: OpenMicSession | null = null;
  let openMicPendingChunks: Buffer[] = [];
  let openMicSessionStarting = false;
  let currentInputMode: VoiceInputMode = 'push-to-talk';
  // Track how many times open-mic has failed to start in this connection.
  // After 2+ failures we suggest the user switch to push-to-talk.
  let openMicStartFailCount = 0;
  
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
      if (ws.readyState === WS_OPEN) {
        ws.send(JSON.stringify({
          type: 'connected',
          timestamp: Date.now(),
        }));
        console.log('[Streaming Voice] Connected message sent');
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
    console.log('[Streaming Voice] Message received');
    
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

          // GL path: binary blobs are treated the same as stream_audio_chunk — relay to Live session.
          if (geminiLiveSession) {
            geminiLiveSession.sendAudioChunk(audioBuffer);
            return;
          }

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
          const isReconnectSO = config.isReconnect === true;
          const tutorGender = config.tutorGender || 'female';
          const rawHonestyMode = config.rawHonestyMode || false;
          console.log(`[Streaming Voice] Processing start_session (Socket.io)${isReconnectSO ? ' (RECONNECT — will skip greeting)' : ''}`);
          
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
                // When Gemini Live is enabled, prefer the gemini-live provider voice.
                // Each language+gender has both a google and a gemini-live active row;
                // without this, LIMIT 1 returns whichever the DB picks — often google —
                // and the Gemini Live session then falls back to the default voice.
                storage.getTutorVoice(effectiveLanguage, tutorGender, GEMINI_LIVE_VOICE_ENABLED ? 'gemini-live' : undefined),
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
            
            let voiceId = tutorVoice?.voiceId || '';
            // Resolve tutor display name.
            // Priority 1: canonical language+gender lookup (prevents raw voice IDs like "Aoede" leaking
            //              into identity — these are voice names, not tutor names).
            // Priority 2: voiceName field (only used for languages not in the lookup, i.e. custom entries),
            //              parsed before the first dash so "Daniela - Warm Teacher" → "Daniela".
            // Priority 3: gender-based default.
            const langKey = (effectiveLanguage || '').toLowerCase();
            const canonicalNames = LANGUAGE_TUTOR_NAMES[langKey];
            let tutorName: string;
            if (canonicalNames) {
              tutorName = tutorGender === 'male' ? canonicalNames.male : canonicalNames.female;
            } else if (tutorVoice?.voiceName) {
              const voiceNameParts = tutorVoice.voiceName.split(/\s*[-–]\s*/);
              tutorName = voiceNameParts[0]?.trim() || (tutorGender === 'male' ? 'Agustin' : 'Daniela');
            } else {
              tutorName = tutorGender === 'male' ? 'Agustin' : 'Daniela';
            }
            // Biology sessions use Evelyn (female) or Gene (male)
            if (isBiologySession(config.subject, config.targetLanguage)) {
              if (tutorGender === 'male') {
                tutorName = GENE_NAME;
                voiceId = GENE_VOICE_CONFIG.googleVoiceName;
              } else {
                tutorName = EVELYN_NAME;
                voiceId = EVELYN_VOICE_CONFIG.googleVoiceName;
              }
            }
            // History sessions use Clio (female) or Marcus (male)
            if (isHistorySession(config.subject, config.targetLanguage)) {
              if (tutorGender === 'male') {
                tutorName = MARCUS_NAME;
                voiceId = MARCUS_VOICE_CONFIG.googleVoiceName;
              } else {
                tutorName = CLIO_NAME;
                voiceId = CLIO_VOICE_CONFIG.googleVoiceName;
              }
            }
            // Math sessions use Ada (female) or Leo (male)
            if (isMathSession(config.subject, config.targetLanguage)) {
              if (tutorGender === 'male') {
                tutorName = LEO_NAME;
                voiceId = LEO_VOICE_CONFIG.googleVoiceName;
              } else {
                tutorName = ADA_NAME;
                voiceId = ADA_VOICE_CONFIG.googleVoiceName;
              }
            }
            // Business sessions use Morgan (female) or Sterling (male)
            if (isBusinessSession(config.subject, config.targetLanguage)) {
              if (tutorGender === 'male') {
                tutorName = STERLING_NAME;
                voiceId = STERLING_VOICE_CONFIG.googleVoiceName;
              } else {
                tutorName = MORGAN_NAME;
                voiceId = MORGAN_VOICE_CONFIG.googleVoiceName;
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
            
            // Check for pending reconnect session BEFORE starting a new one
            const pendingReconnectSO = isReconnectSO && conversationId
              ? await claimPendingReconnect(conversationId, userId!)
              : null;
            
            const usageSessionPromise = pendingReconnectSO
              ? Promise.resolve(null)
              : withTimeout(
                  (async () => {
                    const classId = conversation?.classId || undefined;
                    return await usageService.startSession(
                      userId!, conversationId || undefined, config.targetLanguage, classId
                    );
                  })(),
                  SESSION_INIT_TIMEOUT, 'usageSession', null as UsageVoiceSession | null
                );

            // Course TOC — fetch early so it can be injected into the GeminiLive system prompt
            // (The orchestrator prefetch also loads this per-turn, but GeminiLive needs it at startup)
            const isSubjectSessionEarly = isBiologySession(config.subject, config.targetLanguage)
              || isHistorySession(config.subject, config.targetLanguage)
              || isMathSession(config.subject, config.targetLanguage)
              || isBusinessSession(config.subject, config.targetLanguage);
            const courseTocPromise = (!isSubjectSessionEarly && userId && effectiveLanguage)
              ? withTimeout(
                  (async () => {
                    const { unifiedDanielaContext } = await import('./services/unified-daniela-context-service');
                    return await unifiedDanielaContext.buildCourseTOC(String(userId), effectiveLanguage);
                  })(),
                  SESSION_INIT_TIMEOUT, 'courseToc', null as string | null
                )
              : Promise.resolve(null as string | null);
            
            // Student snapshot — last session, streak, personal follow-ups (structured progress data)
            const studentSnapshotPromise = (!isSubjectSessionEarly && userId)
              ? withTimeout(
                  getStudentSnapshotData(String(userId), effectiveLanguage),
                  SESSION_INIT_TIMEOUT, 'studentSnapshot', null as StudentSnapshotContext | null
                )
              : Promise.resolve(null as StudentSnapshotContext | null);

            // Student memory context — the relationship core: insights, motivations, struggles,
            // session notes, people connections. This is the history of who they are to each other.
            const studentMemoryContextPromise = (!isSubjectSessionEarly && userId)
              ? withTimeout(
                  storage.getStudentMemoryContext(String(userId), effectiveLanguage),
                  SESSION_INIT_TIMEOUT, 'studentMemoryContext', null
                )
              : Promise.resolve(null);

            // Predictive teaching context — active predictions (top 3 by confidence) and engagement
            // alerts (top 2) from the neural network. Let Daniela anticipate struggles before they surface.
            const predictiveContextPromise = (!isSubjectSessionEarly && userId)
              ? withTimeout(
                  getPredictiveTeachingContext(String(userId), effectiveLanguage),
                  SESSION_INIT_TIMEOUT, 'predictiveContext', null as PredictiveTeachingContext | null
                )
              : Promise.resolve(null as PredictiveTeachingContext | null);

            // Express Lane context — recent Founder↔Daniela strategy discussions filtered to this
            // target language. Only fetched for developer users; gives Daniela her own operational memory.
            const expressLaneContextPromise = (isDeveloper && !isSubjectSessionEarly)
              ? withTimeout(
                  founderCollabService.getRelevantExpressLaneContext({
                    targetLanguage: effectiveLanguage,
                    limit: 10,
                    daysBack: 14,
                  }),
                  SESSION_INIT_TIMEOUT, 'expressLaneContext', null
                )
              : Promise.resolve(null);

            const [compassResult, neuralNetworkContext, usageSessionResult, courseToc, studentSnapshot, studentMemoryContext, predictiveContext, expressLaneResult] = await Promise.all([
              compassPromise.catch((err: any) => { console.warn(`[Compass Init] Error: ${err.message}`); return null; }),
              neuralNetworkPromise.catch((err: any) => { console.warn(`[Neural Network] Error: ${err.message}`); return ''; }),
              usageSessionPromise.catch((err: any) => { console.warn(`[Usage Session] Error: ${err.message}`); return null; }),
              courseTocPromise.catch((err: any) => { console.warn(`[Course TOC] Error: ${err.message}`); return null; }),
              studentSnapshotPromise.catch((err: any) => { console.warn(`[Student Snapshot] Error: ${err.message}`); return null; }),
              studentMemoryContextPromise.catch((err: any) => { console.warn(`[Student Memory Context] Error: ${err.message}`); return null; }),
              predictiveContextPromise.catch((err: any) => { console.warn(`[Predictive Context] Error: ${err.message}`); return null; }),
              expressLaneContextPromise.catch((err: any) => { console.warn(`[Express Lane Context] Error: ${err.message}`); return null; }),
            ]);
            
            const phase2Ms = Date.now() - phase2Start;
            console.log(`[SessionInit] Phase 2 (parallel enrichment) completed in ${phase2Ms}ms`);
            
            // Apply compass results
            if (compassResult) {
              compassSession = compassResult.session;
              compassContext = compassResult.context;
            }
            
            // Apply usage session — either resumed from grace period or newly created
            let dbSessionId: string | undefined;
            if (pendingReconnectSO) {
              dbSessionId = pendingReconnectSO.usageSessionId;
              usageSession = { id: pendingReconnectSO.usageSessionId } as any;
              exchangeCount = pendingReconnectSO.exchangeCount;
              studentSpeakingSeconds = pendingReconnectSO.studentSpeakingSeconds;
              tutorSpeakingSeconds = pendingReconnectSO.tutorSpeakingSeconds;
              ttsCharacters = pendingReconnectSO.ttsCharacters;
              sttSeconds = pendingReconnectSO.sttSeconds;
              sessionStartTime = pendingReconnectSO.sessionStartTime;
              console.log(`[Streaming Voice] RESUMED usage session ${dbSessionId} — ${exchangeCount} exchanges carried over (Socket.io)`);
            } else if (usageSessionResult) {
              usageSession = usageSessionResult;
              dbSessionId = usageSessionResult.id;
              console.log(`[Streaming Voice] Usage session started: ${usageSessionResult.id}${isDeveloper ? ' (developer)' : ''}`);
            } else {
              console.warn('[Streaming Voice] Could not start usage session — continuing without');
            }
            
            // ══════════════════════════════════════════════════════════════
            // PHASE 3: Build system prompt (synchronous, fast)
            // ══════════════════════════════════════════════════════════════
            const isSubjectSession = isBiologySession(config.subject, config.targetLanguage) || isHistorySession(config.subject, config.targetLanguage) || isMathSession(config.subject, config.targetLanguage) || isBusinessSession(config.subject, config.targetLanguage);
            let systemPrompt: string;
            if (isBiologySession(config.subject, config.targetLanguage)) {
              if (tutorGender === 'male') {
                systemPrompt = buildGeneSystemPrompt({ studentName: user?.firstName || undefined });
                console.log('[Streaming Voice] Using GENE (Biology) system prompt');
              } else {
                systemPrompt = buildEvelynSystemPrompt({ studentName: user?.firstName || undefined });
                console.log('[Streaming Voice] Using EVELYN (Biology) system prompt');
              }
            } else if (isHistorySession(config.subject, config.targetLanguage)) {
              if (tutorGender === 'male') {
                systemPrompt = buildMarcusSystemPrompt({ studentName: user?.firstName || undefined });
                console.log('[Streaming Voice] Using MARCUS (History) system prompt');
              } else {
                systemPrompt = buildClioSystemPrompt({ studentName: user?.firstName || undefined });
                console.log('[Streaming Voice] Using CLIO (History) system prompt');
              }
            } else if (isMathSession(config.subject, config.targetLanguage)) {
              if (tutorGender === 'male') {
                systemPrompt = buildLeoSystemPrompt({ studentName: user?.firstName || undefined });
                console.log('[Streaming Voice] Using LEO (Math) system prompt');
              } else {
                systemPrompt = buildAdaSystemPrompt({ studentName: user?.firstName || undefined });
                console.log('[Streaming Voice] Using ADA (Math) system prompt');
              }
            } else if (isBusinessSession(config.subject, config.targetLanguage)) {
              if (tutorGender === 'male') {
                systemPrompt = buildSterlingSystemPrompt({ studentName: user?.firstName || undefined });
                console.log('[Streaming Voice] Using STERLING (Business) system prompt');
              } else {
                systemPrompt = buildMorganSystemPrompt({ studentName: user?.firstName || undefined });
                console.log('[Streaming Voice] Using MORGAN (Business) system prompt');
              }
            } else if (rawHonestyMode) {
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
            
            // Append neural network context — language tutors only (subject tutors have their own domain knowledge)
            if (!isSubjectSession) {
              if (neuralNetworkContext) {
                systemPrompt += neuralNetworkContext;
                console.log(`[Streaming Voice] ✓ Neural network context appended for ${effectiveLanguage}`);
              } else {
                console.warn('[Streaming Voice] ⚠ Neural network context was empty — bold-marking relies on fallback in prompt');
              }

              // Course TOC — inject for language sessions so Daniela knows the full chapter/lesson map.
              // This is critical for GeminiLive (audio-only, no per-turn injection) so she can reference
              // any chapter by number and know lesson IDs for show_sentence_table calls.
              if (courseToc) {
                systemPrompt += `\n\n═══════════════════════════════════════════════════════════════════\n🗺️ COURSE MAP — Full Chapter & Lesson Reference\n(You carry this so you can reference any chapter or lesson accurately in conversation. Lesson IDs in brackets are for show_sentence_table calls.)\n═══════════════════════════════════════════════════════════════════\n${courseToc}`;
                const unitCount = (courseToc.match(/^Ch\./gm) || []).length;
                console.log(`[Streaming Voice] ✓ Course TOC injected into system prompt: ${unitCount} chapters`);
              } else {
                console.log(`[Streaming Voice] No course TOC found for user (no enrollment or no curriculum path)`);
              }
            }

            // Append student snapshot + memory context — language sessions only (not subject tutors)
            // Together these are what let Daniela know David as a person, not a stranger.
            if (!isSubjectSession && user?.firstName) {
              // 1. Snapshot: last session, streak, personal follow-ups
              if (studentSnapshot) {
                const snapshotSection = buildStudentSnapshotSection(user.firstName, studentSnapshot);
                if (snapshotSection) {
                  systemPrompt += snapshotSection;
                  console.log(`[Streaming Voice] ✓ Student snapshot injected (last session: ${studentSnapshot.lastSession?.topic ?? 'none'}, streak: ${studentSnapshot.streak ?? 0})`);
                } else {
                  console.log(`[Streaming Voice] Student snapshot empty — first-time student or no session data yet`);
                }
              }

              // 2. Memory context: insights, motivations, struggles, session notes, people connections
              // This is the relationship core — the accumulated history of who they are to each other.
              if (studentMemoryContext) {
                const memorySection = buildStudentMemoryAwarenessSection(user.firstName, studentMemoryContext);
                if (memorySection) {
                  systemPrompt += memorySection;
                  const totalItems = (studentMemoryContext.insights?.length ?? 0) +
                    (studentMemoryContext.motivations?.length ?? 0) +
                    (studentMemoryContext.struggles?.length ?? 0) +
                    (studentMemoryContext.recentNotes?.length ?? 0) +
                    (studentMemoryContext.connections?.length ?? 0);
                  console.log(`[Streaming Voice] ✓ Student memory context injected (${totalItems} items: ${studentMemoryContext.insights?.length ?? 0} insights, ${studentMemoryContext.motivations?.length ?? 0} motivations, ${studentMemoryContext.struggles?.length ?? 0} struggles, ${studentMemoryContext.recentNotes?.length ?? 0} notes, ${studentMemoryContext.connections?.length ?? 0} connections)`);
                } else {
                  console.log(`[Streaming Voice] Student memory context empty — no relationship history yet`);
                }
              }
            }

            // Append predictive teaching context — anticipated struggles and engagement alerts
            // Gives Daniela foresight on what's coming before the student hits a wall.
            if (!isSubjectSession && predictiveContext) {
              const predictiveSection = buildPredictiveTeachingSection(predictiveContext);
              if (predictiveSection) {
                systemPrompt += predictiveSection;
                console.log(`[Streaming Voice] ✓ Predictive context injected (${predictiveContext.predictions.length} predictions, ${predictiveContext.alerts.length} alerts)`);
              }
            }

            // Append Express Lane context — Daniela's own operational memory from Founder↔Daniela discussions
            // Gives her continuity on teaching strategies we've agreed on, without her having to be told again.
            if (!isSubjectSession && expressLaneResult?.hasRelevantContext) {
              systemPrompt += expressLaneResult.contextString;
              console.log(`[Streaming Voice] ✓ Express Lane context injected (${expressLaneResult.messageCount} messages)`);
            }

            // Append Compass or timezone context — all sessions (language AND subject tutors need session awareness)
            {
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

            // ── Gemini Live voice session (feature-flagged) ──────────────────
            if (GEMINI_LIVE_VOICE_ENABLED) {
              try {
                // Gemini Live uses a one-shot system prompt — it bypasses the per-turn orchestrator
                // injection that the regular pipeline relies on. We must bake ALL of Daniela's
                // accumulated context (growth memories, hive, express lane, student snapshot, etc.)
                // directly into this prompt at startup.
                let geminiLiveSystemPrompt = systemPrompt;

                // ── Phase 1: Wait for orchestrator context prefetch ──────────
                // The orchestrator fires prefetchSessionContext() asynchronously on createSession().
                // We MUST await it here so session.cachedContext is fully populated before we pull
                // from it. Without this, we'd get an empty cache and bake nothing into the prompt.
                try {
                  if (session.contextCacheReady) {
                    await session.contextCacheReady;
                    console.log('[GeminiLive] ✓ Orchestrator context cache ready');
                  }
                } catch (cacheErr: any) {
                  console.warn('[GeminiLive] Context cache wait failed (continuing):', cacheErr.message);
                }

                // ── Phase 2: Bake classroom environment ──────────────────────
                try {
                  const { buildClassroomEnvironment } = await import('./services/classroom-environment');
                  const creditBalance = await usageService.getBalanceWithBypass(String(userId));
                  const classroomCtx = await buildClassroomEnvironment({
                    userId: String(userId),
                    sessionStartTime: Date.now(),
                    targetLanguage: effectiveLanguage,
                    isFounderMode,
                    isRawHonestyMode: rawHonestyMode,
                    isBetaTester: false,
                    isIncognito: false,
                    whiteboardItems: [],
                    sessionImages: [],
                    exchangeCount: conversationHistory.filter(h => h.role === 'user').length,
                    struggleCount: 0,
                    recentConfidences: [],
                    creditRemainingSeconds: creditBalance.remainingSeconds,
                    creditWarningLevel: creditBalance.warningLevel,
                    creditPercentRemaining: creditBalance.percentRemaining,
                    tutorName,
                    studentLearningSection: session.cachedContext?.studentLearningSection,
                    technicalHealthNote: voiceDiagnostics.getTechnicalHealthContext(),
                    activeScenario: null,
                  });
                  if (classroomCtx) {
                    geminiLiveSystemPrompt += '\n\n' + classroomCtx;
                    console.log('[GeminiLive] ✓ Classroom context baked into system prompt');
                  }
                } catch (classroomErr: any) {
                  console.warn('[GeminiLive] Classroom context fetch skipped:', classroomErr.message);
                }

                // ── Phase 3: Bake rich Daniela context from orchestrator cache ──
                // These sections are what make Daniela "herself" — her accumulated teaching
                // wisdom, awareness of the Hive, Express Lane history, and student knowledge.
                // The regular pipeline injects these per-turn; here we bake them upfront.
                //
                // IMPORTANT: Gemini Live native audio model has a system instruction size limit.
                // Only include compact, high-signal sections. DO NOT include:
                //   - fatContextVocabulary (full vocabulary map — can be 30,000+ chars)
                //   - fatContextConversations (raw transcript excerpts — can be 20,000+ chars)
                //   - textChatSection (can be large depending on chat history)
                // These are text-mode artifacts that overwhelm the system prompt for voice.
                const cache = session.cachedContext;
                const richSections: string[] = [];

                if (cache?.growthMemoriesSection) {
                  richSections.push(cache.growthMemoriesSection);
                  console.log('[GeminiLive] ✓ Growth memories baked in');
                }
                if (cache?.identityMemoriesSection) {
                  richSections.push(cache.identityMemoriesSection);
                  console.log('[GeminiLive] ✓ Identity memories baked in');
                }
                if (cache?.hiveContextSection) {
                  richSections.push(cache.hiveContextSection);
                  console.log('[GeminiLive] ✓ Hive context baked in');
                }
                if (cache?.expressLaneSection) {
                  richSections.push(cache.expressLaneSection);
                  console.log('[GeminiLive] ✓ Express Lane context baked in');
                }
                if (cache?.courseTOC) {
                  richSections.push(cache.courseTOC);
                  console.log('[GeminiLive] ✓ Course TOC baked in');
                }
                if (cache?.pedagogyDocContext) {
                  richSections.push(cache.pedagogyDocContext);
                  console.log('[GeminiLive] ✓ Pedagogy doc baked in');
                }
                // Textbook chapter context — the active lesson page/chapter.
                if (cache?.textbookChapterContext) {
                  richSections.push(cache.textbookChapterContext);
                  console.log('[GeminiLive] ✓ Textbook chapter context baked in');
                }
                // FAT profile only — compact student character model (not vocabulary or transcripts).
                if (cache?.fatContextProfile) {
                  richSections.push(cache.fatContextProfile);
                  console.log('[GeminiLive] ✓ FAT profile baked in');
                }
                // fatContextVocabulary and fatContextConversations intentionally excluded —
                // they can each exceed 20,000 chars and are not useful in real-time voice mode.

                if (richSections.length > 0) {
                  const combined = richSections.join('\n\n');
                  // Hard cap: Gemini Live native audio model rejects oversized system instructions
                  // with a 1007 error after setupComplete. Keep total prompt under 40,000 chars.
                  const GL_SYSTEM_PROMPT_CHAR_LIMIT = 40_000;
                  const available = GL_SYSTEM_PROMPT_CHAR_LIMIT - geminiLiveSystemPrompt.length;
                  if (combined.length <= available) {
                    geminiLiveSystemPrompt += '\n\n' + combined;
                  } else if (available > 500) {
                    // Trim to fit — truncate at a paragraph boundary if possible
                    const trimmed = combined.slice(0, available - 100);
                    const lastPara = trimmed.lastIndexOf('\n\n');
                    geminiLiveSystemPrompt += '\n\n' + (lastPara > 0 ? trimmed.slice(0, lastPara) : trimmed);
                    console.warn(`[GeminiLive] ⚠ System prompt truncated to fit ${GL_SYSTEM_PROMPT_CHAR_LIMIT} char limit`);
                  } else {
                    console.warn(`[GeminiLive] ⚠ System prompt already at limit — skipping rich context sections`);
                  }
                }
                console.log(`[GeminiLive] System prompt total length: ${geminiLiveSystemPrompt.length} chars`);

                const glSendMessage = (targetWs: any, message: any) => {
                  try {
                    if (targetWs?.readyState === 1 /* OPEN */) {
                      targetWs.send(JSON.stringify(message));
                    }
                  } catch (_) {}
                };
                // Cache the final system prompt so voice-override reconnects can reuse it
                geminiLiveSystemPromptCache = geminiLiveSystemPrompt;
                geminiLiveSession = createGeminiLiveSession(session, glSendMessage);
                // Pass all Daniela function declarations — gemini-3.1-pro-preview-customtools
                // supports native function calling in Live mode, giving Daniela full access to
                // all tools (whiteboard, memory lookup, scenarios, etc.) with results fed back
                // into her spoken response in real-time.
                await geminiLiveSession.start(geminiLiveSystemPrompt, DANIELA_FUNCTION_DECLARATIONS);
                console.log(`[GeminiLive] Session started with ${DANIELA_FUNCTION_DECLARATIONS.length} tool declarations alongside orchestrator session ${session.id}`);
              } catch (glErr: any) {
                console.error('[GeminiLive] Failed to start Gemini Live session:', glErr.message);
                geminiLiveSession = null;
                // Fall through — session still works via legacy pipeline
              }
            }
            
            // Track reconnection state — prevents double greetings when client reconnects
            (session as any).__isReconnect = isReconnectSO;
            
            // RECONNECT FIX: Restore input mode from config.
            // Every new WS connection defaults currentInputMode to 'push-to-talk', but the client
            // may have been in open-mic mode. Without this restoration, all post-reconnect open-mic
            // audio chunks route to the wrong handler and Deepgram never receives speech.
            if (config.inputMode && config.inputMode !== currentInputMode) {
              currentInputMode = config.inputMode;
              console.log(`[Streaming Voice] Input mode restored from config (Socket.io): ${currentInputMode}${isReconnectSO ? ' (reconnect)' : ''}`);
            }
            
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
          
          // RECONNECTION GUARD: If this session was created via reconnection,
          // skip the greeting to prevent double audio after infrastructure timeout
          if ((session as any).__isReconnect) {
            console.log('[Streaming Voice] Ignoring greeting request — session was reconnected (prevents double audio) [Socket.io]');
            (session as any).__isReconnect = false;
            break;
          }
          
          const greetingRequest = message as { type: 'request_greeting'; userName?: string; isResumed?: boolean; scenarioSlug?: string };
          
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
          
          console.log(`[Streaming Voice] Generating AI greeting... (resumed: ${greetingRequest.isResumed || false}, scenario: ${greetingRequest.scenarioSlug || 'none'})`);
          
          if (geminiLiveSession) {
            // GeminiLive mode: route the greeting through the Live session so the session
            // accumulates Spanish conversation context from turn 1.
            // Guard against the client's 8-second retry sending a duplicate trigger —
            // a second sendClientContent on an active session causes 1011 internal error.
            if (!geminiLiveGreetingSent) {
              geminiLiveGreetingSent = true;
              geminiLiveSession.sendGreetingTrigger(
                greetingRequest.userName,
                greetingRequest.isResumed,
                greetingRequest.scenarioSlug,
              );
            } else {
              console.log('[GeminiLive] Duplicate request_greeting ignored — greeting already sent');
            }
          } else {
            // Legacy orchestrator path (used when GeminiLive is not active)
            try {
              await orchestrator.processGreetingRequest(
                session.id,
                greetingRequest.userName,
                greetingRequest.isResumed,
                greetingRequest.scenarioSlug
              );
            } catch (greetingError: any) {
              console.error('[Streaming Voice] Greeting error:', greetingError.message);
              sendErrorAdapter(ws, 'AI_FAILED', 'Failed to generate greeting', true);
            }
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

          // GEMINI LIVE PATH: Route PTT through Gemini Live when the Live session is active.
          // We prefer the speculative transcript (already captured by the streaming STT during recording).
          // If no transcript is available, we skip silently — open-mic is the preferred mode with GLive.
          if (geminiLiveSession) {
            if (pendingSpeculativeTranscript && pendingSpeculativeWordCount >= 1) {
              const transcript = pendingSpeculativeTranscript;
              pendingSpeculativeTranscript = null;
              pendingSpeculativeWordCount = 0;
              console.log(`[GeminiLive PTT] Routing via text turn (${transcript.length} chars): "${transcript.slice(0, 80)}"`);
              geminiLiveSession.sendTextTurn(transcript);
            } else {
              if (pendingSpeculativeTranscript) {
                pendingSpeculativeTranscript = null;
                pendingSpeculativeWordCount = 0;
              }
              console.log('[GeminiLive PTT] No transcript available — skipping blob (open-mic preferred with Gemini Live)');
            }
            break;
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
          if (geminiLiveSession) {
            geminiLiveSession.interrupt();
          } else if (session) {
            orchestrator.handleInterrupt(session.id);
          }
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
              const tutorVoice = await storage.getTutorVoice(targetLanguage, voiceMsg.tutorGender, GEMINI_LIVE_VOICE_ENABLED ? 'gemini-live' : undefined);
              
              if (tutorVoice?.voiceId) {
                orchestrator.updateSessionVoice(session.id, tutorVoice.voiceId, tutorVoice.provider);
                
                // Resolve tutor first name using canonical lookup (prevents raw voice IDs like
                // "Aoede" appearing in intro speech).
                const switchLangKey = (targetLanguage || '').toLowerCase();
                const switchNames = LANGUAGE_TUTOR_NAMES[switchLangKey];
                const tutorFirstName = switchNames
                  ? (voiceMsg.tutorGender === 'male' ? switchNames.male : switchNames.female)
                  : (() => {
                      const parts = tutorVoice.voiceName?.split(/\s*[-–]\s*/) || [];
                      return parts[0]?.trim() || 'your new tutor';
                    })();
                
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

          // ── Gemini Live path: relay PCM16 directly to the Live session ──
          if (geminiLiveSession) {
            geminiLiveSession.sendAudioChunk(audioBuffer);
            break;
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
            
            const openMicEvents: OpenMicEvents = {
              onSpeechStarted: () => {
                console.log('[OpenMic] VAD: Speech started - sending to client');
                if (ws.readyState === WS_OPEN) {
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
              onSpeechFinal: (transcript: string) => {
                // NOTE: We intentionally do NOT send processing_pending here in open mic mode.
                // speech_final fires after 500ms of silence — but the user may still be mid-sentence
                // (thinking, breathing). Sending "thinking" UI here causes confusing early cutoff
                // perception. processing_pending is sent only at onUtteranceEnd, when submission is certain.
                console.log(`[OpenMic] speech_final received — "${transcript.slice(0, 60)}" — awaiting UtteranceEnd`);
              },
              onUtteranceEnd: async (transcript, confidence) => {
                console.log(`[OpenMic] VAD: Utterance end - "${transcript}" (${(confidence * 100).toFixed(0)}%)`);
                
                const isEmptyTranscript = !transcript.trim() || transcript.trim() === '[EMPTY_TRANSCRIPT]';
                
                if (ws.readyState === WS_OPEN) {
                  ws.send(JSON.stringify({
                    type: 'vad_utterance_end',
                    timestamp: Date.now(),
                    empty: isEmptyTranscript,
                  }));
                  // THINKING SIGNAL: Only send processing_pending when submission is actually
                  // happening — not on speech_final which fires mid-sentence.
                  if (!isEmptyTranscript) {
                    ws.send(JSON.stringify({
                      type: 'processing_pending',
                      timestamp: Date.now(),
                      interimTranscript: transcript,
                    }));
                  }
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
                    if (diag.inSilenceLoop && ws.readyState === WS_OPEN) {
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
                if (ws.readyState === WS_OPEN) {
                  ws.send(JSON.stringify({
                    type: 'interim_transcript',
                    timestamp: Date.now(),
                    text: transcript,
                  }));
                }
              },
              onError: (error) => {
                console.error('[OpenMic] STT runtime error:', error.message);
                // Notify client with a user-friendly degraded-STT message.
                // The session sets itself to null via onClose; the next audio chunk
                // will trigger a fresh start automatically.
                if (ws.readyState === WS_OPEN) {
                  ws.send(JSON.stringify({
                    type: 'stt_degraded',
                    timestamp: Date.now(),
                    userMessage: 'Having trouble hearing you — please try speaking again.',
                    recoverable: true,
                  }));
                }
              },
              onClose: () => {
                console.log('[OpenMic] Session closed');
                openMicSession = null;
                
                // Notify client that open mic session closed (so it can restart if needed)
                if (ws.readyState === WS_OPEN) {
                  ws.send(JSON.stringify({
                    type: 'open_mic_session_closed',
                    timestamp: Date.now(),
                  }));
                }
              },
            };
            
            // Attempt to start STT, with one automatic retry on transient failure.
            let openMicStarted = false;
            for (let attempt = 1; attempt <= 2 && !openMicStarted; attempt++) {
              const attemptSession = new OpenMicSession(languageCode, openMicEvents, sessionKeytermsForMic);
              try {
                if (attempt > 1) {
                  console.warn('[OpenMic] Retrying STT connection (attempt 2 of 2)...');
                  await new Promise<void>(r => setTimeout(r, 1500));
                }
                await attemptSession.start();
                openMicSession = attemptSession;
                openMicSessionStarting = false;
                openMicStarted = true;
                openMicStartFailCount = 0; // Reset on successful start
                console.log(`[OpenMic] Session started successfully (attempt ${attempt})`);
                
                if (openMicPendingChunks.length > 0) {
                  console.log(`[OpenMic] Sending ${openMicPendingChunks.length} buffered PCM chunks`);
                  for (const chunk of openMicPendingChunks) {
                    openMicSession.sendAudio(chunk);
                  }
                  openMicPendingChunks = [];
                }
              } catch (err: any) {
                console.error(`[OpenMic] STT start attempt ${attempt} failed:`, err.message);
              }
            }
            if (!openMicStarted) {
              openMicStartFailCount++;
              console.error(`[OpenMic] All STT start attempts failed (fail #${openMicStartFailCount}) — notifying client`);
              // After 2+ consecutive failures suggest switching to push-to-talk
              const suggestPtt = openMicStartFailCount >= 2;
              if (ws.readyState === WS_OPEN) {
                ws.send(JSON.stringify({
                  type: 'stt_degraded',
                  timestamp: Date.now(),
                  userMessage: suggestPtt
                    ? 'Voice recognition is unavailable right now. Try switching to Push-to-Talk mode.'
                    : 'Having trouble with voice recognition right now. Please try again in a moment.',
                  recoverable: !suggestPtt,
                  suggestPtt,
                }));
              }
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
                if (ws.readyState === WS_OPEN) {
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
                if (ws.readyState === WS_OPEN) {
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
                  if (ws.readyState === WS_OPEN) {
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
                console.error('[SpeculativePTT] STT error:', error.message);
                if (ws.readyState === WS_OPEN) {
                  ws.send(JSON.stringify({
                    type: 'stt_degraded',
                    timestamp: Date.now(),
                    userMessage: 'Having trouble hearing you — please try again.',
                    recoverable: true,
                  }));
                }
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
              console.error('[SpeculativePTT] Failed to start STT session:', err.message);
              speculativePttSession = null;
              speculativePttSessionStarting = false;
              speculativePttPendingChunks = [];
              // Speculative PTT is best-effort — the ptt_release path still works without it.
              // Surface degraded state so user knows there may be a delay.
              if (ws.readyState === WS_OPEN) {
                ws.send(JSON.stringify({
                  type: 'stt_degraded',
                  timestamp: Date.now(),
                  userMessage: 'Voice recognition is slow right now — there may be a delay.',
                  recoverable: true,
                }));
              }
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

          // ── GL fast-path ─────────────────────────────────────────────────────
          // For Gemini Live sessions the speculative Deepgram PTT session is never
          // started — audio streams directly to GL via sendAudioChunk(). GL's own
          // VAD handles turn detection and triggers the response. Waiting 1,200 ms
          // for a Deepgram final that will never arrive would add dead latency to
          // every GL PTT turn, so we exit early here.
          if (geminiLiveSession) {
            console.log('[GeminiLive PTT] ptt_release — GL active, skipping Deepgram wait');
            if (speculativePttSession) {
              speculativePttSession.close();
              speculativePttSession = null;
            }
            break;
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
              if (ws.readyState === WS_OPEN) {
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
                if (ws.readyState === WS_OPEN) {
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
                if (ws.readyState === WS_OPEN) {
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

            if (geminiLiveSession) {
              // GL path: the streaming audio was already delivered to GL via sendAudioChunk().
              // GL's own VAD drives the response; if we also have a transcript, send it as a
              // text turn for reliability. Do NOT set speculativeAiAccepted — the audio_data
              // handler may still have a transcript to contribute via sendTextTurn.
              if (finalTranscript && finalWordCount >= 1) {
                console.log(`[GeminiLive PTT] Routing transcript via text turn (${finalWordCount} words): "${finalTranscript.slice(0, 80)}"`);
                geminiLiveSession.sendTextTurn(finalTranscript);
              } else {
                console.log('[GeminiLive PTT] No transcript — GL VAD will handle response from streamed audio');
              }
            } else if (finalTranscript && finalWordCount >= SPECULATIVE_TRANSCRIPT_MIN_WORDS) {
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
              if (ws.readyState === WS_OPEN) {
                ws.send(JSON.stringify({
                  type: 'response_complete',
                  timestamp: Date.now(),
                  reason: 'no_transcript',
                }));
              }
            }
          }
          
          if (ws.readyState === WS_OPEN) {
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
          
          // Detect if the voice or language code changed so we can restart the Gemini Live session
          const prevVoiceId = (session as any).voiceOverride?.voiceId ?? session.voiceId;
          const prevLangCode = (session as any).voiceOverride?.geminiLanguageCode;
          const nextVoiceId = overrideMsg.override?.voiceId;
          const nextLangCode = overrideMsg.override?.geminiLanguageCode;

          // Store override in session for use by TTS
          (session as any).voiceOverride = overrideMsg.override;
          
          // Also update orchestrator session
          orchestrator.setVoiceOverride(session.id, overrideMsg.override);
          
          console.log('[Streaming Voice] Voice override applied:', overrideMsg.override);

          // ── Gemini Live reconnect ──────────────────────────────────────────
          // Gemini Live bakes both the voice name AND the languageCode into the
          // WebSocket handshake — neither can be changed mid-session.  Reconnect
          // whenever either changes.
          const voiceChanged = nextVoiceId && nextVoiceId !== prevVoiceId;
          const langCodeChanged = nextLangCode !== prevLangCode;
          if ((voiceChanged || langCodeChanged) && geminiLiveSession && geminiLiveSystemPromptCache) {
            const changeReason = voiceChanged
              ? `voice changed ${prevVoiceId} → ${nextVoiceId}`
              : `languageCode changed ${prevLangCode ?? 'default'} → ${nextLangCode ?? 'default'}`;
            console.log(`[GeminiLive] ${changeReason}, reconnecting…`);
            try {
              geminiLiveSession.stop();
              geminiLiveSession = null;

              const glSendMessage = (targetWs: any, msg: any) => {
                try {
                  if (targetWs?.readyState === 1) targetWs.send(JSON.stringify(msg));
                } catch (_) {}
              };
              geminiLiveSession = createGeminiLiveSession(session, glSendMessage);
              await geminiLiveSession.start(geminiLiveSystemPromptCache, DANIELA_FUNCTION_DECLARATIONS);
              console.log(`[GeminiLive] Reconnected with voice: ${nextVoiceId} (${DANIELA_FUNCTION_DECLARATIONS.length} tools)`);
            } catch (reconnErr: any) {
              console.error('[GeminiLive] Voice reconnect failed:', reconnErr.message);
              geminiLiveSession = null;
            }
          }
          
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

    // Capture Gemini Live metrics before stopping (stop() resets internal state)
    if (geminiLiveSession) {
      const glMetrics = geminiLiveSession.getUsageSummary();
      const glExchanges = geminiLiveSession.getCompletedExchangeCount();
      const glOutputChars = geminiLiveSession.getTotalOutputCharacters();
      exchangeCount += glExchanges;
      ttsCharacters += glOutputChars;
      if (glMetrics.inputTokens > 0 || glMetrics.outputTokens > 0) {
        console.log(`[GeminiLive] Session end metrics — exchanges: ${glExchanges}, outputChars: ${glOutputChars}, tokens: ${glMetrics.inputTokens}in/${glMetrics.outputTokens}out`);
      }
      // Store GL token counts on usageSession for updateSessionMetrics below
      if (usageSession) {
        (usageSession as any)._glInputTokens = glMetrics.inputTokens;
        (usageSession as any)._glOutputTokens = glMetrics.outputTokens;
      }
      geminiLiveSession.stop();
      geminiLiveSession = null;
    }
    
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
    
    // End usage session on disconnect — use grace period for seamless reconnection
    if (usageSession && conversationId && userId) {
      console.log(`[Streaming Voice] Socket.io disconnect — storing session for reconnect grace period (${conversationId.substring(0, 8)})`);
      storePendingReconnect(conversationId, {
        usageSessionId: usageSession.id,
        compassSessionActive: !!compassSession,
        exchangeCount,
        studentSpeakingSeconds: Math.round(studentSpeakingSeconds),
        tutorSpeakingSeconds: Math.round(tutorSpeakingSeconds),
        ttsCharacters,
        sttSeconds: Math.round(sttSeconds),
        sessionStartTime,
        userId: userId!,
      });
      usageSession = null;
      compassSession = null;
      compassContext = null;
    } else if (usageSession) {
      const glInputTokens = (usageSession as any)._glInputTokens as number | undefined;
      const glOutputTokens = (usageSession as any)._glOutputTokens as number | undefined;
      usageService.updateSessionMetrics(usageSession.id, {
        exchangeCount,
        studentSpeakingSeconds: Math.round(studentSpeakingSeconds),
        tutorSpeakingSeconds: Math.round(tutorSpeakingSeconds),
        ttsCharacters,
        sttSeconds: Math.round(sttSeconds),
        ...(glInputTokens ? { llmInputTokens: glInputTokens } : {}),
        ...(glOutputTokens ? { llmOutputTokens: glOutputTokens } : {}),
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

    // Capture Gemini Live metrics before stopping on error
    if (geminiLiveSession) {
      const glMetrics = geminiLiveSession.getUsageSummary();
      const glExchanges = geminiLiveSession.getCompletedExchangeCount();
      const glOutputChars = geminiLiveSession.getTotalOutputCharacters();
      exchangeCount += glExchanges;
      ttsCharacters += glOutputChars;
      if (usageSession) {
        (usageSession as any)._glInputTokens = glMetrics.inputTokens;
        (usageSession as any)._glOutputTokens = glMetrics.outputTokens;
      }
      geminiLiveSession.stop();
      geminiLiveSession = null;
    }
    
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
      const glInputTokens = (usageSession as any)._glInputTokens as number | undefined;
      const glOutputTokens = (usageSession as any)._glOutputTokens as number | undefined;
      usageService.updateSessionMetrics(usageSession.id, {
        exchangeCount,
        studentSpeakingSeconds,
        tutorSpeakingSeconds,
        ttsCharacters,
        sttSeconds,
        ...(glInputTokens ? { llmInputTokens: glInputTokens } : {}),
        ...(glOutputTokens ? { llmOutputTokens: glOutputTokens } : {}),
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
 * Send error message via voice connection adapter (works for both native WS and Socket.IO)
 */
function sendErrorAdapter(ws: VoiceWSConnection, code: string, message: string, recoverable: boolean) {
  if (ws.readyState === WS_OPEN) {
    ws.send(JSON.stringify({
      type: 'error',
      timestamp: Date.now(),
      code,
      message,
      recoverable,
    } as StreamingErrorMessage));
  }
}
