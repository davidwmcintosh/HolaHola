import { TextToSpeechClient, protos } from '@google-cloud/text-to-speech';
import { v1beta1 as ttsV1Beta1 } from '@google-cloud/text-to-speech';
import OpenAI from 'openai';
import { franc } from 'franc-min';

/**
 * TTS Provider Interface
 */
export type TTSProvider = 'openai' | 'google';

/**
 * Common TTS Request Interface
 */
export interface TTSRequest {
  text: string;
  language?: string; // Voice language (e.g., "spanish" for Spanish accent)
  voice?: string;
  targetLanguage?: string; // Target learning language for phoneme tag processing
}

/**
 * Word-level timing information for synchronized subtitles
 */
export interface WordTiming {
  word: string;
  startTime: number; // Seconds
  endTime: number;   // Seconds
}

/**
 * Common TTS Response Interface
 */
export interface TTSResponse {
  audioBuffer: Buffer;
  contentType: string;
  wordTimings?: WordTiming[]; // Optional word-level timestamps for karaoke-style highlighting
}

/**
 * Google Cloud TTS Voice Mapping
 * Maps language codes to optimal voices with regional variants
 * 
 * Voice tiers:
 * - Chirp 3 HD: Latest model, highest quality (31 locales, 8 styles)
 * - Neural2: High quality WaveNet voices (40+ speakers)
 * - WaveNet: Classic premium voices
 */
const GOOGLE_VOICE_MAP: Record<string, { name: string; languageCode: string }> = {
  'spanish': { name: 'es-US-Chirp-HD-O', languageCode: 'es-US' }, // US Spanish, Chirp 3 HD
  'english': { name: 'en-US-Chirp-HD-O', languageCode: 'en-US' }, // US English, Chirp 3 HD
  'french': { name: 'fr-FR-Chirp-HD-O', languageCode: 'fr-FR' }, // French, Chirp 3 HD
  'german': { name: 'de-DE-Chirp-HD-O', languageCode: 'de-DE' }, // German, Chirp 3 HD
  'italian': { name: 'it-IT-Chirp-HD-O', languageCode: 'it-IT' }, // Italian, Chirp 3 HD
  'portuguese': { name: 'pt-BR-Chirp-HD-O', languageCode: 'pt-BR' }, // Brazilian Portuguese, Chirp 3 HD
  'japanese': { name: 'ja-JP-Chirp-HD-O', languageCode: 'ja-JP' }, // Japanese, Chirp 3 HD
  'mandarin chinese': { name: 'cmn-CN-Chirp-HD-O', languageCode: 'cmn-CN' }, // Mandarin Chinese, Chirp 3 HD
  'korean': { name: 'ko-KR-Chirp-HD-O', languageCode: 'ko-KR' }, // Korean, Chirp 3 HD
};

/**
 * Language code mapping for franc-min detection
 * Maps franc's ISO 639-3 codes to our language names
 */
const FRANC_TO_LANGUAGE_MAP: Record<string, string> = {
  'spa': 'spanish',
  'eng': 'english',
  'fra': 'french',
  'deu': 'german',
  'ita': 'italian',
  'por': 'portuguese',
  'jpn': 'japanese',
  'cmn': 'mandarin chinese',
  'kor': 'korean',
};

/**
 * IPA (International Phonetic Alphabet) pronunciation mappings for common target-language words
 * Used to fix syllable pronunciation when Spanish TTS reads English text with embedded Spanish words
 * 
 * Example: "Hola" in English sentence → Chirp 3 HD mis-segments to 3 syllables
 * Solution: Wrap with <phoneme alphabet="ipa" ph="ˈola">Hola</phoneme> → Forces 2 syllables
 */
const IPA_PRONUNCIATIONS: Record<string, Record<string, string>> = {
  'spanish': {
    'hola': 'ola',            // HO-la (2 syllables)
    'adiós': 'adjos',         // a-DI-ós (3 syllables)
    'adios': 'adjos',         // without accent
    'gracias': 'gɾasjas',     // GRA-cias (2 syllables)
    'por favor': 'poɾ faβoɾ', // por fa-VOR
    'sí': 'si',               // sí (1 syllable)
    'si': 'si',               // without accent
    'no': 'no',               // no (1 syllable)
    'buenos días': 'bwenos dias', // BUE-nos DI-as
    'buenos dias': 'bwenos dias', // without accent
    'buenas tardes': 'bwenas taɾdes', // BUE-nas TAR-des
    'buenas noches': 'bwenas notʃes', // BUE-nas NO-ches
    'qué tal': 'ke tal',      // qué TAL
    'que tal': 'ke tal',      // without accent
    'cómo estás': 'komo estas', // CÓ-mo es-TÁS
    'como estas': 'komo estas', // without accents
    'perfecto': 'peɾfekto',   // per-FEC-to
    'excelente': 'ekselente', // ex-ce-LEN-te
    'bien': 'bjen',           // bien (1 syllable)
    'muy bien': 'muj bjen',   // muy bien
    'de nada': 'de naða',     // de NA-da
    'lo siento': 'lo sjento', // lo SIEN-to
  },
  // Add other languages as needed
  'french': {
    'bonjour': 'bɔʒuʁ',
    'merci': 'mɛʁsi',
    'oui': 'wi',
    'non': 'nɔ',
  },
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
  private googleBetaClient: ttsV1Beta1.TextToSpeechClient | null = null;
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
        this.googleBetaClient = new ttsV1Beta1.TextToSpeechClient({
          credentials,
        });
        console.log('[TTS Service] ✓ Google Cloud WaveNet initialized (v1 + v1beta1)');
      } catch (error) {
        console.error('[TTS Service] Failed to initialize Google Cloud TTS:', error);
        // Fall back to OpenAI if Google credentials are invalid
        this.provider = 'openai';
      }
    } else {
      console.warn('[TTS Service] GOOGLE_CLOUD_TTS_CREDENTIALS not found, falling back to OpenAI TTS');
      this.provider = 'openai';
    }

    // OpenAI client no longer used - Google Cloud TTS is required for authentic voices
    // Keeping initialization code for future reference, but not used in voice chat
    if (process.env.USER_OPENAI_API_KEY) {
      this.openaiClient = new OpenAI({
        apiKey: process.env.USER_OPENAI_API_KEY,
        baseURL: 'https://api.openai.com/v1',
      });
      console.log('[TTS Service] ℹ️  OpenAI TTS available (not used for voice chat - Google Cloud required)');
    }
    
    // Validate Google Cloud TTS is available
    if (!this.googleClient) {
      console.error('[TTS Service] ❌ CRITICAL: Google Cloud TTS not configured!');
      console.error('[TTS Service] Voice chat will not work without GOOGLE_CLOUD_TTS_CREDENTIALS');
      console.error('[TTS Service] Set GOOGLE_CLOUD_TTS_CREDENTIALS environment variable with service account JSON');
    }
  }

  /**
   * Synthesize speech from text using Google Cloud TTS
   * NO FALLBACK - fails immediately if Google TTS is unavailable
   * This preserves authentic voice quality for language learning
   */
  async synthesize(request: TTSRequest): Promise<TTSResponse> {
    const { text, language, voice, targetLanguage } = request;

    // Google Cloud TTS is required for authentic language learning voices
    if (!this.googleClient) {
      throw new Error('Google Cloud TTS is not available. Voice chat requires GOOGLE_CLOUD_TTS_CREDENTIALS to be configured.');
    }

    try {
      return await this.synthesizeWithGoogle(text, language, targetLanguage);
    } catch (error: any) {
      // Enhanced error logging with actionable diagnostics
      console.error('┌─────────────────────────────────────────────────────────────┐');
      console.error('│ ❌ GOOGLE CLOUD TTS FAILED - VOICE UNAVAILABLE             │');
      console.error('└─────────────────────────────────────────────────────────────┘');
      console.error(`Error: ${error.message}`);
      
      if (error.code === 7 || error.message?.includes('PERMISSION_DENIED')) {
        console.error('\n📋 SETUP REQUIRED:');
        console.error('1. Enable Google Cloud Text-to-Speech API:');
        console.error('   https://console.cloud.google.com/apis/library/texttospeech.googleapis.com');
        console.error('2. Ensure service account has roles/texttospeech.user permission');
        console.error('3. Restart the application after enabling');
      }
      
      if (error.code === 3 || error.message?.includes('INVALID_ARGUMENT')) {
        console.error('\n📋 LIKELY CAUSE: Invalid SSML in request');
        console.error('Check that phoneme tags are properly formatted');
        console.error('Text preview:', text.substring(0, 200));
      }
      
      // NO FALLBACK - fail immediately to preserve learning experience
      throw new Error(`Google Cloud TTS failed: ${error.message}. Voice chat temporarily unavailable.`);
    }
  }

  /**
   * Detect the actual language of text using franc-min with improved accuracy
   * This ensures we use the correct voice for AI responses (Spanish voice for Spanish, English for English)
   */
  private detectLanguage(text: string, fallbackLanguage?: string): string {
    // Clean text for better detection (remove special chars but keep letters and spaces)
    const cleanText = text.replace(/[^a-zA-ZÀ-ÿ\u0100-\u017F\u0180-\u024F\s]/g, ' ').trim();
    
    // Simple heuristic: Check for very common English words
    const commonEnglishWords = /\b(the|is|are|was|were|have|has|had|this|that|these|those|what|when|where|who|how|can|will|would|should|could|may|might|must)\b/i;
    const hasCommonEnglish = commonEnglishWords.test(cleanText);
    
    // Use franc to detect the language (require 15+ chars for better accuracy)
    const detectedCode = franc(cleanText, { minLength: 15 });
    
    // If we detected common English words and franc says French/German/etc, override to English
    // (franc sometimes misidentifies short English texts with foreign words as other languages)
    if (hasCommonEnglish && detectedCode !== 'eng') {
      console.log(`[Language Detection] Override: Common English words detected, ignoring franc result "${detectedCode}"`);
      console.log(`[Language Detection] Using english for text: "${text.substring(0, 50)}..."`);
      return 'english';
    }
    
    // Map franc's ISO 639-3 code to our language name
    const detectedLanguage = FRANC_TO_LANGUAGE_MAP[detectedCode];
    
    if (detectedLanguage) {
      console.log(`[Language Detection] Detected "${detectedCode}" → ${detectedLanguage} from text: "${text.substring(0, 50)}..."`);
      return detectedLanguage;
    }
    
    // If detection failed but we have a fallback language parameter, use it
    if (fallbackLanguage) {
      const normalizedFallback = fallbackLanguage.toLowerCase().trim();
      if (GOOGLE_VOICE_MAP[normalizedFallback]) {
        console.log(`[Language Detection] Failed (code: ${detectedCode}), using fallback: ${normalizedFallback}`);
        return normalizedFallback;
      }
    }
    
    // Final fallback to English if everything else fails
    console.log(`[Language Detection] Could not detect language (code: ${detectedCode}), defaulting to English`);
    return 'english';
  }

  /**
   * Convert text to SSML with language tags for quoted foreign words
   * This allows Spanish words in English sentences to be pronounced correctly
   * 
   * Note: SSML lang tags are only supported by certain voice types (Neural2, WaveNet)
   * Chirp voices may not fully support this feature yet
   */
  private convertToSSML(text: string, primaryLanguage: string, targetLanguage?: string): { ssml: string; usesSSML: boolean } {
    // Only apply SSML if we have a target language and primary language is English
    if (!targetLanguage || primaryLanguage !== 'english') {
      return { ssml: text, usesSSML: false };
    }

    // Get the language code for the target language (e.g., 'es-US' for Spanish)
    const targetVoiceConfig = GOOGLE_VOICE_MAP[targetLanguage.toLowerCase()];
    if (!targetVoiceConfig) {
      return { ssml: text, usesSSML: false };
    }

    // DISABLED: Chirp HD voices don't fully support SSML lang tags yet
    // This feature will be re-enabled when Google adds full SSML support to Chirp voices
    console.log(`[SSML] Skipping SSML conversion - Chirp voices have limited SSML support`);
    return { ssml: text, usesSSML: false };

    // Code below is disabled but preserved for when Chirp voices support SSML
    /*
    // Extract just the base language code (e.g., 'es' from 'es-US')
    const targetLangCode = targetVoiceConfig.languageCode.split('-')[0];

    // Find quoted words (like "Adiós", "hola", 'gracias')
    // Match single or double quotes around words
    const quotedWordPattern = /["""']([^"""']+)["""']/g;
    
    let hasQuotedWords = false;
    const processedText = text.replace(quotedWordPattern, (match, word) => {
      hasQuotedWords = true;
      // Escape XML special characters in the word
      const escapedWord = word.replace(/&/g, '&amp;')
                              .replace(/</g, '&lt;')
                              .replace(/>/g, '&gt;')
                              .replace(/"/g, '&quot;')
                              .replace(/'/g, '&apos;');
      // Use SSML lang tag to mark this word with the target language
      return `<lang xml:lang="${targetLangCode}">${escapedWord}</lang>`;
    });

    if (!hasQuotedWords) {
      return { ssml: text, usesSSML: false };
    }

    // Wrap in SSML speak tags
    const ssmlText = `<speak>${processedText}</speak>`;
    
    console.log(`[SSML] Converted text with ${targetLanguage} language tags`);
    return { ssml: ssmlText, usesSSML: true };
    */
  }

  /**
   * Escape special XML characters for SSML
   */
  private escapeXML(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Wrap target-language words with SSML phoneme tags for correct syllable pronunciation
   * 
   * Problem: When Spanish TTS reads English text with embedded Spanish words like "Hola",
   * it mispronounces them (3 syllables instead of 2)
   * 
   * Solution: Use SSML <phoneme> tags with IPA pronunciation to enforce correct syllables
   * 
   * Example:
   * Input:  "The greeting is 'Hola'..."
   * Output: "The greeting is '<phoneme alphabet="ipa" ph="ˈola">Hola</phoneme>'..."
   * Result: Spanish voice pronounces "Hola" correctly as 2 syllables (HO-la)
   */
  private addPhonemeTagsForTargetWords(text: string, targetLanguage?: string): { text: string; usesSSML: boolean } {
    // TEMPORARILY DISABLED: Google Cloud TTS rejects accented characters (like í in "días") in SSML mode
    // Error: INVALID_ARGUMENT when SSML contains Spanish accented characters
    return { text, usesSSML: false };
    
    if (!targetLanguage) {
      return { text, usesSSML: false };
    }

    const normalizedTarget = targetLanguage.toLowerCase();
    const ipaMappings = IPA_PRONUNCIATIONS[normalizedTarget];
    
    if (!ipaMappings) {
      console.log(`[SSML Phoneme] No IPA mappings for ${targetLanguage}, skipping`);
      return { text, usesSSML: false };
    }

    let hasPhonemes = false;
    
    // CRITICAL: Build SSML by processing text piece by piece
    // Escape text AROUND phoneme tags, but keep phoneme tags as literal XML
    const quotedPattern = /(['''"""«])([^'''"""«»]+)(['''"""»])/g;
    let lastIndex = 0;
    let result = '';
    
    let match;
    while ((match = quotedPattern.exec(text)) !== null) {
      // Escape the text BEFORE this quoted word
      result += this.escapeXML(text.substring(lastIndex, match.index));
      
      const quotedContent = match[2];
      
      // Normalize for lookup
      const normalized = quotedContent.toLowerCase().trim()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[¿?¡!]/g, '');
      const exactNormalized = quotedContent.toLowerCase().trim();
      
      // Check if this quoted word has an IPA pronunciation
      const ipa = ipaMappings[exactNormalized] || ipaMappings[normalized];
      
      if (ipa) {
        hasPhonemes = true;
        console.log(`[SSML Phoneme] Wrapping "${quotedContent}" with IPA: ${ipa}`);
        // Add phoneme tag as LITERAL XML (no escaping of the tags themselves)
        result += `<phoneme alphabet="ipa" ph="${ipa}">${quotedContent}</phoneme>`;
      } else {
        // Keep original quoted word with XML escaping
        result += this.escapeXML(match[0]);
      }
      
      lastIndex = match.index + match[0].length;
    }
    
    // Escape any remaining text after the last match
    result += this.escapeXML(text.substring(lastIndex));

    // Only wrap in SSML <speak> tags if we actually added phoneme tags
    if (!hasPhonemes) {
      console.log(`[SSML Phoneme] No matching words found in text, skipping SSML`);
      return { text, usesSSML: false };
    }
    
    // Wrap entire text in SSML <speak> tags
    const ssmlText = `<speak>${result}</speak>`;
    console.log(`[SSML Phoneme] ✅ Added phoneme tags for ${targetLanguage}`);
    console.log(`[SSML DEBUG] Generated SSML: ${ssmlText.substring(0, 200)}...`);
    
    return { text: ssmlText, usesSSML: true };
  }

  /**
   * Convert plain text to SSML with mark tags between words for timing
   */
  private textToSSMLWithMarks(text: string): { ssml: string; words: string[] } {
    // Split text into words (preserving whitespace and punctuation)
    const words = text.match(/\S+/g) || [];
    
    // Build SSML with <mark> tags between words
    let ssml = '<speak>';
    words.forEach((word, index) => {
      // Escape XML special characters in the word
      ssml += this.escapeXML(word);
      // Add space and mark tag after each word (except the last one)
      if (index < words.length - 1) {
        ssml += ` <mark name="${index}"/>`;
      }
    });
    ssml += '</speak>';
    
    return { ssml, words };
  }

  /**
   * Parse timepoints from Google TTS response into WordTiming array
   * 
   * Logic: <mark name="N"/> appears AFTER word N, so timepoint N marks:
   * - End of word N
   * - Start of word N+1
   */
  private parseWordTimings(timepoints: any[], words: string[], audioTime?: number): WordTiming[] {
    const wordTimings: WordTiming[] = [];
    
    if (words.length === 0) return wordTimings;
    
    // Word 0: starts at 0, ends at first mark (or estimated)
    const firstEndTime = timepoints.length > 0 ? timepoints[0].timeSeconds : 0.3;
    wordTimings.push({
      word: words[0],
      startTime: 0,
      endTime: firstEndTime,
    });
    
    // Words 1 to N-1: use consecutive timepoints
    for (let i = 0; i < timepoints.length; i++) {
      const markIndex = parseInt(timepoints[i].markName || '0', 10);
      const wordIndex = markIndex + 1; // Mark after word N means word N+1
      
      if (wordIndex < words.length) {
        const startTime = timepoints[i].timeSeconds || 0;
        
        // End time is next mark or audio end
        const endTime = i < timepoints.length - 1
          ? timepoints[i + 1].timeSeconds
          : audioTime || (startTime + 0.5); // Fallback: estimate
        
        wordTimings.push({
          word: words[wordIndex],
          startTime,
          endTime,
        });
      }
    }
    
    return wordTimings;
  }

  /**
   * Synthesize speech using Google Cloud TTS (Neural2 and Chirp 3 HD voices)
   * Uses the target language voice consistently for authentic pronunciation
   * 
   * @param text - Text to synthesize
   * @param language - Voice language (e.g., "spanish" for Spanish accent)
   * @param targetLanguage - Target learning language for SSML phoneme tags (optional)
   */
  private async synthesizeWithGoogle(text: string, language?: string, targetLanguage?: string): Promise<TTSResponse> {
    if (!this.googleClient) {
      throw new Error('Google Cloud TTS client not initialized');
    }

    // Determine which voice to use
    let selectedLanguage: string;
    let voiceConfig: { name: string; languageCode: string };

    if (language) {
      selectedLanguage = language.toLowerCase();
      voiceConfig = GOOGLE_VOICE_MAP[selectedLanguage] || GOOGLE_VOICE_MAP['english'];
      console.log(`[Google TTS] Using target language voice: ${voiceConfig.name} (${selectedLanguage})`);
    } else {
      selectedLanguage = this.detectLanguage(text);
      voiceConfig = GOOGLE_VOICE_MAP[selectedLanguage] || GOOGLE_VOICE_MAP['english'];
      console.log(`[Google TTS] Auto-detected language: ${selectedLanguage}, using ${voiceConfig.name}`);
    }

    // Apply SSML phoneme tags for embedded target-language words if targetLanguage provided
    const { text: processedText, usesSSML } = this.addPhonemeTagsForTargetWords(text, targetLanguage);

    console.log(`[Google TTS] Synthesizing ${text.length} chars with ${voiceConfig.name}${usesSSML ? ' (with SSML phoneme tags)' : ''}`);

    // DEBUG: Log exact SSML being sent to Google
    if (usesSSML) {
      console.log(`[SSML REQUEST DEBUG] Length: ${processedText.length} chars`);
      console.log(`[SSML REQUEST DEBUG] First 300 chars: ${processedText.substring(0, 300)}`);
      console.log(`[SSML REQUEST DEBUG] Char codes: ${processedText.substring(0, 100).split('').map(c => c.charCodeAt(0)).join(',')}`);
    }

    // Prepare the synthesis request using standard v1 API
    // Note: Chirp 3 HD voices don't support enableTimePointing beta feature
    const request = {
      input: usesSSML ? { ssml: processedText } : { text: processedText },
      voice: {
        languageCode: voiceConfig.languageCode,
        name: voiceConfig.name,
      },
      audioConfig: {
        audioEncoding: 'MP3' as const,
        speakingRate: 0.9,
        pitch: 0,
        volumeGainDb: 0,
      },
    };

    // Call Google Cloud TTS API (v1)
    const [response] = await this.googleClient.synthesizeSpeech(request);

    if (!response.audioContent) {
      throw new Error('Google TTS returned no audio content');
    }

    const audioBuffer = Buffer.from(response.audioContent as Uint8Array);
    console.log(`[Google WaveNet] ✓ Generated ${audioBuffer.length} bytes`);

    return {
      audioBuffer,
      contentType: 'audio/mpeg',
      // Word timings not available without beta API
      wordTimings: undefined,
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
