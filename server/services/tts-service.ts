import { TextToSpeechClient, protos } from '@google-cloud/text-to-speech';
import { v1beta1 as ttsV1Beta1 } from '@google-cloud/text-to-speech';
import OpenAI from 'openai';
import { CartesiaClient } from '@cartesia/cartesia-js';
import { franc } from 'franc-min';

/**
 * TTS Provider Interface
 * - cartesia: Cartesia Sonic-3 (40ms latency, full SSML support, emotion tags)
 * - google: Google Cloud Chirp HD (500-1500ms latency, limited SSML)
 * - openai: OpenAI TTS (fallback, not used for language learning)
 */
export type TTSProvider = 'cartesia' | 'google' | 'openai';

/**
 * Cartesia Sonic-3 Emotion Types
 * Used to add personality and warmth to tutor responses
 * See: https://docs.cartesia.ai/build-with-cartesia/sonic-3/volume-speed-emotion
 */
export type CartesiaEmotion = 
  | 'neutral'           // Default, calm delivery
  | 'happy'             // Warm, positive
  | 'excited'           // Enthusiastic, high energy
  | 'curious'           // Inquisitive, engaged
  | 'calm'              // Relaxed, patient
  | 'encouraging'       // Supportive, motivating
  | 'friendly'          // Warm, approachable
  | 'enthusiastic'      // Very positive, energetic
  | 'patient'           // Slow, understanding
  | 'surprised';        // Amazed, impressed

/**
 * Common TTS Request Interface
 */
export interface TTSRequest {
  text: string;
  language?: string; // Voice language (e.g., "spanish" for Spanish accent)
  voice?: string;
  voiceId?: string; // Explicit Cartesia voice ID (from database config)
  targetLanguage?: string; // Target learning language for phoneme tag processing
  returnTimings?: boolean; // Request word-level timing data for subtitle sync
  speakingRate?: number; // Speaking rate: 0.25 to 4.0, default 0.9 (0.7 for slow mode)
  emotion?: CartesiaEmotion; // Cartesia Sonic-3 emotion control for natural tutoring
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
 * - Chirp 3 HD: Latest model, highest quality (31 locales, 8 styles) - NO SSML SUPPORT
 * - Neural2: High quality voices with SSML support (phoneme tags work)
 * - WaveNet: Classic premium voices with SSML support
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
 * SSML-compatible voices for when phoneme tags are needed
 * Chirp 3 HD doesn't support SSML - must use WaveNet/Neural2 for phoneme pronunciation
 */
const GOOGLE_SSML_VOICE_MAP: Record<string, { name: string; languageCode: string }> = {
  'spanish': { name: 'es-US-Neural2-A', languageCode: 'es-US' }, // Female Neural2
  'english': { name: 'en-US-Neural2-F', languageCode: 'en-US' }, // Female Neural2
  'french': { name: 'fr-FR-Neural2-A', languageCode: 'fr-FR' }, // Female Neural2
  'german': { name: 'de-DE-Neural2-A', languageCode: 'de-DE' }, // Female Neural2
  'italian': { name: 'it-IT-Neural2-A', languageCode: 'it-IT' }, // Female Neural2
  'portuguese': { name: 'pt-BR-Neural2-A', languageCode: 'pt-BR' }, // Female Neural2
  'japanese': { name: 'ja-JP-Neural2-B', languageCode: 'ja-JP' }, // Female Neural2
  'mandarin chinese': { name: 'cmn-CN-Wavenet-A', languageCode: 'cmn-CN' }, // Female Wavenet
  'korean': { name: 'ko-KR-Neural2-A', languageCode: 'ko-KR' }, // Female Neural2
};

/**
 * Cartesia Sonic Voice Mapping
 * Maps language names to Cartesia voice IDs and language codes
 * 
 * Voice tiers:
 * - sonic-3: Latest model, 42 languages, emotion/laughter support, ~90ms latency
 * - sonic-turbo: Older model, 15 languages, 40ms latency (half of sonic-2)
 * 
 * Selected voices optimized for language tutoring (conversational, clear pronunciation)
 */
const CARTESIA_VOICE_MAP: Record<string, { voiceId: string; languageCode: string; name: string }> = {
  'english': { 
    voiceId: '573e3144-a684-4e72-ac2b-9b2063a50b53', // Teacher Lady - perfect for teaching!
    languageCode: 'en',
    name: 'Teacher Lady'
  },
  'spanish': { 
    voiceId: '5c5ad5e7-1020-476b-8b91-fdcbe9cc313c', // Mexican Woman - natural Spanish
    languageCode: 'es',
    name: 'Mexican Woman'
  },
  'french': { 
    voiceId: 'a249eaff-1e96-4d2c-b23b-12efa4f66f41', // French Conversational Lady
    languageCode: 'fr',
    name: 'French Conversational Lady'
  },
  'german': { 
    voiceId: '3f4ade23-6eb4-4279-ab05-6a144947c4d5', // German Conversational Woman
    languageCode: 'de',
    name: 'German Conversational Woman'
  },
  'italian': { 
    voiceId: '0e21713a-5e9a-428a-bed4-90d410b87f13', // Italian Narrator Woman
    languageCode: 'it',
    name: 'Italian Narrator Woman'
  },
  'portuguese': { 
    voiceId: '700d1ee3-a641-4018-ba6e-899dcadc9e2b', // Pleasant Brazilian Lady
    languageCode: 'pt',
    name: 'Pleasant Brazilian Lady'
  },
  'japanese': { 
    voiceId: '2b568345-1d48-4047-b25f-7baccf842eb0', // Japanese Woman Conversational
    languageCode: 'ja',
    name: 'Japanese Woman Conversational'
  },
  'mandarin chinese': { 
    voiceId: 'e90c6678-f0d3-4767-9883-5d0ecf5894a8', // Chinese Female Conversational
    languageCode: 'zh',
    name: 'Chinese Female Conversational'
  },
  'korean': { 
    voiceId: '29e5f8b4-b953-4160-848f-40fae182235b', // Korean Calm Woman
    languageCode: 'ko',
    name: 'Korean Calm Woman'
  },
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
 * MFA-style IPA (Montreal Forced Aligner) pronunciation mappings for common target-language words
 * Used for Cartesia Sonic-3 custom pronunciation with <<phoneme|phoneme>> syntax
 * 
 * Format: Pipe-separated IPA phonemes using MFA phoneset
 * Example: "Cartesia" → <<kʰ|ɑ|ɹ|tʲ|i|ʒ|ɐ>>
 * 
 * Cartesia Sonic-3 uses MFA-style IPA (no stress markers needed)
 * See: https://docs.cartesia.ai/build-with-cartesia/capability-guides/specify-custom-pronunciations
 * MFA dictionary reference: https://mfa-models.readthedocs.io/en/latest/dictionary/index.html
 */
const MFA_IPA_PRONUNCIATIONS: Record<string, Record<string, string>> = {
  'spanish': {
    // Common greetings - Spanish MFA phonemes
    'hola': 'o|l|a',                    // HO-la (2 syllables)
    'adiós': 'a|ð|j|o|s',               // a-DIOS
    'adios': 'a|ð|j|o|s',               // without accent
    'gracias': 'ɡ|ɾ|a|s|j|a|s',         // GRA-cias
    'por favor': 'p|o|ɾ|f|a|β|o|ɾ',     // por fa-VOR
    'sí': 's|i',                         // sí (1 syllable)
    'si': 's|i',                         // without accent
    'no': 'n|o',                         // no (1 syllable)
    'buenos días': 'b|w|e|n|o|s|ð|i|a|s', // BUE-nos DI-as
    'buenos dias': 'b|w|e|n|o|s|ð|i|a|s', // without accent
    'buenas tardes': 'b|w|e|n|a|s|t|a|ɾ|ð|e|s', // BUE-nas TAR-des
    'buenas noches': 'b|w|e|n|a|s|n|o|tʃ|e|s',  // BUE-nas NO-ches
    'qué tal': 'k|e|t|a|l',             // qué TAL
    'que tal': 'k|e|t|a|l',             // without accent
    'cómo estás': 'k|o|m|o|e|s|t|a|s',  // CÓ-mo es-TÁS
    'como estas': 'k|o|m|o|e|s|t|a|s',  // without accents
    'perfecto': 'p|e|ɾ|f|e|k|t|o',      // per-FEC-to
    'excelente': 'e|k|s|e|l|e|n|t|e',   // ex-ce-LEN-te
    'bien': 'b|j|e|n',                  // bien
    'muy bien': 'm|u|i|b|j|e|n',        // muy bien
    'de nada': 'd|e|n|a|ð|a',           // de NA-da
    'lo siento': 'l|o|s|j|e|n|t|o',     // lo SIEN-to
    'amigo': 'a|m|i|ɣ|o',               // friend
    'amiga': 'a|m|i|ɣ|a',               // friend (f)
    'español': 'e|s|p|a|ɲ|o|l',         // Spanish
    'inglés': 'i|n|ɡ|l|e|s',            // English
    'por qué': 'p|o|ɾ|k|e',             // why
    'porque': 'p|o|ɾ|k|e',              // because
    'mucho': 'm|u|tʃ|o',                // much/many
    'también': 't|a|m|b|j|e|n',         // also
    'siempre': 's|j|e|m|p|ɾ|e',         // always
    'ahora': 'a|o|ɾ|a',                 // now
  },
  'french': {
    'bonjour': 'b|ɔ̃|ʒ|u|ʁ',            // hello
    'merci': 'm|ɛ|ʁ|s|i',              // thank you
    'oui': 'w|i',                       // yes
    'non': 'n|ɔ̃',                       // no
    's\'il vous plaît': 's|i|l|v|u|p|l|ɛ', // please
    'au revoir': 'o|ʁ|ə|v|w|a|ʁ',       // goodbye
    'comment': 'k|ɔ|m|ɑ̃',               // how
    'très bien': 't|ʁ|ɛ|b|j|ɛ̃',         // very good
    'excusez-moi': 'ɛ|k|s|k|y|z|e|m|w|a', // excuse me
    'je suis': 'ʒ|ə|s|ɥ|i',             // I am
  },
  'german': {
    'hallo': 'h|a|l|o',                 // hello
    'guten tag': 'ɡ|u|t|ə|n|t|a|k',     // good day
    'danke': 'd|a|ŋ|k|ə',               // thank you
    'bitte': 'b|ɪ|t|ə',                 // please
    'ja': 'j|a',                        // yes
    'nein': 'n|aɪ|n',                   // no
    'auf wiedersehen': 'a|ʊ|f|v|i|d|ɐ|z|e|ə|n', // goodbye
    'ich': 'ɪ|ç',                       // I
    'spreche': 'ʃ|p|ʁ|ɛ|ç|ə',           // speak
  },
  'italian': {
    'ciao': 'tʃ|a|o',                   // hello/goodbye
    'buongiorno': 'b|w|ɔ|n|dʒ|ɔ|r|n|o', // good morning
    'grazie': 'ɡ|r|a|t|s|j|e',          // thank you
    'prego': 'p|r|e|ɡ|o',               // you're welcome
    'sì': 's|i',                        // yes
    'no': 'n|o',                        // no
    'arrivederci': 'a|r|i|v|e|d|e|r|tʃ|i', // goodbye
    'per favore': 'p|e|r|f|a|v|o|r|e',  // please
  },
  'portuguese': {
    'olá': 'o|l|a',                     // hello
    'bom dia': 'b|õ|dʒ|i|ɐ',            // good morning
    'obrigado': 'o|b|ɾ|i|ɡ|a|d|u',      // thank you (m)
    'obrigada': 'o|b|ɾ|i|ɡ|a|d|ɐ',      // thank you (f)
    'sim': 's|ĩ',                       // yes
    'não': 'n|ɐ̃|w̃',                    // no
    'por favor': 'p|o|ɾ|f|a|v|o|ɾ',     // please
    'tchau': 'tʃ|a|w',                  // bye
  },
  'japanese': {
    'konnichiwa': 'k|o|n|i|tʃ|i|w|a',   // hello
    'arigatou': 'a|ɾ|i|ɡ|a|t|o|ɯ',      // thank you
    'hai': 'h|a|i',                     // yes
    'iie': 'i|i|e',                     // no
    'sumimasen': 's|ɯ|m|i|m|a|s|e|n',   // excuse me
    'ohayou': 'o|h|a|j|o|ɯ',            // good morning
    'sayounara': 's|a|j|o|ɯ|n|a|ɾ|a',   // goodbye
  },
  'mandarin chinese': {
    'nǐ hǎo': 'n|i|x|a|o',              // hello
    'xièxie': 'ɕ|j|e|ɕ|j|e',            // thank you
    'shì': 'ʂ|ɨ',                       // yes/is
    'bù': 'p|u',                        // no/not
    'zàijiàn': 't|s|a|i|tɕ|j|e|n',      // goodbye
  },
  'korean': {
    'annyeonghaseyo': 'a|n|j|ʌ|ŋ|h|a|s|e|j|o', // hello
    'kamsahamnida': 'k|a|m|s|a|h|a|m|n|i|d|a', // thank you
    'ne': 'n|e',                        // yes
    'aniyo': 'a|n|i|j|o',               // no
  },
};

/**
 * TTS Service - Abstraction layer supporting multiple TTS providers
 * 
 * Supports:
 * - Cartesia Sonic-3/Turbo - Ultra-low latency (40-90ms), full SSML, emotion tags
 * - Google Cloud Chirp HD - High quality but slower (500-1500ms)
 * - OpenAI TTS (tts-1, tts-1-hd) - Fast but limited control (not used)
 * 
 * Provider selection via TTS_PRIMARY_PROVIDER env var:
 * - 'cartesia': Use Cartesia as primary (default if CARTESIA_API_KEY set)
 * - 'google': Use Google Cloud as primary (fallback if Cartesia unavailable)
 * 
 * Model selection via TTS_CARTESIA_MODEL env var:
 * - 'sonic-3': Latest model, 42 languages, emotion/laughter (~90ms latency)
 * - 'sonic-turbo': Ultra-fast mode (40ms latency), 15 languages
 */
export class TTSService {
  private googleClient: TextToSpeechClient | null = null;
  private googleBetaClient: ttsV1Beta1.TextToSpeechClient | null = null;
  private openaiClient: OpenAI | null = null;
  private cartesiaClient: CartesiaClient | null = null;
  private provider: TTSProvider;
  private cartesiaModel: string;
  private fallbackEnabled: boolean = true;

  constructor(provider?: TTSProvider) {
    // Determine Cartesia model (sonic-3 is default, sonic-turbo for ultra-low latency)
    this.cartesiaModel = process.env.TTS_CARTESIA_MODEL || 'sonic-3';
    
    // Initialize Cartesia client if API key is available
    if (process.env.CARTESIA_API_KEY) {
      try {
        this.cartesiaClient = new CartesiaClient({
          apiKey: process.env.CARTESIA_API_KEY,
        });
        console.log(`[TTS Service] ✓ Cartesia initialized (model: ${this.cartesiaModel})`);
      } catch (error) {
        console.error('[TTS Service] Failed to initialize Cartesia:', error);
      }
    }

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
        console.log('[TTS Service] ✓ Google Cloud TTS initialized (fallback ready)');
      } catch (error) {
        console.error('[TTS Service] Failed to initialize Google Cloud TTS:', error);
      }
    }

    // OpenAI client (legacy, not used for voice chat)
    if (process.env.USER_OPENAI_API_KEY) {
      this.openaiClient = new OpenAI({
        apiKey: process.env.USER_OPENAI_API_KEY,
        baseURL: 'https://api.openai.com/v1',
      });
    }

    // Determine primary provider based on env var or availability
    const envProvider = process.env.TTS_PRIMARY_PROVIDER as TTSProvider | undefined;
    if (envProvider && ['cartesia', 'google', 'openai'].includes(envProvider)) {
      this.provider = envProvider;
    } else if (provider) {
      this.provider = provider;
    } else if (this.cartesiaClient) {
      this.provider = 'cartesia';
    } else if (this.googleClient) {
      this.provider = 'google';
    } else {
      this.provider = 'openai';
    }
    
    // Log provider status
    console.log(`[TTS Service] Primary provider: ${this.provider.toUpperCase()}`);
    if (this.cartesiaClient) {
      console.log(`[TTS Service] ├─ Cartesia: ✓ Ready (${this.cartesiaModel})`);
    } else {
      console.log('[TTS Service] ├─ Cartesia: ✗ Not configured (set CARTESIA_API_KEY)');
    }
    if (this.googleClient) {
      console.log('[TTS Service] └─ Google: ✓ Fallback ready');
    } else {
      console.log('[TTS Service] └─ Google: ✗ Not configured');
    }
    
    // Validate at least one provider is available
    if (!this.cartesiaClient && !this.googleClient) {
      console.error('[TTS Service] ❌ CRITICAL: No TTS provider configured!');
      console.error('[TTS Service] Set CARTESIA_API_KEY or GOOGLE_CLOUD_TTS_CREDENTIALS');
    }
  }

  /**
   * Synthesize speech from text using the configured primary provider
   * Falls back to Google Cloud TTS if primary fails and fallback is enabled
   */
  async synthesize(request: TTSRequest): Promise<TTSResponse> {
    const { text, language, voice, voiceId, targetLanguage, returnTimings, speakingRate, emotion } = request;
    const startTime = Date.now();

    // Try Cartesia first if it's the primary provider
    if (this.provider === 'cartesia' && this.cartesiaClient) {
      try {
        const result = await this.synthesizeWithCartesia(text, language, speakingRate, emotion, voiceId, targetLanguage);
        const elapsed = Date.now() - startTime;
        console.log(`[TTS] ✓ Cartesia completed in ${elapsed}ms (emotion: ${emotion || 'default'})`);
        return result;
      } catch (error: any) {
        console.error(`[TTS] ⚠ Cartesia failed: ${error.message}`);
        
        // Try fallback to Google if enabled
        if (this.fallbackEnabled && this.googleClient) {
          console.log('[TTS] Falling back to Google Cloud TTS...');
          try {
            const result = await this.synthesizeWithGoogle(text, language, targetLanguage, returnTimings, speakingRate);
            const elapsed = Date.now() - startTime;
            console.log(`[TTS] ✓ Google fallback completed in ${elapsed}ms`);
            return result;
          } catch (googleError: any) {
            console.error(`[TTS] ❌ Google fallback also failed: ${googleError.message}`);
            throw new Error(`All TTS providers failed. Cartesia: ${error.message}. Google: ${googleError.message}`);
          }
        }
        throw new Error(`Cartesia TTS failed: ${error.message}. No fallback configured.`);
      }
    }

    // Use Google as primary
    if (this.provider === 'google' || this.googleClient) {
      if (!this.googleClient) {
        throw new Error('Google Cloud TTS is not available. Set GOOGLE_CLOUD_TTS_CREDENTIALS or CARTESIA_API_KEY.');
      }

      try {
        const result = await this.synthesizeWithGoogle(text, language, targetLanguage, returnTimings, speakingRate);
        const elapsed = Date.now() - startTime;
        console.log(`[TTS] ✓ Google completed in ${elapsed}ms`);
        return result;
      } catch (error: any) {
        console.error('┌─────────────────────────────────────────────────────────────┐');
        console.error('│ ❌ GOOGLE CLOUD TTS FAILED                                 │');
        console.error('└─────────────────────────────────────────────────────────────┘');
        console.error(`Error: ${error.message}`);
        
        if (error.code === 7 || error.message?.includes('PERMISSION_DENIED')) {
          console.error('\n📋 SETUP REQUIRED:');
          console.error('1. Enable Google Cloud Text-to-Speech API:');
          console.error('   https://console.cloud.google.com/apis/library/texttospeech.googleapis.com');
          console.error('2. Ensure service account has roles/texttospeech.user permission');
        }
        
        throw new Error(`Google Cloud TTS failed: ${error.message}. Voice chat temporarily unavailable.`);
      }
    }

    throw new Error('No TTS provider available. Set CARTESIA_API_KEY or GOOGLE_CLOUD_TTS_CREDENTIALS.');
  }

  /**
   * Synthesize speech using Cartesia Sonic-3 or Sonic-Turbo
   * Ultra-low latency (40-90ms), custom phoneme support, emotion tags, [laughter] support
   * 
   * Sonic-3 Features:
   * - generation_config.speed: 0.6 (slow) to 1.5 (fast), default 1.0
   * - generation_config.emotion: happy, excited, curious, calm, etc.
   * - [laughter] tags in transcript for natural laughing
   * - Custom pronunciation via <<phoneme1|phoneme2>> syntax (MFA-style IPA)
   */
  private async synthesizeWithCartesia(
    text: string, 
    language?: string, 
    speakingRate?: number,
    emotion?: CartesiaEmotion,
    voiceId?: string,
    targetLanguage?: string
  ): Promise<TTSResponse> {
    if (!this.cartesiaClient) {
      throw new Error('Cartesia client not initialized');
    }

    // Detect language if not provided
    const selectedLanguage = language ? language.toLowerCase() : this.detectLanguage(text);
    
    // Get voice config for language (or use explicit voiceId if provided from database)
    const voiceConfig = CARTESIA_VOICE_MAP[selectedLanguage] || CARTESIA_VOICE_MAP['english'];
    const effectiveVoiceId = voiceId || voiceConfig.voiceId;
    
    // CRITICAL: When a custom voice is used, use targetLanguage for Cartesia's language parameter
    // This ensures Spanish voices pronounce Spanish words correctly even when the text is in English
    // Example: If Elena (Spanish voice) says "Hello, let's learn 'Hola'", the 'Hola' should be pronounced
    // with Spanish phonetics (silent H), not English phonetics
    const cartesiaLanguageConfig = voiceId && targetLanguage 
      ? (CARTESIA_VOICE_MAP[targetLanguage.toLowerCase()] || voiceConfig)
      : voiceConfig;
    
    // Map speaking rate to Cartesia's 0.6-1.5 range
    // Google uses 0.25-4.0 with default 1.0
    // Our slow mode uses 0.7, normal is 0.9
    let cartesiaSpeed = 1.0; // Default speed
    if (speakingRate !== undefined) {
      if (speakingRate <= 0.7) {
        cartesiaSpeed = 0.7; // Slow for pronunciation practice
      } else if (speakingRate <= 0.9) {
        cartesiaSpeed = 0.9; // Slightly slower than normal
      } else if (speakingRate >= 1.2) {
        cartesiaSpeed = 1.3; // Fast
      }
    }

    // Map our emotion types to Cartesia's supported emotions
    // Default to 'friendly' for a warm tutor voice
    const cartesiaEmotion = emotion || 'friendly';
    
    const voiceName = voiceId ? `custom voice (${voiceId.substring(0, 8)}...)` : voiceConfig.name;
    console.log(`[Cartesia] Synthesizing ${text.length} chars with ${voiceName} (${this.cartesiaModel})`);
    console.log(`[Cartesia] Emotion: ${cartesiaEmotion}, Speed: ${cartesiaSpeed}`);
    console.log(`[Cartesia] Language: ${cartesiaLanguageConfig.languageCode} (target: ${targetLanguage || 'none'}, text: ${selectedLanguage})`);

    // Apply Cartesia phoneme tags for quoted foreign words
    // This uses <<phoneme1|phoneme2>> syntax for correct pronunciation
    const phonemedText = this.addCartesiaPhonemes(text, targetLanguage);
    
    // Clean text: remove remaining quotes that might be pronounced (but keep [laughter] tags and <<phonemes>>!)
    // Don't remove angle brackets since those are used for phoneme syntax
    const cleanedText = phonemedText.replace(/["'"]/g, '');

    try {
      // Use Cartesia bytes API with Sonic-3 generation_config
      const stream = await this.cartesiaClient.tts.bytes({
        modelId: this.cartesiaModel,
        transcript: cleanedText,
        voice: {
          mode: 'id',
          id: effectiveVoiceId,
        },
        language: cartesiaLanguageConfig.languageCode as 'en' | 'es' | 'fr' | 'de' | 'it' | 'pt' | 'ja' | 'zh' | 'ko',
        outputFormat: {
          container: 'mp3',
          sampleRate: 44100,
          bitRate: 128000,
        },
        // Sonic-3 generation config for emotion and precise speed control
        // @ts-ignore - generation_config is valid for Sonic-3 but may not be in older types
        generation_config: {
          speed: cartesiaSpeed,
          emotion: cartesiaEmotion,
        },
      });

      // Collect stream chunks into a buffer
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
      }
      const audioBuffer = Buffer.concat(chunks);
      
      console.log(`[Cartesia] ✓ Generated ${audioBuffer.length} bytes`);

      return {
        audioBuffer,
        contentType: 'audio/mpeg',
        wordTimings: undefined, // Cartesia has timing support but not implemented yet
      };
    } catch (error: any) {
      console.error(`[Cartesia] Error: ${error.message}`);
      throw error;
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
   * Add Cartesia Sonic-3 phoneme tags for correct pronunciation of foreign words
   * 
   * Cartesia uses a custom syntax: <<phoneme1|phoneme2|phoneme3>>
   * This is different from SSML - no XML tags, just double angle brackets with pipe-separated IPA
   * 
   * Use case: When the AI's English response contains quoted foreign words like "Hola",
   * the phoneme tags ensure correct native pronunciation
   * 
   * Example:
   * Input:  "The greeting is 'Hola'"
   * Output: "The greeting is <<o|l|a>>"
   * 
   * @param text - Text to process (typically AI response in English with foreign words)
   * @param targetLanguage - The language being learned (e.g., 'spanish')
   * @returns Text with phoneme tags for quoted words
   */
  private addCartesiaPhonemes(text: string, targetLanguage?: string): string {
    if (!targetLanguage) {
      return text;
    }

    const languageKey = targetLanguage.toLowerCase();
    const pronunciations = MFA_IPA_PRONUNCIATIONS[languageKey];
    
    if (!pronunciations) {
      console.log(`[Cartesia Phonemes] No pronunciation map for ${targetLanguage}`);
      return text;
    }

    // Find quoted words (single, double, smart quotes)
    // Matches: "Hola", 'Hola', "Hola", 'Hola'
    const quotedWordPattern = /["""''']([^"""''']+)["""''']/g;
    
    let hasReplacements = false;
    const processedText = text.replace(quotedWordPattern, (match, word) => {
      // Normalize the word (lowercase, trim)
      const normalizedWord = word.toLowerCase().trim();
      
      // Check if we have a pronunciation for this word
      const phonemes = pronunciations[normalizedWord];
      if (phonemes) {
        hasReplacements = true;
        // Return Cartesia phoneme syntax: <<phoneme1|phoneme2|...>>
        console.log(`[Cartesia Phonemes] "${word}" → <<${phonemes}>>`);
        return `<<${phonemes}>>`;
      }
      
      // Also check if the original casing exists
      const originalPhonemes = pronunciations[word.trim()];
      if (originalPhonemes) {
        hasReplacements = true;
        console.log(`[Cartesia Phonemes] "${word}" → <<${originalPhonemes}>>`);
        return `<<${originalPhonemes}>>`;
      }
      
      // No pronunciation found, keep original with quotes stripped
      return word;
    });

    if (hasReplacements) {
      console.log(`[Cartesia Phonemes] Processed text: "${processedText.substring(0, 100)}..."`);
    }
    
    return processedText;
  }

  /**
   * Encode non-ASCII characters as HTML entities for SSML phoneme attributes
   * Google Cloud TTS requires all non-ASCII chars (like IPA symbols) to be entity-encoded
   * 
   * Example: "ola" stays as "ola", but "əˈola" becomes "&#x259;&#x2c8;ola"
   */
  private encodeForSSML(text: string): string {
    return text.split('').map(char => {
      const code = char.charCodeAt(0);
      // Encode any non-ASCII character (code > 127) as HTML entity
      return code > 127 ? `&#x${code.toString(16)};` : char;
    }).join('');
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
    // DISABLED: Neural2 voices (required for SSML) sound much less natural than Chirp 3 HD
    // The pronunciation benefits don't outweigh the voice quality loss
    // Chirp 3 HD handles most Spanish words correctly without phoneme hints
    // Cartesia Sonic-3 also handles pronunciation well without phoneme hints
    // 
    // To re-enable in future: Remove this early return when Google adds SSML support to Chirp voices
    // See VOICE_TTS_PRONUNCIATION_FIX.md for implementation details if re-enabling
    return { text, usesSSML: false };
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
   * Synthesize speech with word-level timing data using v1beta1 API
   * Uses SSML with <mark> tags to get precise word boundaries
   * Always uses Neural2 voices since Chirp doesn't support SSML
   */
  private async synthesizeWithTimings(text: string, language: string): Promise<TTSResponse> {
    if (!this.googleBetaClient) {
      throw new Error('Google Cloud TTS Beta client not initialized');
    }

    // Use Neural2 voice for SSML compatibility (Chirp doesn't support SSML)
    const voiceConfig = GOOGLE_SSML_VOICE_MAP[language] || GOOGLE_SSML_VOICE_MAP['english'];
    console.log(`[Google TTS Timing] Using Neural2 voice: ${voiceConfig.name} for word timing`);

    // Convert text to SSML with mark tags between words
    const { ssml, words } = this.textToSSMLWithMarks(text);
    console.log(`[Google TTS Timing] SSML with ${words.length} words`);

    // Use v1beta1 API with enableTimePointing to get word boundaries
    // TimepointType enum: 0 = TIMEPOINT_TYPE_UNSPECIFIED, 1 = SSML_MARK
    const request = {
      input: { ssml },
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
      enableTimePointing: [1], // 1 = SSML_MARK
    };

    // Cast to any to work around strict typing with v1beta1 specific fields
    const [response] = await (this.googleBetaClient.synthesizeSpeech(request as any) as Promise<any[]>);

    if (!response.audioContent) {
      throw new Error('Google TTS returned no audio content');
    }

    const audioBuffer = Buffer.from(response.audioContent as Uint8Array);
    
    // Parse timepoints into word timing array
    const timepoints = response.timepoints || [];
    const wordTimings = this.parseWordTimings(timepoints, words);
    
    console.log(`[Google TTS Timing] ✓ Generated ${audioBuffer.length} bytes with ${wordTimings.length} word timings`);

    return {
      audioBuffer,
      contentType: 'audio/mpeg',
      wordTimings,
    };
  }

  /**
   * Synthesize speech using Google Cloud TTS (Neural2 and Chirp 3 HD voices)
   * Uses the target language voice consistently for authentic pronunciation
   * 
   * IMPORTANT: Chirp 3 HD voices do NOT support SSML. When phoneme tags are needed,
   * we automatically switch to Neural2 voices which support SSML phoneme pronunciation.
   * 
   * @param text - Text to synthesize
   * @param language - Voice language (e.g., "spanish" for Spanish accent)
   * @param targetLanguage - Target learning language for SSML phoneme tags (optional)
   * @param returnTimings - Whether to return word-level timing data for subtitles
   * @param speakingRate - Speaking rate: 0.25 to 4.0 (default 0.9, use 0.7 for slow mode)
   */
  private async synthesizeWithGoogle(text: string, language?: string, targetLanguage?: string, returnTimings?: boolean, speakingRate?: number): Promise<TTSResponse> {
    if (!this.googleClient) {
      throw new Error('Google Cloud TTS client not initialized');
    }

    // Determine base language
    let selectedLanguage: string;
    if (language) {
      selectedLanguage = language.toLowerCase();
    } else {
      selectedLanguage = this.detectLanguage(text);
    }

    // If word timings are requested, use SSML with marks and Neural2 voice (Chirp doesn't support SSML)
    if (returnTimings && this.googleBetaClient) {
      console.log(`[Google TTS] Word timings requested - using SSML with marks`);
      return this.synthesizeWithTimings(text, selectedLanguage);
    }

    // Apply SSML phoneme tags for embedded target-language words if targetLanguage provided
    const { text: processedText, usesSSML } = this.addPhonemeTagsForTargetWords(text, targetLanguage);

    // CRITICAL: Chirp 3 HD voices do NOT support SSML!
    // If SSML is needed, switch to Neural2 voice which supports phoneme tags
    let voiceConfig: { name: string; languageCode: string };
    if (usesSSML) {
      // Use Neural2 voice for SSML compatibility
      voiceConfig = GOOGLE_SSML_VOICE_MAP[selectedLanguage] || GOOGLE_SSML_VOICE_MAP['english'];
      console.log(`[Google TTS] Using SSML-compatible voice: ${voiceConfig.name} (${selectedLanguage}) for phoneme pronunciation`);
    } else {
      // Use Chirp 3 HD for best quality when no SSML needed
      voiceConfig = GOOGLE_VOICE_MAP[selectedLanguage] || GOOGLE_VOICE_MAP['english'];
      console.log(`[Google TTS] Using Chirp 3 HD voice: ${voiceConfig.name} (${selectedLanguage})`);
    }

    console.log(`[Google TTS] Synthesizing ${text.length} chars with ${voiceConfig.name}${usesSSML ? ' (with SSML phoneme tags)' : ''}`);

    // DEBUG: Log exact SSML being sent to Google
    if (usesSSML) {
      console.log(`[SSML REQUEST DEBUG] Length: ${processedText.length} chars`);
      console.log(`[SSML REQUEST DEBUG] First 300 chars: ${processedText.substring(0, 300)}`);
      // Only log char codes in dev for debugging
      const hasNonAscii = processedText.split('').some(c => c.charCodeAt(0) > 127);
      if (hasNonAscii) {
        console.log(`[SSML REQUEST DEBUG] WARNING: Contains non-ASCII chars that should be entity-encoded`);
      }
    }

    // Prepare the synthesis request using standard v1 API
    // Speaking rate: 0.25-4.0, default 0.9 (normal), 0.7 for slow mode
    const effectiveSpeakingRate = speakingRate ?? 0.9;
    console.log(`[Google TTS] Speaking rate: ${effectiveSpeakingRate}`);
    
    const request = {
      input: usesSSML ? { ssml: processedText } : { text: processedText },
      voice: {
        languageCode: voiceConfig.languageCode,
        name: voiceConfig.name,
      },
      audioConfig: {
        audioEncoding: 'MP3' as const,
        speakingRate: effectiveSpeakingRate,
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
    if (provider === 'cartesia') {
      return this.cartesiaClient !== null;
    }
    if (provider === 'google') {
      return this.googleClient !== null;
    }
    return this.openaiClient !== null;
  }

  /**
   * Get the current Cartesia model being used
   */
  getCartesiaModel(): string {
    return this.cartesiaModel;
  }

  /**
   * Set whether fallback to Google is enabled
   */
  setFallbackEnabled(enabled: boolean): void {
    this.fallbackEnabled = enabled;
    console.log(`[TTS Service] Fallback ${enabled ? 'enabled' : 'disabled'}`);
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
    cartesiaAvailable: boolean;
    cartesiaModel: string;
    googleAvailable: boolean;
    openaiAvailable: boolean;
    googleHealthy?: boolean;
    healthMessage?: string;
    fallbackEnabled: boolean;
  }> {
    const cartesiaAvailable = this.isProviderAvailable('cartesia');
    const googleAvailable = this.isProviderAvailable('google');
    const openaiAvailable = this.isProviderAvailable('openai');

    let googleHealthy = false;
    let healthMessage = '';

    if (googleAvailable) {
      const healthCheck = await this.healthCheckGoogle();
      googleHealthy = healthCheck.healthy;
      healthMessage = healthCheck.message || healthCheck.error || '';
    }

    return {
      currentProvider: this.provider,
      cartesiaAvailable,
      cartesiaModel: this.cartesiaModel,
      googleAvailable,
      openaiAvailable,
      googleHealthy,
      healthMessage,
      fallbackEnabled: this.fallbackEnabled
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
