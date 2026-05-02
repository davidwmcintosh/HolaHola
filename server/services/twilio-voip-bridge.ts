/**
 * Twilio VoIP Bridge — Daniela Calls the Student (Phase 4)
 *
 * Bridges Twilio Media Streams ↔ GeminiLiveSession for real-time outbound calls.
 * Uses the same GeminiLiveSession pipeline as normal voice sessions so billing,
 * lifecycle management, and session instrumentation are fully consistent.
 *
 * Audio path (inbound):
 *   Twilio μ-law 8kHz → decode + upsample → PCM16 16kHz → GeminiLiveSession.sendAudioChunk()
 *
 * Audio path (outbound):
 *   GeminiLiveSession sendWsMessage audio_chunk (F32LE 24kHz)
 *     → downsample + encode → μ-law 8kHz → Twilio media event
 *
 * Call identity (userId, queueId, HMAC nonce) arrives via TwiML <Parameter>
 * elements in the Media Streams 'start' event customParameters — Twilio does
 * not forward URL query params through the Stream url attribute.
 *
 * Human-answer gate:
 *   `deliveredAt` and the voiceSessions DB row are only written after
 *   `confirmHumanAnswer(callSid)` is called by the voice-status webhook with
 *   AnsweredBy='human'. Machine/no-answer paths call `handleCallNoAnswer()`.
 *
 * Max-duration guard:
 *   A hard 3-minute timer fires a server-side hangup so short check-in calls
 *   never run indefinitely if the student stays on the line.
 */

import { WebSocket } from 'ws';
import { randomUUID } from 'crypto';
import { GeminiLiveSession } from './gemini-live-session';
import type { StreamingSession } from './streaming-session-types';
import type { TutorPersonality } from './tts-service';
import type { VoiceSpeedOption } from './voice-speed-config';
import { getSharedDb } from '../db';
import { storage } from '../storage';
import { danielaOutboundQueue, voiceSessions, tutorSessions } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';
import { unifiedDanielaContext } from './unified-daniela-context-service';
import { computeCallNonce } from './voice-call-sender';

const MAX_CALL_DURATION_MS = 3 * 60 * 1000; // 3-minute hard cap for outbound check-in calls

// ── G.711 μ-law codec ─────────────────────────────────────────────────────────

function encodeUlaw(sample: number): number {
  const BIAS = 0x84;
  const sign = sample < 0 ? 0 : 0x80;
  sample = Math.min(Math.abs(sample) + BIAS, 0x7fff);
  let exp = 7;
  for (let mask = 0x4000; (sample & mask) === 0 && exp > 0; mask >>= 1) exp--;
  const mantissa = (sample >> (exp + 3)) & 0x0f;
  return (~(sign | (exp << 4) | mantissa)) & 0xff;
}

function decodeUlaw(ulaw: number): number {
  ulaw = ~ulaw & 0xff;
  const sign = ulaw & 0x80 ? -1 : 1;
  const exp = (ulaw >> 4) & 0x07;
  const mantissa = ulaw & 0x0f;
  const magnitude = ((0x21 | (mantissa << 1)) << exp) - 0x21;
  return sign * magnitude;
}

/** μ-law bytes (8kHz mono) → PCM16 LE (16kHz, 2× linear interpolation). */
function mulawBufToPcm16k(src: Buffer): Buffer {
  const decoded: number[] = new Array(src.length);
  for (let i = 0; i < src.length; i++) decoded[i] = decodeUlaw(src[i]);
  const out = Buffer.allocUnsafe(decoded.length * 2 * 2);
  let pos = 0;
  for (let i = 0; i < decoded.length; i++) {
    const a = decoded[i];
    const b = i + 1 < decoded.length ? decoded[i + 1] : a;
    out.writeInt16LE(Math.max(-32768, Math.min(32767, a)), pos); pos += 2;
    out.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round((a + b) / 2))), pos); pos += 2;
  }
  return out;
}

/** F32LE bytes (24kHz) → μ-law bytes (8kHz, average every 3 samples). */
function f32le24kBufToMulaw8k(src: Buffer): Buffer {
  const floatCount = Math.floor(src.length / 4);
  const outSamples = Math.floor(floatCount / 3);
  const out = Buffer.allocUnsafe(outSamples);
  for (let i = 0; i < outSamples; i++) {
    const f0 = src.readFloatLE(i * 12);
    const f1 = i * 12 + 4 < src.length ? src.readFloatLE(i * 12 + 4) : f0;
    const f2 = i * 12 + 8 < src.length ? src.readFloatLE(i * 12 + 8) : f0;
    const avg = Math.round(((f0 + f1 + f2) / 3) * 32767);
    out[i] = encodeUlaw(Math.max(-32768, Math.min(32767, avg)));
  }
  return out;
}

// ── Twilio REST call control ───────────────────────────────────────────────────

async function hangUpCall(callSid: string): Promise<void> {
  const sid = process.env.TWILIO_ACCOUNT_SID || '';
  const token = process.env.TWILIO_AUTH_TOKEN || '';
  if (!sid || !token || !callSid) return;
  try {
    const auth = Buffer.from(`${sid}:${token}`).toString('base64');
    await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls/${callSid}.json`, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ Status: 'completed' }).toString(),
    });
    console.log(`[TwilioVoipBridge] Hung up call ${callSid.slice(-8)}`);
  } catch (err: unknown) {
    console.warn('[TwilioVoipBridge] hangUpCall error:', err instanceof Error ? err.message : String(err));
  }
}

// ── Context loading ────────────────────────────────────────────────────────────

interface CallContext {
  studentName: string;
  targetLanguage: string;
  languageCode: string;
  actflLevel: string | null;
  messageContent: string;
  lastSessionSummary: string | null;
  daysAbsent: number | null;
  unifiedContextStr: string;
}

const LANGUAGE_TO_BCP47: Record<string, string> = {
  english: 'en-US', spanish: 'es-ES', french: 'fr-FR', italian: 'it-IT',
  portuguese: 'pt-BR', german: 'de-DE', japanese: 'ja-JP', mandarin: 'zh-CN',
  chinese: 'zh-CN', korean: 'ko-KR', hebrew: 'he-IL',
};

function verifyCallNonce(userId: string, queueId: string, sig: string): boolean {
  return computeCallNonce(userId, queueId) === sig;
}

async function loadCallContext(userId: string, queueId: string): Promise<CallContext | null> {
  const db = getSharedDb();
  const [user, queueRow] = await Promise.all([
    storage.getUser(userId),
    db.select().from(danielaOutboundQueue).where(eq(danielaOutboundQueue.id, queueId)).then(r => r[0] ?? null),
  ]);

  if (!queueRow) { console.warn(`[TwilioVoipBridge] Queue item ${queueId.slice(-6)} not found`); return null; }
  if (queueRow.userId !== userId) { console.warn('[TwilioVoipBridge] Queue ownership mismatch'); return null; }

  const studentName = user ? [user.firstName, user.lastName].filter(Boolean).join(' ') || 'there' : 'there';
  const targetLanguage = user?.targetLanguage || 'spanish';
  const languageCode = LANGUAGE_TO_BCP47[targetLanguage.toLowerCase()] || 'es-ES';
  const actflLevel = user?.actflLevel ?? null;
  const messageContent = queueRow.content || '';

  let lastSessionSummary: string | null = null;
  let daysAbsent: number | null = null;
  try {
    const sessions = await db
      .select({ sessionSummary: tutorSessions.sessionSummary, endedAt: tutorSessions.endedAt })
      .from(tutorSessions).where(eq(tutorSessions.userId, userId)).orderBy(desc(tutorSessions.createdAt)).limit(1);
    if (sessions[0]) {
      lastSessionSummary = sessions[0].sessionSummary ?? null;
      if (sessions[0].endedAt) daysAbsent = Math.floor((Date.now() - new Date(sessions[0].endedAt).getTime()) / 86400000);
    }
  } catch (err: unknown) {
    console.warn('[TwilioVoipBridge] Last session fetch:', err instanceof Error ? err.message : String(err));
  }

  let unifiedContextStr = '';
  try {
    unifiedContextStr = await unifiedDanielaContext.getContext({
      userId, targetLanguage, channel: 'voice',
      includeStudentSnapshot: true, includeVoiceSummary: true,
      includeNeuralNetwork: false, includeHiveContext: false,
      includeCurriculumContext: false, includeJourneyContext: false,
    });
  } catch (err: unknown) {
    console.warn('[TwilioVoipBridge] Unified context load:', err instanceof Error ? err.message : String(err));
  }

  return { studentName, targetLanguage, languageCode, actflLevel, messageContent, lastSessionSummary, daysAbsent, unifiedContextStr };
}

function buildCallSystemPrompt(ctx: CallContext): string {
  const langName = ctx.targetLanguage.charAt(0).toUpperCase() + ctx.targetLanguage.slice(1);
  const level = ctx.actflLevel ? `${ctx.actflLevel.replace('_', ' ')} ${langName} learner` : `${langName} learner`;
  const absenceNote = ctx.daysAbsent !== null && ctx.daysAbsent > 0
    ? `They haven't practiced in ${ctx.daysAbsent} day${ctx.daysAbsent !== 1 ? 's' : ''}.`
    : "You haven't seen them recently.";
  const summaryNote = ctx.lastSessionSummary ? `Last session: ${ctx.lastSessionSummary.slice(0, 200)}` : 'No previous session summary.';
  const msgNote = ctx.messageContent ? `\n- Your note: "${ctx.messageContent.slice(0, 300)}"` : '';
  const memorySection = ctx.unifiedContextStr ? `\n\nDaniela's memory context:\n${ctx.unifiedContextStr.slice(0, 1200)}` : '';

  return `You are Daniela, a warm and encouraging AI ${langName} tutor.
RIGHT NOW: You have just called ${ctx.studentName} on their phone. This is a real phone call.
STUDENT: Name: ${ctx.studentName} | Level: ${level} | ${absenceNote} | ${summaryNote}${msgNote}${memorySection}
CALL RULES: Brief 2-3 min check-in only. Start immediately: "¡Hola ${ctx.studentName}! Soy Daniela..." Be warm, personal, and encouraging. Speak mostly in ${langName}. Wind down naturally after 2-3 exchanges. No tools. End graciously if they can't talk.
Begin speaking now.`;
}

// ── Minimal StreamingSession adapter for GeminiLiveSession ───────────────────

/**
 * Build a StreamingSession adapter so GeminiLiveSession can operate for an
 * outbound VoIP call without an active client WebSocket session.
 *
 * All required fields are given explicit types — no type-bypassing casts.
 * The Twilio WS is the same ws.WebSocket type that StreamingSession.ws expects,
 * so it is passed directly. Optional fields with no relevant meaning for a
 * standalone call are omitted (TypeScript omit-as-undefined semantics).
 */
function buildCallSession(userId: string, ctx: CallContext, twilioWs: WebSocket): StreamingSession {
  const personality: TutorPersonality = 'warm';
  const voiceSpeed: VoiceSpeedOption = 'normal';

  const session: StreamingSession = {
    id: randomUUID(),
    userId,
    conversationId: randomUUID(),
    targetLanguage: ctx.targetLanguage,
    nativeLanguage: 'english',
    difficultyLevel: ctx.actflLevel || 'intermediate',
    subtitleMode: 'off',
    tutorPersonality: personality,
    tutorExpressiveness: 0.7,
    voiceSpeed,
    voiceId: 'Kore',
    tutorGender: 'female',
    tutorName: 'Daniela',
    systemPrompt: ctx.unifiedContextStr || '',
    conversationHistory: [],
    ws: twilioWs,
    startTime: Date.now(),
    isActive: true,
    isFounderMode: false,
    isRawHonestyMode: false,
    isIncognito: false,
    isDeveloperUser: false,
    isBetaTester: false,
    lastContextRefreshTime: Date.now(),
    lastActivityTime: Date.now(),
    currentTurnId: 0,
    isInterrupted: false,
    lastTurnWasInterrupted: false,
    isGenerating: false,
    toolsUsedSession: [],
    pendingArchitectNoteIds: [],
    recentSttConfidences: [],
    sessionStruggleCount: 0,
    adaptiveSpeedEnabled: false,
    sessionWordAnalyses: [],
    sessionAudioChunks: [],
    sessionTranscripts: [],
  };
  return session;
}

// ── Per-call bridge state ─────────────────────────────────────────────────────

interface BridgeState {
  streamSid: string;
  callSid: string;
  glSession: GeminiLiveSession | null;
  isEnded: boolean;
  callStartMs: number;
  /** Set when the stream 'start' event fires (call connected). */
  streamStartedAt: Date | null;
  /** Set when AMD confirms AnsweredBy='human' via the status webhook. */
  isHumanConfirmed: boolean;
  maxDurationTimer: NodeJS.Timeout | null;
  userId: string;
  queueId: string;
  targetLanguage: string;
  contextReady: boolean;
}

/** Index by callSid so the status webhook can confirm human answer. */
const activeBridges = new Map<string, BridgeState>();

async function logCallAsVoiceSession(state: BridgeState, durationSeconds: number): Promise<void> {
  if (!state.streamStartedAt || !state.userId) return;
  try {
    const db = getSharedDb();
    await db.insert(voiceSessions).values({
      userId: state.userId,
      startedAt: state.streamStartedAt,
      endedAt: new Date(),
      durationSeconds,
      language: state.targetLanguage || 'spanish',
      status: 'completed',
      tutorMode: 'main',
    });
    console.log(`[TwilioVoipBridge] Voice session logged — user ${state.userId.slice(-6)}, ${durationSeconds}s`);
  } catch (err: unknown) {
    console.warn('[TwilioVoipBridge] Failed to log voice session:', err instanceof Error ? err.message : String(err));
  }
}

async function endBridge(state: BridgeState): Promise<void> {
  if (state.isEnded) return;
  state.isEnded = true;

  if (state.maxDurationTimer) { clearTimeout(state.maxDurationTimer); state.maxDurationTimer = null; }
  if (state.callSid) activeBridges.delete(state.callSid);
  try { state.glSession?.stop(); } catch (_) {}
  state.glSession = null;

  if (!state.queueId) return;
  const durationSeconds = Math.round((Date.now() - state.callStartMs) / 1000);

  try {
    const db = getSharedDb();
    await db.update(danielaOutboundQueue).set({
      callAnsweredAt: state.streamStartedAt,
      callDurationSeconds: state.isHumanConfirmed ? durationSeconds : null,
      // deliveredAt and the voice session row are only written for confirmed human answers.
      // Machine/voicemail detections are handled by handleCallNoAnswer (never set these).
      deliveredAt: state.isHumanConfirmed ? state.streamStartedAt : undefined,
    }).where(eq(danielaOutboundQueue.id, state.queueId));

    if (state.isHumanConfirmed) await logCallAsVoiceSession(state, durationSeconds);

    console.log(`[TwilioVoipBridge] Call ended — user ${state.userId.slice(-6)}, humanConfirmed: ${state.isHumanConfirmed}, ${durationSeconds}s`);
  } catch (err: unknown) {
    console.warn('[TwilioVoipBridge] Failed to log call end:', err instanceof Error ? err.message : String(err));
  }
}

// ── WebSocket connection handler ──────────────────────────────────────────────

/**
 * Entry point — called by unified-ws-handler for every /api/voice/twilio-stream connection.
 *
 * All call identity (userId, queueId, HMAC nonce) arrives in the Media Streams
 * 'start' event customParameters field, embedded as TwiML <Parameter> elements.
 */
export async function handleTwilioMediaStream(ws: WebSocket): Promise<void> {
  console.log('[TwilioVoipBridge] New Twilio Media Streams connection');

  const state: BridgeState = {
    streamSid: '', callSid: '', glSession: null, isEnded: false,
    callStartMs: Date.now(), streamStartedAt: null, isHumanConfirmed: false,
    maxDurationTimer: null,
    userId: '', queueId: '', targetLanguage: 'spanish', contextReady: false,
  };

  ws.on('message', (raw: Buffer | string) => {
    if (state.isEnded) return;
    let event: Record<string, unknown>;
    try { event = JSON.parse(raw.toString()) as Record<string, unknown>; } catch { return; }

    switch (event.event as string) {
      case 'connected':
        console.log('[TwilioVoipBridge] Twilio connected — awaiting start event');
        break;

      case 'start': {
        const startData = event.start as Record<string, unknown> | undefined;
        state.streamSid = (startData?.streamSid as string) ?? '';
        state.callSid = (startData?.callSid as string) ?? '';
        state.streamStartedAt = new Date();
        if (state.callSid) activeBridges.set(state.callSid, state);

        const params = (startData?.customParameters ?? {}) as Record<string, string>;
        const userId = params.userId ?? '';
        const queueId = params.queueId ?? '';
        const sig = params.sig ?? '';

        console.log(`[TwilioVoipBridge] Stream started — user: ${userId.slice(-6)}, queue: ${queueId.slice(-6)}`);

        if (!userId || !queueId || !verifyCallNonce(userId, queueId, sig)) {
          console.warn('[TwilioVoipBridge] Nonce verification failed — rejecting stream');
          hangUpCall(state.callSid).catch(() => {});
          state.isEnded = true;
          if (ws.readyState === WebSocket.OPEN) ws.close(1008, 'Forbidden');
          return;
        }

        state.userId = userId;
        state.queueId = queueId;

        // Hard max-duration guard: hang up after 3 minutes regardless
        state.maxDurationTimer = setTimeout(() => {
          console.log(`[TwilioVoipBridge] Max duration reached — hanging up user ${userId.slice(-6)}`);
          hangUpCall(state.callSid).catch(() => {});
          endBridge(state).catch(() => {});
          if (ws.readyState === WebSocket.OPEN) ws.close();
        }, MAX_CALL_DURATION_MS);

        loadCallContext(userId, queueId)
          .then(async (ctx) => {
            if (!ctx || state.isEnded) {
              console.error('[TwilioVoipBridge] Context load rejected — closing');
              hangUpCall(state.callSid).catch(() => {});
              state.isEnded = true;
              if (ws.readyState === WebSocket.OPEN) ws.close(1008, 'Forbidden');
              return;
            }
            state.targetLanguage = ctx.targetLanguage;

            // sendWsMessage intercept: route audio_chunk to Twilio; drop UI-only messages
            const sendWsMessage = (_ws: unknown, message: unknown): void => {
              const msg = message as Record<string, unknown>;
              if (
                msg.type === 'audio_chunk' &&
                typeof msg.audio === 'string' &&
                ws.readyState === WebSocket.OPEN &&
                !state.isEnded &&
                state.streamSid
              ) {
                const mulaw = f32le24kBufToMulaw8k(Buffer.from(msg.audio, 'base64'));
                if (mulaw.length > 0) {
                  ws.send(JSON.stringify({
                    event: 'media',
                    streamSid: state.streamSid,
                    media: { payload: mulaw.toString('base64') },
                  }));
                }
              }
            };

            const callSession = buildCallSession(userId, ctx, ws);
            const gl = new GeminiLiveSession(callSession, sendWsMessage);
            state.glSession = gl;

            const systemPrompt = buildCallSystemPrompt(ctx);
            const greetingTrigger = `Hello Daniela! Please greet ${ctx.studentName} warmly in ${ctx.targetLanguage} right now — you just called them.`;
            await gl.start(systemPrompt, [], greetingTrigger);
            state.contextReady = true;
          })
          .catch((err: unknown) => {
            console.error('[TwilioVoipBridge] Session init error:', err instanceof Error ? err.message : String(err));
          });
        break;
      }

      case 'media': {
        if (!state.contextReady || !state.glSession) return;
        const payload = (event.media as Record<string, unknown> | undefined)?.payload;
        if (typeof payload !== 'string') return;
        try { state.glSession.sendAudioChunk(mulawBufToPcm16k(Buffer.from(payload, 'base64'))); } catch (err: unknown) {
          console.warn('[TwilioVoipBridge] Audio send error:', err instanceof Error ? err.message : String(err));
        }
        break;
      }

      case 'stop':
        console.log('[TwilioVoipBridge] Twilio stop event');
        endBridge(state).catch(() => {});
        break;

      default:
        break;
    }
  });

  ws.on('close', () => { endBridge(state).catch(() => {}); });
  ws.on('error', (err: Error) => {
    console.error('[TwilioVoipBridge] WS error:', err.message);
    endBridge(state).catch(() => {});
  });
}

/**
 * Called by the voice-status webhook when AMD confirms AnsweredBy='human'.
 * Marks the bridge as delivering to a confirmed human so `endBridge()` will
 * write `deliveredAt` and insert the voiceSessions record.
 */
export function confirmHumanAnswer(callSid: string): void {
  const state = activeBridges.get(callSid);
  if (!state) {
    console.log(`[TwilioVoipBridge] confirmHumanAnswer: no active bridge for SID ${callSid.slice(-8)}`);
    return;
  }
  state.isHumanConfirmed = true;
  console.log(`[TwilioVoipBridge] Human answer confirmed — user ${state.userId.slice(-6)}`);
}

/**
 * Called by the voice-status webhook when a call ends without a human answer
 * (no-answer, busy, machine detected, failed). Hangs up the Twilio call to
 * prevent audio streaming into voicemail, then falls back to SMS if consent allows.
 */
export async function handleCallNoAnswer(userId: string, queueId: string): Promise<void> {
  try {
    const db = getSharedDb();
    const rows = await db.select().from(danielaOutboundQueue).where(eq(danielaOutboundQueue.id, queueId));
    const item = rows[0];
    if (!item) return;
    if (item.userId !== userId) { console.warn('[TwilioVoipBridge] handleCallNoAnswer ownership mismatch'); return; }

    await db.update(danielaOutboundQueue).set({ callNoAnswer: true }).where(eq(danielaOutboundQueue.id, queueId));

    // Terminate the Twilio call to prevent audio streaming into voicemail
    if (item.callSid) await hangUpCall(item.callSid);

    const { canContactStudent } = await import('./outbound-consent');
    if (await canContactStudent(userId, 'sms')) {
      console.log(`[TwilioVoipBridge] No answer — SMS fallback for user ${userId.slice(-6)}`);
      const { deliverVoiceMessageViaSms } = await import('./voice-message-delivery');
      await deliverVoiceMessageViaSms(queueId, userId, item.content);
    } else {
      console.log(`[TwilioVoipBridge] No answer, no SMS consent — staying in queue for user ${userId.slice(-6)}`);
    }
  } catch (err: unknown) {
    console.error('[TwilioVoipBridge] handleCallNoAnswer error:', err instanceof Error ? err.message : String(err));
  }
}
