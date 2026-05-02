/**
 * Twilio VoIP Bridge — Daniela Calls the Student (Phase 4)
 *
 * Bridges Twilio Media Streams ↔ Gemini Live 3.1 for real-time voice calls.
 *
 * Audio path:
 *   Twilio (μ-law 8 kHz) → decode → upsample 16 kHz → Gemini Live
 *   Gemini Live (PCM16 24 kHz) → downsample 8 kHz → encode → Twilio (μ-law 8 kHz)
 *
 * Twilio Media Streams protocol (JSON over WS):
 *   connected        → session handshake (no auth data yet)
 *   start            → call begins; customParameters contain userId/queueId/sig
 *   media            → audio chunk (base64 μ-law payload)
 *   stop             → call ended → close Gemini session, log voice session event
 */

import { WebSocket } from 'ws';
import {
  GoogleGenAI,
  Modality,
  StartSensitivity,
  EndSensitivity,
  type Session,
  type LiveServerMessage,
} from '@google/genai';
import { getSharedDb } from '../db';
import { storage } from '../storage';
import { danielaOutboundQueue, voiceSessions, tutorSessions } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';
import { unifiedDanielaContextService } from './unified-daniela-context-service';
import { computeCallNonce } from './voice-call-sender';

const GEMINI_LIVE_MODEL = process.env.GEMINI_LIVE_MODEL || 'gemini-3.1-flash-live-preview';
const DANIELA_LIVE_VOICE = 'Kore';

const LANGUAGE_TO_BCP47: Record<string, string> = {
  english: 'en-US',
  spanish: 'es-ES',
  french: 'fr-FR',
  italian: 'it-IT',
  portuguese: 'pt-BR',
  german: 'de-DE',
  japanese: 'ja-JP',
  mandarin: 'zh-CN',
  chinese: 'zh-CN',
  korean: 'ko-KR',
  hebrew: 'he-IL',
};

// ── G.711 μ-law codec ──────────────────────────────────────────────────────────

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

/**
 * Decode μ-law bytes (8 kHz mono) to PCM16 LE at 16 kHz via 2× linear interpolation.
 */
function mulawBufToPcm16k(src: Buffer): Buffer {
  const decoded: number[] = new Array(src.length);
  for (let i = 0; i < src.length; i++) decoded[i] = decodeUlaw(src[i]);

  const out = Buffer.allocUnsafe(decoded.length * 2 * 2);
  let pos = 0;
  for (let i = 0; i < decoded.length; i++) {
    const a = decoded[i];
    const b = i + 1 < decoded.length ? decoded[i + 1] : a;
    const interpolated = Math.round((a + b) / 2);
    out.writeInt16LE(Math.max(-32768, Math.min(32767, a)), pos);
    pos += 2;
    out.writeInt16LE(Math.max(-32768, Math.min(32767, interpolated)), pos);
    pos += 2;
  }
  return out;
}

/**
 * Downsample PCM16 LE at 24 kHz to μ-law bytes at 8 kHz (average each trio).
 */
function pcm24kBufToMulaw8k(src: Buffer): Buffer {
  const sampleCount = Math.floor(src.length / 2);
  const outSamples = Math.floor(sampleCount / 3);
  const out = Buffer.allocUnsafe(outSamples);
  for (let i = 0; i < outSamples; i++) {
    const s0 = src.readInt16LE(i * 6);
    const s1 = i * 6 + 2 < src.length ? src.readInt16LE(i * 6 + 2) : s0;
    const s2 = i * 6 + 4 < src.length ? src.readInt16LE(i * 6 + 4) : s0;
    const avg = Math.round((s0 + s1 + s2) / 3);
    out[i] = encodeUlaw(Math.max(-32768, Math.min(32767, avg)));
  }
  return out;
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
  unifiedContext: string;
}

/**
 * Verify the per-call HMAC nonce embedded in the TwiML <Parameter> values.
 * Prevents unauthorized actors from abusing the WS endpoint to open Gemini sessions.
 */
function verifyCallNonce(userId: string, queueId: string, sig: string): boolean {
  const expected = computeCallNonce(userId, queueId);
  return expected === sig;
}

/**
 * Load full context for the call.
 * Returns null if the queue item does not exist or belongs to a different user.
 */
async function loadCallContext(userId: string, queueId: string): Promise<CallContext | null> {
  const db = getSharedDb();

  const [user, queueRow] = await Promise.all([
    storage.getUser(userId),
    db
      .select()
      .from(danielaOutboundQueue)
      .where(eq(danielaOutboundQueue.id, queueId))
      .then((rows) => rows[0] ?? null),
  ]);

  if (!queueRow) {
    console.warn(`[TwilioVoipBridge] Queue item ${queueId.slice(-6)} not found`);
    return null;
  }
  if (queueRow.userId !== userId) {
    console.warn(
      `[TwilioVoipBridge] Queue ownership mismatch — item ${queueId.slice(-6)} belongs to ${queueRow.userId.slice(-6)}, caller claims ${userId.slice(-6)}`,
    );
    return null;
  }

  const studentName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(' ') || 'there'
    : 'there';
  const targetLanguage = user?.targetLanguage || 'spanish';
  const languageCode = LANGUAGE_TO_BCP47[targetLanguage.toLowerCase()] || 'es-ES';
  const actflLevel = user?.actflLevel ?? null;
  const messageContent = queueRow.content || '';

  let lastSessionSummary: string | null = null;
  let daysAbsent: number | null = null;
  try {
    const sessions = await db
      .select({ sessionSummary: tutorSessions.sessionSummary, endedAt: tutorSessions.endedAt })
      .from(tutorSessions)
      .where(eq(tutorSessions.userId, userId))
      .orderBy(desc(tutorSessions.createdAt))
      .limit(1);
    if (sessions[0]) {
      lastSessionSummary = sessions[0].sessionSummary ?? null;
      if (sessions[0].endedAt) {
        const msSince = Date.now() - new Date(sessions[0].endedAt).getTime();
        daysAbsent = Math.floor(msSince / (1000 * 60 * 60 * 24));
      }
    }
  } catch (err: unknown) {
    console.warn(
      '[TwilioVoipBridge] Last session fetch error:',
      err instanceof Error ? err.message : String(err),
    );
  }

  // Same context path used by normal voice sessions
  let unifiedContext = '';
  try {
    unifiedContext = await unifiedDanielaContextService.getContext({
      userId,
      targetLanguage,
      channel: 'voice',
      includeStudentSnapshot: true,
      includeVoiceSummary: true,
      includeNeuralNetwork: false,
      includeHiveContext: false,
      includeCurriculumContext: false,
      includeJourneyContext: false,
    });
  } catch (err: unknown) {
    console.warn(
      '[TwilioVoipBridge] Unified context load error:',
      err instanceof Error ? err.message : String(err),
    );
  }

  return {
    studentName,
    targetLanguage,
    languageCode,
    actflLevel,
    messageContent,
    lastSessionSummary,
    daysAbsent,
    unifiedContext,
  };
}

function buildCallSystemPrompt(ctx: CallContext): string {
  const langName = ctx.targetLanguage.charAt(0).toUpperCase() + ctx.targetLanguage.slice(1);
  const level = ctx.actflLevel
    ? `${ctx.actflLevel.replace('_', ' ')} ${langName} learner`
    : `${langName} learner`;
  const absenceNote =
    ctx.daysAbsent !== null && ctx.daysAbsent > 0
      ? `They haven't practiced in ${ctx.daysAbsent} day${ctx.daysAbsent !== 1 ? 's' : ''}.`
      : "You haven't seen them recently.";
  const summaryNote = ctx.lastSessionSummary
    ? `Last session: ${ctx.lastSessionSummary.slice(0, 200)}`
    : 'No previous session summary available.';
  const msgNote = ctx.messageContent
    ? `Your note to them: "${ctx.messageContent.slice(0, 300)}"`
    : '';
  const memorySection = ctx.unifiedContext
    ? `\n\nDaniela's memory context:\n${ctx.unifiedContext.slice(0, 1200)}`
    : '';

  return `You are Daniela, a warm and encouraging AI ${langName} tutor.

RIGHT NOW: You have just called ${ctx.studentName} on their phone. This is a real phone call.

STUDENT CONTEXT:
- Name: ${ctx.studentName}
- Level: ${level}
- ${absenceNote}
- ${summaryNote}
${msgNote ? `- ${msgNote}` : ''}${memorySection}

CALL RULES (critical):
1. This is a BRIEF CHECK-IN CALL (2–3 minutes max), NOT a lesson.
2. Start speaking IMMEDIATELY — introduce yourself warmly: "¡Hola ${ctx.studentName}! Soy Daniela..."
3. Be warm, personal, and encouraging. Reference what you know about them.
4. Speak mostly in ${langName} but use English for important points — this is casual, not a drill.
5. Naturally wind down the call after 2–3 exchanges. Say goodbye warmly.
6. Do NOT use any tools or special commands. Just have a natural phone conversation.
7. If they seem confused or say they can't talk, be understanding and end the call graciously.

Begin speaking now. The call just connected.`;
}

// ── Per-call state ─────────────────────────────────────────────────────────────

interface BridgeState {
  streamSid: string;
  callSid: string;
  geminiSession: Session | null;
  isEnded: boolean;
  callStartMs: number;
  answeredAt: Date | null;
  isSetupComplete: boolean;
  pendingGreeting: string;
  userId: string;
  queueId: string;
  targetLanguage: string;
  contextReady: boolean;
}

const activeBridges = new Map<string, BridgeState>();

function sendAudioToTwilio(ws: WebSocket, state: BridgeState, pcm24k: Buffer): void {
  if (ws.readyState !== WebSocket.OPEN || state.isEnded || !state.streamSid) return;
  const mulaw = pcm24kBufToMulaw8k(pcm24k);
  if (mulaw.length === 0) return;
  ws.send(
    JSON.stringify({
      event: 'media',
      streamSid: state.streamSid,
      media: { payload: mulaw.toString('base64') },
    }),
  );
}

/**
 * Log the completed call as a voiceSession record so it appears in session
 * history and resets absence detection (which reads voiceSessions.endedAt).
 */
async function logCallAsVoiceSession(state: BridgeState, durationSeconds: number): Promise<void> {
  if (!state.answeredAt || !state.userId) return;
  try {
    const db = getSharedDb();
    await db.insert(voiceSessions).values({
      userId: state.userId,
      startedAt: state.answeredAt,
      endedAt: new Date(),
      durationSeconds,
      language: state.targetLanguage || 'spanish',
      status: 'completed',
      tutorMode: 'main',
    });
    console.log(
      `[TwilioVoipBridge] Voice session logged — user ${state.userId.slice(-6)}, ${durationSeconds}s`,
    );
  } catch (err: unknown) {
    console.warn(
      '[TwilioVoipBridge] Failed to log voice session:',
      err instanceof Error ? err.message : String(err),
    );
  }
}

async function endBridge(ws: WebSocket, state: BridgeState): Promise<void> {
  if (state.isEnded) return;
  state.isEnded = true;

  if (state.callSid) activeBridges.delete(state.callSid);

  try {
    state.geminiSession?.close();
  } catch (_) {}
  state.geminiSession = null;

  if (!state.queueId) return;

  const durationMs = Date.now() - state.callStartMs;
  const durationSeconds = Math.round(durationMs / 1000);
  const wasAnswered = state.answeredAt !== null;

  try {
    const db = getSharedDb();
    await db
      .update(danielaOutboundQueue)
      .set({
        callAnsweredAt: state.answeredAt,
        callDurationSeconds: wasAnswered ? durationSeconds : null,
        // Set deliveredAt on successful answer — marks the item as delivered
        // and resets absence detection for this student
        deliveredAt: wasAnswered ? state.answeredAt : undefined,
      })
      .where(eq(danielaOutboundQueue.id, state.queueId));

    if (wasAnswered) {
      await logCallAsVoiceSession(state, durationSeconds);
    }

    console.log(
      `[TwilioVoipBridge] Call ended — user ${state.userId.slice(-6)}, answered: ${wasAnswered}, duration: ${durationSeconds}s`,
    );
  } catch (err: unknown) {
    console.warn(
      '[TwilioVoipBridge] Failed to log call end:',
      err instanceof Error ? err.message : String(err),
    );
  }
}

async function openGeminiSession(
  ws: WebSocket,
  state: BridgeState,
  systemPrompt: string,
  languageCode: string,
): Promise<void> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

  state.geminiSession = await ai.live.connect({
    model: GEMINI_LIVE_MODEL,
    config: {
      systemInstruction: systemPrompt,
      responseModalities: [Modality.AUDIO],
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      speechConfig: {
        languageCode,
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: DANIELA_LIVE_VOICE },
        },
      },
      realtimeInputConfig: {
        automaticActivityDetection: {
          disabled: false,
          startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_HIGH,
          endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_LOW,
          prefixPaddingMs: 200,
          silenceDurationMs: 2500,
        },
      },
    },
    callbacks: {
      onmessage: (msg: LiveServerMessage) => handleGeminiMessage(ws, state, msg),
      onerror: (err: unknown) => {
        console.error(
          '[TwilioVoipBridge] Gemini error:',
          err instanceof Error ? err.message : String(err),
        );
      },
      onclose: (event: { code?: number }) => {
        console.log(`[TwilioVoipBridge] Gemini session closed — code: ${event?.code}`);
        if (!state.isEnded) {
          endBridge(ws, state).catch(() => {});
          if (ws.readyState === WebSocket.OPEN) ws.close();
        }
      },
    },
  });

  console.log(`[TwilioVoipBridge] Gemini session open — user ${state.userId.slice(-6)}`);
}

function handleGeminiMessage(ws: WebSocket, state: BridgeState, msg: LiveServerMessage): void {
  const msgAny = msg as Record<string, unknown>;

  // setupComplete → fire the greeting prompt
  if (msgAny.setupComplete != null && !state.isSetupComplete) {
    state.isSetupComplete = true;
    console.log('[TwilioVoipBridge] Gemini setupComplete — firing greeting');
    if (state.pendingGreeting && state.geminiSession) {
      try {
        const silencePcm = Buffer.alloc(32000, 0);
        state.geminiSession.sendRealtimeInput({
          audio: { data: silencePcm.toString('base64'), mimeType: 'audio/pcm;rate=16000' },
        });
        state.geminiSession.sendClientContent({
          turns: [{ role: 'user', parts: [{ text: state.pendingGreeting }] }],
          turnComplete: true,
        });
        state.geminiSession.sendRealtimeInput({ activityEnd: {} });
        state.pendingGreeting = '';
      } catch (err: unknown) {
        console.warn(
          '[TwilioVoipBridge] Greeting send error:',
          err instanceof Error ? err.message : String(err),
        );
      }
    }
  }

  // Audio output → encode to μ-law and forward to Twilio
  if (msg.serverContent?.modelTurn?.parts) {
    for (const part of msg.serverContent.modelTurn.parts) {
      if (part.inlineData?.data && part.inlineData.mimeType?.includes('audio')) {
        const pcm24k = Buffer.from(part.inlineData.data, 'base64');
        sendAudioToTwilio(ws, state, pcm24k);
      }
    }
  }

  const serverContent = msg.serverContent as Record<string, unknown> | undefined;
  if (serverContent) {
    const outputTx = serverContent.outputTranscription as { text?: string } | undefined;
    const inputTx = serverContent.inputTranscription as { text?: string } | undefined;
    if (outputTx?.text?.trim()) {
      console.log(`[TwilioVoipBridge] Daniela: "${outputTx.text.trim().slice(0, 100)}"`);
    }
    if (inputTx?.text?.trim()) {
      console.log(`[TwilioVoipBridge] Student: "${inputTx.text.trim().slice(0, 100)}"`);
    }
  }
}

// ── WebSocket connection handler ───────────────────────────────────────────────

/**
 * Entry point — called by unified-ws-handler for every /api/voice/twilio-stream connection.
 *
 * Since Twilio Media Streams does not pass query parameters from the Stream URL,
 * all call-specific data (userId, queueId, HMAC nonce) arrives in the 'start'
 * event's customParameters field, populated via TwiML <Parameter> elements.
 */
export async function handleTwilioMediaStream(ws: WebSocket): Promise<void> {
  console.log('[TwilioVoipBridge] New Twilio Media Streams connection');

  const state: BridgeState = {
    streamSid: '',
    callSid: '',
    geminiSession: null,
    isEnded: false,
    callStartMs: Date.now(),
    answeredAt: null,
    isSetupComplete: false,
    pendingGreeting: 'Hello! I just called you. Please start the conversation.',
    userId: '',
    queueId: '',
    targetLanguage: 'spanish',
    contextReady: false,
  };

  ws.on('message', (raw: Buffer | string) => {
    if (state.isEnded) return;
    let event: Record<string, unknown>;
    try {
      event = JSON.parse(raw.toString()) as Record<string, unknown>;
    } catch {
      return;
    }

    switch (event.event as string) {
      case 'connected':
        console.log('[TwilioVoipBridge] Twilio connected — waiting for start event');
        break;

      case 'start': {
        const startData = event.start as Record<string, unknown> | undefined;
        state.streamSid = (startData?.streamSid as string) ?? '';
        state.callSid = (startData?.callSid as string) ?? '';
        state.answeredAt = new Date();
        if (state.callSid) activeBridges.set(state.callSid, state);

        // Extract call identity from TwiML <Parameter> values
        const params = (startData?.customParameters ?? {}) as Record<string, string>;
        const userId = params.userId ?? '';
        const queueId = params.queueId ?? '';
        const sig = params.sig ?? '';

        console.log(
          `[TwilioVoipBridge] Stream started — streamSid: ${state.streamSid.slice(-8)}, user: ${userId.slice(-6)}, queue: ${queueId.slice(-6)}`,
        );

        // Verify HMAC nonce — rejects forged connections
        if (!userId || !queueId || !verifyCallNonce(userId, queueId, sig)) {
          console.warn('[TwilioVoipBridge] Nonce verification failed — rejecting stream');
          state.isEnded = true;
          if (ws.readyState === WebSocket.OPEN) ws.close(1008, 'Forbidden');
          return;
        }

        state.userId = userId;
        state.queueId = queueId;

        // Load context and open Gemini session now that we have the identity
        loadCallContext(userId, queueId)
          .then(async (ctx) => {
            if (!ctx) {
              console.error('[TwilioVoipBridge] Context load rejected — closing');
              state.isEnded = true;
              if (ws.readyState === WebSocket.OPEN) ws.close(1008, 'Forbidden');
              return;
            }
            state.targetLanguage = ctx.targetLanguage;
            const systemPrompt = buildCallSystemPrompt(ctx);
            state.pendingGreeting = `Hello! I just called you. Please introduce yourself now.`;
            if (!state.isEnded) {
              await openGeminiSession(ws, state, systemPrompt, ctx.languageCode);
              state.contextReady = true;
            }
          })
          .catch((err: unknown) => {
            console.error(
              '[TwilioVoipBridge] Context/Gemini init error:',
              err instanceof Error ? err.message : String(err),
            );
          });
        break;
      }

      case 'media': {
        if (!state.contextReady || !state.geminiSession) return;
        const mediaData = event.media as { payload?: string } | undefined;
        if (!mediaData?.payload) return;
        const mulawBuf = Buffer.from(mediaData.payload, 'base64');
        const pcm16k = mulawBufToPcm16k(mulawBuf);
        try {
          state.geminiSession.sendRealtimeInput({
            audio: { data: pcm16k.toString('base64'), mimeType: 'audio/pcm;rate=16000' },
          });
        } catch (err: unknown) {
          console.warn(
            '[TwilioVoipBridge] Audio send error:',
            err instanceof Error ? err.message : String(err),
          );
        }
        break;
      }

      case 'stop':
        console.log('[TwilioVoipBridge] Twilio stop event received');
        endBridge(ws, state).catch(() => {});
        break;

      default:
        break;
    }
  });

  ws.on('close', () => {
    endBridge(ws, state).catch(() => {});
  });

  ws.on('error', (err: Error) => {
    console.error('[TwilioVoipBridge] WS error:', err.message);
    endBridge(ws, state).catch(() => {});
  });
}

/**
 * Called by voice-status webhook when a call ends without the student answering.
 * Marks callNoAnswer and falls back to SMS delivery.
 */
export async function handleCallNoAnswer(userId: string, queueId: string): Promise<void> {
  try {
    const db = getSharedDb();
    const rows = await db
      .select()
      .from(danielaOutboundQueue)
      .where(eq(danielaOutboundQueue.id, queueId));
    const item = rows[0];
    if (!item) return;

    if (item.userId !== userId) {
      console.warn('[TwilioVoipBridge] handleCallNoAnswer ownership mismatch — skipping');
      return;
    }

    await db
      .update(danielaOutboundQueue)
      .set({ callNoAnswer: true })
      .where(eq(danielaOutboundQueue.id, queueId));

    const { canContactStudent } = await import('./outbound-consent');
    const smsOk = await canContactStudent(userId, 'sms');
    if (smsOk) {
      console.log(`[TwilioVoipBridge] No answer — falling back to SMS for user ${userId.slice(-6)}`);
      const { deliverVoiceMessageViaSms } = await import('./voice-message-delivery');
      await deliverVoiceMessageViaSms(queueId, userId, item.content);
    } else {
      console.log(
        `[TwilioVoipBridge] No answer, no SMS consent — staying in session queue for user ${userId.slice(-6)}`,
      );
    }
  } catch (err: unknown) {
    console.error(
      '[TwilioVoipBridge] handleCallNoAnswer error:',
      err instanceof Error ? err.message : String(err),
    );
  }
}
