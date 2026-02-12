import { EventEmitter } from 'events';
import { GoogleGenAI, Modality, Session, LiveServerMessage } from '@google/genai';
import { WordTiming } from '@shared/streaming-voice-types';
import { stripWhiteboardMarkup } from '@shared/whiteboard-types';
import type {
  StreamingSynthesisRequest,
  StreamingAudioChunk,
  ProgressiveStreamingCallbacks,
} from './cartesia-streaming';
import { voiceDiagnostics } from './voice-diagnostics-service';

const GEMINI_LIVE_VOICES: { name: string; gender: 'male' | 'female' }[] = [
  { name: 'Aoede', gender: 'female' },
  { name: 'Kore', gender: 'female' },
  { name: 'Leda', gender: 'female' },
  { name: 'Zephyr', gender: 'female' },
  { name: 'Puck', gender: 'male' },
  { name: 'Charon', gender: 'male' },
  { name: 'Fenrir', gender: 'male' },
  { name: 'Orus', gender: 'male' },
];

const LIVE_MODEL = 'gemini-2.5-flash-native-audio-preview-12-2025';
const LIVE_SAMPLE_RATE = 24000;
const SYNTHESIS_TIMEOUT_MS = 15000;

export const LANGUAGE_ACCENT_VARIANTS: Record<string, { label: string; code: string }[]> = {
  spanish: [
    { label: 'Spanish (US)', code: 'es-US' },
    { label: 'Spanish (Spain)', code: 'es-ES' },
    { label: 'Spanish (Mexico)', code: 'es-MX' },
    { label: 'Spanish (Argentina)', code: 'es-AR' },
    { label: 'Spanish (Colombia)', code: 'es-CO' },
  ],
  english: [
    { label: 'English (US)', code: 'en-US' },
    { label: 'English (UK)', code: 'en-GB' },
    { label: 'English (Australia)', code: 'en-AU' },
    { label: 'English (India)', code: 'en-IN' },
  ],
  french: [
    { label: 'French (France)', code: 'fr-FR' },
    { label: 'French (Canada)', code: 'fr-CA' },
  ],
  german: [
    { label: 'German (Germany)', code: 'de-DE' },
    { label: 'German (Austria)', code: 'de-AT' },
  ],
  italian: [
    { label: 'Italian (Italy)', code: 'it-IT' },
  ],
  portuguese: [
    { label: 'Portuguese (Brazil)', code: 'pt-BR' },
    { label: 'Portuguese (Portugal)', code: 'pt-PT' },
  ],
  japanese: [
    { label: 'Japanese (Japan)', code: 'ja-JP' },
  ],
  'mandarin chinese': [
    { label: 'Chinese (Mainland)', code: 'zh-CN' },
    { label: 'Chinese (Taiwan)', code: 'zh-TW' },
  ],
  korean: [
    { label: 'Korean (Korea)', code: 'ko-KR' },
  ],
  hebrew: [
    { label: 'Hebrew (Israel)', code: 'he-IL' },
  ],
};

const DEFAULT_LANGUAGE_CODE: Record<string, string> = {
  spanish: 'es-US',
  english: 'en-US',
  french: 'fr-FR',
  german: 'de-DE',
  italian: 'it-IT',
  portuguese: 'pt-BR',
  japanese: 'ja-JP',
  'mandarin chinese': 'zh-CN',
  korean: 'ko-KR',
  hebrew: 'he-IL',
};

export class GeminiLiveTtsService extends EventEmitter {
  private client: GoogleGenAI | null = null;

  constructor() {
    super();
    const apiKey = process.env.GEMINI_API_KEY || '';
    if (apiKey) {
      this.client = new GoogleGenAI({ apiKey });
      console.log(`[Gemini Live TTS] Initialized (model: ${LIVE_MODEL} via Live API)`);
    } else {
      console.warn('[Gemini Live TTS] No API key configured');
    }
  }

  isAvailable(): boolean {
    return this.client !== null;
  }

  isConnected(): boolean {
    return this.client !== null;
  }

  getVoices(gender?: 'male' | 'female'): { name: string; gender: 'male' | 'female' }[] {
    if (gender) return GEMINI_LIVE_VOICES.filter(v => v.gender === gender);
    return GEMINI_LIVE_VOICES;
  }

  consumeNativeTimestamps(): WordTiming[] {
    return [];
  }

  async ensureConnection(): Promise<number> {
    return 0;
  }

  async connect(): Promise<void> {}

  disconnect(): void {}

  private cleanTextForTTS(text: string): string {
    const textWithoutMarkup = stripWhiteboardMarkup(text);
    const cleaned = textWithoutMarkup
      .replace(/<speed[^>]*>(.*?)<\/speed>/gi, '$1')
      .replace(/<volume[^>]*>(.*?)<\/volume>/gi, '$1')
      .replace(/<spell>(.*?)<\/spell>/gi, '$1')
      .replace(/<pause[^>]*\/?>/gi, ' ')
      .replace(/<[a-z]+[^>]*\/?>/gi, '')
      .replace(/\[VOICE_ADJUST[^\]]*\]/gi, '')
      .replace(/voice_adjust\s*\{[^}]*\}/gi, '')
      .replace(/voice_adjust\s*:\s*\{[^}]*\}/gi, '')
      .replace(/\[VOICE_RESET[^\]]*\]/gi, '')
      .replace(/voice_reset\s*[:\{][^}]*\}?/gi, '')
      .replace(/\[SUBTITLE\s+(?:off|on|target)\s*\]/gi, '')
      .replace(/subtitle\s*:\s*\{[^}]*\}/gi, '')
      .replace(/<ctrl\d+>/gi, '')
      .replace(/\[?MEMORY_LOOKUP[^\]]*\]?/gi, '');

    const emojiPattern = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;
    return cleaned
      .replace(/^["'"]+|["'"]+$/g, '')
      .replace(/\s["'"]+/g, ' ')
      .replace(/["'"]+\s/g, ' ')
      .replace(/["'"]{2,}/g, '')
      .replace(/(?<![a-zA-Z])["'"](?![a-zA-Z])/g, '')
      .replace(emojiPattern, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private buildStylePrompt(request: StreamingSynthesisRequest, resolvedLanguageCode?: string): string {
    const vocalStyle = (request as any).vocalStyle as string | undefined;
    const emotion = (request as any).emotion as string | undefined;
    const personality = (request as any).personality as string | undefined;
    const expressiveness = (request as any).expressiveness as number | undefined;

    const parts: string[] = [];

    parts.push('Read the following text aloud exactly as written. Do not add extra words or commentary.');

    if (vocalStyle) {
      parts.push(`Delivery: ${vocalStyle}.`);
    } else {
      const styleHints: string[] = [];
      if (emotion && emotion !== 'neutral') {
        const EMOTION_TO_STYLE: Record<string, string> = {
          'happy': 'with a bright, cheerful tone',
          'excited': 'with high energy and enthusiasm',
          'friendly': 'in a warm, approachable way',
          'curious': 'with an inquisitive, interested lilt',
          'thoughtful': 'in a reflective, measured pace',
          'warm': 'with genuine warmth',
          'playful': 'with a light, playful spirit',
          'surprised': 'with pleasant surprise',
          'proud': 'with pride and satisfaction',
          'encouraging': 'in a supportive, encouraging way',
          'calm': 'in a calm, steady voice',
        };
        const hint = EMOTION_TO_STYLE[emotion];
        if (hint) styleHints.push(hint);
      }
      if (personality) {
        const PERSONALITY_TO_STYLE: Record<string, string> = {
          'warm': 'like a caring teacher',
          'calm': 'with a soothing, relaxed presence',
          'energetic': 'with lively energy',
          'professional': 'in a clear, polished manner',
        };
        const hint = PERSONALITY_TO_STYLE[personality];
        if (hint) styleHints.push(hint);
      }
      if (styleHints.length > 0) {
        parts.push(`Speak ${styleHints.join(', ')}.`);
      }
    }

    if (resolvedLanguageCode) {
      const LANG_NAMES: Record<string, string> = {
        'en-US': 'American English', 'en-GB': 'British English', 'en-AU': 'Australian English', 'en-IN': 'Indian English',
        'es-US': 'Latin American Spanish', 'es-ES': 'Castilian Spanish', 'es-MX': 'Mexican Spanish', 'es-AR': 'Argentine Spanish', 'es-CO': 'Colombian Spanish',
        'fr-FR': 'French', 'fr-CA': 'Canadian French',
        'de-DE': 'German', 'de-AT': 'Austrian German',
        'it-IT': 'Italian',
        'pt-BR': 'Brazilian Portuguese', 'pt-PT': 'European Portuguese',
        'ja-JP': 'Japanese',
        'zh-CN': 'Mandarin Chinese', 'zh-TW': 'Taiwanese Mandarin',
        'ko-KR': 'Korean',
        'he-IL': 'Hebrew',
      };
      const langName = LANG_NAMES[resolvedLanguageCode];
      if (langName) {
        parts.push(`Accent: ${langName}.`);
      }
    }

    return parts.join(' ');
  }

  private convertS16leToF32le(s16Buffer: Buffer): Buffer {
    const sampleCount = s16Buffer.length / 2;
    const f32Buffer = Buffer.alloc(sampleCount * 4);
    for (let i = 0; i < sampleCount; i++) {
      const s16Value = s16Buffer.readInt16LE(i * 2);
      const f32Value = s16Value / 32768.0;
      f32Buffer.writeFloatLE(f32Value, i * 4);
    }
    return f32Buffer;
  }

  private convertF32leToS16le(f32Buffer: Buffer): Buffer {
    const sampleCount = f32Buffer.length / 4;
    const s16Buffer = Buffer.alloc(sampleCount * 2);
    for (let i = 0; i < sampleCount; i++) {
      const f32Value = f32Buffer.readFloatLE(i * 4);
      const clamped = Math.max(-1, Math.min(1, f32Value));
      s16Buffer.writeInt16LE(Math.round(clamped * 32767), i * 2);
    }
    return s16Buffer;
  }

  async streamSynthesizeProgressive(
    request: StreamingSynthesisRequest,
    callbacks: ProgressiveStreamingCallbacks,
  ): Promise<{ totalDurationMs: number; finalTimestamps: WordTiming[] }> {
    const trimmedText = this.cleanTextForTTS(request.text || '');
    if (trimmedText.length === 0) {
      callbacks.onComplete?.([], 0);
      return { totalDurationMs: 0, finalTimestamps: [] };
    }

    if (!this.client) {
      throw new Error('Gemini Live TTS client not initialized');
    }

    const voiceName = request.voiceId || 'Kore';
    const targetLanguage = (request as any).targetLanguage as string | undefined;
    const geminiLanguageCode = (request as any).geminiLanguageCode as string | undefined
      || (request as any).accentLanguage as string | undefined;
    const resolvedLanguageCode = geminiLanguageCode 
      || (targetLanguage ? DEFAULT_LANGUAGE_CODE[targetLanguage.toLowerCase()] : undefined);

    const SUPPORTED_SPEECH_CONFIG_CODES = new Set([
      'en-US', 'es-US', 'es-ES', 'es-MX', 'fr-FR', 'fr-CA',
      'de-DE', 'it-IT', 'pt-BR', 'pt-PT', 'ja-JP', 'zh-CN', 'zh-TW',
      'ko-KR', 'he-IL',
    ]);
    const BASE_CODE_FALLBACK: Record<string, string> = {
      'en': 'en-US', 'es': 'es-US', 'fr': 'fr-FR', 'de': 'de-DE',
      'it': 'it-IT', 'pt': 'pt-BR', 'ja': 'ja-JP', 'zh': 'zh-CN',
      'ko': 'ko-KR', 'he': 'he-IL',
    };
    const speechConfigCode = resolvedLanguageCode
      ? (SUPPORTED_SPEECH_CONFIG_CODES.has(resolvedLanguageCode)
        ? resolvedLanguageCode
        : BASE_CODE_FALLBACK[resolvedLanguageCode.split('-')[0]] || undefined)
      : undefined;

    const startTime = Date.now();
    const stylePrompt = this.buildStylePrompt(request, resolvedLanguageCode);
    console.log(`[Gemini Live TTS] Progressive: "${trimmedText.substring(0, 60)}..." (${trimmedText.length} chars, voice: ${voiceName}, langCode: ${speechConfigCode || 'auto'} (accent: ${resolvedLanguageCode || 'none'}), style: "${stylePrompt.substring(0, 100)}")`);

    return new Promise((resolve, reject) => {
      let chunkIndex = 0;
      let totalDurationMs = 0;
      let firstChunkTime: number | null = null;
      let liveSession: Session | null = null;
      let completed = false;
      let silenceTimer: ReturnType<typeof setTimeout> | null = null;
      const SILENCE_GAP_MS = 500;

      const timeout = setTimeout(() => {
        if (completed) return;
        completed = true;
        if (silenceTimer) clearTimeout(silenceTimer);
        console.error(`[Gemini Live TTS] Progressive timed out after ${SYNTHESIS_TIMEOUT_MS}ms`);
        voiceDiagnostics.recordTTSResult(false, undefined, 'daniela');
        try { liveSession?.close(); } catch {}
        reject(new Error(`Gemini Live TTS timed out after ${SYNTHESIS_TIMEOUT_MS}ms`));
      }, SYNTHESIS_TIMEOUT_MS);

      const finalize = (reason: string) => {
        if (completed) return;
        completed = true;
        clearTimeout(timeout);
        if (silenceTimer) clearTimeout(silenceTimer);

        const elapsed = Date.now() - startTime;
        const ttfb = firstChunkTime ? firstChunkTime - startTime : null;
        const displayText = request.text || '';
        const finalTimestamps = this.estimateWordTimings(displayText, totalDurationMs / 1000);

        for (let i = 0; i < finalTimestamps.length; i++) {
          callbacks.onWordTimestamp?.(finalTimestamps[i], i, totalDurationMs);
        }
        callbacks.onComplete?.(finalTimestamps, totalDurationMs);

        console.log(`[Gemini Live TTS] Progressive complete (${reason}): ${chunkIndex} chunks, ${Math.round(totalDurationMs)}ms audio, ${elapsed}ms wall, TTFB: ${ttfb ?? 'N/A'}ms`);
        voiceDiagnostics.recordTTSResult(true, elapsed, 'daniela');

        try { liveSession?.close(); } catch {}
        resolve({ totalDurationMs, finalTimestamps });
      };

      const resetSilenceTimer = () => {
        if (silenceTimer) clearTimeout(silenceTimer);
        silenceTimer = setTimeout(() => {
          if (!completed && chunkIndex > 0) {
            finalize('silence-gap');
          }
        }, SILENCE_GAP_MS);
      };

      this.client!.live.connect({
        model: LIVE_MODEL,
        callbacks: {
          onopen: () => {
            console.log(`[Gemini Live TTS] WebSocket connected, sending text...`);
          },
          onmessage: (msg: LiveServerMessage) => {
            if (completed) return;

            if (msg.serverContent?.modelTurn?.parts) {
              for (const part of msg.serverContent.modelTurn.parts) {
                if (part.inlineData?.data) {
                  if (!firstChunkTime) firstChunkTime = Date.now();

                  const rawPcm = Buffer.from(part.inlineData.data, 'base64');
                  const f32Chunk = this.convertS16leToF32le(rawPcm);
                  const chunkDurationMs = (f32Chunk.length / 4 / LIVE_SAMPLE_RATE) * 1000;
                  totalDurationMs += chunkDurationMs;

                  callbacks.onAudioChunk?.({
                    audio: f32Chunk,
                    durationMs: chunkDurationMs,
                    isLast: false,
                    audioFormat: 'pcm_f32le' as any,
                    sampleRate: LIVE_SAMPLE_RATE,
                  }, chunkIndex);
                  chunkIndex++;
                  resetSilenceTimer();
                }
              }
            }

            if (msg.serverContent?.turnComplete) {
              finalize('turn-complete');
            }
          },
          onerror: (e: ErrorEvent) => {
            if (completed) return;
            completed = true;
            clearTimeout(timeout);
            if (silenceTimer) clearTimeout(silenceTimer);
            console.error(`[Gemini Live TTS] Progressive error:`, e.message || e);
            voiceDiagnostics.recordTTSResult(false, undefined, 'daniela');
            try { liveSession?.close(); } catch {}
            reject(new Error(`Gemini Live TTS error: ${e.message || 'unknown'}`));
          },
          onclose: () => {
            if (!completed) {
              finalize('ws-close');
            }
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: stylePrompt,
          speechConfig: {
            ...(speechConfigCode ? { languageCode: speechConfigCode } : {}),
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
      }).then((session) => {
        liveSession = session;
        try {
          session.sendClientContent({
            turns: [{ role: 'user', parts: [{ text: trimmedText }] }],
            turnComplete: true,
          });
          console.log(`[Gemini Live TTS] Sent to Live API (${trimmedText.length} chars)`);
        } catch (sendErr: any) {
          if (completed) return;
          completed = true;
          clearTimeout(timeout);
          reject(new Error(`Failed to send to Gemini Live: ${sendErr.message}`));
        }
      }).catch((connectErr: any) => {
        if (completed) return;
        completed = true;
        clearTimeout(timeout);
        console.error(`[Gemini Live TTS] Connection failed:`, connectErr.message);
        reject(new Error(`Failed to connect Gemini Live: ${connectErr.message}`));
      });
    });
  }

  async *streamSynthesize(request: StreamingSynthesisRequest): AsyncGenerator<StreamingAudioChunk> {
    const trimmedText = this.cleanTextForTTS(request.text || '');
    if (trimmedText.length === 0) {
      yield { audio: Buffer.alloc(0), durationMs: 0, isLast: true };
      return;
    }

    const voiceName = request.voiceId || 'Kore';
    console.log(`[Gemini Live TTS] streamSynthesize: "${trimmedText.substring(0, 50)}..." (voice: ${voiceName})`);
    const startTime = Date.now();

    const allChunks: StreamingAudioChunk[] = [];

    try {
      await this.streamSynthesizeProgressive(request, {
        onAudioChunk: (chunk, idx) => {
          allChunks.push(chunk);
        },
        onComplete: () => {},
      });

      for (const chunk of allChunks) {
        yield chunk;
      }

      yield { audio: Buffer.alloc(0), durationMs: 0, isLast: true, audioFormat: 'pcm_f32le' as any, sampleRate: LIVE_SAMPLE_RATE };

      const elapsed = Date.now() - startTime;
      console.log(`[Gemini Live TTS] streamSynthesize complete in ${elapsed}ms`);
    } catch (error: any) {
      console.error('[Gemini Live TTS] streamSynthesize error:', error.message);
      throw error;
    }
  }

  async synthesizeToBuffer(text: string, voiceName: string, languageHint?: string, accentLanguage?: string): Promise<Buffer> {
    const trimmedText = this.cleanTextForTTS(text);
    if (!trimmedText) return Buffer.alloc(0);

    console.log(`[Gemini Live TTS] synthesizeToBuffer: "${trimmedText.substring(0, 50)}..." voice=${voiceName} lang=${languageHint || 'auto'} accent=${accentLanguage || 'none'}`);

    const allChunks: Buffer[] = [];
    await this.streamSynthesizeProgressive(
      { text, voiceId: voiceName, languageHint, accentLanguage } as StreamingSynthesisRequest & { languageHint?: string; accentLanguage?: string },
      {
        onAudioChunk: (chunk) => { allChunks.push(chunk.audio); },
        onComplete: () => {},
      },
    );

    const totalF32 = Buffer.concat(allChunks);
    const s16Buffer = this.convertF32leToS16le(totalF32);
    const wavHeader = this.createWavHeader(s16Buffer.length, LIVE_SAMPLE_RATE, 1, 16);
    return Buffer.concat([wavHeader, s16Buffer]);
  }

  private createWavHeader(dataSize: number, sampleRate: number, channels: number, bitsPerSample: number): Buffer {
    const header = Buffer.alloc(44);
    const byteRate = sampleRate * channels * (bitsPerSample / 8);
    const blockAlign = channels * (bitsPerSample / 8);
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + dataSize, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(channels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitsPerSample, 34);
    header.write('data', 36);
    header.writeUInt32LE(dataSize, 40);
    return header;
  }

  private estimateWordTimings(text: string, durationSeconds: number): WordTiming[] {
    const cleanedText = text
      .replace(/\[laughter\]/gi, ' ')
      .replace(/<[^>]+>/g, '')
      .replace(/\[[^\]]+\]/g, '');

    const words = cleanedText.split(/\s+/).filter(w => w.length > 0);
    if (words.length === 0) return [];

    const wordWeights = words.map(word => {
      let weight = Math.max(1, word.length);
      if (/[.!?]$/.test(word)) weight += 2;
      else if (/[,;:]$/.test(word)) weight += 1;
      return weight;
    });

    const totalWeight = wordWeights.reduce((sum, w) => sum + w, 0);
    const timings: WordTiming[] = [];
    let currentTime = 0.1;
    const speakingDuration = Math.max(0.1, durationSeconds - 0.2);

    for (let i = 0; i < words.length; i++) {
      const wordDuration = (wordWeights[i] / totalWeight) * speakingDuration;
      timings.push({
        word: words[i],
        startTime: currentTime,
        endTime: currentTime + Math.max(0.1, wordDuration),
      });
      currentTime += Math.max(0.1, wordDuration);
    }

    return timings;
  }
}

let service: GeminiLiveTtsService | null = null;

export function getGeminiLiveTtsService(): GeminiLiveTtsService {
  if (!service) {
    service = new GeminiLiveTtsService();
  }
  return service;
}

export { GEMINI_LIVE_VOICES };
