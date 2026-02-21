import type { StreamingSynthesisRequest, ProgressiveStreamingCallbacks, WordTiming } from './cartesia-streaming';

export type TTSProviderName = 'gemini' | 'cartesia' | 'elevenlabs' | 'google';

export interface TTSStreamingProvider {
  readonly name: TTSProviderName;
  readonly requiresBatchMode: boolean;
  readonly supportsNativeTimestamps: boolean;
  readonly supportsCartesiaSSML: boolean;
  streamSynthesizeProgressive(
    request: StreamingSynthesisRequest,
    callbacks: ProgressiveStreamingCallbacks,
  ): Promise<{ totalDurationMs: number; finalTimestamps: WordTiming[] }>;
}

export function resolveSessionTTSProvider(
  sessionProvider: TTSProviderName | undefined,
  fallbackProvider: TTSProviderName,
): TTSProviderName {
  return sessionProvider || fallbackProvider;
}

class CartesiaTTSAdapter implements TTSStreamingProvider {
  readonly name: TTSProviderName = 'cartesia';
  readonly requiresBatchMode = false;
  readonly supportsNativeTimestamps = true;
  readonly supportsCartesiaSSML = true;
  private service: any;

  constructor(service: any) {
    this.service = service;
  }

  async streamSynthesizeProgressive(
    request: StreamingSynthesisRequest,
    callbacks: ProgressiveStreamingCallbacks,
  ) {
    return this.service.streamSynthesizeProgressive(request, callbacks);
  }
}

class ElevenLabsTTSAdapter implements TTSStreamingProvider {
  readonly name: TTSProviderName = 'elevenlabs';
  readonly requiresBatchMode = false;
  readonly supportsNativeTimestamps = false;
  readonly supportsCartesiaSSML = false;
  private service: any;

  constructor(service: any) {
    this.service = service;
  }

  async streamSynthesizeProgressive(
    request: StreamingSynthesisRequest,
    callbacks: ProgressiveStreamingCallbacks,
  ) {
    return this.service.streamSynthesizeProgressive(request, callbacks);
  }
}

class GeminiLiveTTSAdapter implements TTSStreamingProvider {
  readonly name: TTSProviderName = 'gemini';
  readonly requiresBatchMode = false;
  readonly supportsNativeTimestamps = false;
  readonly supportsCartesiaSSML = false;
  private service: any;

  constructor(service: any) {
    this.service = service;
  }

  async streamSynthesizeProgressive(
    request: StreamingSynthesisRequest,
    callbacks: ProgressiveStreamingCallbacks,
  ) {
    return this.service.streamSynthesizeProgressive(request, callbacks);
  }
}

function estimateWordTimingsForGoogle(text: string, durationSeconds: number): WordTiming[] {
  const cleanedText = text.replace(/\[laughter\]/gi, ' ');
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

class GoogleTTSAdapter implements TTSStreamingProvider {
  readonly name: TTSProviderName = 'google';
  readonly requiresBatchMode = true;
  readonly supportsNativeTimestamps = false;
  readonly supportsCartesiaSSML = false;
  private ttsServiceGetter: () => any;

  constructor(ttsServiceGetter: () => any) {
    this.ttsServiceGetter = ttsServiceGetter;
  }

  async streamSynthesizeProgressive(
    request: StreamingSynthesisRequest,
    callbacks: ProgressiveStreamingCallbacks,
  ): Promise<{ totalDurationMs: number; finalTimestamps: WordTiming[] }> {
    const ttsService = this.ttsServiceGetter();
    const speakingRate = request.speakingRate || 1.0;
    const text = request.text || '';
    const wordsPerMinute = 150;
    const wordCount = text.split(/\s+/).length;
    const estimatedDurationMs = Math.max(1000, (wordCount / wordsPerMinute) * 60000 / speakingRate);
    let streamChunkIdx = 0;

    return new Promise<{ totalDurationMs: number; finalTimestamps: WordTiming[] }>((resolve, reject) => {
      ttsService.streamSynthesizeWithGoogle({
        text,
        voiceId: request.voiceId || '',
        speakingRate,
        targetLanguage: request.targetLanguage,
        accentLanguageCode: (request as any).geminiLanguageCode || undefined,
        onAudioChunk: (audioChunk: any) => {
          callbacks.onAudioChunk?.({
            audio: audioChunk.audio,
            durationMs: audioChunk.durationMs,
            audioFormat: audioChunk.audioFormat || 'pcm_f32le',
            isLast: false,
          }, streamChunkIdx++);

          if (streamChunkIdx === 1) {
            const estimatedTimings = estimateWordTimingsForGoogle(text, estimatedDurationMs / 1000);
            for (let wi = 0; wi < estimatedTimings.length; wi++) {
              callbacks.onWordTimestamp?.(estimatedTimings[wi], wi, estimatedDurationMs);
            }
          }
        },
        onComplete: (totalBytes: number) => {
          const actualDurationMs = totalBytes > 0
            ? (totalBytes / 2 / 24000) * 1000
            : estimatedDurationMs;
          const timingDurationMs = actualDurationMs > 0 ? actualDurationMs : estimatedDurationMs;
          const finalTimings = estimateWordTimingsForGoogle(text, timingDurationMs / 1000);
          callbacks.onComplete?.(finalTimings, timingDurationMs);
          resolve({ totalDurationMs: timingDurationMs, finalTimestamps: finalTimings });
        },
        onError: (err: Error) => {
          reject(err);
        },
      }).catch(reject);
    });
  }
}

export class TTSProviderRegistry {
  private adapters: Map<TTSProviderName, TTSStreamingProvider> = new Map();

  register(adapter: TTSStreamingProvider): void {
    this.adapters.set(adapter.name, adapter);
  }

  get(name: TTSProviderName): TTSStreamingProvider | undefined {
    return this.adapters.get(name);
  }

  getOrThrow(name: TTSProviderName): TTSStreamingProvider {
    const adapter = this.adapters.get(name);
    if (!adapter) {
      throw new Error(`TTS provider '${name}' not registered. Available: ${[...this.adapters.keys()].join(', ')}`);
    }
    return adapter;
  }

  getAll(): TTSStreamingProvider[] {
    return [...this.adapters.values()];
  }
}

let registryInstance: TTSProviderRegistry | null = null;

export function createTTSProviderRegistry(services: {
  cartesiaService: any;
  elevenlabsService: any;
  geminiLiveTtsService: any;
  getTTSService: () => any;
}): TTSProviderRegistry {
  const registry = new TTSProviderRegistry();
  registry.register(new CartesiaTTSAdapter(services.cartesiaService));
  registry.register(new ElevenLabsTTSAdapter(services.elevenlabsService));
  registry.register(new GeminiLiveTTSAdapter(services.geminiLiveTtsService));
  registry.register(new GoogleTTSAdapter(services.getTTSService));
  registryInstance = registry;
  return registry;
}

export function getTTSProviderRegistry(): TTSProviderRegistry | null {
  return registryInstance;
}
