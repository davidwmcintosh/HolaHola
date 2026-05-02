/**
 * Twilio VoIP Bridge — Daniela Calls the Student (Phase 4)
 *
 * Bridges Twilio Media Streams ↔ Gemini Live 3.1 for real-time voice calls.
 *
 * Audio path:
 *   Twilio (μ-law 8kHz) → decode → upsample 16kHz → Gemini Live
 *   Gemini Live (PCM16 24kHz) → downsample 8kHz → encode → Twilio (μ-law 8kHz)
 *
 * Twilio Media Streams protocol (JSON over WS):
 *   connected  → session handshake
 *   start      → call begins, streamSid available → trigger Daniela's greeting
 *   media      → audio chunk (base64 μ-law payload)
 *   stop       → call ended → close Gemini session, log event
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
import { danielaOutboundQueue, tutorSessions } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';

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
 * Decode a buffer of μ-law bytes (8 kHz mono) to PCM16 LE at 16 kHz.
 * Upsampling via linear interpolation (2×).
 */
function mulawBufToPcm16k(src: Buffer): Buffer {
  const decoded: number[] = new Array(src.length);
  for (let i = 0; i < src.length; i++) decoded[i] = decodeUlaw(src[i]);

  const out = Buffer.allocUnsafe(decoded.length * 2 * 2); // 2× samples, 2 bytes each
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
 * Downsample PCM16 LE at 24 kHz to μ-law bytes at 8 kHz.
 * Downsampling via averaging every 3 consecutive samples (24→8: take average of each trio).
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
}

async function loadCallContext(userId: string, queueId: string): Promise<CallContext> {
  const db = getSharedDb();

  const [user, queueRow] = await Promise.all([
    storage.getUser(userId),
    db
      .select()
      .from(danielaOutboundQueue)
      .where(eq(danielaOutboundQueue.id, queueId))
      .then((rows) => rows[0] ?? null),
  ]);

  const studentName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(' ') || 'there'
    : 'there';
  const targetLanguage = user?.targetLanguage || 'spanish';
  const languageCode = LANGUAGE_TO_BCP47[targetLanguage.toLowerCase()] || 'es-ES';
  const actflLevel = user?.actflLevel ?? null;
  const messageContent = queueRow?.content || '';

  // Last session summary from tutorSessions
  let lastSessionSummary: string | null = null;
  let daysAbsent: number | null = null;
  try {
    const sessions = await db
      .select({
        sessionSummary: tutorSessions.sessionSummary,
        endedAt: tutorSessions.endedAt,
      })
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
  } catch (err: any) {
    console.warn('[TwilioVoipBridge] Last session fetch error:', err.message);
  }

  return { studentName, targetLanguage, languageCode, actflLevel, messageContent, lastSessionSummary, daysAbsent };
}

function buildCallSystemPrompt(ctx: CallContext): string {
  const langName = ctx.targetLanguage.charAt(0).toUpperCase() + ctx.targetLanguage.slice(1);
  const level = ctx.actflLevel ? `${ctx.actflLevel.replace('_', ' ')} ${langName} learner` : `${langName} learner`;
  const absenceNote =
    ctx.daysAbsent !== null && ctx.daysAbsent > 0
      ? `They haven't practiced in ${ctx.daysAbsent} day${ctx.daysAbsent !== 1 ? 's' : ''}.`
      : 'You haven\'t seen them recently.';
  const summaryNote = ctx.lastSessionSummary
    ? `Last session: ${ctx.lastSessionSummary.slice(0, 200)}`
    : 'No previous session summary available.';
  const msgNote = ctx.messageContent
    ? `Your note to them: "${ctx.messageContent.slice(0, 300)}"`
    : '';

  return `You are Daniela, a warm and encouraging AI ${langName} tutor.

RIGHT NOW: You have just called ${ctx.studentName} on their phone. This is a real phone call.

STUDENT CONTEXT:
- Name: ${ctx.studentName}
- Level: ${level}
- ${absenceNote}
- ${summaryNote}
${msgNote ? `- ${msgNote}` : ''}

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
  pendingGreeting: string | null;
  userId: string;
  queueId: string;
}

// Active bridges keyed by callSid (set once start event arrives)
const activeBridges = new Map<string, BridgeState>();

function sendMarkToTwilio(ws: WebSocket, streamSid: string, name: string) {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ event: 'mark', streamSid, mark: { name } }));
}

function sendAudioToTwilio(ws: WebSocket, state: BridgeState, pcm24k: Buffer) {
  if (ws.readyState !== WebSocket.OPEN || state.isEnded) return;
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

async function endBridge(ws: WebSocket, state: BridgeState): Promise<void> {
  if (state.isEnded) return;
  state.isEnded = true;

  if (state.callSid) activeBridges.delete(state.callSid);

  try {
    state.geminiSession?.close();
  } catch (_) {}
  state.geminiSession = null;

  // Log call completion on the queue row
  if (state.queueId) {
    const durationMs = Date.now() - state.callStartMs;
    const durationSeconds = Math.round(durationMs / 1000);
    try {
      const db = getSharedDb();
      await db
        .update(danielaOutboundQueue)
        .set({
          callAnsweredAt: state.answeredAt,
          callDurationSeconds: state.answeredAt ? durationSeconds : null,
        })
        .where(eq(danielaOutboundQueue.id, state.queueId));
      console.log(`[TwilioVoipBridge] Call ended — user ${state.userId.slice(-6)}, duration ${durationSeconds}s`);
    } catch (err: any) {
      console.warn('[TwilioVoipBridge] Failed to log call end:', err.message);
    }
  }
}

async function openGeminiSession(
  ws: WebSocket,
  state: BridgeState,
  systemPrompt: string,
  languageCode: string,
  greetingTrigger: string,
): Promise<void> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

  state.pendingGreeting = greetingTrigger;

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
      onerror: (err: any) => {
        console.error('[TwilioVoipBridge] Gemini error:', err?.message ?? err);
      },
      onclose: (event: any) => {
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
  // setupComplete → send greeting
  if ((msg as any).setupComplete != null && !state.isSetupComplete) {
    state.isSetupComplete = true;
    console.log('[TwilioVoipBridge] Gemini setupComplete — firing greeting');
    if (state.pendingGreeting && state.geminiSession) {
      try {
        // Prime audio context (required for gemini-3.1-flash-live-preview)
        const silencePcm = Buffer.alloc(32000, 0);
        state.geminiSession.sendRealtimeInput({
          audio: { data: silencePcm.toString('base64'), mimeType: 'audio/pcm;rate=16000' },
        });
        state.geminiSession.sendClientContent({
          turns: [{ role: 'user', parts: [{ text: state.pendingGreeting }] }],
          turnComplete: true,
        });
        state.geminiSession.sendRealtimeInput({ activityEnd: {} });
        state.pendingGreeting = null;
      } catch (err: any) {
        console.warn('[TwilioVoipBridge] Greeting send error:', err.message);
      }
    }
  }

  // Audio output → forward to Twilio
  if (msg.serverContent?.modelTurn?.parts) {
    for (const part of msg.serverContent.modelTurn.parts) {
      if (part.inlineData?.data && part.inlineData.mimeType?.includes('audio')) {
        const pcm24k = Buffer.from(part.inlineData.data, 'base64');
        sendAudioToTwilio(ws, state, pcm24k);
      }
    }
  }

  // Log output transcription for debugging
  if ((msg.serverContent as any)?.outputTranscription?.text) {
    const text = ((msg.serverContent as any).outputTranscription.text as string).trim();
    if (text) console.log(`[TwilioVoipBridge] Daniela: "${text.slice(0, 100)}"`);
  }
  if ((msg.serverContent as any)?.inputTranscription?.text) {
    const text = ((msg.serverContent as any).inputTranscription.text as string).trim();
    if (text) console.log(`[TwilioVoipBridge] Student: "${text.slice(0, 100)}"`);
  }
}

// ── WebSocket connection handler ───────────────────────────────────────────────

export async function handleTwilioMediaStream(
  ws: WebSocket,
  userId: string,
  queueId: string,
): Promise<void> {
  console.log(`[TwilioVoipBridge] New connection — user ${userId.slice(-6)}, queue ${queueId.slice(-6)}`);

  const state: BridgeState = {
    streamSid: '',
    callSid: '',
    geminiSession: null,
    isEnded: false,
    callStartMs: Date.now(),
    answeredAt: null,
    isSetupComplete: false,
    pendingGreeting: null,
    userId,
    queueId,
  };

  // Load context + open Gemini session eagerly (before Twilio 'start' event)
  let contextReady = false;
  loadCallContext(userId, queueId)
    .then(async (ctx) => {
      const systemPrompt = buildCallSystemPrompt(ctx);
      const greetingTrigger = `Hello! I just answered the phone. Who is calling?`;
      if (!state.isEnded) {
        await openGeminiSession(ws, state, systemPrompt, ctx.languageCode, greetingTrigger);
        contextReady = true;
      }
    })
    .catch((err: any) => {
      console.error('[TwilioVoipBridge] Context load / Gemini open error:', err.message);
    });

  // ── Twilio WS event handling ─────────────────────────────────────────────────
  ws.on('message', (raw: Buffer | string) => {
    if (state.isEnded) return;
    let event: any;
    try {
      event = JSON.parse(raw.toString());
    } catch {
      return;
    }

    switch (event.event) {
      case 'connected':
        console.log('[TwilioVoipBridge] Twilio connected');
        break;

      case 'start': {
        state.streamSid = event.start?.streamSid || '';
        state.callSid = event.start?.callSid || '';
        state.answeredAt = new Date();
        if (state.callSid) activeBridges.set(state.callSid, state);
        console.log(`[TwilioVoipBridge] Stream started — streamSid: ${state.streamSid.slice(-8)}, callSid: ${state.callSid.slice(-8)}`);
        break;
      }

      case 'media': {
        if (!event.media?.payload || !state.geminiSession || !contextReady) return;
        const mulawBuf = Buffer.from(event.media.payload, 'base64');
        const pcm16k = mulawBufToPcm16k(mulawBuf);
        try {
          state.geminiSession.sendRealtimeInput({
            audio: {
              data: pcm16k.toString('base64'),
              mimeType: 'audio/pcm;rate=16000',
            },
          });
        } catch (err: any) {
          console.warn('[TwilioVoipBridge] Audio send error:', err.message);
        }
        break;
      }

      case 'mark':
        break;

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

  ws.on('error', (err) => {
    console.error('[TwilioVoipBridge] WS error:', err.message);
    endBridge(ws, state).catch(() => {});
  });
}

/**
 * Called by voice-status webhook when a call ends without answer.
 * Falls back to SMS voice note delivery.
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

    await db
      .update(danielaOutboundQueue)
      .set({ callNoAnswer: true })
      .where(eq(danielaOutboundQueue.id, queueId));

    // Fallback: try SMS delivery
    const { canContactStudent } = await import('./outbound-consent');
    const smsOk = await canContactStudent(userId, 'sms');
    if (smsOk) {
      console.log(`[TwilioVoipBridge] No answer — falling back to SMS for user ${userId.slice(-6)}`);
      const { deliverVoiceMessageViaSms } = await import('./voice-message-delivery');
      await deliverVoiceMessageViaSms(queueId, userId, item.content);
    } else {
      console.log(`[TwilioVoipBridge] No answer, no SMS consent — staying in session queue for user ${userId.slice(-6)}`);
    }
  } catch (err: any) {
    console.error('[TwilioVoipBridge] handleCallNoAnswer error:', err.message);
  }
}
