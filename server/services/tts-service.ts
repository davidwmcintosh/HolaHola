import { TextToSpeechClient, protos } from '@google-cloud/text-to-speech';
import OpenAI from 'openai';

/**
 * TTS Provider Interface
 */
export type TTSProvider = 'openai' | 'google';

/**
 * Common TTS Request Interface
 */
export interface TTSRequest {
  text: string;
  language?: string;
  voice?: string;
}

/**
 * Common TTS Response Interface
 */
export interface TTSResponse {
  audioBuffer: Buffer;
  contentType: string;
}

/**
 * Google Cloud WaveNet Voice Mapping
 * Maps language codes to optimal neural voices with regional variants
 * 
 * WaveNet voices provide:
 * - Native pronunciation (no American accent artifacts)
 * - SSML support for fine-grained control
 * - Regional dialect variations
 * - Natural prosody and intonation
 */
const GOOGLE_VOICE_MAP: Record<string, { name: string; languageCode: string }> = {
  'spanish': { name: 'es-ES-Neural2-A', languageCode: 'es-ES' }, // Castilian Spanish, female
  'english': { name: 'en-US-Neural2-A', languageCode: 'en-US' }, // US English, female
  'french': { name: 'fr-FR-Neural2-A', languageCode: 'fr-FR' }, // French, female
  'german': { name: 'de-DE-Neural2-A', languageCode: 'de-DE' }, // German, female
  'italian': { name: 'it-IT-Neural2-A', languageCode: 'it-IT' }, // Italian, female
  'portuguese': { name: 'pt-BR-Neural2-A', languageCode: 'pt-BR' }, // Brazilian Portuguese, female
  'japanese': { name: 'ja-JP-Neural2-B', languageCode: 'ja-JP' }, // Japanese, female
  'mandarin chinese': { name: 'cmn-CN-Wavenet-A', languageCode: 'cmn-CN' }, // Mandarin, female
  'korean': { name: 'ko-KR-Neural2-A', languageCode: 'ko-KR' }, // Korean, female
};

/**
 * TTS Service - Abstraction layer supporting multiple TTS providers
 * 
 * Supports:
 * - OpenAI TTS (tts-1, tts-1-hd) - Fast but limited control
 * - Google Cloud WaveNet - Authentic pronunciation, SSML support
 */
export class TTSService {
  private googleClient: TextToSpeechClient | null = null;
  private openaiClient: OpenAI | null = null;
  private provider: TTSProvider;

  constructor(provider: TTSProvider = 'google') {
    this.provider = provider;

    // Initialize Google Cloud TTS client if credentials are available
    if (process.env.GOOGLE_CLOUD_TTS_CREDENTIALS) {
      try {
        const credentials = JSON.parse(process.env.GOOGLE_CLOUD_TTS_CREDENTIALS);
        this.googleClient = new TextToSpeechClient({
          credentials,
        });
        console.log('[TTS Service] ✓ Google Cloud WaveNet initialized');
      } catch (error) {
        console.error('[TTS Service] Failed to initialize Google Cloud TTS:', error);
        // Fall back to OpenAI if Google credentials are invalid
        this.provider = 'openai';
      }
    } else {
      console.warn('[TTS Service] GOOGLE_CLOUD_TTS_CREDENTIALS not found, falling back to OpenAI TTS');
      this.provider = 'openai';
    }

    // Initialize OpenAI client for fallback (only if API key is available)
    if (process.env.USER_OPENAI_API_KEY) {
      this.openaiClient = new OpenAI({
        apiKey: process.env.USER_OPENAI_API_KEY,
        baseURL: 'https://api.openai.com/v1',
      });
      console.log('[TTS Service] ✓ OpenAI TTS fallback initialized');
    } else {
      console.warn('[TTS Service] USER_OPENAI_API_KEY not found, OpenAI TTS fallback unavailable');
      // If neither provider is available, this is a configuration error
      if (!this.googleClient) {
        console.error('[TTS Service] ⚠️  No TTS provider available! Set either GOOGLE_CLOUD_TTS_CREDENTIALS or USER_OPENAI_API_KEY');
      }
    }
  }

  /**
   * Synthesize speech from text using the configured provider with automatic fallback
   */
  async synthesize(request: TTSRequest): Promise<TTSResponse> {
    const { text, language, voice } = request;

    // Try Google WaveNet first (if available)
    if (this.provider === 'google' && this.googleClient) {
      try {
        return await this.synthesizeWithGoogle(text, language);
      } catch (error: any) {
        // Enhanced error logging with actionable diagnostics
        console.error('┌─────────────────────────────────────────────────────────────┐');
        console.error('│ ⚠️  GOOGLE CLOUD TTS FAILED - FALLING BACK TO OPENAI TTS   │');
        console.error('└─────────────────────────────────────────────────────────────┘');
        console.error(`Error: ${error.message}`);
        
        if (error.code === 7 || error.message?.includes('PERMISSION_DENIED')) {
          console.error('\n📋 SETUP REQUIRED:');
          console.error('1. Enable Google Cloud Text-to-Speech API:');
          console.error('   https://console.cloud.google.com/apis/library/texttospeech.googleapis.com');
          console.error('2. Ensure service account has roles/texttospeech.user permission');
          console.error('3. Restart the application after enabling');
          console.error('\n⚠️  Impact: Using OpenAI TTS with American accent instead of native WaveNet pronunciation');
        }
        
        // Attempt fallback to OpenAI if available
        if (this.openaiClient) {
          console.warn('[TTS Service] → Switching to OpenAI TTS fallback...');
          try {
            const result = await this.synthesizeWithOpenAI(text, voice);
            console.log('[TTS Service] ✓ Fallback to OpenAI TTS succeeded');
            console.warn('[TTS Service] ⚠️  WARNING: Voice quality degraded - using OpenAI instead of authentic WaveNet pronunciation');
            return result; // SUCCESS: Return the fallback result
          } catch (fallbackError: any) {
            console.error('[TTS Service] OpenAI TTS fallback also failed:', fallbackError.message);
            throw new Error(`All TTS providers failed. Google: ${error.message}, OpenAI: ${fallbackError.message}`);
          }
        }
        
        // No fallback available, re-throw original error
        throw new Error(`Google TTS failed and no fallback available: ${error.message}`);
      }
    }

    // Direct OpenAI TTS (when Google is not the primary provider)
    return await this.synthesizeWithOpenAI(text, voice);
  }

  /**
   * Synthesize speech using Google Cloud WaveNet
   * Provides authentic native pronunciation with SSML support
   */
  private async synthesizeWithGoogle(text: string, language?: string): Promise<TTSResponse> {
    if (!this.googleClient) {
      throw new Error('Google Cloud TTS client not initialized');
    }

    // Determine voice based on target language
    const normalizedLanguage = language?.toLowerCase().trim() || 'english';
    const voiceConfig = GOOGLE_VOICE_MAP[normalizedLanguage] || GOOGLE_VOICE_MAP['english'];

    console.log(`[Google WaveNet] Synthesizing ${text.length} chars in ${normalizedLanguage} with voice ${voiceConfig.name}`);

    // Prepare the synthesis request
    const googleRequest: protos.google.cloud.texttospeech.v1.ISynthesizeSpeechRequest = {
      input: { text },
      voice: {
        languageCode: voiceConfig.languageCode,
        name: voiceConfig.name,
      },
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: 0.9, // Slightly slower for language learning
        pitch: 0,
        volumeGainDb: 0,
      },
    };

    // Call Google Cloud TTS API
    const [response] = await this.googleClient.synthesizeSpeech(googleRequest);

    if (!response.audioContent) {
      throw new Error('Google TTS returned no audio content');
    }

    const audioBuffer = Buffer.from(response.audioContent as Uint8Array);
    console.log(`[Google WaveNet] ✓ Generated ${audioBuffer.length} bytes`);

    return {
      audioBuffer,
      contentType: 'audio/mpeg',
    };
  }

  /**
   * Synthesize speech using OpenAI TTS (fallback)
   */
  private async synthesizeWithOpenAI(text: string, voice?: string): Promise<TTSResponse> {
    if (!this.openaiClient) {
      throw new Error('OpenAI TTS is not available. Please set USER_OPENAI_API_KEY or GOOGLE_CLOUD_TTS_CREDENTIALS.');
    }

    const selectedVoice = voice || 'nova'; // nova has better multilingual support

    console.log(`[OpenAI TTS] Synthesizing ${text.length} chars with voice ${selectedVoice}`);

    const mp3Response = await this.openaiClient.audio.speech.create({
      model: 'tts-1-hd',
      voice: selectedVoice as any,
      input: text,
      response_format: 'mp3',
    });

    const audioBuffer = Buffer.from(await mp3Response.arrayBuffer());
    console.log(`[OpenAI TTS] ✓ Generated ${audioBuffer.length} bytes`);

    return {
      audioBuffer,
      contentType: 'audio/mpeg',
    };
  }

  /**
   * Get the current provider being used
   */
  getProvider(): TTSProvider {
    return this.provider;
  }

  /**
   * Check if a specific provider is available
   */
  isProviderAvailable(provider: TTSProvider): boolean {
    if (provider === 'google') {
      return this.googleClient !== null;
    }
    return this.openaiClient !== null;
  }

  /**
   * Health check for Google Cloud TTS API
   * Tests if the API is enabled and accessible
   */
  async healthCheckGoogle(): Promise<{ healthy: boolean; error?: string; message?: string }> {
    if (!this.googleClient) {
      return {
        healthy: false,
        error: 'Google Cloud TTS client not initialized',
        message: 'Set GOOGLE_CLOUD_TTS_CREDENTIALS environment variable with valid service account JSON'
      };
    }

    try {
      // Try a minimal synthesis request to verify API is enabled
      const testRequest: protos.google.cloud.texttospeech.v1.ISynthesizeSpeechRequest = {
        input: { text: 'test' },
        voice: {
          languageCode: 'en-US',
          name: 'en-US-Neural2-A',
        },
        audioConfig: {
          audioEncoding: 'MP3',
        },
      };

      await this.googleClient.synthesizeSpeech(testRequest);
      return {
        healthy: true,
        message: 'Google Cloud TTS API is enabled and accessible'
      };
    } catch (error: any) {
      // Check for specific error codes
      if (error.code === 7 || error.message?.includes('PERMISSION_DENIED')) {
        return {
          healthy: false,
          error: 'PERMISSION_DENIED',
          message: 'Google Cloud Text-to-Speech API is not enabled. Enable it at: https://console.cloud.google.com/apis/library/texttospeech.googleapis.com'
        };
      }

      if (error.message?.includes('has not been used in project')) {
        return {
          healthy: false,
          error: 'API_NOT_ENABLED',
          message: 'Google Cloud Text-to-Speech API has not been used in project. Enable it in Google Cloud Console and ensure service account has roles/texttospeech.user permission'
        };
      }

      return {
        healthy: false,
        error: error.code || 'UNKNOWN',
        message: `Google Cloud TTS health check failed: ${error.message}`
      };
    }
  }

  /**
   * Get TTS service status including provider health
   */
  async getStatus(): Promise<{
    currentProvider: TTSProvider;
    googleAvailable: boolean;
    openaiAvailable: boolean;
    googleHealthy?: boolean;
    healthMessage?: string;
    fallbackActive: boolean;
  }> {
    const googleAvailable = this.isProviderAvailable('google');
    const openaiAvailable = this.isProviderAvailable('openai');

    let googleHealthy = false;
    let healthMessage = '';

    if (googleAvailable) {
      const healthCheck = await this.healthCheckGoogle();
      googleHealthy = healthCheck.healthy;
      healthMessage = healthCheck.message || healthCheck.error || '';
    }

    const fallbackActive = this.provider === 'google' && !googleHealthy && openaiAvailable;

    return {
      currentProvider: this.provider,
      googleAvailable,
      openaiAvailable,
      googleHealthy,
      healthMessage,
      fallbackActive
    };
  }
}

// Singleton instance
let ttsServiceInstance: TTSService | null = null;

/**
 * Get or create the TTS service singleton
 */
export function getTTSService(): TTSService {
  if (!ttsServiceInstance) {
    ttsServiceInstance = new TTSService('google'); // Prefer Google WaveNet
  }
  return ttsServiceInstance;
}
