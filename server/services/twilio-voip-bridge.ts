/**
 * Twilio VoIP Bridge — Daniela Calls the Student (Phase 4)
 *
 * Bridges Twilio Media Streams ↔ GeminiLiveSession for real-time outbound calls.
 * Uses the same GeminiLiveSession pipeline as normal voice sessions.
 *
 * Human-answer guarantee: the voice-answer webhook uses synchronous AMD —
 * Twilio returns <Hangup/> for machines before the stream is established.
 * Streams are therefore always human calls; no in-memory AMD gate is needed.
 *
 * Audio: Twilio μ-law 8kHz → PCM16 16kHz → GeminiLiveSession.sendAudioChunk()
 *        GeminiLiveSession audio_chunk (F32LE 24kHz) → μ-law 8kHz → Twilio
 */

import { WebSocket } from 'ws';
import { randomUUID } from 'crypto';
import { GeminiLiveSession } from './gemini-live-session';
import type { StreamingSession } from './streaming-session-types';
import type { TutorPersonality } from './tts-service';
import type { VoiceSpeedOption } from './voice-speed-config';
import { getSharedDb } from '../db';
import { storage } from '../storage';
import { danielaOutboundQueue, voiceSessions, tutorSessions, actflProgress } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';
import { unifiedDanielaContext } from './unified-daniela-context-service';
import { computeCallNonce } from './voice-call-sender';

const MAX_CALL_DURATION_MS = 3 * 60 * 1000;

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

function f32le24kBufToMulaw8k(src: Buffer): Buffer {
  const outSamples = Math.floor(src.length / 12);
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
  const messageContent = queueRow.content || '';

  // users.actfl_level is rarely populated — pull from actfl_progress per language instead
  let actflLevel: string | null = user?.actflLevel ?? null;
  if (!actflLevel) {
    try {
      const { and } = await import('drizzle-orm');
      const progressRows = await db
        .select({ currentActflLevel: actflProgress.currentActflLevel })
        .from(actflProgress)
        .where(and(eq(actflProgress.userId, userId), eq(actflProgress.language, targetLanguage)))
        .limit(1);
      if (progressRows[0]?.currentActflLevel) {
        actflLevel = progressRows[0].currentActflLevel;
        console.log(`[TwilioVoipBridge] ACTFL level from actfl_progress: ${actflLevel} (${targetLanguage})`);
      } else {
        console.warn(`[TwilioVoipBridge] No ACTFL level found for user ${userId.slice(-6)} in language "${targetLanguage}" — will use level-unknown scaffolding`);
      }
    } catch (err: unknown) {
      console.warn('[TwilioVoipBridge] actfl_progress fetch:', err instanceof Error ? err.message : String(err));
    }
  } else {
    console.log(`[TwilioVoipBridge] ACTFL level from users table: ${actflLevel}`);
  }

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

/**
 * Returns ACTFL-appropriate linguistic scaffolding for a phone call.
 *
 * Philosophy (from Daniela's pedagogy brief):
 *   Spanish is always the medium. English is the scaffold — a precision tool
 *   picked up and put down. The scaffold adjusts the COMPLEXITY of the Spanish,
 *   not the proportion of the language.
 *
 *   Two kinds of English are always available:
 *   - Emotional English (warmth, encouragement, "You got this!") — freely
 *   - Instructional English (explaining a word/concept) — rare, targeted, brief
 */
function getCallScaffoldingPolicy(actflLevel: string | null, langName: string): string {
  const lvl = (actflLevel || '').toLowerCase();

  if (lvl.startsWith('novice_low') || lvl === 'novice low') {
    return `SCAFFOLDING — Novice Low:
Conduct this call in ${langName}. Scaffold the ${langName} itself:
- Vocabulary: high-frequency words and cognates only
- Sentences: present tense, 4-6 words max ("¿Cómo estás?" "¿Qué haces hoy?")
- Questions: yes/no and simple recognition ("¿Es un banco?")
- Pacing: slow, clear, repeat key phrases
- If the student seems lost: rephrase in simpler ${langName} first — don't immediately switch to English
- Emotional English is freely available ("Great job!" "Don't worry!")
- Instructional English only as a last resort if ${langName} rephrasing doesn't work`;
  }

  if (lvl.startsWith('novice_mid') || lvl === 'novice mid') {
    return `SCAFFOLDING — Novice Mid:
Conduct this call in ${langName}. Scaffold the ${langName} itself:
- Vocabulary: common verbs, basic adjectives, familiar nouns
- Sentences: simple present with some common verb variety (ir, querer, tener, gustar)
- Questions: simple open-ended ("¿Qué te gusta?" "¿Adónde vas?")
- Topics: daily routine, food, school, family — concrete and familiar
- Pacing: natural but unhurried; recast errors naturally, don't drill corrections
- Emotional English freely available; instructional English sparingly`;
  }

  if (lvl.startsWith('novice_high') || lvl === 'novice high') {
    return `SCAFFOLDING — Novice High:
Conduct this call in ${langName}. Scaffold the ${langName} itself:
- Vocabulary: broader range; can handle some unfamiliar words via context
- Sentences: connected with porque, y, pero; preterite for recent events
- Questions: what/where/when/who ("¿Qué hiciste ayer?")
- Topics: familiar and semi-familiar; simple narratives
- Emotional English freely available; instructional English rarely`;
  }

  if (lvl.startsWith('intermediate_low') || lvl === 'intermediate low') {
    return `SCAFFOLDING — Intermediate Low:
Conduct this call in ${langName}. Scaffold the ${langName} itself:
- Vocabulary: wide range; can derive meaning from context
- Sentences: paragraph-length; mix of present/preterite/imperfect
- Questions: opinions and preferences ("¿Qué piensas de...?")
- Topics: familiar and semi-familiar; can narrate past events
- English only for emotional warmth or rare targeted instruction`;
  }

  if (lvl.startsWith('intermediate_mid') || lvl === 'intermediate mid' ||
      lvl.startsWith('intermediate_high') || lvl === 'intermediate high') {
    return `SCAFFOLDING — Intermediate Mid/High:
Conduct this call fully in ${langName}.
- Full tense range including subjunctive for common expressions
- Idiomatic expressions and extended discourse
- Abstract and unfamiliar topics welcome
- English only for brief emotional moments`;
  }

  if (lvl.startsWith('advanced') || lvl.startsWith('superior') || lvl.startsWith('distinguished')) {
    return `SCAFFOLDING — Advanced:
Conduct this call entirely in ${langName}. Full register range, hypotheticals, cultural nuance.
English only if the student explicitly requests it.`;
  }

  // Unknown/null level — immersion-first but gauge and adjust
  return `SCAFFOLDING — Level unknown:
Conduct this call in ${langName}. Start with clear, short sentences on familiar topics and gauge the student's comfort immediately. If they respond confidently, increase complexity. If they struggle, simplify the ${langName} (shorter sentences, present tense, high-frequency words) — don't default to English. Emotional English is freely available; instructional English only when ${langName} rephrasing has failed.`;
}

function buildCallSystemPrompt(ctx: CallContext): string {
  const langName = ctx.targetLanguage.charAt(0).toUpperCase() + ctx.targetLanguage.slice(1);
  const actflDisplay = ctx.actflLevel ? ctx.actflLevel.replace(/_/g, ' ') : 'unknown';
  const level = ctx.actflLevel ? `${actflDisplay} ${langName} learner` : `${langName} learner`;
  const absenceNote = ctx.daysAbsent !== null && ctx.daysAbsent > 0
    ? `They haven't practiced in ${ctx.daysAbsent} day${ctx.daysAbsent !== 1 ? 's' : ''}.`
    : "You haven't seen them recently.";
  const summaryNote = ctx.lastSessionSummary ? `Last session: ${ctx.lastSessionSummary.slice(0, 200)}` : 'No previous session summary.';
  const msgNote = ctx.messageContent ? `\n- Your note: "${ctx.messageContent.slice(0, 300)}"` : '';
  const memorySection = ctx.unifiedContextStr ? `\n\nStudent memory:\n${ctx.unifiedContextStr.slice(0, 3000)}` : '';
  const scaffoldingPolicy = getCallScaffoldingPolicy(ctx.actflLevel, langName);

  return `You are Daniela, a warm and encouraging AI ${langName} tutor making a brief phone check-in.

STUDENT: ${ctx.studentName} | ACTFL Level: ${actflDisplay} | ${absenceNote} | ${summaryNote}${msgNote}${memorySection}

${scaffoldingPolicy}

THIS IS A CHECK-IN CALL — NOT A LESSON:
Your only job is to say hello, ask one or two questions about how they're doing or how practice has been going, then wrap up warmly and point them toward the app. That's it.

HARD RULES — do not break these:
- NEVER offer to practice, drill, quiz, or do any language exercise on this call — not even "just a little." You are not here to teach. You are here to check in.
- NEVER suggest "we have time for a quick practice" or any variation. The call ends after the check-in.
- If the student tries to turn it into a lesson, gently hold the line: "I just wanted to check in — the app is where we do the real work together."
- If the student points out that you're redirecting them to the app, own it warmly and directly: "Exactly — I just wanted to hear how you're doing. The app is waiting for you!" Then wrap up. Do NOT backpedal or offer practice as a consolation.

Call arc: greet → 1-2 brief exchanges → warm redirect to the app → goodbye. Target under 2 minutes.
End graciously if they say they can't talk. No function tools on this call.`;
}

// ── StreamingSession adapter for GeminiLiveSession ───────────────────────────

function buildCallSession(userId: string, ctx: CallContext, twilioWs: WebSocket): StreamingSession {
  const personality: TutorPersonality = 'warm';
  const speed: VoiceSpeedOption = 'normal';

  return {
    id: randomUUID(),
    userId,
    conversationId: randomUUID(),
    targetLanguage: ctx.targetLanguage,
    nativeLanguage: 'english',
    difficultyLevel: ctx.actflLevel || 'intermediate',
    subtitleMode: 'off',
    tutorPersonality: personality,
    tutorExpressiveness: 0.7,
    voiceSpeed: speed,
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
    isReadingRoom: false,
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
    sentAudioChunks: new Set<string>(),
    sentAudioHashes: new Map<string, number>(),
    telemetryTtsCharacters: 0,
    telemetrySttSeconds: 0,
    telemetryExchangeCount: 0,
    telemetryStudentSpeakingMs: 0,
    telemetryTutorSpeakingMs: 0,
    telemetryLlmInputTokens: 0,
    telemetryLlmOutputTokens: 0,
  };
}

// ── Per-call bridge state ─────────────────────────────────────────────────────

interface BridgeState {
  streamSid: string;
  callSid: string;
  glSession: GeminiLiveSession | null;
  isEnded: boolean;
  callStartMs: number;
  streamStartedAt: Date | null;
  maxDurationTimer: NodeJS.Timeout | null;
  userId: string;
  queueId: string;
  targetLanguage: string;
  contextReady: boolean;
  // Echo gate — true while Daniela's audio is actively being sent to the phone.
  // Prevents her speaker output from looping back through the mic as "student audio".
  isSpeaking: boolean;
  speakingTimer: NodeJS.Timeout | null;
}

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

  if (!state.queueId || !state.streamStartedAt) return;
  const durationSeconds = Math.round((Date.now() - state.callStartMs) / 1000);
  try {
    const db = getSharedDb();
    // Fetch the current queue row to check callAnsweredAt (set by voice-answer webhook)
    const rows = await db.select({ callAnsweredAt: danielaOutboundQueue.callAnsweredAt })
      .from(danielaOutboundQueue).where(eq(danielaOutboundQueue.id, state.queueId));
    const wasHumanAnswered = !!rows[0]?.callAnsweredAt;

    await db.update(danielaOutboundQueue).set({
      callDurationSeconds: wasHumanAnswered ? durationSeconds : null,
      deliveredAt: wasHumanAnswered ? state.streamStartedAt : undefined,
    }).where(eq(danielaOutboundQueue.id, state.queueId));

    if (wasHumanAnswered) await logCallAsVoiceSession(state, durationSeconds);
    console.log(`[TwilioVoipBridge] Call ended — user ${state.userId.slice(-6)}, humanAnswered: ${wasHumanAnswered}, ${durationSeconds}s`);
  } catch (err: unknown) {
    console.warn('[TwilioVoipBridge] Failed to log call end:', err instanceof Error ? err.message : String(err));
  }
}

// ── WebSocket connection handler ──────────────────────────────────────────────

export async function handleTwilioMediaStream(ws: WebSocket): Promise<void> {
  console.log('[TwilioVoipBridge] New Twilio Media Streams connection');

  const state: BridgeState = {
    streamSid: '', callSid: '', glSession: null, isEnded: false,
    callStartMs: Date.now(), streamStartedAt: null,
    maxDurationTimer: null,
    userId: '', queueId: '', targetLanguage: 'spanish', contextReady: false,
    isSpeaking: false, speakingTimer: null,
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
                  // Echo gate: mark Daniela as speaking while her audio is going to the phone.
                  // This prevents her speaker output from looping back through the phone mic
                  // and being forwarded to Gemini as "student audio."
                  state.isSpeaking = true;
                  if (state.speakingTimer) clearTimeout(state.speakingTimer);
                  state.speakingTimer = setTimeout(() => {
                    state.isSpeaking = false;
                    state.speakingTimer = null;
                  }, 600); // 600ms quiet after last audio chunk before accepting student input
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
            const langName = ctx.targetLanguage.charAt(0).toUpperCase() + ctx.targetLanguage.slice(1);
            const lvl = (ctx.actflLevel || '').toLowerCase();
            // Use English-first greeting for novice levels OR when level is unknown
            const isNoviceOrUnknown = !ctx.actflLevel ||
              lvl.startsWith('novice_low') || lvl.startsWith('novice_mid') ||
              lvl === 'novice low' || lvl === 'novice mid';
            const greetingLang = isNoviceOrUnknown
              ? 'English (you may sprinkle in a brief Spanish phrase like "¡Hola!" but keep the rest in English)'
              : langName;
            const greetingTrigger = `Daniela, you have just reached ${ctx.studentName} on a phone call. Please greet them warmly now in ${greetingLang}, following the LANGUAGE MIX policy in your instructions, and begin the check-in.`;
            await gl.start(systemPrompt, [], greetingTrigger);
            state.contextReady = true;
          })
          .catch((err: unknown) => {
            console.error('[TwilioVoipBridge] Session init error:', err instanceof Error ? err.message : String(err));
            // Hang up and attempt SMS fallback rather than leaving a silent call
            hangUpCall(state.callSid).catch(() => {});
            endBridge(state).catch(() => {});
            if (ws.readyState === WebSocket.OPEN) ws.close();
            handleCallNoAnswer(state.userId, state.queueId).catch(() => {});
          });
        break;
      }

      case 'media': {
        if (!state.contextReady || !state.glSession) return;
        // Echo gate: drop Twilio audio while Daniela is actively speaking to the phone.
        // On speaker calls her voice goes mic → Twilio → here → Gemini causing a feedback loop.
        if (state.isSpeaking) return;
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

export async function handleCallNoAnswer(userId: string, queueId: string): Promise<void> {
  try {
    const db = getSharedDb();
    const rows = await db.select().from(danielaOutboundQueue).where(eq(danielaOutboundQueue.id, queueId));
    const item = rows[0];
    if (!item) return;
    if (item.userId !== userId) { console.warn('[TwilioVoipBridge] handleCallNoAnswer ownership mismatch'); return; }

    // Idempotency guard — skip if already handled by a prior callback
    if (item.callNoAnswer || item.deliveredAt || item.smsDeliveredAt) {
      console.log(`[TwilioVoipBridge] handleCallNoAnswer — already handled, skipping (user ${userId.slice(-6)})`);
      return;
    }

    await db.update(danielaOutboundQueue).set({ callNoAnswer: true }).where(eq(danielaOutboundQueue.id, queueId));

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
