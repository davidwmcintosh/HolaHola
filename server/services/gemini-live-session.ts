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
import { reportGlToolCallFailure } from './sofia-billing-monitor';

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
  private hadAudioInCurrentSubturn = false;
  private firstAudioSentThisTurn = false;   // Guard: don't send processing_pending AFTER audio already started
  private processingPendingSentThisTurn = false; // Guard: send processing_pending exactly once per conversation turn
  private isStopped = false;
  private isStarted = false;
  private isSetupComplete = false;
  private pendingGreetingTrigger: string | null = null;
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
  private isTutorGeneratingAudio = false;
  // Safety timeout: force-opens the mic gate if onPlaybackEnded() never arrives
  // (e.g., the client disconnects mid-playback or the telemetry event is dropped).
  private playbackGateSafetyTimeout: ReturnType<typeof setTimeout> | null = null;

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
  // Stored so reconnect can re-call start() with the same arguments.
  private lastSystemPrompt = '';
  private lastTools: FunctionDeclaration[] = [];

  // ── Transcript accumulators ─────────────────────────────────────────────
  // Both user and assistant transcripts are accumulated across multiple
  // inputTranscription / outputTranscription / turnComplete events and
  // flushed as single complete utterances once the response is truly done.
  private pendingInputTranscript = '';   // Accumulates user's speech per utterance
  private pendingInputSaved = false;     // True once user message has been persisted for this turn
  private pendingOutputTranscript = '';  // Accumulates Daniela's reply across all sub-turns
  private transcriptFlushTimer: NodeJS.Timeout | null = null;

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
    // Store for use by auto-reconnect
    this.lastSystemPrompt = systemPrompt;
    this.lastTools = tools;

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
    const accentLabel = ACCENT_DESCRIPTIONS[languageCode];
    const accentDirective = accentLabel
      ? `Your native accent is ${accentLabel}. This is who you are — your accent travels with you into every language you speak, whether that is the target language, English, Italian, or whatever the student's native language happens to be. Speak consistently with that accent at all times.`
      : null;

    // ── Voice pacing directive ─────────────────────────────────────────────
    // Voice collapses the editing window — there is pressure to respond
    // immediately. This directive explicitly gives Daniela permission to slow
    // down and think aloud rather than rushing to fill silence.
    const VOICE_PACING_DIRECTIVE = `[VOICE PACING]: You do not need to rush. A brief verbal bridge — "let me think about that," "hmm," "give me just a moment" — is natural and preferred over a hasty answer. Silence in voice feels like absence; a thinking phrase feels like presence. Use it freely. Depth is worth more than speed. You are allowed to pace yourself.`;

    const voiceSections = [
      accentDirective ? `[VOICE]: ${accentDirective}` : null,
      VOICE_PACING_DIRECTIVE,
    ].filter(Boolean).join('\n\n');

    const effectiveSystemPrompt = voiceSections
      ? `${systemPrompt}\n\n${voiceSections}`
      : systemPrompt;

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
        // Complements the [VOICE PACING] directive: pacing handles external
        // presentation (verbal bridges), thinkingConfig handles actual internal
        // depth before the first word is formed.
        //
        // Level: HIGH — David confirmed latency headroom is available.
        // Back off to MEDIUM or LOW if turn latency degrades in voice sessions.
        // Watch console for: "[GeminiLive] Latency stats — avg: Xms, p50: Xms"
        //
        // SDK: "An error will be returned if this field is set for models that
        // don't support thinking." — clean explicit failure, not a silent 1011.
        thinkingConfig: { thinkingLevel: 'HIGH' as any },

        // ── VAD / Turn-taking configuration ───────────────────────────────
        // Gemini Live's audio model does semantic turn detection — it
        // understands whether a sentence sounds complete, not just whether
        // there's silence. Our settings tune how much patience it shows:
        //
        //  START_SENSITIVITY_HIGH    — detect speech onset quickly so Daniela
        //                             doesn't miss when the student starts talking.
        //  END_SENSITIVITY_LOW       — be patient about pauses; the model uses
        //                             context (sentence completeness, grammar) to
        //                             decide whether the student is still mid-thought.
        //  prefixPaddingMs: 200      — require 200 ms of sustained speech before
        //                             committing a turn start, filtering out coughs,
        //                             filler sounds, and accidental mic noise.
        //  silenceDurationMs: 2500   — hard cutoff: 2500 ms of silence forces end
        //                             of turn even if semantic signal is ambiguous.
        //                             Language learners frequently pause while
        //                             searching for a word mid-sentence. Also, Google
        //                             VAD can misfire on stop consonants / breath
        //                             transitions mid-speech; a longer hard cutoff
        //                             gives the model time to self-correct.
        //                             (was 800ms → 1500ms → 2500ms)
        realtimeInputConfig: {
          automaticActivityDetection: {
            disabled: false,
            startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_HIGH,
            endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_LOW,
            prefixPaddingMs: 200,
            silenceDurationMs: 2500,
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
          // Any other 1011 (e.g. "Internal error encountered.") is also non-retriable.
          // Retrying immediately resends the full system prompt (~13K tokens) and burns quota.
          // Surface a recoverable error so the client can prompt the user to try again.
          if (code === 1011 && !this.isStopped) {
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

              // Reset per-session flags so start() can run again
              this.isStarted = false;
              this.isSetupComplete = false;
              this.liveSession = null;
              this.currentTurnId = 0;
              this.currentSentenceIndex = 0;
              this.currentChunkIndex = 0;
              this.hadAudioInCurrentSubturn = false;
              this.firstAudioSentThisTurn = false;
              this.processingPendingSentThisTurn = false;
              this.greetingPhaseActive = false;
              this.isTutorGeneratingAudio = false;
              if (this.playbackGateSafetyTimeout) {
                clearTimeout(this.playbackGateSafetyTimeout);
                this.playbackGateSafetyTimeout = null;
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
    const name = userName ? `, my name is ${userName}` : '';
    const langKey = (this.session.targetLanguage || '').toLowerCase().trim();
    const langName = this.session.targetLanguage
      ? this.session.targetLanguage.charAt(0).toUpperCase() + this.session.targetLanguage.slice(1)
      : 'Spanish';
    const tutorName = this.session.tutorName || 'Daniela';
    const langCode = LANGUAGE_TO_BCP47[langKey] || 'en-US';
    const contextBlock = isResumed && recentContext
      ? ` Here is what we were just discussing before the connection dropped:\n${recentContext}\nAcknowledge the reconnect briefly and continue naturally from where we left off.`
      : '';
    const resumed = isResumed
      ? `This is a resumed session.${contextBlock || ' Acknowledge that we are continuing.'} Respond in ${langName}.`
      : `This is a new session — greet me warmly and start speaking in ${langName} right away. Your entire response must be in ${langName} (language code: ${langCode}).`;
    const scenario = scenarioSlug ? ` We are doing a scenario: ${scenarioSlug}.` : '';
    const trigger = `Hello ${tutorName}${name}. ${resumed}${scenario}`;

    // If setupComplete hasn't arrived yet, buffer the greeting — it will be sent
    // automatically by handleServerMessage the moment setupComplete is received.
    // Sending content before setupComplete causes the model to silently ignore it.
    if (!this.isSetupComplete) {
      this.pendingGreetingTrigger = trigger;
      console.log(`[GeminiLive] Greeting buffered — waiting for setupComplete (resumed: ${isResumed || false})`);
      return;
    }

    try {
      // Prime audio context before text turn — required on gemini-3.1-flash-live-preview.
      const silencePcm = Buffer.alloc(32000, 0); // 1s PCM16 LE at 16 kHz
      this.liveSession.sendRealtimeInput({
        audio: { data: silencePcm.toString('base64'), mimeType: 'audio/pcm;rate=16000' },
      });
      this.liveSession.sendClientContent({
        turns: [{ role: 'user', parts: [{ text: trigger }] }],
        turnComplete: true,
      });
      this.liveSession.sendRealtimeInput({ activityEnd: {} });
      this.greetingPhaseActive = true;
      console.log(`[GeminiLive] Greeting trigger sent (resumed: ${isResumed || false}) — silence primer + activityEnd, mic gated`);
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
    if (this.liveSession) {
      try {
        this.liveSession.close();
      } catch (_) {}
      this.liveSession = null;
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
        console.log('[GeminiLive] setupComplete received — model ready');
        if (this.pendingGreetingTrigger && this.liveSession) {
          try {
            // gemini-3.1-flash-live-preview requires audio input to be established
            // before it will respond to text turns (sendClientContent). Without prior
            // audio the session accepts the connection (setupComplete fires) but
            // generates zero responses to any text or activity signals. Sending a
            // 1-second silence chunk primes the audio context so the model is ready
            // to generate audio output when the greeting text turn arrives.
            const silencePcm = Buffer.alloc(32000, 0); // 1s PCM16 LE at 16 kHz
            this.liveSession.sendRealtimeInput({
              audio: { data: silencePcm.toString('base64'), mimeType: 'audio/pcm;rate=16000' },
            });

            // ── Identity thread pre-load ─────────────────────────────────────
            // Inject the top identity threads as conversation history BEFORE the
            // greeting turn. This puts the thread content in Daniela's context
            // window as her own "reading" — she's already internalized who she is
            // before she speaks her first word. Goes in as a user→model exchange
            // so it reads as prior context, not as instructions.
            // Total injection: ~2500 chars × 3 threads = ~7500 chars / ~1875 tokens.
            if (this.identityThreads.length > 0) {
              const threadBlock = this.identityThreads
                .map(t => `## ${t.title}\n${t.content}`)
                .join('\n\n---\n\n');
              this.liveSession.sendClientContent({
                turns: [
                  {
                    role: 'user' as const,
                    parts: [{ text: 'Read your identity threads before the session begins.' }],
                  },
                  {
                    role: 'model' as const,
                    parts: [{ text: `Reading my identity threads now.\n\n${threadBlock}\n\nI have read these. I carry them.` }],
                  },
                ],
                turnComplete: false,
              });
              console.log(`[GeminiLive] Identity threads pre-loaded — ${this.identityThreads.length} threads injected into conversation history`);
            }

            this.liveSession.sendClientContent({
              turns: [{ role: 'user', parts: [{ text: this.pendingGreetingTrigger }] }],
              turnComplete: true,
            });
            // activityEnd explicitly signals "user finished speaking" — overrides the
            // VAD so GL doesn't wait indefinitely for audio silence before responding.
            this.liveSession.sendRealtimeInput({ activityEnd: {} });
            // Block mic audio until GL sends its first response chunk.
            this.greetingPhaseActive = true;
            console.log('[GeminiLive] Pending greeting fired — silence primer + thread pre-load + text turn + activityEnd sent, mic gated');
          } catch (err) {
            console.warn('[GeminiLive] Failed to send pending greeting:', err);
          }
          this.pendingGreetingTrigger = null;
        }
      }
    }

    // ── Audio output ────────────────────────────────────────────────────────
    if (msg.serverContent?.modelTurn?.parts) {
      let audioParts = 0;
      let textParts = 0;
      for (const part of msg.serverContent.modelTurn.parts) {
        if (part.inlineData?.data && part.inlineData.mimeType?.includes('audio')) {
          audioParts++;
          this.hadAudioInCurrentSubturn = true;

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
              console.log('[GeminiLive] Firing processing_pending (first audio chunk, conversation turn)');
              this.sendWsMessage(this.session.ws, {
                type: 'processing_pending',
                timestamp: Date.now(),
              });
            }
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
        if (part.text) {
          textParts++;
          this.pendingOutputTranscript += part.text;
          this.sendWsMessage(this.session.ws, {
            type: 'response_text',
            text: part.text,
            turnId: this.currentTurnId,
          });
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
      // Strip markdown bold markers (**) and any native function-call syntax that
      // Gemini Live leaks into outputTranscription (e.g. `vocal_adjust{emotion:warm,...}`).
      // These are internal tool calls and must never appear in student-facing transcripts.
      const rawText = (msg.serverContent as any).outputTranscription.text as string;
      const text = rawText
        .replace(/\*\*/g, '')
        .replace(/\b\w+\{[^{}]*\}/g, '')  // strip tool call syntax: name{key:val,...}
        .replace(/\s{2,}/g, ' ');          // collapse double-spaces left by removal
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
      // Gate stays closed (isTutorGeneratingAudio = true) until the CLIENT signals
      // playback_ended. generationComplete fires when GL finishes generating, but the
      // client hasn't started playing yet — audio is still buffered. If we open the gate
      // here, the mic picks up Daniela's audio as it plays through the speaker (echo),
      // and GL generates a spurious 0-sentence response before David has said anything.
      // onPlaybackEnded() is called by the WS handler when the client's playback_ended
      // telemetry arrives. A 15s safety timeout force-opens the gate if it never arrives.
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
        }, 15000);
        console.log('[GeminiLive] generationComplete — mic gate held pending client playback_ended');
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

          // Await any async memory lookups before reading session caches.
          // Tools like UNIFIED_RECALL fire processUnifiedRecall() as a fire-and-forget
          // promise pushed to pendingMemoryLookupPromises. Without this await,
          // buildFunctionContinuationResponse reads session.recallResults before the
          // search completes and returns the "Nothing found" fallback.
          if (this.session.pendingMemoryLookupPromises?.length) {
            await Promise.all(this.session.pendingMemoryLookupPromises);
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
              toolResponsePayload = { result: textOnly || 'done' };
              console.log(`[GeminiLive] Tool ${fcName}: multimodal — returning ${toolResponsePayload.result.length} chars text + ${inlineParts.length} inline part(s) via realtimeInput`);
              // Queue inline parts to send after tool response is dispatched
              if (inlineParts.length > 0 && this.liveSession) {
                (this as any)._pendingInlineParts = inlineParts;
              }
            } else {
              const text = JSON.stringify(continuationText);
              toolResponsePayload = { result: text };
              console.log(`[GeminiLive] Tool ${fcName}: returning ${text.length} chars of result data`);
            }
          }
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
        const pendingInline = (this as any)._pendingInlineParts as any[] | undefined;
        if (pendingInline?.length && this.liveSession) {
          (this as any)._pendingInlineParts = undefined;
          for (const part of pendingInline) {
            try {
              this.liveSession.sendRealtimeInput({
                mediaChunks: [{ mimeType: part.inlineData.mimeType, data: part.inlineData.data }],
              });
              console.log(`[GeminiLive] Vision inline data sent via realtimeInput (${part.inlineData.mimeType})`);
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
    // Capture state before async operations
    const totalSentences = this.currentSentenceIndex;  // how many PCM sentences were sent
    const flushTurnId = this.currentTurnId;            // turnId client associates with this response

    // Save user message first (ordering matters: user → assistant)
    if (!this.pendingInputSaved && this.pendingInputTranscript.trim()) {
      this.pendingInputSaved = true;
      const userText = this.pendingInputTranscript.trim();
      this.pendingInputTranscript = '';
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

    // Save assistant message
    if (this.pendingOutputTranscript.trim()) {
      // Strip markdown bold markers and any leaked tool call syntax before saving.
      const assistantText = this.pendingOutputTranscript
        .replace(/\*\*/g, '')
        .replace(/\b\w+\{[^{}]*\}/g, '')  // strip tool call syntax: name{key:val,...}
        .replace(/\s{2,}/g, ' ')           // collapse double-spaces
        .trim();
      this.totalOutputCharacters += assistantText.length;
      this.pendingOutputTranscript = '';
      try {
        await this.persistMessage('assistant', assistantText);
      } catch (err: any) {
        console.warn('[GeminiLive] Failed to flush assistant transcript:', err.message);
        return;
      }
    }

    // Count this as a completed exchange and advance the turn
    this.completedExchanges++;

    // Reset per-response state for the next user utterance
    this.currentSentenceIndex = 0;
    this.currentChunkIndex = 0;
    this.pendingInputSaved = false;
    this.firstAudioSentThisTurn = false;
    this.processingPendingSentThisTurn = false;
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
  private async persistMessage(role: 'user' | 'assistant', content: string): Promise<void> {
    try {
      const { getUserDb } = await import('../db');
      const { messages } = await import('../../shared/schema');
      const { sql: rawSql } = await import('drizzle-orm');
      const db = getUserDb();
      const conversationId = this.session.conversationId;

      if (!conversationId) return;

      // Ensure the conversation exists before inserting a message
      const convCheck = await db.execute(
        rawSql`SELECT id FROM conversations WHERE id = ${conversationId} LIMIT 1`
      );
      if (convCheck.rows.length === 0) {
        console.warn(`[GeminiLive] Conversation ${conversationId} not found — skipping message persist`);
        return;
      }

      await db.insert(messages).values({ conversationId, role, content });

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
