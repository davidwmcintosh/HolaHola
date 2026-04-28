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
import { lookupLegacyType } from './daniela-function-registry';
import type { ExtractedFunctionCall } from './gemini-function-declarations';

const GEMINI_LIVE_MODEL = process.env.GEMINI_LIVE_MODEL || 'gemini-2.5-flash-native-audio-preview-12-2025';
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
  spanish:    'es-US',   // es-ES rejected by gemini-2.5-flash-native-audio-preview models
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
 * Map of Gemini TTS voice IDs → Gemini Live prebuilt voice names.
 * Gemini Live uses the same Chirp HD voice catalog, just different naming.
 */
const VOICE_ID_TO_LIVE_NAME: Record<string, string> = {
  'Aoede':  'Aoede',
  'Kore':   'Kore',
  'Leda':   'Leda',
  'Zephyr': 'Zephyr',
  'Puck':   'Puck',
  'Charon': 'Charon',
  'Fenrir': 'Fenrir',
  'Orus':   'Orus',
};

export class GeminiLiveSession {
  private liveSession: Session | null = null;
  private fcHandler: NativeFunctionCallHandler;
  private currentTurnId = 0;
  private currentChunkIndex = 0;
  private isStopped = false;
  private isStarted = false;

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

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

    const liveName = VOICE_ID_TO_LIVE_NAME[this.session.voiceId || ''] || DEFAULT_LIVE_VOICE;
    const langKey = (this.session.targetLanguage || '').toLowerCase().trim();
    const languageCode = LANGUAGE_TO_BCP47[langKey] || 'en-US';
    console.log(`[GeminiLive] Opening session — model: ${GEMINI_LIVE_MODEL}, voice: ${liveName}, languageCode: ${languageCode}`);

    this.liveSession = await ai.live.connect({
      model: GEMINI_LIVE_MODEL,
      config: {
        systemInstruction: systemPrompt,
        tools: tools.length > 0 ? [{ functionDeclarations: tools }] : undefined,
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          languageCode,
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: liveName,
            },
          },
        },

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
        //  prefixPaddingMs: 300      — require 300 ms of sustained speech before
        //                             committing a turn start, filtering out coughs,
        //                             filler sounds, and accidental mic noise.
        //  silenceDurationMs: 800    — hard cutoff: 800 ms of silence forces end
        //                             of turn even if semantic signal is ambiguous.
        //                             Language learners often pause while searching
        //                             for a word, so we give a little extra room.
        realtimeInputConfig: {
          automaticActivityDetection: {
            disabled: false,
            startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_HIGH,
            endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_LOW,
            prefixPaddingMs: 300,
            silenceDurationMs: 800,
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
          const code = event?.code;
          const reason = event?.reason || '(no reason)';
          console.log(`[GeminiLive] Session closed — code: ${code}, reason: ${reason}`);
          if (!this.isStopped) {
            this.sendWsMessage(this.session.ws, {
              type: 'voice_error',
              code: 'GEMINI_LIVE_DISCONNECTED',
              message: 'Daniela\'s voice session disconnected',
              recoverable: true,
            });
          }
        },
      },
    });

    console.log(`[GeminiLive] Session open — sessionId: ${this.session.id}`);

    // If a greeting trigger is provided, send it as the first user turn.
    // Gemini Live will respond with Daniela's opening greeting audio.
    if (greetingTrigger && this.liveSession) {
      try {
        this.liveSession.sendClientContent({
          turns: [{ role: 'user', parts: [{ text: greetingTrigger }] }],
          turnComplete: true,
        });
        console.log('[GeminiLive] Greeting trigger sent');
      } catch (err) {
        console.warn('[GeminiLive] Failed to send greeting trigger:', err);
      }
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
    const base64Audio = pcm16Buffer.toString('base64');
    this.liveSession.sendRealtimeInput({
      audio: {
        data: base64Audio,
        mimeType: `audio/pcm;rate=${AUDIO_INPUT_SAMPLE_RATE}`,
      },
    });
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
    console.log(`[GeminiLive] Interrupted — advancing to turnId ${this.currentTurnId}`);
  }

  /**
   * Send a greeting trigger to Gemini Live to start the conversation.
   * Called from the `request_greeting` WS handler instead of orchestrator.processGreetingRequest().
   */
  sendGreetingTrigger(userName?: string, isResumed?: boolean, scenarioSlug?: string): void {
    if (!this.liveSession || this.isStopped) return;
    const name = userName ? `, my name is ${userName}` : '';
    const langName = this.session.targetLanguage
      ? this.session.targetLanguage.charAt(0).toUpperCase() + this.session.targetLanguage.slice(1)
      : 'Spanish';
    const tutorName = this.session.tutorName || 'Daniela';
    const resumed = isResumed
      ? 'This is a resumed session — acknowledge that we are continuing.'
      : `This is a new session — greet me warmly and dive straight into ${langName}.`;
    const scenario = scenarioSlug ? ` We are doing a scenario: ${scenarioSlug}.` : '';
    const trigger = `Hello ${tutorName}${name}. ${resumed}${scenario}`;
    try {
      this.liveSession.sendClientContent({
        turns: [{ role: 'user', parts: [{ text: trigger }] }],
        turnComplete: true,
      });
      console.log(`[GeminiLive] Greeting trigger sent (resumed: ${isResumed || false})`);
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
    if (this.liveSession) {
      try {
        this.liveSession.close();
      } catch (_) {}
      this.liveSession = null;
    }
    console.log(`[GeminiLive] Session stopped — sessionId: ${this.session.id}`);
  }

  private async handleServerMessage(msg: LiveServerMessage): Promise<void> {
    // ── Diagnostic: log the top-level keys of every message ─────────────────
    const msgKeys = Object.keys(msg).filter(k => (msg as any)[k] != null);
    if (!msg.usageMetadata && !msg.sessionResumptionUpdate) {
      // Log non-accounting messages so we can trace what Gemini is actually returning
      console.log(`[GeminiLive] Server msg keys: [${msgKeys.join(', ')}]`, {
        hasTurnComplete: !!msg.serverContent?.turnComplete,
        hasParts: !!msg.serverContent?.modelTurn?.parts,
        partCount: msg.serverContent?.modelTurn?.parts?.length ?? 0,
        hasToolCall: !!msg.toolCall,
        hasError: !!(msg as any).error,
      });
    }

    // ── Catch any top-level error from Gemini ────────────────────────────────
    if ((msg as any).error) {
      console.error('[GeminiLive] API error in message:', (msg as any).error);
    }

    // ── Audio output ────────────────────────────────────────────────────────
    if (msg.serverContent?.modelTurn?.parts) {
      let audioParts = 0;
      let textParts = 0;
      for (const part of msg.serverContent.modelTurn.parts) {
        if (part.inlineData?.data && part.inlineData.mimeType?.includes('audio')) {
          audioParts++;
          const pcm16Buffer = Buffer.from(part.inlineData.data, 'base64');
          const f32leBuffer = pcm16ToF32le(pcm16Buffer);

          this.sendWsMessage(this.session.ws, {
            type: 'audio_chunk',
            audio: f32leBuffer.toString('base64'),
            audioFormat: 'pcm_f32le',
            sampleRate: AUDIO_OUTPUT_SAMPLE_RATE,
            turnId: this.currentTurnId,
            sentenceIndex: 0,
            chunkIndex: this.currentChunkIndex++,
            isLast: false,
          });
        }

        // Model text output (transcription / subtitles)
        if (part.text) {
          textParts++;
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

    // ── Turn complete ────────────────────────────────────────────────────────
    if (msg.serverContent?.turnComplete) {
      // Signal end-of-turn to the client's audio player
      this.sendWsMessage(this.session.ws, {
        type: 'audio_chunk',
        audio: '',
        audioFormat: 'pcm_f32le',
        sampleRate: AUDIO_OUTPUT_SAMPLE_RATE,
        turnId: this.currentTurnId,
        sentenceIndex: 0,
        chunkIndex: this.currentChunkIndex,
        isLast: true,
      });
      this.session.currentTurnId = ++this.currentTurnId;
      this.currentChunkIndex = 0;
      console.log(`[GeminiLive] Turn complete → turnId now ${this.currentTurnId}`);
    }

    // ── Input transcription (what the user said) ─────────────────────────────
    if ((msg.serverContent as any)?.inputTranscription?.text) {
      const text = (msg.serverContent as any).inputTranscription.text as string;
      if (text.trim()) {
        this.sendWsMessage(this.session.ws, {
          type: 'transcript',
          text,
          isFinal: true,
          source: 'gemini_live',
        });
      }
    }

    // ── Output transcription (what Daniela said) ─────────────────────────────
    if ((msg.serverContent as any)?.outputTranscription?.text) {
      const text = (msg.serverContent as any).outputTranscription.text as string;
      if (text.trim()) {
        this.sendWsMessage(this.session.ws, {
          type: 'daniela_transcript',
          text,
          turnId: this.currentTurnId,
        });
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

        try {
          await this.fcHandler.handle(this.session.id, this.session, extractedFc);
        } catch (err) {
          console.error(`[GeminiLive] Tool call failed (${fcName}):`, err);
        }

        responses.push({
          id: fc.id || '',
          name: fcName,
          response: { result: 'done' },
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
    // losing conversation context.
    if (msg.sessionResumptionUpdate?.newHandle) {
      this.session.geminiLiveResumptionHandle = msg.sessionResumptionUpdate.newHandle;
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
