/**
 * GeminiLiveSession — Gemini Live API voice session manager.
 *
 * Replaces the 3-service pipeline (Deepgram STT + Gemini streaming + Gemini TTS)
 * with a single bidirectional Gemini Live WebSocket.
 *
 * Architecture:
 *   Client PCM16 (16 kHz) → sendAudioChunk() → ai.live session → Daniela audio (PCM16 24 kHz)
 *                                                               → tool_call events → NativeFunctionCallHandler
 *   PCM16 output → pcm16ToF32le() → audio_chunk WS message → client
 *
 * Preserved unchanged:
 *   - native-fc-handlers.ts  — all 40+ tool implementations
 *   - daniela-function-registry.ts — tool declarations
 *   - StreamingSession object — created by orchestrator, passed in here
 *   - All client-side UI — same audio_chunk message format
 *
 * Feature flag: GEMINI_LIVE_VOICE=true
 */

import {
  GoogleGenAI,
  Modality,
  StartSensitivity,
  EndSensitivity,
  type Session,
  type LiveServerMessage,
} from '@google/genai';
import type { FunctionDeclaration } from '@google/genai';
import { NativeFunctionCallHandler } from './native-fc-handlers';
import type { StreamingSession } from './streaming-session-types';
import { lookupLegacyType, buildFunctionContinuationResponse } from './daniela-function-registry';
import type { ExtractedFunctionCall } from './gemini-function-declarations';
import { reportGlToolCallFailure, reportGlToolCallSuccess } from './sofia-billing-monitor';
import { getSharedDb } from '../db';
import { sql } from 'drizzle-orm';
import { GLKaraokeTracker } from './gl-karaoke-tracker';
import { PostResponseEnrichmentService } from './post-response-enrichment';
import { storage } from '../storage';
import type { IStorage } from '../storage';

export const GEMINI_LIVE_MODEL = process.env.GEMINI_LIVE_MODEL || 'gemini-3.1-flash-live-preview';
const AUDIO_OUTPUT_SAMPLE_RATE = 24000;
const AUDIO_INPUT_SAMPLE_RATE = 16000;

/** Default voice for Daniela in Gemini Live mode. */
const DEFAULT_LIVE_VOICE = 'Aoede';

/**
 * Map target language names → BCP-47 language codes for Gemini Live speechConfig.
 * Controls both STT recognition language and influences output voice accent.
 */
const LANGUAGE_TO_BCP47: Record<string, string> = {
  english:    'en-US',
  spanish:    'es-ES',   // es-US caused silence on gemini-3.1-flash-live-preview; es-ES is correct BCP-47
  french:     'fr-FR',
  italian:    'it-IT',
  portuguese: 'pt-BR',
  german:     'de-DE',
  japanese:   'ja-JP',
  mandarin:   'zh-CN',
  chinese:    'zh-CN',
  korean:     'ko-KR',
  hebrew:     'he-IL',
};

/**
 * Complete set of valid Gemini Live prebuilt voice names.
 * The voice ID used in our DB/overrides IS the voice name — no translation needed.
 * Gemini Live rejects unknown voice names, so we validate against this set and
 * fall back to DEFAULT_LIVE_VOICE for anything not in the list.
 */
const GEMINI_LIVE_VOICE_NAMES = new Set([
  // Original 8 (shared with Chirp HD catalog)
  'Aoede', 'Kore', 'Leda', 'Zephyr', 'Puck', 'Charon', 'Fenrir', 'Orus',
  // Additional Gemini Live–only voices
  'Achernar', 'Autonoe', 'Callirrhoe', 'Despina', 'Erinome', 'Laomedeia',
  'Pulcherrima', 'Sulafat', 'Vindemiatrix',
  'Achird', 'Algenib', 'Algieba', 'Alnilam', 'Enceladus', 'Gacrux',
  'Iapetus', 'Rasalgethi', 'Sadachbia', 'Sadaltager', 'Schedar', 'Umbriel', 'Zubenelgenubi',
]);

/**
 * Scan Daniela's output transcript for any previously-taught vocab word.
 * Returns the first match found, or null if none.
 * Words in `skipKeys` (added this turn) are excluded — they just had a full card shown.
 */
function findTaughtWordMention(
  text: string,
  taughtVocab: Map<string, { word: string; imageUrl: string; meaning?: string }>,
  skipKeys?: Set<string>,
): { word: string; imageUrl: string } | null {
  if (!text) return null;
  const lowerText = text.toLowerCase();
  for (const [key, entry] of taughtVocab) {
    if (skipKeys?.has(key)) continue;
    // Match the full word phrase (e.g. "el tiempo") or the word without its article
    const wordLower = entry.word.toLowerCase();
    const wordNoArticle = wordLower.replace(/^(el|la|los|las|le|les|der|die|das|il|lo|os|as|o|a)\s+/, '');
    const candidates = wordNoArticle !== wordLower ? [wordLower, wordNoArticle] : [wordLower];
    for (const candidate of candidates) {
      if (lowerText.includes(candidate)) {
        return { word: entry.word, imageUrl: entry.imageUrl };
      }
    }
  }
  return null;
}

export class GeminiLiveSession {
  private liveSession: Session | null = null;
  private fcHandler: NativeFunctionCallHandler;
  private currentTurnId = 0;
  /** Total completed conversation exchanges (user speaks → Daniela responds) this session. */
  private completedExchanges = 0;
  /** Cumulative length of all Daniela output transcripts — used as TTS char proxy for billing. */
  private totalOutputCharacters = 0;

  // ── Session-level speaking & latency metrics ────────────────────────────
  // These are accumulated per-turn and exposed at session end for billing/telemetry.
  /** Accumulated student speaking time in ms (from first inputTranscription → first Daniela audio). */
  private studentSpeakingMs = 0;
  /** Accumulated tutor speaking time in ms (from first audio chunk → generationComplete). */
  private tutorSpeakingMs = 0;
  /** Per-turn latencies in ms: time from processing_pending → first audio chunk. */
  private turnLatencies: number[] = [];
  /** Timestamp (Date.now()) when the current turn's processing_pending was fired. */
  private turnLatencyStartTime: number | null = null;
  /** Timestamp (Date.now()) when Daniela's first audio chunk arrived for the current turn. */
  private tutorSpeakingStartTime: number | null = null;
  /** Timestamp (Date.now()) when the first inputTranscription arrived for the current user turn. */
  private studentSpeakingStartTime: number | null = null;
  /** Timestamp (Date.now()) of the LAST inputTranscription chunk — used for latency: last word → first audio. */
  private lastInputTranscriptionTime: number | null = null;
  // Each Gemini sub-turn (one turnComplete) maps to one "sentence" in the progressive PCM player.
  // sentenceIndex must increment per sub-turn so the player queues them sequentially instead of
  // overwriting earlier chunks with chunkIndex:0 from a later sub-turn.
  private currentSentenceIndex = 0;
  private currentChunkIndex = 0;       // Resets to 0 at each new sentenceIndex boundary
  private lastSentenceStartSentIndex = -1;  // Tracks which sentenceIndex has had sentence_start emitted
  private karaokeTracker: GLKaraokeTracker | null = null;
  private hadAudioInCurrentSubturn = false;
  private lastAudioChunkAt = 0;             // Wall-clock ms of most recent audio chunk — gates ghost-transcription suppression
  private firstAudioSentThisTurn = false;   // Guard: don't send processing_pending AFTER audio already started
  private sessionStartedAt = 0;             // Wall-clock ms when start() was called (for establishment latency)
  private processingPendingSentThisTurn = false; // Guard: send processing_pending exactly once per conversation turn
  private isStopped = false;
  private isStarted = false;
  private isSetupComplete = false;
  private pendingGreetingTrigger: string | null = null;
  private pendingGreetingSilent = false; // true = prime audio on setupComplete but don't speak
  private identityThreads: Array<{ title: string; content: string }> = [];

  // ── Mic gate: blocks echo during ALL Daniela audio generation ────────────
  // When open-mic mode is active, the client streams audio continuously.
  // If mic audio reaches GL while Daniela is speaking, GL's VAD detects the
  // echo through the speaker as "user speaking" and either interrupts itself
  // or produces a zero-sentence response to the echo (alternating silence bug).
  //
  // greetingPhaseActive: gates mic from session start until Daniela's first audio chunk.
  // isTutorGeneratingAudio: gates mic for ALL subsequent Daniela turns.
  // Together these cover the full echo suppression lifecycle.
  private greetingPhaseActive = false;
  // DOUBLE-AUDIO FIX: After a GL internal reconnect that interrupted mid-turn audio,
  // the client is sent gl_audio_reset (which calls player.stop() + resetForNewTurn()).
  // The next first-audio processing_pending is suppressed since the client already
  // reset — sending it again would clear the new audio's dedup state prematurely.
  private suppressNextProcessingPending = false;
  private isTutorGeneratingAudio = false;
  // Safety timeout: force-opens the mic gate if onPlaybackEnded() never arrives
  // (e.g., the client disconnects mid-playback or the telemetry event is dropped).
  private playbackGateSafetyTimeout: ReturnType<typeof setTimeout> | null = null;
  // Safety timeout: force-clears greetingPhaseActive if the greeting produces no audio
  // (content filter, text-only response, error) so the mic doesn't stay permanently blocked.
  // 15s is generous — greeting audio typically arrives within 1-2s.
  private greetingWatchdogTimer: NodeJS.Timeout | null = null;
  // generationComplete watchdog: if Gemini stops sending audio chunks but never fires
  // generationComplete (a known GL API transient failure), this timer fires ~6s after
  // the last audio chunk and executes the same sealing logic, preventing a deaf session.
  private generationCompleteWatchdogTimer: NodeJS.Timeout | null = null;

  // ── Auto-reconnect ─────────────────────────────────────────────────────────
  // When the GL WebSocket closes unexpectedly (1011 internal error, 1006 network
  // drop, etc.) we transparently reconnect so the student doesn't have to reload.
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 3;
  // Close codes we consider transient/retriable (not policy violations or intentional closes).
  // 1011 is intentionally excluded: it covers both quota exhaustion and Gemini internal errors.
  // Both cases are non-retriable — retrying immediately with a large system prompt just burns
  // more quota. Quota is handled explicitly above; other 1011s bail with a clear error.
  private readonly RETRIABLE_CLOSE_CODES = new Set([
    1006,  // Abnormal closure — no close frame (network drop)
    1008,  // GoAway / session duration limit reached — Gemini sends this when the session
           // hits its maximum duration. Transparent reconnect restores the session.
    1012,  // Service restart
    1013,  // Try again later
  ]);
  // Timestamp of the last goAway message received from GL.
  // When GL sends goAway + then closes with 1007, the 1007 is not a genuine
  // "invalid argument" — it is GL completing the graceful disconnect after the
  // goAway grace period. We treat it as retriable in that specific context.
  private lastGoAwayTimestamp = 0;
  // Stored so reconnect can re-call start() with the same arguments.
  private lastSystemPrompt = '';
  private lastTools: FunctionDeclaration[] = [];

  // ── Mid-session context refresh (DISABLED — 2026-06-13) ────────────────
  // sendClientContent({role:'model', turnComplete:false}) was intended as a
  // silent context reminder but is incorrect GL API usage: it signals GL that
  // the model is mid-utterance, causing GL to generate a second audio stream to
  // "complete" the injected model turn — producing audio doubling every 15 turns.
  // GL has no safe "inject context without triggering a response" mechanism via
  // sendClientContent. System prompt handles context for now.
  // Keeping modelTurnCount as a counter for future use with a safe injection API.
  private modelTurnCount = 0;

  // ── Transcript accumulators ─────────────────────────────────────────────
  // Both user and assistant transcripts are accumulated across multiple
  // inputTranscription / outputTranscription / turnComplete events and
  // flushed as single complete utterances once the response is truly done.
  private pendingInputTranscript = '';   // Accumulates user's speech per utterance
  private pendingInputSaved = false;     // True once user message has been persisted for this turn
  private pendingOutputTranscript = '';  // Accumulates Daniela's reply across all sub-turns
  private lastUserText = '';             // Last completed user turn — for enrichment context
  private enrichment: PostResponseEnrichmentService;
  private transcriptFlushTimer: NodeJS.Timeout | null = null;
  // Guard: prevents concurrent flushTranscripts() calls (e.g. 800ms debounce fires before
  // generationComplete, then generationComplete also calls flush) from double-incrementing
  // completedExchanges or sending response_complete twice.
  private isFlushInProgress = false;
  // Typed field for inline media parts that must be sent via realtimeInput after tool response
  // (GL tool response payloads cannot carry binary inlineData — causes 1007 session crash).
  // Using a typed array + push ensures batched tool calls (functionCalls[]) don't overwrite
  // each other's pending parts; each call appends and all are sent together.
  private pendingInlineParts: Array<{ mimeType: string; data: string }> = [];

  /**
   * Optional callback fired with the completed user transcript after each GL turn.
   * Used by the unified-ws-handler to route the transcript through the orchestrator
   * in "tools-only" mode so tool call side-effects (whiteboard, memory lookups,
   * scenarios, etc.) fire even though GL handles audio natively.
   */
  onUserTurnComplete?: (transcript: string) => void;

  /**
   * Optional callback fired whenever Gemini sends a new session resumption handle.
   * Used by the unified-ws-handler to persist the handle to the DB so a server
   * restart can restore it and pass it back to Gemini on reconnect — giving
   * Daniela full in-session memory even across hard process restarts.
   */
  onResumptionHandleUpdate?: (handle: string) => void;

  /**
   * Optional callback fired when Daniela's first audio chunk arrives.
   * Used by the unified-ws-handler to clear the tutor-no-response watchdog timer.
   */
  onFirstAudioGenerated?: () => void;

  constructor(
    private session: StreamingSession,
    private sendWsMessage: (ws: any, message: any, session?: any) => void,
  ) {
    this.enrichment = new PostResponseEnrichmentService(storage as unknown as IStorage, sendWsMessage);
    this.fcHandler = new NativeFunctionCallHandler(
      sendWsMessage,
      (_ws: any, code: string, message: string, _recoverable: boolean) => {
        console.error(`[GeminiLive] FC error: ${code} — ${message}`);
      },
      async (_session: StreamingSession, data: { to: string; reason: string }) => {
        console.log(`[GeminiLive] Phase shift requested: ${data.to} — ${data.reason}`);
      },
    );
  }

  /**
   * Open the Gemini Live WebSocket session.
   * Call once after session metadata is ready.
   */
  async start(
    systemPrompt: string,
    tools: FunctionDeclaration[],
    greetingTrigger?: string,
  ): Promise<void> {
    if (this.isStarted) {
      console.warn('[GeminiLive] start() called on already-started session — ignoring');
      return;
    }
    this.isStarted = true;
    this.sessionStartedAt = Date.now();
    // Store for use by auto-reconnect
    this.lastSystemPrompt = systemPrompt;
    this.lastTools = tools;

    // Start karaoke tracker when subtitles are active — taps GL output audio
    // and runs it through a parallel Deepgram STT leg for word-level timestamps.
    if (this.session.subtitleMode !== 'off') {
      this.karaokeTracker = new GLKaraokeTracker(
        this.session.targetLanguage,
        (msg: any) => this.sendWsMessage(this.session.ws, msg),
      );
      this.karaokeTracker.start().catch(err =>
        console.warn('[GeminiLive] Karaoke tracker failed to start:', err?.message ?? err)
      );
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

    // Voice override (from Voice Lab) takes priority over the session's stored voice.
    const voiceOverride = (this.session as any).voiceOverride;
    const effectiveVoiceId = voiceOverride?.voiceId ?? this.session.voiceId ?? '';
    const liveName = GEMINI_LIVE_VOICE_NAMES.has(effectiveVoiceId) ? effectiveVoiceId : DEFAULT_LIVE_VOICE;
    const langKey = (this.session.targetLanguage || '').toLowerCase().trim();
    // geminiLanguageCode from the Voice Lab override takes priority over the language-map default.
    const languageCode = voiceOverride?.geminiLanguageCode || LANGUAGE_TO_BCP47[langKey] || 'en-US';
    console.log(`[GeminiLive] Opening session — model: ${GEMINI_LIVE_MODEL}, voice: ${liveName}, languageCode: ${languageCode}${voiceOverride?.geminiLanguageCode ? ' (voice-lab override)' : ''}`);

    // Build a universal accent identity directive from the session's language code.
    // The label is driven entirely by languageCode, which comes from the Voice Lab
    // override first (voiceOverride.geminiLanguageCode) and then the language-map
    // default — so changing the Voice Lab accent automatically changes this directive.
    //
    // The directive is intentionally language-agnostic: the tutor's accent is part of
    // who they are and travels with them into every language they speak — the target
    // language, the student's native language (English, Italian, etc.), or anything
    // else. A tutor from Spain sounds Spanish whether she's speaking Spanish or Italian.
    const ACCENT_DESCRIPTIONS: Record<string, string> = {
      'es-ES': 'Castilian Spanish',
      'es-MX': 'Mexican Spanish',
      'es-CO': 'Colombian Spanish',
      'es-AR': 'Rioplatense (Argentine) Spanish',
      'es-CL': 'Chilean Spanish',
      'es-PE': 'Peruvian Spanish',
      'fr-FR': 'Parisian French',
      'fr-CA': 'Québécois French',
      'de-DE': 'Standard German (Hochdeutsch)',
      'de-AT': 'Austrian German',
      'de-CH': 'Swiss German',
      'it-IT': 'Standard Italian',
      'it-CH': 'Swiss Italian',
      'pt-BR': 'Brazilian Portuguese',
      'pt-PT': 'European Portuguese',
      'ja-JP': 'standard Tokyo Japanese',
      'zh-CN': 'Mainland Mandarin Chinese',
      'zh-TW': 'Taiwan Mandarin Chinese',
      'ko-KR': 'Seoul Korean',
      'he-IL': 'Modern Israeli Hebrew',
    };
    // ── Accent identity directive (re-enabled June 13 2026 — new framing) ──────
    // Previous directive caused regionalism over-indexing (vosotros, guay, vale).
    // New approach (per Gemini 3-flash audit): decouple PHONOLOGY from LEXICON.
    // Identity framing ("your native language is X") vs. behavioral instruction
    // ("speak with X accent") avoids the proving/regionalism problem while keeping
    // the acoustic anchor. Appended to END of system prompt for recency-bias weight.
    //
    // VOICE_PACING directive remains removed: Flash does not stream audio while
    // thinking — filler prepends robotic words to every turn without buying latency.
    const accentLabel = ACCENT_DESCRIPTIONS[languageCode];
    const accentDirective = accentLabel ? `

── TUTOR ACCENT IDENTITY ──
IDENTITY: You are a native speaker of ${accentLabel}. This is who you are, not a performance.
LINGUISTIC BOUNDARY: Your internal monologue and primary linguistic identity are ${accentLabel}. You think and feel in your native language.
SPEECH CHARACTERISTICS: When speaking the student's language (e.g. English), maintain the natural phonology and prosody of a ${accentLabel} native speaker. Your accent is part of who you are and travels with you into every language you speak — including the student's native language.
LEXICAL CONSTRAINT: Do not use regional slang, fillers, or interjections from your native language unless you are specifically teaching those terms as vocabulary. Use standard, internationally clear vocabulary in all languages. Your identity is audible in your voice — not in regional vocabulary choices.` : '';
    const effectiveSystemPrompt = accentDirective ? systemPrompt + accentDirective : systemPrompt;

    this.liveSession = await ai.live.connect({
      model: GEMINI_LIVE_MODEL,
      config: {
        systemInstruction: effectiveSystemPrompt,
        tools: tools.length > 0 ? [{ functionDeclarations: tools }] : undefined,
        // AUDIO-only: gemini-3.1-flash-live-preview does NOT support TEXT as a
        // responseModality — sending [AUDIO, TEXT] causes immediate 1011
        // "Internal error encountered." at setup time. Use outputAudioTranscription
        // to capture the assistant's words instead.
        responseModalities: [Modality.AUDIO],

        // ── Generation config ─────────────────────────────────────────────
        // temperature 0.8: varied phrasing without losing coherence. Default
        // Flash temperature is lower, which causes the tutor to converge on
        // the same filler phrases ("¡Muy bien!", "¡Excelente!") every turn.
        // Higher temp = more lexical diversity in acknowledgments and transitions.
        // presence_penalty and frequency_penalty are silently ignored in Live
        // audio mode — the audio generation pipeline doesn't apply logit biases
        // the way text generation does. (3-flash audit June 13 2026)
        generationConfig: {
          temperature: 0.8,
        },

        // ── Transcription ─────────────────────────────────────────────────
        // inputAudioTranscription:  student speech → text (live captions + DB)
        // outputAudioTranscription: assistant speech → text (DB conversation log)
        inputAudioTranscription: {},
        outputAudioTranscription: {},

        speechConfig: {
          languageCode,
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: liveName,
            },
          },
        },

        // ── Thinking configuration ────────────────────────────────────────
        // Gives Daniela an internal reasoning pass before her first word.
        //
        // Level: MEDIUM — HIGH holds the first audio token until a full reasoning
        // pass completes, adding noticeable TTFT lag. MEDIUM gives meaningful depth
        // without blocking voice streaming. (June 12 2026 audit: dropped from HIGH)
        //
        // SDK: "An error will be returned if this field is set for models that
        // don't support thinking." — clean explicit failure, not a silent 1011.
        thinkingConfig: { thinkingLevel: 'MEDIUM' as any },

        // ── VAD / Turn-taking configuration ───────────────────────────────
        // Gemini Live's audio model does semantic turn detection — it
        // understands whether a sentence sounds complete, not just whether
        // there's silence. Our settings tune how much patience it shows:
        //
        //  START_SENSITIVITY_HIGH    — detect speech onset quickly so Daniela
        //                             doesn't miss when the student starts talking.
        //  END_SENSITIVITY_LOW       — "lazy" end detection; forces the model to wait
        //                             for a more definitive final cadence before it
        //                             starts the silence countdown. Critical for language
        //                             learners who pause mid-sentence while word-searching
        //                             ("Quiero… [pause]… una… [pause]… manzana").
        //                             HIGH + 1500ms was contradictory: HIGH is aggressive
        //                             about interpreting any pitch/volume drop as turn-end,
        //                             meaning the 1500ms timer would start at the learner's
        //                             first pause — well before they finished their sentence.
        //                             LOW is correct: be "lazy," not "eager," for non-fluent
        //                             speakers. (3-flash audit June 13 2026)
        //                             (history: LOW+2500ms→HIGH+1500ms [dead air fix]→
        //                              LOW+1500ms [3-flash audit: HIGH contradictory for learners])
        //  prefixPaddingMs: 200      — require 200 ms of sustained speech before
        //                             committing a turn start, filtering out coughs,
        //                             filler sounds, and accidental mic noise.
        //  silenceDurationMs: 1500   — hard cutoff: 1500 ms of silence forces end
        //                             of turn even if semantic signal is ambiguous.
        //                             Language learners frequently pause while
        //                             searching for a word — 1500ms handles that
        //                             without making the conversation feel frozen.
        //                             (was 800ms → 1500ms → 2500ms → back to 1500ms)
        realtimeInputConfig: {
          automaticActivityDetection: {
            disabled: false,
            startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_HIGH,
            endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_LOW,
            prefixPaddingMs: 200,
            silenceDurationMs: 1500,
          },
        },

        // ── Session resumption ────────────────────────────────────────────
        // Server will stream back newHandle tokens on each turn.
        // We store the latest token so we can reconnect without losing context.
        // NOTE: Only include sessionResumption when we actually have a handle.
        // Passing an empty {} causes a 1011 internal error on fresh sessions.
        ...(this.session.geminiLiveResumptionHandle
          ? { sessionResumption: { handle: this.session.geminiLiveResumptionHandle } }
          : {}),
      },
      callbacks: {
        onmessage: (msg: LiveServerMessage) => {
          this.handleServerMessage(msg).catch(err => {
            console.error('[GeminiLive] handleServerMessage error:', err);
          });
        },
        onerror: (err: any) => {
          console.error('[GeminiLive] WebSocket error:', err);
          // Propagate to client so the UI can show a recoverable error rather
          // than hanging silently.  The subsequent onclose will drive reconnect
          // logic — this just ensures the user sees something immediately.
          if (!this.isStopped) {
            this.sendWsMessage(this.session.ws, {
              type: 'voice_error',
              code: 'GEMINI_WS_ERROR',
              message: 'The voice connection encountered an error. Reconnecting…',
              recoverable: true,
            });
          }
        },
        onclose: (event: any) => {
          const code = event?.code as number;
          const reason = event?.reason || '(no reason)';
          console.log(`[GeminiLive] Session closed — code: ${code}, reason: ${reason}`);

          // ── Auto-reconnect ─────────────────────────────────────────────────
          // Retriable codes are transient (network hiccup, GL service restart).
          // We only reconnect when isStopped is false (student didn't end the session)
          // and we haven't exhausted our 3 attempts.
          //
          // Quota errors (1011 + "quota" in reason) are NOT retriable — retrying
          // immediately just burns more quota. Surface a clear error instead.
          const isQuotaError = code === 1011 && /quota|exceeded|billing/i.test(reason);
          if (isQuotaError && !this.isStopped) {
            console.error('[GeminiLive] Quota exceeded — not retrying. Reason:', reason);
            this.sendWsMessage(this.session.ws, {
              type: 'voice_error',
              code: 'GEMINI_QUOTA_EXCEEDED',
              message: 'Voice sessions are temporarily unavailable due to high demand. Please try again in a few minutes.',
              recoverable: false,
            });
            return;
          }
          // goAway → 1007: GL sent a graceful goAway message and then closed with 1007.
          // This is NOT a genuine "invalid argument" — it is GL completing a planned
          // disconnect after the goAway grace period. Treat it as retriable by temporarily
          // adding 1007 to the retriable set (same pattern as stale handle recovery).
          const isGoAway1007 = code === 1007 &&
            (Date.now() - this.lastGoAwayTimestamp) < 15_000;
          if (isGoAway1007 && !this.isStopped && this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
            console.log('[GeminiLive] 1007 after goAway — treating as retriable (graceful GL disconnect)');
            this.RETRIABLE_CLOSE_CODES.add(1007);
            setTimeout(() => this.RETRIABLE_CLOSE_CODES.delete(1007), 10_000);
          }

          // Stale resumption handle — 1011 whose reason references the handle/session token.
          // This happens when a student reconnects hours later with an expired handle.
          // Clear the handle and fall through to a fresh session start (no bail-out).
          // (3-flash audit recommendation, 2026-06-13)
          const isStaleHandle = code === 1011 &&
            !!this.session.geminiLiveResumptionHandle &&
            /handle|resumption|invalid.*session|session.*invalid|expired/i.test(reason);
          if (isStaleHandle && !this.isStopped && this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
            console.warn('[GeminiLive] Stale resumption handle (1011) — clearing handle and retrying as fresh session. Reason:', reason);
            this.session.geminiLiveResumptionHandle = undefined as any;
            // Fall through to the retriable reconnect block below by temporarily allowing it.
            // We force-add code 1011 to retriable set only for this one attempt.
            this.RETRIABLE_CLOSE_CODES.add(1011);
            // Remove after the reconnect fires so we don't permanently allow 1011 retries.
            setTimeout(() => this.RETRIABLE_CLOSE_CODES.delete(1011), 5000);
          }
          // Any other 1011 (e.g. "Internal error encountered.") is also non-retriable.
          // Retrying immediately resends the full system prompt (~13K tokens) and burns quota.
          // Surface a recoverable error so the client can prompt the user to try again.
          if (code === 1011 && !this.isStopped && !isStaleHandle) {
            console.error('[GeminiLive] Internal error (1011) — not retrying. Reason:', reason || '(no reason)');
            this.sendWsMessage(this.session.ws, {
              type: 'voice_error',
              code: 'GEMINI_INTERNAL_ERROR',
              message: 'The voice connection encountered an error. Please try again.',
              recoverable: true,
            });
            return;
          }
          if (!this.isStopped && this.RETRIABLE_CLOSE_CODES.has(code) && this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
            this.reconnectAttempts++;
            const delayMs = 1000 * Math.pow(2, this.reconnectAttempts - 1); // 1 s, 2 s, 4 s
            console.log(`[GeminiLive] Scheduling reconnect ${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS} in ${delayMs} ms`);

            this.sendWsMessage(this.session.ws, {
              type: 'gl_reconnecting',
              attempt: this.reconnectAttempts,
              maxAttempts: this.MAX_RECONNECT_ATTEMPTS,
              delayMs,
            });

            setTimeout(async () => {
              if (this.isStopped) return;
              console.log(`[GeminiLive] Reconnect attempt ${this.reconnectAttempts}…`);

              // DOUBLE-AUDIO FIX: If GL disconnected while actively generating audio,
              // the client's AudioContext has already scheduled BufferSource nodes for
              // the pre-reconnect chunks. resetForNewTurn() clears dedup but does NOT
              // cancel those scheduled nodes — they keep playing. GL then resumes/re-
              // generates the same turn and we get double audio.
              // Fix: send gl_audio_reset BEFORE resetting state so the client can call
              // player.stop() (which cancels all scheduled sources) + resetForNewTurn().
              // Also suppress the next processing_pending since the client already reset.
              if (this.hadAudioInCurrentSubturn) {
                console.log('[GeminiLive] Reconnect mid-turn — sending gl_audio_reset to clear client audio buffer');
                this.sendWsMessage(this.session.ws, {
                  type: 'gl_audio_reset',
                  reason: 'reconnect',
                });
                this.suppressNextProcessingPending = true;

                // Telemetry: write a queryable event so Sofia can watch for this path firing in prod.
                // Fire-and-forget — never block the reconnect on a DB write.
                const capturedSessionId = this.session.id;
                const capturedUserId = this.session.userId;
                import('../db').then(async ({ getSharedDb }) => {
                  const { sql: dbSql } = await import('drizzle-orm');
                  const payload = JSON.stringify({ sessionId: capturedSessionId, reconnectAttempt: this.reconnectAttempts });
                  await getSharedDb().execute(dbSql`
                    INSERT INTO voice_pipeline_events (id, session_id, user_id, event_type, event_data, created_at)
                    VALUES (gen_random_uuid(), ${capturedSessionId ?? null}, ${String(capturedUserId ?? '')},
                      'gl_reconnect_mid_turn', ${payload}::jsonb, NOW())
                  `);
                }).catch((err: Error) => console.warn('[GeminiLive] Failed to log mid-turn reconnect telemetry:', err.message));
              }

              // Reset per-session flags so start() can run again
              this.isStarted = false;
              this.isSetupComplete = false;
              this.liveSession = null;
              this.currentTurnId = 0;
              this.currentSentenceIndex = 0;
              this.currentChunkIndex = 0;
              this.lastSentenceStartSentIndex = -1;
              this.hadAudioInCurrentSubturn = false;
              this.firstAudioSentThisTurn = false;
              this.processingPendingSentThisTurn = false;
              this.greetingPhaseActive = false;
              this.isTutorGeneratingAudio = false;
              if (this.playbackGateSafetyTimeout) {
                clearTimeout(this.playbackGateSafetyTimeout);
                this.playbackGateSafetyTimeout = null;
              }
              if (this.greetingWatchdogTimer) {
                clearTimeout(this.greetingWatchdogTimer);
                this.greetingWatchdogTimer = null;
              }
              this.pendingInputTranscript = '';
              this.pendingInputSaved = false;
              this.pendingOutputTranscript = '';
              if (this.transcriptFlushTimer) {
                clearTimeout(this.transcriptFlushTimer);
                this.transcriptFlushTimer = null;
              }

              try {
                // Reconnect without a greeting — student was already mid-session
                await this.start(this.lastSystemPrompt, this.lastTools);
                this.reconnectAttempts = 0; // success — reset counter
                console.log('[GeminiLive] Reconnected successfully');
                this.sendWsMessage(this.session.ws, { type: 'gl_reconnected' });
              } catch (err: any) {
                console.error(`[GeminiLive] Reconnect attempt ${this.reconnectAttempts} failed:`, err?.message);
                // onclose will fire again and trigger the next attempt (or give up)
              }
            }, delayMs);
          } else if (!this.isStopped) {
            // Non-retriable close or retries exhausted — surface to client
            this.sendWsMessage(this.session.ws, {
              type: 'voice_error',
              code: 'GEMINI_LIVE_DISCONNECTED',
              message: 'Daniela\'s voice session disconnected',
              recoverable: this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS,
            });
          }
        },
      },
    });

    console.log(`[GeminiLive] Session open — sessionId: ${this.session.id}`);

    // If a greeting trigger is provided at start() time, buffer it — setupComplete
    // has not arrived yet at this point (it arrives asynchronously via onmessage).
    // handleServerMessage will fire it as soon as setupComplete is received.
    if (greetingTrigger) {
      this.pendingGreetingTrigger = greetingTrigger;
      console.log('[GeminiLive] Greeting buffered at start() — waiting for setupComplete');
    }
  }

  /**
   * Send a PCM16 audio chunk (16 kHz, mono) from the client's microphone
   * to Gemini Live for processing.
   *
   * The client already captures PCM16 at 16 kHz via its AudioContext
   * and sends it via stream_audio_chunk WS messages. No transcoding needed.
   */
  sendAudioChunk(pcm16Buffer: Buffer): void {
    if (!this.liveSession || this.isStopped) return;
    // Gate 1 — greeting phase: GL is generating the opening response.
    // Drop mic audio until the first audio chunk from GL arrives.
    if (this.greetingPhaseActive) return;
    // Gate 2 — turn gate: GL is generating audio for any subsequent turn.
    // Daniela's audio plays through the speaker; the mic would pick it up and
    // send it back to GL as "user speech," causing GL to produce a zero-sentence
    // echo response on the next turn (alternating silence bug).
    // Gate stays closed from first audio chunk until generationComplete fires.
    if (this.isTutorGeneratingAudio) return;
    const base64Audio = pcm16Buffer.toString('base64');
    this.liveSession.sendRealtimeInput({
      audio: {
        data: base64Audio,
        mimeType: `audio/pcm;rate=${AUDIO_INPUT_SAMPLE_RATE}`,
      },
    });
  }

  /**
   * Called by the WS handler when the client's playback_ended telemetry arrives.
   * This is the true end of Daniela's audio from the student's perspective — speakers
   * have gone quiet and there is no more echo risk. We open the mic gate here instead
   * of at generationComplete (which fires before the client even starts playing).
   */
  onPlaybackEnded(): void {
    if (this.playbackGateSafetyTimeout) {
      clearTimeout(this.playbackGateSafetyTimeout);
      this.playbackGateSafetyTimeout = null;
    }
    if (this.isTutorGeneratingAudio) {
      this.isTutorGeneratingAudio = false;
      console.log('[GeminiLive] Mic gate lifted — client playback_ended (echo suppression off)');
    }
  }

  /**
   * Signal that the user has started speaking — interrupts Daniela's current response.
   * Gemini Live handles VAD natively, but the client's barge-in button can also
   * call this to force an interruption.
   */
  interrupt(): void {
    if (!this.liveSession || this.isStopped) return;
    this.currentTurnId++;
    this.currentChunkIndex = 0;
    this.firstAudioSentThisTurn = false;
    this.processingPendingSentThisTurn = false;
    // DOUBLE-AUDIO FIX: Clear suppress flag on interrupt so a stale reconnect-era flag
    // doesn't carry into the next turn if GL never generated audio after the reconnect.
    this.suppressNextProcessingPending = false;
    console.log(`[GeminiLive] Interrupted — advancing to turnId ${this.currentTurnId}`);
  }

  /**
   * Pre-load identity threads into conversation history before the first greeting.
   * Called from the unified WS handler after session creation, before start().
   * Top 3 threads by importance; content is already truncated to ~2500 chars each.
   */
  setIdentityThreads(threads: Array<{ title: string; content: string }>): void {
    this.identityThreads = threads;
  }

  /**
   * Send a greeting trigger to Gemini Live to start the conversation.
   * Called from the `request_greeting` WS handler instead of orchestrator.processGreetingRequest().
   */
  sendGreetingTrigger(userName?: string, isResumed?: boolean, scenarioSlug?: string, recentContext?: string): void {
    if (!this.liveSession || this.isStopped) return;
    // DOUBLE-AUDIO GUARD: if a greeting was already triggered via pendingGreetingTrigger
    // (fired at setupComplete), greetingPhaseActive is already true — skip the duplicate.
    if (this.greetingPhaseActive) {
      console.log('[GeminiLive] sendGreetingTrigger: greeting already in progress — skipping duplicate (prevents double audio)');
      return;
    }
    const name = userName ? `, my name is ${userName}` : '';
    const langKey = (this.session.targetLanguage || '').toLowerCase().trim();
    const langName = this.session.targetLanguage
      ? this.session.targetLanguage.charAt(0).toUpperCase() + this.session.targetLanguage.slice(1)
      : 'Spanish';
    const tutorName = this.session.tutorName || 'Daniela';
    const langCode = LANGUAGE_TO_BCP47[langKey] || 'en-US';
    const contextBlock = isResumed && recentContext
      ? ` Here is the recent conversation context:\n${recentContext}\nContinue naturally from here.`
      : '';
    const resumed = isResumed
      ? `Continue our conversation naturally in ${langName}.${contextBlock}`
      : `This is a new session — greet me warmly and start speaking in ${langName} right away. Your entire response must be in ${langName} (language code: ${langCode}).`;
    const scenario = scenarioSlug ? ` We are doing a scenario: ${scenarioSlug}.` : '';
    const trigger = `Hello ${tutorName}${name}. ${resumed}${scenario}`;

    // MID-SESSION RECONNECT: when resuming with recent context, prime audio only — do NOT
    // generate a spoken greeting. Daniela re-introducing herself with "Honesty Mode, hmm I
    // like it..." on every 4.5-min cycle or server drop is disruptive. GL stays ready and
    // responds naturally when David speaks next.
    const isSilentReconnect = !!(isResumed && recentContext);

    // If setupComplete hasn't arrived yet, buffer — fired by handleServerMessage.
    if (!this.isSetupComplete) {
      this.pendingGreetingTrigger = trigger;
      this.pendingGreetingSilent = isSilentReconnect;
      console.log(`[GeminiLive] Greeting buffered — waiting for setupComplete (resumed: ${isResumed || false}, silent: ${isSilentReconnect})`);
      return;
    }

    try {
      // Prime audio context — required on gemini-3.1-flash-live-preview.
      const silencePcm = Buffer.alloc(32000, 0); // 1s PCM16 LE at 16 kHz
      this.liveSession.sendRealtimeInput({
        audio: { data: silencePcm.toString('base64'), mimeType: 'audio/pcm;rate=16000' },
      });

      if (isSilentReconnect) {
        console.log('[GeminiLive] Mid-session reconnect — silent audio prime only (no spoken greeting)');
        return;
      }

      this.liveSession.sendClientContent({
        turns: [{ role: 'user', parts: [{ text: trigger }] }],
        turnComplete: true,
      });
      // NOTE: activityEnd intentionally NOT sent here — same reasoning as setupComplete path.
      // sendClientContent with turnComplete:true already ends the turn. Sending activityEnd
      // after creates a SECOND turn-end signal and causes GL to generate a duplicate response.
      this.greetingPhaseActive = true;
      // Safety: if greeting produces no audio (content filter / text-only / error),
      // greetingPhaseActive would never be cleared and the mic stays permanently blocked.
      // Force-clear after 15s — greeting audio normally arrives within 1-2s.
      if (this.greetingWatchdogTimer) clearTimeout(this.greetingWatchdogTimer);
      this.greetingWatchdogTimer = setTimeout(() => {
        this.greetingWatchdogTimer = null;
        if (this.greetingPhaseActive) {
          this.greetingPhaseActive = false;
          console.warn('[GeminiLive] Greeting watchdog fired — greetingPhaseActive cleared (no audio in 15s)');
        }
      }, 15000);
      console.log(`[GeminiLive] Greeting trigger sent (resumed: ${isResumed || false}) — silence primer + text turn, mic gated`);
    } catch (err) {
      console.warn('[GeminiLive] Failed to send greeting trigger:', err);
    }
  }

  /**
   * Send a typed text turn to Gemini Live (e.g. from a PTT transcript).
   * Used when the client submits a push-to-talk recording and speculative STT
   * has already produced a transcript — we route it here so Gemini Live
   * generates the audio response instead of the legacy pipeline.
   */
  sendTextTurn(text: string): void {
    if (!this.liveSession || this.isStopped) return;
    try {
      this.liveSession.sendClientContent({
        turns: [{ role: 'user', parts: [{ text }] }],
        turnComplete: true,
      });
      console.log(`[GeminiLive] Text turn sent (${text.length} chars): "${text.slice(0, 80)}"`);
    } catch (err) {
      console.warn('[GeminiLive] Failed to send text turn:', err);
    }
  }

  /**
   * Close the Gemini Live session cleanly.
   */
  stop(): void {
    if (this.isStopped) return;
    this.isStopped = true;
    if (this.transcriptFlushTimer) {
      clearTimeout(this.transcriptFlushTimer);
      this.transcriptFlushTimer = null;
    }
    if (this.greetingWatchdogTimer) {
      clearTimeout(this.greetingWatchdogTimer);
      this.greetingWatchdogTimer = null;
    }
    // The playback gate safety timeout must be cleared on stop — otherwise it
    // fires 60 seconds after teardown on a dead session object, setting
    // isTutorGeneratingAudio=false after the session is already gone.
    if (this.playbackGateSafetyTimeout) {
      clearTimeout(this.playbackGateSafetyTimeout);
      this.playbackGateSafetyTimeout = null;
    }
    if (this.generationCompleteWatchdogTimer) {
      clearTimeout(this.generationCompleteWatchdogTimer);
      this.generationCompleteWatchdogTimer = null;
    }
    if (this.liveSession) {
      try {
        this.liveSession.close();
      } catch (_) {}
      this.liveSession = null;
    }
    // Tear down karaoke tracker if active
    if (this.karaokeTracker) {
      this.karaokeTracker.destroy();
      this.karaokeTracker = null;
    }
    // Flush any unsaved transcripts on session end (e.g., user closes mid-response)
    this.flushTranscripts().catch(err =>
      console.warn('[GeminiLive] Final transcript flush error on stop:', err.message)
    );
    console.log(`[GeminiLive] Session stopped — sessionId: ${this.session.id}`);
  }

  private async handleServerMessage(msg: LiveServerMessage): Promise<void> {
    // ── Diagnostic: log the top-level keys of every message ─────────────────
    const msgKeys = Object.keys(msg).filter(k => (msg as any)[k] != null);
    if (!msg.usageMetadata && !msg.sessionResumptionUpdate) {
      const sc = msg.serverContent as any;
      const scKeys = sc ? Object.keys(sc).filter((k: string) => sc[k] != null) : [];
      console.log(`[GeminiLive] Server msg keys: [${msgKeys.join(', ')}]`, {
        hasTurnComplete: !!sc?.turnComplete,
        hasParts: !!sc?.modelTurn?.parts,
        partCount: sc?.modelTurn?.parts?.length ?? 0,
        serverContentKeys: scKeys,
        hasInputTranscription: !!sc?.inputTranscription,
        inputTranscriptionText: sc?.inputTranscription?.text?.slice(0, 80),
        hasOutputTranscription: !!sc?.outputTranscription,
        outputTranscriptionText: sc?.outputTranscription?.text?.slice(0, 80),
        hasInterrupted: !!sc?.interrupted,
        hasToolCall: !!msg.toolCall,
        hasError: !!(msg as any).error,
      });
    }

    // ── goAway — GL is asking the client to reconnect elsewhere ─────────────
    // Record the timestamp so onclose can treat the subsequent 1007 as retriable.
    // A 1007 after a goAway is not a genuine "invalid argument" — it's GL closing
    // after the graceful disconnect window, not a protocol error on our side.
    if ((msg as any).goAway != null) {
      this.lastGoAwayTimestamp = Date.now();
      console.log('[GeminiLive] goAway received — reconnect expected shortly');
    }

    // ── Catch any top-level error from Gemini ────────────────────────────────
    if ((msg as any).error) {
      console.error('[GeminiLive] API error in message:', (msg as any).error);
    }

    // ── Setup complete — model is now ready to receive content ───────────────
    // The Gemini Live protocol requires waiting for setupComplete before sending
    // any client content turns. We buffer the greeting and fire it here so it
    // is never sent before the model is ready.
    if ((msg as any).setupComplete != null) {
      if (!this.isSetupComplete) {
        this.isSetupComplete = true;
        const establishMs = this.sessionStartedAt > 0 ? Date.now() - this.sessionStartedAt : null;
        console.log(`[GeminiLive] setupComplete received — model ready${establishMs !== null ? ` (${establishMs}ms to establish)` : ''}`);
        // Telemetry: GL session establishment latency (start() → setupComplete)
        if (establishMs !== null) {
          const estPayload = JSON.stringify({
            establishMs,
            sessionId: this.session.id,
            userId: this.session.userId ? String(this.session.userId) : undefined,
          });
          getSharedDb().execute(sql`
            INSERT INTO voice_pipeline_events
              (id, session_id, user_id, event_type, event_data, created_at)
            VALUES (
              gen_random_uuid(),
              ${this.session.id},
              ${this.session.userId ? String(this.session.userId) : null},
              'gl_session_established',
              ${estPayload}::jsonb,
              NOW()
            )
          `).catch(() => {});
        }
        if (this.pendingGreetingTrigger && this.liveSession) {
          try {
            // Prime audio context — required on gemini-3.1-flash-live-preview.
            const silencePcm = Buffer.alloc(32000, 0); // 1s PCM16 LE at 16 kHz
            this.liveSession.sendRealtimeInput({
              audio: { data: silencePcm.toString('base64'), mimeType: 'audio/pcm;rate=16000' },
            });

            if (this.pendingGreetingSilent) {
              // Mid-session reconnect: audio primed, but do NOT speak — Daniela will
              // respond naturally when David speaks next.
              console.log('[GeminiLive] Pending silent reconnect fired — audio prime only, no greeting');
            } else {
              // ── Identity thread pre-load ─────────────────────────────────────
              // NOTE: Intentionally NOT injected via sendClientContent here.
              // The identity threads are already baked into the system prompt via
              // the neural network context. Injecting them again as a conversation
              // turn using {role:'model', turnComplete:false} is documented broken
              // behaviour (line 193-200): GL interprets the incomplete model turn
              // as mid-utterance and generates a second audio stream to "complete"
              // it — producing an audible double greeting. System prompt is the
              // correct and sufficient delivery mechanism for identity context.
              if (this.identityThreads.length > 0) {
                console.log(`[GeminiLive] Identity threads (${this.identityThreads.length}) carried via system prompt — skipping sendClientContent injection (prevents double audio)`);
              }

              this.liveSession.sendClientContent({
                turns: [{ role: 'user', parts: [{ text: this.pendingGreetingTrigger }] }],
                turnComplete: true,
              });
              // NOTE: activityEnd is intentionally NOT sent here.
              // sendClientContent with turnComplete:true already signals end-of-turn to GL.
              // Sending activityEnd immediately after creates a SECOND turn-end signal,
              // causing GL to generate two responses (double greeting / double audio).
              // Block mic audio until GL sends its first response chunk.
              this.greetingPhaseActive = true;
              if (this.greetingWatchdogTimer) clearTimeout(this.greetingWatchdogTimer);
              this.greetingWatchdogTimer = setTimeout(() => {
                this.greetingWatchdogTimer = null;
                if (this.greetingPhaseActive) {
                  this.greetingPhaseActive = false;
                  console.warn('[GeminiLive] Greeting watchdog fired — greetingPhaseActive cleared (no audio in 15s)');
                }
              }, 15000);
              console.log('[GeminiLive] Pending greeting fired — silence primer + thread pre-load + text turn + activityEnd sent, mic gated');
            }
          } catch (err) {
            console.warn('[GeminiLive] Failed to send pending greeting:', err);
          }
          this.pendingGreetingTrigger = null;
          this.pendingGreetingSilent = false;
        }
      }
    }

    // ── Audio output ────────────────────────────────────────────────────────
    if (msg.serverContent?.modelTurn?.parts) {
      let audioParts = 0;
      let textParts = 0;
      // Pre-scan: does this message contain any audio parts?
      // Text-only messages are GL's internal planning notes — never send to client.
      const messageHasAudio = msg.serverContent.modelTurn.parts.some(
        (p: any) => p.inlineData?.data && p.inlineData.mimeType?.includes('audio')
      );
      for (const part of msg.serverContent.modelTurn.parts) {
        if (part.inlineData?.data && part.inlineData.mimeType?.includes('audio')) {
          audioParts++;
          this.hadAudioInCurrentSubturn = true;
          this.lastAudioChunkAt = Date.now();

          // First audio from GL — open the greeting gate, activate the turn gate.
          // greetingPhaseActive → false: student can now speak.
          // isTutorGeneratingAudio → true: mic gated for the duration of this response
          // to prevent Daniela's audio echoing back through the speaker and confusing GL.
          const wasGreetingPhase = this.greetingPhaseActive;
          if (this.greetingPhaseActive) {
            this.greetingPhaseActive = false;
            console.log('[GeminiLive] Greeting gate lifted — first audio chunk received from GL');
          }
          if (!this.isTutorGeneratingAudio) {
            this.isTutorGeneratingAudio = true;
            console.log('[GeminiLive] Mic gated — Daniela is generating audio (echo suppression active)');
          }

          // Reset generationComplete watchdog on every audio chunk.
          // If Gemini stops sending audio but never fires generationComplete (a known
          // transient GL API failure), this timer fires 12s after the last chunk and
          // executes the same sealing logic, preventing a permanently deaf session.
          // NOTE: 12s (was 6s) — longer responses can have natural inter-chunk pauses
          // exceeding 6s, causing premature turn-seal and audio cutoff mid-sentence.
          if (this.generationCompleteWatchdogTimer) {
            clearTimeout(this.generationCompleteWatchdogTimer);
          }
          this.generationCompleteWatchdogTimer = setTimeout(() => {
            this.generationCompleteWatchdogTimer = null;
            if (!this.isStopped && this.isTutorGeneratingAudio && this.hadAudioInCurrentSubturn) {
              console.warn('[GeminiLive] generationComplete watchdog fired — GL dropped the completion signal; sealing turn manually');
              // Seal the open audio sub-turn so the PCM player can render it
              this.sendWsMessage(this.session.ws, {
                type: 'audio_chunk',
                audio: '',
                audioFormat: 'pcm_f32le',
                sampleRate: AUDIO_OUTPUT_SAMPLE_RATE,
                turnId: this.currentTurnId,
                sentenceIndex: this.currentSentenceIndex,
                chunkIndex: this.currentChunkIndex,
                isLast: true,
              });
              this.currentSentenceIndex++;
              this.currentChunkIndex = 0;
              this.hadAudioInCurrentSubturn = false;
              // Hold mic gate until playback_ended (same as normal generationComplete path)
              if (this.playbackGateSafetyTimeout) clearTimeout(this.playbackGateSafetyTimeout);
              this.playbackGateSafetyTimeout = setTimeout(() => {
                this.playbackGateSafetyTimeout = null;
                if (this.isTutorGeneratingAudio) {
                  this.isTutorGeneratingAudio = false;
                  console.log('[GeminiLive] Mic gate force-opened — safety timeout after watchdog seal');
                }
              }, 60000);
              // Flush transcripts
              if (this.transcriptFlushTimer) { clearTimeout(this.transcriptFlushTimer); this.transcriptFlushTimer = null; }
              this.flushTranscripts().catch(err =>
                console.warn('[GeminiLive] Watchdog flush error:', err.message)
              );
            }
          }, 12000);

          // Flush accumulated user input the moment model starts generating audio
          // (user is definitely done speaking at this point).
          if (!this.pendingInputSaved && this.pendingInputTranscript.trim()) {
            this.pendingInputSaved = true;
            const userText = this.pendingInputTranscript.trim();
            this.pendingInputTranscript = '';
            this.persistMessage('user', userText).catch(err =>
              console.warn('[GeminiLive] Failed to persist user transcript:', err.message)
            );
          }

          const pcm16Buffer = Buffer.from(part.inlineData.data, 'base64');
          const f32leBuffer = pcm16ToF32le(pcm16Buffer);

          // ── Karaoke tap ────────────────────────────────────────────────
          // Feed the raw PCM16 to Deepgram in parallel so it can return
          // word-level timestamps while audio plays on the client.
          this.karaokeTracker?.sendAudioChunk(
            pcm16Buffer,
            this.currentSentenceIndex,
            this.currentTurnId,
          );

          // Mark that audio has started for this turn — prevents late outputTranscription
          // chunks from firing a spurious processing_pending AFTER audio has played.
          //
          // ALSO: fire processing_pending on the first audio chunk of CONVERSATION turns
          // (not the greeting). outputAudioTranscription is enabled and will fire
          // outputTranscription chunks, but audio typically arrives before the transcription
          // text. This is the reliable fallback: the moment the first audio arrives we know
          // GL is responding and the avatar should show thinking briefly (it flips to speaking
          // within the same render cycle in practice).
          if (!this.firstAudioSentThisTurn) {
            this.firstAudioSentThisTurn = true;
            const now = Date.now();

            // ── Flush pending whiteboard updates ───────────────────────────
            // Function calls (show_image, add_to_scene, etc.) buffer their
            // whiteboard updates until audio starts, so images arrive in sync
            // with speech. In the GeminiLive path, audio bypasses the
            // orchestrator's sendMessage, so the orchestrator's flush logic
            // never fires. We flush here instead — at the exact moment the
            // first audio chunk arrives.
            if (this.session.pendingWhiteboardUpdates && this.session.pendingWhiteboardUpdates.length > 0) {
              const pending = this.session.pendingWhiteboardUpdates;
              this.session.pendingWhiteboardUpdates = [];
              console.log(`[GeminiLive] Flushing ${pending.length} pending whiteboard update(s) on first audio`);
              for (const update of pending) {
                this.sendWsMessage(this.session.ws, update);
              }
            }
            this.session.firstAudioSent = true; // keep orchestrator flag in sync

            // ── Student speaking duration ──────────────────────────────────
            // Student stopped speaking when Daniela's first audio arrives.
            if (!wasGreetingPhase && this.studentSpeakingStartTime !== null) {
              this.studentSpeakingMs += now - this.studentSpeakingStartTime;
              this.studentSpeakingStartTime = null;
            }

            // ── Turn latency ───────────────────────────────────────────────
            // Latency = time from last inputTranscription chunk → first Daniela audio.
            // This measures "how long after GL finished hearing the student did it start speaking".
            if (!wasGreetingPhase && this.lastInputTranscriptionTime !== null) {
              const latencyMs = now - this.lastInputTranscriptionTime;
              if (latencyMs >= 0 && latencyMs < 30000) { // sanity: 0ms–30s window
                this.turnLatencies.push(latencyMs);
                console.log(`[GeminiLive] Turn latency: ${latencyMs}ms (last-word → first audio)`);
              }
              this.lastInputTranscriptionTime = null;
            }
            this.turnLatencyStartTime = null;

            // ── Tutor speaking start ───────────────────────────────────────
            if (!wasGreetingPhase) {
              this.tutorSpeakingStartTime = now;
            }

            if (!wasGreetingPhase && !this.processingPendingSentThisTurn) {
              this.processingPendingSentThisTurn = true;
              if (this.suppressNextProcessingPending) {
                // DOUBLE-AUDIO FIX: Client already reset via gl_audio_reset — don't
                // send processing_pending again (would trigger a second resetForNewTurn).
                console.log('[GeminiLive] Suppressing processing_pending after mid-turn reconnect (gl_audio_reset already sent)');
                this.suppressNextProcessingPending = false;
              } else {
                console.log('[GeminiLive] Firing processing_pending (first audio chunk, conversation turn)');
                this.sendWsMessage(this.session.ws, {
                  type: 'processing_pending',
                  timestamp: Date.now(),
                });
              }
            }
          }

          // Emit sentence_start for the first audio chunk of each sentence so the subtitle
          // state creates a sentence entry that word_timing_delta (GL karaoke) can attach to.
          if (this.currentSentenceIndex !== this.lastSentenceStartSentIndex && this.session.subtitleMode !== 'off') {
            this.lastSentenceStartSentIndex = this.currentSentenceIndex;
            this.sendWsMessage(this.session.ws, {
              type: 'sentence_start',
              turnId: this.currentTurnId,
              sentenceIndex: this.currentSentenceIndex,
              text: '',
              hasTargetContent: true,
            });
          }
          this.sendWsMessage(this.session.ws, {
            type: 'audio_chunk',
            audio: f32leBuffer.toString('base64'),
            audioFormat: 'pcm_f32le',
            sampleRate: AUDIO_OUTPUT_SAMPLE_RATE,
            turnId: this.currentTurnId,
            sentenceIndex: this.currentSentenceIndex,
            chunkIndex: this.currentChunkIndex++,
            isLast: false,
          });
        }

        // Model text output — emitted when TEXT is included in responseModalities.
        // Accumulate into pendingOutputTranscript so the assistant's full reply is
        // persisted to the DB on generationComplete / turnComplete flush.
        // GUARD: skip text-only messages (messageHasAudio=false) — these are GL's
        // internal planning notes / chain-of-thought and must never reach the client.
        if (part.text) {
          textParts++;
          if (messageHasAudio || this.hadAudioInCurrentSubturn) {
            this.pendingOutputTranscript += part.text;
            this.sendWsMessage(this.session.ws, {
              type: 'response_text',
              text: part.text,
              turnId: this.currentTurnId,
            });
          } else {
            console.log('[GeminiLive] Suppressed text-only model part (internal monologue):', part.text.slice(0, 120));
          }
        }
      }
      if (audioParts > 0 || textParts > 0) {
        console.log(`[GeminiLive] Parts processed — audio: ${audioParts}, text: ${textParts}, turnId: ${this.currentTurnId}`);
      } else {
        console.warn(`[GeminiLive] modelTurn had ${msg.serverContent.modelTurn.parts.length} part(s) but none had audio or text`);
        for (const part of msg.serverContent.modelTurn.parts) {
          const partKeys = Object.keys(part).filter(k => (part as any)[k] != null);
          console.warn(`[GeminiLive] Part keys: [${partKeys.join(', ')}]`, part.inlineData?.mimeType ?? '(no mimeType)');
        }
      }
    }

    // ── Input transcription (what the user said) ─────────────────────────────
    // inputTranscription fires per word/phrase as Gemini transcribes the user's speech.
    // We accumulate all chunks and only persist once (when model starts generating),
    // avoiding word-by-word rows in the messages table.
    if ((msg.serverContent as any)?.inputTranscription?.text) {
      const text = (msg.serverContent as any).inputTranscription.text as string;
      if (text.trim()) {
        // Track student speech timing: start on first chunk, update last-word timestamp each chunk
        const inputNow = Date.now();
        if (this.studentSpeakingStartTime === null) {
          this.studentSpeakingStartTime = inputNow;
        }
        this.lastInputTranscriptionTime = inputNow;
        this.pendingInputTranscript += text;
        this.pendingInputSaved = false;

        // DO NOT fire processing_pending here — inputTranscription arrives while the user
        // is still mid-sentence (GL transcribes in real-time). Showing the thinking avatar
        // at this point makes the user believe they've been cut off, causing them to stop
        // talking, which then triggers an actual cutoff. processing_pending is now fired
        // on the first outputTranscription chunk — the true "you've finished, she's
        // generating" signal.

        // Forward each chunk to the client for interim display (subtitle / transcript bar)
        this.sendWsMessage(this.session.ws, {
          type: 'transcript',
          text,
          isFinal: true,
          source: 'gemini_live',
        });
      }
    }

    // ── Output transcription (what Daniela said) ─────────────────────────────
    // outputTranscription fires per-chunk (streaming tokens) — accumulate here.
    // Checked BEFORE turnComplete so if both arrive in the same message, the
    // final chunk is appended to the buffer before the flush occurs.
    if ((msg.serverContent as any)?.outputTranscription?.text) {
      // Ghost-transcription guard: if audio was flowing this turn but stopped >800ms ago,
      // GL is generating text internally without audio — suppress to prevent transcript
      // from showing more than what was actually spoken. 800ms is generous enough to allow
      // for normal inter-chunk gaps without catching legitimate streaming pauses.
      const audioSilenceMs = this.lastAudioChunkAt > 0 ? Date.now() - this.lastAudioChunkAt : 0;
      if (this.hadAudioInCurrentSubturn && audioSilenceMs > 800) {
        const rawGhost = (msg.serverContent as any).outputTranscription.text as string;
        console.log('[GeminiLive] Suppressed ghost outputTranscription (audio silent for ' + audioSilenceMs + 'ms):', rawGhost.slice(0, 100));
      } else {
      // Strip markdown bold markers (**) and any native function-call syntax that
      // Gemini Live leaks into outputTranscription (e.g. `vocal_adjust{emotion:warm,...}`).
      // These are internal tool calls and must never appear in student-facing transcripts.
      const rawText = (msg.serverContent as any).outputTranscription.text as string;
      const text = rawText
        .replace(/\*\*/g, '')
        .replace(/\b\w+\{[^{}]*\}/g, '')   // strip tool call syntax: name{key:val,...}
        .replace(/([.!?])thought\n[\s\S]*/i, '$1')  // strip GL thinking blocks (thought\nThinking Process:...)
        .replace(/\s{2,}/g, ' ');           // collapse double-spaces left by removal
        // NOTE: do NOT trimStart unconditionally — GL streaming chunks naturally include a
        // leading space between words. Stripping it causes words to run together when chunks
        // are concatenated (e.g. "Take" + "a" → "Takea"). Only trim on the first chunk so
        // the saved transcript does not start with a leading space.
      if (text.trim()) {
        // Fire processing_pending on the FIRST output chunk. This is the definitive signal
        // that GL has finished listening to the user and is now generating a response.
        // Firing it earlier (on inputTranscription) caused the user to see the thinking
        // avatar while still speaking and stop talking prematurely.
        // GUARD: skip if audio already started — a late transcription chunk arriving after
        // audio has played would stick the avatar in "thinking" with no audio to follow.
        const isFirstOutputChunk = this.pendingOutputTranscript.trim() === '';
        this.pendingOutputTranscript += isFirstOutputChunk ? text.trimStart() : text;
        if (isFirstOutputChunk && !this.firstAudioSentThisTurn && !this.processingPendingSentThisTurn) {
          this.processingPendingSentThisTurn = true;
          console.log('[GeminiLive] Firing processing_pending (transcription first, before audio)');
          this.sendWsMessage(this.session.ws, {
            type: 'processing_pending',
            timestamp: Date.now(),
          });
        } else if (isFirstOutputChunk) {
          console.log('[GeminiLive] Skipping processing_pending — already sent or audio started this turn');
        }
        this.sendWsMessage(this.session.ws, {
          type: 'daniela_transcript',
          text,
          turnId: this.currentTurnId,
        });
      }
      } // end else (not ghost transcription)
    }

    // ── Turn complete ────────────────────────────────────────────────────────
    // Gemini Live fires turnComplete after each sub-turn (phrase/sentence), not just
    // at the true end of the full response. We handle two concerns separately:
    //
    //  1. AUDIO: send isLast:true for the current sentence so the progressive PCM
    //     player can start rendering it. Increment sentenceIndex so the NEXT
    //     sub-turn's audio is queued as a new sentence (not overwriting chunkIndex 0).
    //
    //  2. TRANSCRIPTS: debounce 800 ms — only persist user + assistant text once the
    //     model has truly stopped generating (no more turnComplete events incoming).
    //     This produces one DB row per utterance instead of one per phrase.
    if (msg.serverContent?.turnComplete) {
      // H1 fix: clear greeting gate on turnComplete (covers no-audio greeting paths).
      if (this.greetingPhaseActive) {
        this.greetingPhaseActive = false;
        if (this.greetingWatchdogTimer) { clearTimeout(this.greetingWatchdogTimer); this.greetingWatchdogTimer = null; }
        console.log('[GeminiLive] turnComplete — greeting gate cleared (no audio path)');
      }
      // ── Audio: close current sentence, prepare next ──────────────────────
      if (this.hadAudioInCurrentSubturn) {
        this.sendWsMessage(this.session.ws, {
          type: 'audio_chunk',
          audio: '',
          audioFormat: 'pcm_f32le',
          sampleRate: AUDIO_OUTPUT_SAMPLE_RATE,
          turnId: this.currentTurnId,
          sentenceIndex: this.currentSentenceIndex,
          chunkIndex: this.currentChunkIndex,
          isLast: true,
        });
        this.currentSentenceIndex++;
        this.currentChunkIndex = 0;
        this.hadAudioInCurrentSubturn = false;
        this.karaokeTracker?.onSentenceComplete();
        console.log(`[GeminiLive] Sub-turn audio sealed — sentenceIndex now ${this.currentSentenceIndex}`);
      }

      // ── Transcripts: debounced flush ─────────────────────────────────────
      if (this.transcriptFlushTimer) clearTimeout(this.transcriptFlushTimer);
      this.transcriptFlushTimer = setTimeout(() => {
        this.flushTranscripts().catch(err =>
          console.warn('[GeminiLive] Transcript flush error:', err.message)
        );
      }, 800);
    }

    // ── Generation complete (GL uses this instead of turnComplete) ───────────
    // gemini-3.1-flash-live-preview sends serverContent.generationComplete rather than
    // turnComplete to signal the end of a full response. Without this handler the
    // 800 ms debounce flush timer inside the turnComplete block never fires, so
    // assistant messages are never persisted to the DB and voice transcripts are lost.
    //
    // When generationComplete arrives we:
    //  1. Seal the open audio sub-turn (send isLast:true) so the PCM player can start rendering.
    //  2. Cancel any pending debounce timer from an earlier turnComplete.
    //  3. Flush transcripts immediately — generationComplete is a definitive end-of-response
    //     signal, so there is no value in waiting for more sub-turns.
    if ((msg.serverContent as any)?.generationComplete) {
      // NOTE (2026-06-13): maybeInjectContextRefresh() was removed here.
      // It sent sendClientContent({role:'model', turnComplete:false}) which incorrectly
      // signals GL that the model is mid-utterance — causing GL to generate a second audio
      // stream to "complete" the injected model turn, producing audio doubling every 15 turns.
      // Context refresh via GL's sendClientContent has no safe "inject without triggering
      // response" mode. System prompt covers this for now.

      // H1 fix: clear greeting gate on generationComplete — handles the case where the
      // greeting turn produces no audio (content filter, text-only, error), which would
      // otherwise leave greetingPhaseActive=true permanently and block all mic input.
      if (this.greetingPhaseActive) {
        this.greetingPhaseActive = false;
        if (this.greetingWatchdogTimer) { clearTimeout(this.greetingWatchdogTimer); this.greetingWatchdogTimer = null; }
        console.log('[GeminiLive] generationComplete — greeting gate cleared (no audio path)');
      }
      // Gate stays closed (isTutorGeneratingAudio = true) until the CLIENT signals
      // playback_ended. generationComplete fires when GL finishes generating, but the
      // client hasn't started playing yet — audio is still buffered. If we open the gate
      // here, the mic picks up Daniela's audio as it plays through the speaker (echo),
      // and GL generates a spurious 0-sentence response before David has said anything.
      // onPlaybackEnded() is called by the WS handler when the client's playback_ended
      // telemetry arrives. A 60s safety timeout force-opens the gate if it never arrives.
      // 60s (was 15s) because long responses can take 25-35s to play through; firing at
      // 15s opened the mic mid-sentence and caused perceived pauses/freezes.
      if (this.isTutorGeneratingAudio) {
        // Cancel any previous safety timeout
        if (this.playbackGateSafetyTimeout) {
          clearTimeout(this.playbackGateSafetyTimeout);
        }
        this.playbackGateSafetyTimeout = setTimeout(() => {
          this.playbackGateSafetyTimeout = null;
          if (this.isTutorGeneratingAudio) {
            this.isTutorGeneratingAudio = false;
            console.log('[GeminiLive] Mic gate force-opened — safety timeout (no playback_ended received)');
          }
        }, 60000);
        console.log('[GeminiLive] generationComplete — mic gate held pending client playback_ended');
      }
      // Clear the generationComplete watchdog — signal arrived normally
      if (this.generationCompleteWatchdogTimer) {
        clearTimeout(this.generationCompleteWatchdogTimer);
        this.generationCompleteWatchdogTimer = null;
      }
      console.log('[GeminiLive] generationComplete received — sealing audio sub-turn and flushing transcripts');

      // ── Tutor speaking end ─────────────────────────────────────────────
      if (this.tutorSpeakingStartTime !== null) {
        this.tutorSpeakingMs += Date.now() - this.tutorSpeakingStartTime;
        this.tutorSpeakingStartTime = null;
      }

      // Seal current audio sub-turn
      if (this.hadAudioInCurrentSubturn) {
        this.sendWsMessage(this.session.ws, {
          type: 'audio_chunk',
          audio: '',
          audioFormat: 'pcm_f32le',
          sampleRate: AUDIO_OUTPUT_SAMPLE_RATE,
          turnId: this.currentTurnId,
          sentenceIndex: this.currentSentenceIndex,
          chunkIndex: this.currentChunkIndex,
          isLast: true,
        });
        this.currentSentenceIndex++;
        this.currentChunkIndex = 0;
        this.hadAudioInCurrentSubturn = false;
        console.log(`[GeminiLive] generationComplete: audio sub-turn sealed — sentenceIndex now ${this.currentSentenceIndex}`);
      }

      // Cancel any pending debounce and flush immediately
      if (this.transcriptFlushTimer) {
        clearTimeout(this.transcriptFlushTimer);
        this.transcriptFlushTimer = null;
      }
      this.flushTranscripts().catch(err =>
        console.warn('[GeminiLive] generationComplete flush error:', err.message)
      );
    }

    // ── Interrupted signal (barge-in detected) ───────────────────────────────
    // GL sends serverContent.interrupted=true when the user starts speaking mid-generation.
    // Audio delivery stops immediately; no further outputTranscription arrives for this turn
    // (audio was already in the client's PCM buffer — faster than transcription text).
    // We close the open audio sub-turn and flush whatever partial transcript we have so
    // the truncated assistant message is saved cleanly before the next user turn begins.
    if ((msg.serverContent as any)?.interrupted) {
      // Telemetry: barge-in event so Sofia can track interruption frequency
      const bargePayload = JSON.stringify({
        sessionId: this.session.id,
        userId: this.session.userId ? String(this.session.userId) : undefined,
        tutorWasGenerating: this.isTutorGeneratingAudio,
      });
      getSharedDb().execute(sql`
        INSERT INTO voice_pipeline_events
          (id, session_id, user_id, event_type, event_data, created_at)
        VALUES (
          gen_random_uuid(),
          ${this.session.id},
          ${this.session.userId ? String(this.session.userId) : null},
          'gl_barge_in',
          ${bargePayload}::jsonb,
          NOW()
        )
      `).catch(() => {});

      // Barge-in: cancel the playback gate safety timeout and open the mic immediately.
      // The student started speaking, so audio has effectively stopped — no more echo risk.
      if (this.playbackGateSafetyTimeout) {
        clearTimeout(this.playbackGateSafetyTimeout);
        this.playbackGateSafetyTimeout = null;
      }
      if (this.isTutorGeneratingAudio) {
        this.isTutorGeneratingAudio = false;
        console.log('[GeminiLive] Mic gate lifted — barge-in interrupted Daniela (echo suppression off)');
      }
      // Clear the generationComplete watchdog — barge-in ends the generating turn
      if (this.generationCompleteWatchdogTimer) {
        clearTimeout(this.generationCompleteWatchdogTimer);
        this.generationCompleteWatchdogTimer = null;
      }
      console.log('[GeminiLive] Barge-in detected — flushing partial transcript and sealing audio sub-turn');
      // Close tutor speaking timer on barge-in (student interrupted before generation complete)
      if (this.tutorSpeakingStartTime !== null) {
        this.tutorSpeakingMs += Date.now() - this.tutorSpeakingStartTime;
        this.tutorSpeakingStartTime = null;
      }
      // Reset latency tracking — new user turn starting
      this.studentSpeakingStartTime = null;
      this.lastInputTranscriptionTime = null;

      // Seal the current audio sub-turn so the PCM player doesn't wait indefinitely
      if (this.hadAudioInCurrentSubturn) {
        this.sendWsMessage(this.session.ws, {
          type: 'audio_chunk',
          audio: '',
          audioFormat: 'pcm_f32le',
          sampleRate: AUDIO_OUTPUT_SAMPLE_RATE,
          turnId: this.currentTurnId,
          sentenceIndex: this.currentSentenceIndex,
          chunkIndex: this.currentChunkIndex,
          isLast: true,
        });
        this.currentSentenceIndex++;
        this.currentChunkIndex = 0;
        this.hadAudioInCurrentSubturn = false;
      }

      // Flush the partial assistant transcript immediately (don't wait for next turnComplete)
      if (this.pendingOutputTranscript.trim()) {
        if (this.transcriptFlushTimer) {
          clearTimeout(this.transcriptFlushTimer);
          this.transcriptFlushTimer = null;
        }
        this.flushTranscripts().catch(err =>
          console.warn('[GeminiLive] Barge-in transcript flush error:', err.message)
        );
      }
    }

    // ── Tool calls ────────────────────────────────────────────────────────────
    if (msg.toolCall?.functionCalls && msg.toolCall.functionCalls.length > 0) {
      const responses: Array<{ id: string; name: string; response: Record<string, unknown> }> = [];

      for (const fc of msg.toolCall.functionCalls) {
        const fcName = fc.name || '';
        const legacyType = lookupLegacyType(fcName);

        const extractedFc: ExtractedFunctionCall = {
          name: fcName,
          legacyType,
          args: (fc.args as Record<string, unknown>) || {},
        };

        console.log(`[GeminiLive] Tool call: ${fcName} (${legacyType})`);

        // Signal client that a function is executing — keeps thinking avatar alive
        // during long tool calls (memory searches, image generation, etc.).
        // Without this, the avatar can drop to 'listening' during 5-30s searches.
        try {
          this.sendWsMessage(this.session.ws, {
            type: 'function_executing',
            functionName: fcName,
            timestamp: Date.now(),
          }, this.session);
        } catch (_sigErr) { /* non-critical */ }

        let toolResponsePayload: Record<string, unknown> = { result: 'done' };

        try {
          await this.fcHandler.handle(this.session.id, this.session, extractedFc);

          // If subtitle mode just became active (Daniela called the subtitle tool mid-session)
          // and the karaoke tracker wasn't started at init (because mode was 'off' then),
          // start it now so word_timing_delta events fire for upcoming sentences.
          if (this.session.subtitleMode !== 'off' && !this.karaokeTracker) {
            this.karaokeTracker = new GLKaraokeTracker(
              this.session.targetLanguage,
              (msg: any) => this.sendWsMessage(this.session.ws, msg),
            );
            this.karaokeTracker.start().catch(err =>
              console.warn('[GeminiLive] Karaoke tracker late-start failed:', err?.message ?? err)
            );
            console.log('[GeminiLive] Karaoke tracker started (subtitle mode activated mid-session)');
          } else if (this.session.subtitleMode === 'off' && this.karaokeTracker) {
            this.karaokeTracker.destroy();
            this.karaokeTracker = null;
            console.log('[GeminiLive] Karaoke tracker stopped (subtitle mode turned off)');
          }

          // Await any async memory lookups before reading session caches.
          // Tools like UNIFIED_RECALL fire processUnifiedRecall() as a fire-and-forget
          // promise pushed to pendingMemoryLookupPromises. Without this await,
          // buildFunctionContinuationResponse reads session.recallResults before the
          // search completes and returns the "Nothing found" fallback.
          // TIMEOUT GUARD: cap at 8s — if any lookup hangs (e.g. open_scene vision fetch
          // on a slow image URL), GL stalls forever waiting to send the tool response.
          // On timeout we continue with whatever results have resolved so far.
          if (this.session.pendingMemoryLookupPromises?.length) {
            const LOOKUP_TIMEOUT_MS = 8000;
            await Promise.race([
              Promise.all(this.session.pendingMemoryLookupPromises),
              new Promise<void>(resolve => setTimeout(resolve, LOOKUP_TIMEOUT_MS)),
            ]);
            this.session.pendingMemoryLookupPromises = [];
          }

          // For data-returning tools (memory_lookup, express_lane_lookup, etc.) the handler
          // populates session caches (e.g. session.memoryLookupResults[query]). We use
          // buildFunctionContinuationResponse() — the same path as non-GL streaming — to format
          // the results and send them back to Gemini Live as the tool response payload.
          // Without this, GL receives only { result: 'done' } and Daniela has no memory data.
          const continuationText = buildFunctionContinuationResponse(this.session, extractedFc);
          if (continuationText) {
            if (typeof continuationText === 'string') {
              toolResponsePayload = { result: continuationText };
              console.log(`[GeminiLive] Tool ${fcName}: returning ${continuationText.length} chars of result data`);
            } else if (continuationText && typeof continuationText === 'object' && (continuationText as any).multimodal) {
              // Multimodal response — extract text parts only for the tool response payload.
              // GL tool responses cannot carry inlineData (binary) — sending base64 image data
              // in the text field causes a 1007 "invalid argument" session crash.
              // The inlineData is sent separately below as a realtimeInput media chunk.
              const parts: any[] = (continuationText as any).parts || [];
              const textOnly = parts.filter((p: any) => p.text).map((p: any) => p.text).join('\n');
              const inlineParts = parts.filter((p: any) => p.inlineData);
              // Race condition mitigation: image arrives via realtimeInput after this tool response.
              // The model may start generating audio before the image arrives. The hint tells it
              // to pause and receive the image before responding to it. (3-flash audit June 13 2026)
              const imageHint = inlineParts.length > 0 ? '\n\n[Image incoming via visual channel — wait to receive it before describing or responding to it]' : '';
              toolResponsePayload = { result: (textOnly || 'done') + imageHint };
              console.log(`[GeminiLive] Tool ${fcName}: multimodal — returning ${toolResponsePayload.result.length} chars text + ${inlineParts.length} inline part(s) via realtimeInput`);
              // Queue inline parts to send after tool response is dispatched.
              // H4 fix: push onto typed array instead of overwriting — batched tool calls
              // (functionCalls[]) would otherwise silently drop earlier calls' images.
              if (inlineParts.length > 0 && this.liveSession) {
                for (const p of inlineParts) {
                  this.pendingInlineParts.push({ mimeType: (p as any).inlineData.mimeType, data: (p as any).inlineData.data });
                }
              }
            } else {
              const text = JSON.stringify(continuationText);
              toolResponsePayload = { result: text };
              console.log(`[GeminiLive] Tool ${fcName}: returning ${text.length} chars of result data`);
            }
          }
        // Telemetry: record successful tool dispatch so Sofia can compute success rates
        reportGlToolCallSuccess({
          toolName: fcName,
          sessionId: this.session.id,
          userId: this.session.userId,
        }).catch(() => {});

        } catch (err) {
          const errMsg = (err as Error).message || String(err);
          console.error(`[GeminiLive] Tool call failed (${fcName}):`, err);
          toolResponsePayload = { result: `Tool call failed: ${errMsg}` };
          // File a Sofia report — clusters of the same tool failing reveal systemic bugs
          reportGlToolCallFailure({
            toolName: fcName,
            sessionId: this.session.id,
            userId: this.session.userId,
            error: errMsg,
          }).catch(() => {});
        }

        responses.push({
          id: fc.id || '',
          name: fcName,
          response: toolResponsePayload,
        });
      }

      // Always send tool responses — Gemini Live stalls if we don't
      if (this.liveSession && responses.length > 0) {
        try {
          this.liveSession.sendToolResponse({ functionResponses: responses });
          console.log(`[GeminiLive] Tool responses sent: ${responses.map(r => r.name).join(', ')}`);
        } catch (err) {
          console.error('[GeminiLive] Failed to send tool responses:', err);
        }

        // Send any queued inline image parts (vision) as realtimeInput after tool response.
        // These were stripped from the tool response payload to prevent 1007 crashes.
        // H4 fix: use typed class field (not (this as any)) and re-check liveSession
        // before each send — sendToolResponse() yields to the event loop and a reconnect
        // could null liveSession between the batch send and the inline parts loop.
        if (this.pendingInlineParts.length > 0) {
          const partsToSend = this.pendingInlineParts.splice(0);
          for (const part of partsToSend) {
            if (!this.liveSession) {
              console.warn('[GeminiLive] liveSession gone before inline parts could be sent — dropping remaining parts');
              break;
            }
            try {
              this.liveSession.sendRealtimeInput({
                mediaChunks: [{ mimeType: part.mimeType, data: part.data }],
              });
              console.log(`[GeminiLive] Vision inline data sent via realtimeInput (${part.mimeType})`);
            } catch (vErr) {
              console.warn('[GeminiLive] Failed to send vision inline data:', (vErr as Error).message);
            }
          }
        }
      }
    }

    // ── Interruption signal from server ──────────────────────────────────────
    if (msg.toolCallCancellation) {
      console.log('[GeminiLive] Server cancelled tool call(s)');
    }

    // ── Usage metadata — accumulate into session telemetry ───────────────────
    // Feeds the burn report and Daniela's compass credit display.
    if (msg.usageMetadata) {
      const meta = msg.usageMetadata;
      if (meta.promptTokenCount) {
        this.session.telemetryLlmInputTokens =
          (this.session.telemetryLlmInputTokens || 0) + meta.promptTokenCount;
      }
      if (meta.candidatesTokenCount) {
        this.session.telemetryLlmOutputTokens =
          (this.session.telemetryLlmOutputTokens || 0) + meta.candidatesTokenCount;
      }
      if (meta.totalTokenCount) {
        console.log(
          `[GeminiLive] Usage — in: ${meta.promptTokenCount ?? 0}, out: ${meta.candidatesTokenCount ?? 0}, total: ${meta.totalTokenCount} (session cumulative: ${this.session.telemetryLlmInputTokens}in/${this.session.telemetryLlmOutputTokens}out)`,
        );
      }
    }

    // ── Session resumption token ──────────────────────────────────────────────
    // Store the latest handle so a dropped connection can resume without
    // losing conversation context. Also fire the persistence callback so the
    // unified-ws-handler can write it to the DB — survives server restarts.
    if (msg.sessionResumptionUpdate?.newHandle) {
      this.session.geminiLiveResumptionHandle = msg.sessionResumptionUpdate.newHandle;
      this.onResumptionHandleUpdate?.(msg.sessionResumptionUpdate.newHandle);
    }
  }

  /**
   * Expose accumulated token counts so the orchestrator can log them
   * to the burn report when the session ends.
   */
  getUsageSummary(): { inputTokens: number; outputTokens: number } {
    return {
      inputTokens: this.session.telemetryLlmInputTokens || 0,
      outputTokens: this.session.telemetryLlmOutputTokens || 0,
    };
  }

  /** Number of completed conversation exchanges (user turn → Daniela response) this session. */
  getCompletedExchangeCount(): number {
    return this.completedExchanges;
  }

  /**
   * Total characters in all of Daniela's output transcripts this session.
   * Used as a TTS-character proxy for analytics/billing (GL has no separate TTS step).
   */
  getTotalOutputCharacters(): number {
    return this.totalOutputCharacters;
  }

  /**
   * Accumulated speaking time for both parties this session.
   * Used by billing (studentSpeakingSeconds) and analytics (tutorSpeakingSeconds).
   */
  getSpeakingStats(): { studentSpeakingMs: number; tutorSpeakingMs: number } {
    // Include any in-progress tutor turn (session ending mid-speech)
    const activeTutorMs = this.tutorSpeakingStartTime !== null
      ? Date.now() - this.tutorSpeakingStartTime
      : 0;
    return {
      studentSpeakingMs: this.studentSpeakingMs,
      tutorSpeakingMs: this.tutorSpeakingMs + activeTutorMs,
    };
  }

  /**
   * Per-turn latency statistics (time from last inputTranscription → first Daniela audio).
   * Used by voice health monitor and burn report.
   */
  getTurnLatencyStats(): { avgMs: number; p50Ms: number; p95Ms: number; count: number; samples: number[] } {
    const samples = [...this.turnLatencies];
    if (samples.length === 0) {
      return { avgMs: 0, p50Ms: 0, p95Ms: 0, count: 0, samples: [] };
    }
    const sorted = [...samples].sort((a, b) => a - b);
    const avg = Math.round(samples.reduce((s, v) => s + v, 0) / samples.length);
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? sorted[sorted.length - 1];
    return { avgMs: avg, p50Ms: p50, p95Ms: p95, count: samples.length, samples };
  }

  /**
   * Flush accumulated user and assistant transcripts to the database as complete utterances.
   * Called 800 ms after the last turnComplete (debounced) and also on session stop().
   * Produces one DB row per user utterance and one per assistant response, rather than
   * one row per transcription chunk / sub-turn.
   */
  private async flushTranscripts(): Promise<void> {
    // H3 fix: prevent concurrent flushes (e.g. 800ms debounce fires before generationComplete
    // arrives, then generationComplete also calls flush — both paths otherwise double-increment
    // completedExchanges and send response_complete twice).
    if (this.isFlushInProgress) {
      console.log('[GeminiLive] flushTranscripts: concurrent call suppressed');
      return;
    }
    this.isFlushInProgress = true;
    try {
      await this._doFlushTranscripts();
    } finally {
      this.isFlushInProgress = false;
    }
  }

  private async _doFlushTranscripts(): Promise<void> {
    // Capture state before async operations
    const totalSentences = this.currentSentenceIndex;  // how many PCM sentences were sent
    const flushTurnId = this.currentTurnId;            // turnId client associates with this response

    // Save user message first (ordering matters: user → assistant)
    if (!this.pendingInputSaved && this.pendingInputTranscript.trim()) {
      this.pendingInputSaved = true;
      const userText = this.pendingInputTranscript.trim();
      this.pendingInputTranscript = '';
      this.lastUserText = userText; // capture for enrichment context
      try {
        await this.persistMessage('user', userText);
      } catch (err: any) {
        console.warn('[GeminiLive] Failed to flush user transcript:', err.message);
      }

      // Fire the tool-detection shadow turn in the background.
      // The callback (set by unified-ws-handler) routes the transcript through the
      // orchestrator with TTS and DB persistence suppressed so tool side-effects
      // (whiteboard, scenarios, memory lookups, etc.) fire normally.
      if (this.onUserTurnComplete) {
        try {
          this.onUserTurnComplete(userText);
        } catch (cbErr: any) {
          console.warn('[GeminiLive] onUserTurnComplete callback error:', cbErr.message);
        }
      }
    }

    // Capture output transcript text before the if-block clears it (used by word echo below).
    const capturedOutputText = this.pendingOutputTranscript;

    // Save assistant message
    if (this.pendingOutputTranscript.trim()) {
      // Strip markdown bold markers, leaked tool call syntax, and Gemini thinking blocks before saving.
      const assistantText = this.pendingOutputTranscript
        .replace(/\*\*/g, '')
        .replace(/\b\w+\{[^{}]*\}/g, '')    // strip tool call syntax: name{key:val,...}
        .replace(/([.!?])thought\n[\s\S]*/i, '$1')  // strip GL thinking blocks (thought\nThinking Process:...)
        .replace(/\s*\bthought\n[\s\S]*/i, '')       // fallback: strip if no punct before thought\n
        .replace(/\s{2,}/g, ' ')             // collapse double-spaces
        .trim();
      this.totalOutputCharacters += assistantText.length;
      this.pendingOutputTranscript = '';
      try {
        const messageId = await this.persistMessage('assistant', assistantText);
        // Fire background enrichment (student_insights, recurring_struggles, vocab)
        // non-blocking — same pipeline as the text orchestrator uses.
        const conversationId = this.session.conversationId;
        if (messageId && conversationId) {
          const userTextForEnrichment = this.lastUserText;
          const assistantTextForEnrichment = assistantText;
          setImmediate(() => {
            this.enrichment.processBackgroundEnrichment(
              this.session,
              conversationId,
              messageId,
              userTextForEnrichment,
              assistantTextForEnrichment,
              0,
            ).catch(err => console.warn('[GeminiLive] Enrichment failed:', err?.message));
          });
        }
      } catch (err: any) {
        console.warn('[GeminiLive] Failed to flush assistant transcript:', err.message);
        return;
      }
    }

    // Word echo: if Daniela mentioned a previously-taught vocab word this turn,
    // send a brief image flash (word_echo) to the whiteboard. Skip words that
    // were just taught this turn (they already have a full vocab card).
    if (this.session.taughtVocab && this.session.taughtVocab.size > 0) {
      try {
        const echoMatch = findTaughtWordMention(
          capturedOutputText,
          this.session.taughtVocab,
          this.session.vocabAddedThisTurn,
        );
        if (echoMatch) {
          this.sendWsMessage(this.session.ws, {
            type: 'whiteboard_update',
            timestamp: Date.now(),
            items: [{
              id: `word-echo-${Date.now()}`,
              type: 'word_echo',
              content: echoMatch.word,
              timestamp: Date.now(),
              data: { word: echoMatch.word, imageUrl: echoMatch.imageUrl, durationMs: 2500 },
            }],
          });
          console.log(`[GeminiLive] Word echo fired for "${echoMatch.word}"`);
        }
      } catch (echoErr: any) {
        console.warn('[GeminiLive] Word echo error:', echoErr.message);
      }
      // Clear the per-turn set so next turn starts fresh
      this.session.vocabAddedThisTurn = new Set();
    }

    // Count this as a completed exchange and advance the turn
    this.completedExchanges++;

    // Reset per-response state for the next user utterance
    this.currentSentenceIndex = 0;
    this.currentChunkIndex = 0;
    this.lastSentenceStartSentIndex = -1;
    this.pendingInputSaved = false;
    this.firstAudioSentThisTurn = false;
    this.processingPendingSentThisTurn = false;
    // DOUBLE-AUDIO FIX: Clear suppress flag at turn complete so a stale reconnect-era
    // flag never carries into the next turn if GL never generated audio post-reconnect.
    this.suppressNextProcessingPending = false;
    this.session.currentTurnId = ++this.currentTurnId;

    // Send response_complete AFTER DB writes so the client's cache invalidation
    // (onResponseComplete → queryClient.invalidateQueries) refetches the messages
    // that are now in the DB. Also tells the progressive PCM player the total
    // sentence count (totalSentences) so it knows when the stream is fully done.
    this.sendWsMessage(this.session.ws, {
      type: 'response_complete',
      timestamp: Date.now(),
      conversationId: this.session.conversationId,
      turnId: flushTurnId,
      totalSentences,
      fullText: '',
    });

    console.log(`[GeminiLive] Transcripts flushed & response_complete sent — sentences: ${totalSentences}, old turnId: ${flushTurnId}, new turnId: ${this.currentTurnId}`);
  }

  /**
   * Insert one message row and bump the conversation's message_count + duration.
   * Uses a raw SQL UPDATE so message_count is always accurate in the list view.
   */
  private async persistMessage(role: 'user' | 'assistant', content: string): Promise<string | null> {
    // Incognito mode — skip all DB writes so nothing is recorded
    if (this.session.isIncognito) {
      console.log(`[GeminiLive] Incognito: skipping persistMessage (${role})`);
      return null;
    }

    try {
      const { getUserDb } = await import('../db');
      const { messages } = await import('../../shared/schema');
      const { sql: rawSql } = await import('drizzle-orm');
      const db = getUserDb();
      const conversationId = this.session.conversationId;

      if (!conversationId) return null;

      // Ensure the conversation exists before inserting a message
      const convCheck = await db.execute(
        rawSql`SELECT id FROM conversations WHERE id = ${conversationId} LIMIT 1`
      );
      if (convCheck.rows.length === 0) {
        console.warn(`[GeminiLive] Conversation ${conversationId} not found — skipping message persist`);
        return null;
      }

      const inserted = await db.insert(messages).values({ conversationId, role, content }).returning({ id: messages.id });
      const messageId = inserted[0]?.id ?? null;

      // Update conversation stats so the list view shows correct counts
      await db.execute(rawSql`
        UPDATE conversations
        SET
          message_count = message_count + 1,
          duration = GREATEST(
            EXTRACT(EPOCH FROM (NOW() - created_at)) / 60,
            1
          )::integer
        WHERE id = ${conversationId}
      `);

      return messageId;
    } catch (err: any) {
      throw new Error(err.message);
    }
  }
}

/**
 * Convert PCM16 (int16 little-endian) buffer to PCM f32le (float32 little-endian).
 * Gemini Live outputs PCM16; the client expects pcm_f32le.
 * Each int16 sample → float32 / 32768.0
 */
function pcm16ToF32le(pcm16Buffer: Buffer): Buffer {
  const sampleCount = Math.floor(pcm16Buffer.length / 2);
  const f32Buffer = Buffer.allocUnsafe(sampleCount * 4);
  for (let i = 0; i < sampleCount; i++) {
    const int16 = pcm16Buffer.readInt16LE(i * 2);
    f32Buffer.writeFloatLE(int16 / 32768.0, i * 4);
  }
  return f32Buffer;
}

/**
 * Factory — create a GeminiLiveSession for the given StreamingSession.
 */
export function createGeminiLiveSession(
  session: StreamingSession,
  sendWsMessage: (ws: any, message: any, session?: any) => void,
): GeminiLiveSession {
  return new GeminiLiveSession(session, sendWsMessage);
}

/**
 * Whether Gemini Live voice mode is enabled for this process.
 * Controlled by the GEMINI_LIVE_VOICE=true environment variable.
 */
export const GEMINI_LIVE_VOICE_ENABLED = process.env.GEMINI_LIVE_VOICE === 'true';
