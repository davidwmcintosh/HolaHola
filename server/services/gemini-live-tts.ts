import { EventEmitter } from 'events';
import { GoogleGenAI, Modality } from '@google/genai';
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

const TTS_MODEL = 'gemini-2.5-flash-preview-tts';
const TTS_SAMPLE_RATE = 24000;
const CHUNK_SIZE_SAMPLES = 2400;

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
      console.log(`[Gemini TTS] Initialized (model: ${TTS_MODEL} via generateContent)`);
    } else {
      console.warn('[Gemini TTS] No API key configured');
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

    const hints: string[] = [];

    if (vocalStyle) {
      hints.push(vocalStyle);
    } else if (emotion && emotion !== 'neutral') {
      const EMOTION_MAP: Record<string, string> = {
        'happy': 'cheerfully', 'excited': 'with excitement', 'friendly': 'warmly',
        'curious': 'with curiosity', 'thoughtful': 'thoughtfully', 'warm': 'warmly',
        'playful': 'playfully', 'surprised': 'with surprise', 'proud': 'proudly',
        'encouraging': 'encouragingly', 'calm': 'calmly',
      };
      if (EMOTION_MAP[emotion]) hints.push(EMOTION_MAP[emotion]);
    }

    if (hints.length > 0) {
      return `Say ${hints.join(', ')}:`;
    }
    return '';
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

  private trimLeadingSilence(f32Buffer: Buffer, threshold = 0.005): Buffer {
    const sampleCount = f32Buffer.length / 4;
    let firstVoiceSample = 0;
    for (let i = 0; i < sampleCount; i++) {
      if (Math.abs(f32Buffer.readFloatLE(i * 4)) > threshold) {
        firstVoiceSample = Math.max(0, i - 240);
        break;
      }
    }
    if (firstVoiceSample === 0) return f32Buffer;
    return f32Buffer.subarray(firstVoiceSample * 4);
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
      throw new Error('Gemini TTS client not initialized');
    }

    const voiceName = request.voiceId || 'Kore';
    const targetLanguage = (request as any).targetLanguage as string | undefined;
    const geminiLanguageCode = (request as any).geminiLanguageCode as string | undefined
      || (request as any).accentLanguage as string | undefined;
    const resolvedLanguageCode = geminiLanguageCode 
      || (targetLanguage ? DEFAULT_LANGUAGE_CODE[targetLanguage.toLowerCase()] : undefined);

    const startTime = Date.now();
    const stylePrompt = this.buildStylePrompt(request, resolvedLanguageCode);

    const ttsPrompt = stylePrompt ? `${stylePrompt} ${trimmedText}` : trimmedText;

    console.log(`[Gemini TTS] Progressive: "${trimmedText.substring(0, 60)}..." (${trimmedText.length} chars, voice: ${voiceName}, langCode: ${resolvedLanguageCode || 'none'}, targetLang: ${targetLanguage || 'unset'})`);
    if (stylePrompt) console.log(`[Gemini TTS] Style: "${stylePrompt}"`);

    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Gemini TTS timed out after ${SYNTHESIS_TIMEOUT_MS}ms`)), SYNTHESIS_TIMEOUT_MS);
      });

      const speechConfig: any = {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName },
        },
      };
      if (resolvedLanguageCode) {
        speechConfig.languageCode = resolvedLanguageCode;
      }

      const response = await Promise.race([
        this.client.models.generateContent({
          model: TTS_MODEL,
          contents: [{ parts: [{ text: ttsPrompt }] }],
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig,
          },
        }),
        timeoutPromise,
      ]);

      const generationTime = Date.now() - startTime;

      const audioPart = response.candidates?.[0]?.content?.parts?.[0];
      if (!audioPart?.inlineData?.data) {
        console.error(`[Gemini TTS] No audio data in response`);
        voiceDiagnostics.recordTTSResult(false, undefined, 'daniela');
        throw new Error('Gemini TTS returned no audio data');
      }

      const rawPcmS16 = Buffer.from(audioPart.inlineData.data, 'base64');
      const rawF32 = this.convertS16leToF32le(rawPcmS16);

      const fullF32 = this.trimLeadingSilence(rawF32);
      const trimmedSamples = (rawF32.length - fullF32.length) / 4;
      const totalSamples = fullF32.length / 4;
      const totalDurationMs = (totalSamples / TTS_SAMPLE_RATE) * 1000;

      console.log(`[Gemini TTS] Generated ${Math.round(totalDurationMs)}ms audio in ${generationTime}ms (${rawPcmS16.length} bytes s16, trimmed ${trimmedSamples} silent samples)`);

      const bytesPerChunk = CHUNK_SIZE_SAMPLES * 4;
      let offset = 0;
      let chunkIndex = 0;

      while (offset < fullF32.length) {
        const end = Math.min(offset + bytesPerChunk, fullF32.length);
        const chunkBuf = fullF32.subarray(offset, end);
        const chunkDurationMs = ((end - offset) / 4 / TTS_SAMPLE_RATE) * 1000;

        callbacks.onAudioChunk?.({
          audio: Buffer.from(chunkBuf),
          durationMs: chunkDurationMs,
          isLast: false,
          audioFormat: 'pcm_f32le' as any,
          sampleRate: TTS_SAMPLE_RATE,
        }, chunkIndex);

        chunkIndex++;
        offset = end;
      }

      const displayText = request.text || '';
      const finalTimestamps = this.estimateWordTimings(displayText, totalDurationMs / 1000);

      for (let i = 0; i < finalTimestamps.length; i++) {
        callbacks.onWordTimestamp?.(finalTimestamps[i], i, totalDurationMs);
      }
      callbacks.onComplete?.(finalTimestamps, totalDurationMs);

      const elapsed = Date.now() - startTime;
      console.log(`[Gemini TTS] Progressive complete: ${chunkIndex} chunks, ${Math.round(totalDurationMs)}ms audio, ${elapsed}ms wall (generation: ${generationTime}ms)`);
      voiceDiagnostics.recordTTSResult(true, elapsed, 'daniela');

      return { totalDurationMs, finalTimestamps };
    } catch (error: any) {
      const elapsed = Date.now() - startTime;
      console.error(`[Gemini TTS] Error after ${elapsed}ms:`, error.message);
      voiceDiagnostics.recordTTSResult(false, undefined, 'daniela');
      throw error;
    }
  }

  async *streamSynthesize(request: StreamingSynthesisRequest): AsyncGenerator<StreamingAudioChunk> {
    const trimmedText = this.cleanTextForTTS(request.text || '');
    if (trimmedText.length === 0) {
      yield { audio: Buffer.alloc(0), durationMs: 0, isLast: true };
      return;
    }

    const voiceName = request.voiceId || 'Kore';
    console.log(`[Gemini TTS] streamSynthesize: "${trimmedText.substring(0, 50)}..." (voice: ${voiceName})`);
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

      yield { audio: Buffer.alloc(0), durationMs: 0, isLast: true, audioFormat: 'pcm_f32le' as any, sampleRate: TTS_SAMPLE_RATE };

      const elapsed = Date.now() - startTime;
      console.log(`[Gemini TTS] streamSynthesize complete in ${elapsed}ms`);
    } catch (error: any) {
      console.error('[Gemini TTS] streamSynthesize error:', error.message);
      throw error;
    }
  }

  async synthesizeToBuffer(text: string, voiceName: string, languageHint?: string, accentLanguage?: string, nativeLanguage?: string): Promise<Buffer> {
    const trimmedText = this.cleanTextForTTS(text);
    if (!trimmedText) return Buffer.alloc(0);

    console.log(`[Gemini TTS] synthesizeToBuffer: "${trimmedText.substring(0, 50)}..." voice=${voiceName} lang=${languageHint || 'auto'} accent=${accentLanguage || 'none'} native=${nativeLanguage || 'english'}`);

    const allChunks: Buffer[] = [];
    await this.streamSynthesizeProgressive(
      { text, voiceId: voiceName, languageHint, accentLanguage, nativeLanguage: nativeLanguage || 'english' } as StreamingSynthesisRequest & { languageHint?: string; accentLanguage?: string; nativeLanguage?: string },
      {
        onAudioChunk: (chunk) => { allChunks.push(chunk.audio); },
        onComplete: () => {},
      },
    );

    const totalF32 = Buffer.concat(allChunks);
    const s16Buffer = this.convertF32leToS16le(totalF32);
    const wavHeader = this.createWavHeader(s16Buffer.length, TTS_SAMPLE_RATE, 1, 16);
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
