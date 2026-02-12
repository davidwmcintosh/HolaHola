import { EventEmitter } from 'events';
import { GoogleGenAI } from '@google/genai';
import {
  WordTiming,
} from '@shared/streaming-voice-types';
import {
  stripWhiteboardMarkup,
} from '@shared/whiteboard-types';
import { voiceDiagnostics } from './voice-diagnostics-service';

import type {
  StreamingSynthesisRequest,
  StreamingAudioChunk,
  ProgressiveStreamingCallbacks,
} from './cartesia-streaming';

const GEMINI_TTS_VOICES: { name: string; gender: 'male' | 'female' }[] = [
  { name: 'Kore', gender: 'female' },
  { name: 'Puck', gender: 'male' },
  { name: 'Charon', gender: 'male' },
  { name: 'Aoede', gender: 'female' },
  { name: 'Algieba', gender: 'male' },
  { name: 'Alnilam', gender: 'male' },
  { name: 'Autonoe', gender: 'female' },
  { name: 'Callirhoe', gender: 'female' },
  { name: 'Despina', gender: 'female' },
  { name: 'Enceladus', gender: 'male' },
  { name: 'Erinome', gender: 'female' },
  { name: 'Fenrir', gender: 'male' },
  { name: 'Gacrux', gender: 'male' },
  { name: 'Iapetus', gender: 'male' },
  { name: 'Laomedeia', gender: 'female' },
  { name: 'Leda', gender: 'female' },
  { name: 'Orus', gender: 'male' },
  { name: 'Pulcherrima', gender: 'female' },
  { name: 'Rasalgethi', gender: 'male' },
  { name: 'Sadachbia', gender: 'male' },
  { name: 'Achernar', gender: 'female' },
  { name: 'Achird', gender: 'female' },
  { name: 'Algenib', gender: 'male' },
];

export class GeminiTtsStreamingService extends EventEmitter {
  private client: GoogleGenAI | null = null;
  private model: string;

  constructor() {
    super();
    this.model = process.env.GEMINI_TTS_MODEL || 'gemini-2.5-flash-preview-tts';
    const apiKey = process.env.GEMINI_API_KEY || '';
    if (apiKey) {
      this.client = new GoogleGenAI({ apiKey });
      console.log(`[Gemini TTS] Initialized (model: ${this.model})`);
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

  async ensureConnection(): Promise<number> {
    return 0;
  }

  async connect(): Promise<void> {}
  disconnect(): void {}

  consumeNativeTimestamps(): WordTiming[] {
    return [];
  }

  getVoices(gender?: 'male' | 'female'): { name: string; gender: 'male' | 'female' }[] {
    if (gender) {
      return GEMINI_TTS_VOICES.filter(v => v.gender === gender);
    }
    return GEMINI_TTS_VOICES;
  }

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

  private parseSampleRateFromMimeType(mimeType: string): number {
    const rateMatch = mimeType.match(/rate=(\d+)/);
    if (rateMatch) return parseInt(rateMatch[1], 10);
    return 24000;
  }

  private async generateAudio(
    text: string,
    voiceName: string,
  ): Promise<{ pcmBuffer: Buffer; sampleRate: number }> {
    if (!this.client) {
      throw new Error('Gemini TTS client not initialized');
    }

    const response = await this.client.models.generateContent({
      model: this.model,
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName,
            },
          },
        },
      },
    });

    const inlineData = (response as any).candidates?.[0]?.content?.parts?.[0]?.inlineData;
    if (!inlineData?.data) {
      throw new Error('No audio data in Gemini TTS response');
    }

    const mimeType = inlineData.mimeType || 'unknown';
    const sampleRate = this.parseSampleRateFromMimeType(mimeType);
    console.log(`[Gemini TTS] Response mimeType: ${mimeType}, sampleRate: ${sampleRate}, data length: ${inlineData.data.length} chars (base64)`);

    const rawBuffer = Buffer.from(inlineData.data, 'base64');

    if (mimeType.includes('wav') || (rawBuffer.length > 44 && rawBuffer.toString('ascii', 0, 4) === 'RIFF')) {
      console.log(`[Gemini TTS] WAV container detected - stripping 44-byte header`);
      return { pcmBuffer: rawBuffer.subarray(44), sampleRate };
    }

    return { pcmBuffer: rawBuffer, sampleRate };
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

  async *streamSynthesize(request: StreamingSynthesisRequest): AsyncGenerator<StreamingAudioChunk> {
    if (!this.client) {
      throw new Error('Gemini TTS client not initialized');
    }

    const trimmedText = this.cleanTextForTTS(request.text || '');
    if (trimmedText.length === 0) {
      yield { audio: Buffer.alloc(0), durationMs: 0, isLast: true };
      return;
    }

    const voiceName = request.voiceId || 'Kore';
    console.log(`[Gemini TTS] Synthesizing: "${trimmedText.substring(0, 50)}..." (${trimmedText.length} chars, voice: ${voiceName})`);

    const startTime = Date.now();

    try {
      const { pcmBuffer: pcmS16Buffer, sampleRate } = await this.generateAudio(trimmedText, voiceName);
      const pcmF32Buffer = this.convertS16leToF32le(pcmS16Buffer);

      const firstChunkTime = Date.now();
      console.log(`[Gemini TTS] TTFB: ${firstChunkTime - startTime}ms`);

      const CHUNK_SIZE = 96000;
      let offset = 0;

      while (offset < pcmF32Buffer.length) {
        const end = Math.min(offset + CHUNK_SIZE, pcmF32Buffer.length);
        const chunk = pcmF32Buffer.subarray(offset, end);
        const durationMs = (chunk.length / 4 / sampleRate) * 1000;

        yield {
          audio: Buffer.from(chunk),
          durationMs,
          isLast: false,
          audioFormat: 'pcm_f32le' as any,
          sampleRate,
        };

        offset = end;
      }

      yield {
        audio: Buffer.alloc(0),
        durationMs: 0,
        isLast: true,
        audioFormat: 'pcm_f32le' as any,
        sampleRate,
      };

      const elapsed = Date.now() - startTime;
      const durationMs = (pcmS16Buffer.length / 2 / sampleRate) * 1000;
      console.log(`[Gemini TTS] Complete: ${pcmS16Buffer.length} bytes s16 -> ${pcmF32Buffer.length} bytes f32 in ${elapsed}ms (audio: ${Math.round(durationMs)}ms, rate: ${sampleRate})`);
      voiceDiagnostics.recordTTSResult(true, elapsed, 'daniela');
    } catch (error: any) {
      console.error('[Gemini TTS] Error:', error.message);
      voiceDiagnostics.recordTTSResult(false, undefined, 'daniela');
      throw error;
    }
  }

  async streamSynthesizeProgressive(
    request: StreamingSynthesisRequest,
    callbacks: ProgressiveStreamingCallbacks
  ): Promise<{ totalDurationMs: number; finalTimestamps: WordTiming[] }> {
    let chunkIndex = 0;
    let totalDurationMs = 0;

    console.log(`[Gemini TTS Progressive] Starting for: "${request.text.substring(0, 50)}..."`);

    for await (const chunk of this.streamSynthesize(request)) {
      if (chunk.audio.length > 0) {
        totalDurationMs += chunk.durationMs;
        callbacks.onAudioChunk?.(chunk, chunkIndex);
        chunkIndex++;
      }

      if (chunk.isLast) break;
    }

    const displayText = request.text || '';
    const finalTimestamps = this.estimateWordTimings(displayText, totalDurationMs / 1000);

    for (let i = 0; i < finalTimestamps.length; i++) {
      callbacks.onWordTimestamp?.(finalTimestamps[i], i, totalDurationMs);
    }

    callbacks.onComplete?.(finalTimestamps, totalDurationMs);

    return { totalDurationMs, finalTimestamps };
  }

  async synthesizeToBuffer(
    text: string,
    voiceName: string,
  ): Promise<Buffer> {
    if (!this.client) {
      throw new Error('Gemini TTS client not initialized');
    }

    const cleanedText = this.cleanTextForTTS(text);
    if (!cleanedText || cleanedText.length === 0) {
      return Buffer.alloc(0);
    }

    console.log(`[Gemini TTS] synthesizeToBuffer: "${cleanedText.substring(0, 50)}..." voice=${voiceName}`);

    const { pcmBuffer, sampleRate } = await this.generateAudio(cleanedText, voiceName);

    const wavHeader = this.createWavHeader(pcmBuffer.length, sampleRate, 1, 16);
    return Buffer.concat([wavHeader, pcmBuffer]);
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
      const actualDuration = Math.max(0.1, wordDuration);

      timings.push({
        word: words[i],
        startTime: currentTime,
        endTime: currentTime + actualDuration,
      });

      currentTime += actualDuration;
    }

    return timings;
  }
}

let streamingService: GeminiTtsStreamingService | null = null;

export function getGeminiTtsStreamingService(): GeminiTtsStreamingService {
  if (!streamingService) {
    streamingService = new GeminiTtsStreamingService();
  }
  return streamingService;
}

export { GEMINI_TTS_VOICES };
