import { WebSocket as WS } from 'ws';
import type { StreamingSession } from './streaming-session-types';
import { pcm16ToF32le } from './gemini-live-session';

// GA Realtime model name (Aug 2025) — same model string already used by the
// ephemeral-token voice-chat flow in routes.ts. Override via env for testing
// preview models.
export const OPENAI_REALTIME_MODEL = process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime';
const OPENAI_REALTIME_URL = 'wss://api.openai.com/v1/realtime';

// OpenAI's Realtime voice set is a fixed, non-queryable list (no "list voices"
// endpoint like Cartesia/ElevenLabs) — verify against
// https://platform.openai.com/docs/guides/realtime before adding new names.
export const OPENAI_REALTIME_VOICES = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse'] as const;

const OUTPUT_SAMPLE_RATE = 24000;
// OpenAI Realtime's pcm16 format is 24kHz — verify against current docs if OpenAI
// changes this. HolaHola's mic capture is fixed at 16kHz (matches Gemini Live's
// requirement), so input needs upsampling — see resamplePcm16 below.
const OPENAI_INPUT_SAMPLE_RATE = 24000;
const CLIENT_MIC_SAMPLE_RATE = 16000;

/**
 * Naive linear-interpolation resampler — adequate for speech, not audiophile
 * quality. Good enough to prove the pipeline works; revisit if audio quality
 * during testing turns out to be the bottleneck rather than voice/latency.
 */
function resamplePcm16(input: Buffer, fromRate: number, toRate: number): Buffer {
  if (fromRate === toRate || input.length < 2) return input;
  const inSamples = Math.floor(input.length / 2);
  const outSamples = Math.round(inSamples * (toRate / fromRate));
  const out = Buffer.alloc(outSamples * 2);
  for (let i = 0; i < outSamples; i++) {
    const srcPos = i * (fromRate / toRate);
    const i0 = Math.floor(srcPos);
    const i1 = Math.min(i0 + 1, inSamples - 1);
    const frac = srcPos - i0;
    const s0 = input.readInt16LE(i0 * 2);
    const s1 = input.readInt16LE(i1 * 2);
    const sample = Math.round(s0 + (s1 - s0) * frac);
    out.writeInt16LE(Math.max(-32768, Math.min(32767, sample)), i * 2);
  }
  return out;
}

/**
 * Minimal OpenAI GPT Realtime (audio-to-audio, full-duplex) live session —
 * a thin counterpart to GeminiLiveSession for testing whether OpenAI's
 * native voice model is viable as a Daniela voice engine.
 *
 * Deliberately NOT implemented (out of scope for the initial test run):
 * function calling / whiteboard tools (Daniela is conversational-only here),
 * reconnection & resumption handles, the guardian audit channel,
 * karaoke/subtitle word timing, absence-nudge handling, mid-session voice
 * switching. Selecting 'openai-realtime' as a tutor voice's provider gets a
 * real live conversation with Daniela's personality and classroom context
 * (the system prompt ports as plain text), voiced by OpenAI — the whiteboard
 * and other native tools are simply inert for that session.
 */
export class OpenAIRealtimeSession {
  private ws: WS | null = null;
  private isStarted = false;
  private currentTurnId = 0;
  private chunkIndex = 0;
  private hadAudioThisResponse = false;
  private closedByUs = false;

  constructor(
    private session: StreamingSession,
    private sendWsMessage: (ws: any, message: any, session?: any) => void,
  ) {}

  async start(systemPrompt: string, greetingTrigger?: string): Promise<void> {
    if (this.isStarted) {
      console.warn('[OpenAIRealtime] start() called on already-started session — ignoring');
      return;
    }
    this.isStarted = true;

    const apiKey = process.env.USER_OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('USER_OPENAI_API_KEY not configured — cannot start OpenAI Realtime session');
    }

    const voiceOverride = (this.session as any).voiceOverride;
    const requestedVoice = voiceOverride?.voiceId ?? this.session.voiceId;
    const voice = (OPENAI_REALTIME_VOICES as readonly string[]).includes(requestedVoice as string)
      ? requestedVoice
      : 'alloy';

    console.log(`[OpenAIRealtime] Opening session — model: ${OPENAI_REALTIME_MODEL}, voice: ${voice}`);

    await new Promise<void>((resolve, reject) => {
      const ws = new WS(`${OPENAI_REALTIME_URL}?model=${encodeURIComponent(OPENAI_REALTIME_MODEL)}`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'OpenAI-Beta': 'realtime=v1',
        },
      });
      this.ws = ws;

      const openTimeout = setTimeout(() => {
        reject(new Error('OpenAI Realtime connection timed out'));
      }, 15000);

      ws.on('open', () => {
        clearTimeout(openTimeout);
        ws.send(JSON.stringify({
          type: 'session.update',
          session: {
            modalities: ['audio', 'text'],
            instructions: systemPrompt,
            voice,
            input_audio_format: 'pcm16',
            output_audio_format: 'pcm16',
            turn_detection: { type: 'server_vad' },
          },
        }));
        if (greetingTrigger) {
          ws.send(JSON.stringify({
            type: 'response.create',
            response: { instructions: greetingTrigger },
          }));
        }
        resolve();
      });

      ws.on('message', (data: any) => {
        try {
          this.handleServerEvent(JSON.parse(data.toString()));
        } catch (err: any) {
          console.error('[OpenAIRealtime] Failed to parse server event:', err.message);
        }
      });

      ws.on('error', (err: Error) => {
        console.error('[OpenAIRealtime] WebSocket error:', err.message);
        clearTimeout(openTimeout);
        reject(err);
      });

      ws.on('close', (code: number, reason: Buffer) => {
        if (!this.closedByUs) {
          console.warn(`[OpenAIRealtime] Session closed unexpectedly — code: ${code}, reason: ${reason?.toString() || '(none)'}`);
        }
      });
    });
  }

  private handleServerEvent(event: any): void {
    switch (event.type) {
      case 'response.created':
        this.currentTurnId++;
        this.chunkIndex = 0;
        this.hadAudioThisResponse = false;
        // Guard against overlapping audio if the student barges in mid-response —
        // reuses the reset message type the client's player already handles for GL.
        this.sendWsMessage(this.session.ws, { type: 'gl_audio_reset' }, this.session);
        break;

      case 'response.audio.delta': {
        const pcm16 = Buffer.from(event.delta, 'base64');
        const f32le = pcm16ToF32le(pcm16);
        this.hadAudioThisResponse = true;
        this.sendWsMessage(this.session.ws, {
          type: 'audio_chunk',
          audio: f32le.toString('base64'),
          audioFormat: 'pcm_f32le',
          sampleRate: OUTPUT_SAMPLE_RATE,
          turnId: this.currentTurnId,
          sentenceIndex: 0,
          chunkIndex: this.chunkIndex++,
          isLast: false,
        }, this.session);
        break;
      }

      case 'response.audio.done':
      case 'response.done':
        if (this.hadAudioThisResponse) {
          this.sendWsMessage(this.session.ws, {
            type: 'audio_chunk',
            audio: '',
            audioFormat: 'pcm_f32le',
            sampleRate: OUTPUT_SAMPLE_RATE,
            turnId: this.currentTurnId,
            sentenceIndex: 0,
            chunkIndex: this.chunkIndex,
            isLast: true,
          }, this.session);
          this.hadAudioThisResponse = false;
        }
        break;

      case 'error':
        console.error('[OpenAIRealtime] Server error event:', JSON.stringify(event.error ?? event));
        break;

      default:
        // Transcripts, VAD speech_started/stopped, rate-limit updates, etc. are
        // not wired up in this first pass.
        break;
    }
  }

  /** Forward a mic PCM16 chunk (captured at HolaHola's standard 16kHz) to OpenAI. */
  sendAudioChunk(pcm16Buffer: Buffer): void {
    if (!this.ws || this.ws.readyState !== WS.OPEN) return;
    const resampled = resamplePcm16(pcm16Buffer, CLIENT_MIC_SAMPLE_RATE, OPENAI_INPUT_SAMPLE_RATE);
    this.ws.send(JSON.stringify({
      type: 'input_audio_buffer.append',
      audio: resampled.toString('base64'),
    }));
  }

  stop(): void {
    this.closedByUs = true;
    try {
      this.ws?.close();
    } catch {}
    this.ws = null;
  }
}

export function createOpenAIRealtimeSession(
  session: StreamingSession,
  sendWsMessage: (ws: any, message: any, session?: any) => void,
): OpenAIRealtimeSession {
  return new OpenAIRealtimeSession(session, sendWsMessage);
}
