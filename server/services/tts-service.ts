import { TextToSpeechClient, protos } from '@google-cloud/text-to-speech';
import { v1beta1 as ttsV1Beta1 } from '@google-cloud/text-to-speech';
import OpenAI from 'openai';
import { CartesiaClient } from '@cartesia/cartesia-js';
import { franc } from 'franc-min';
import { stripWhiteboardMarkup } from '@shared/whiteboard-types';

/**
 * TTS Provider Interface
 * 
 * VOICE ARCHITECTURE:
 * - Daniela (main AI tutor, streaming voice chat): Deepgram Nova-3 (STT) → Gemini (LLM) → Cartesia Sonic-3 (TTS)
 * - Support/Assistant tutors: Google Cloud TTS
 * - OpenAI Realtime: Separate legacy proxy (realtime-proxy.ts), NOT used for Daniela
 * 
 * Providers:
 * - cartesia: Cartesia Sonic-3 (40ms latency, full SSML support, emotion tags) - PRIMARY for Daniela
 * - google: Google Cloud Chirp HD (500-1500ms latency, limited SSML) - For support/assistant tutors
 * - openai: OpenAI TTS (legacy, available if USER_OPENAI_API_KEY set)
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
 * Tutor Personality Types
 * Each personality has a baseline emotion and allowed emotion range
 */
export type TutorPersonality = 'warm' | 'calm' | 'energetic' | 'professional';

/**
 * Personality Preset Configuration
 * Defines baseline emotion and allowed emotions for each personality type
 */
export interface PersonalityPreset {
  baseline: CartesiaEmotion;      // Default emotion when AI doesn't specify
  primary: CartesiaEmotion[];     // Preferred emotions for this personality
  allowed: CartesiaEmotion[];     // All allowed emotions (includes primary + extended)
  description: string;            // Human-readable description
}

/**
 * Personality Presets
 * Maps personality types to their emotion configurations
 */
export const PERSONALITY_PRESETS: Record<TutorPersonality, PersonalityPreset> = {
  warm: {
    baseline: 'friendly',
    primary: ['friendly', 'encouraging', 'happy'],
    allowed: ['friendly', 'encouraging', 'happy', 'curious', 'patient', 'surprised'],
    description: 'Warm & Encouraging - Supportive and positive, celebrates successes'
  },
  calm: {
    baseline: 'calm',
    primary: ['calm', 'patient', 'neutral'],
    allowed: ['calm', 'patient', 'neutral', 'friendly', 'curious', 'encouraging'],
    description: 'Calm & Patient - Relaxed and steady, never rushed'
  },
  energetic: {
    baseline: 'enthusiastic',
    primary: ['enthusiastic', 'excited', 'happy'],
    allowed: ['enthusiastic', 'excited', 'happy', 'curious', 'surprised', 'encouraging', 'friendly'],
    description: 'Energetic & Fun - High energy, makes learning exciting'
  },
  professional: {
    baseline: 'neutral',
    primary: ['neutral', 'calm', 'curious'],
    allowed: ['neutral', 'calm', 'curious', 'patient', 'encouraging'],
    description: 'Professional - Business-like, focused on efficiency'
  }
};

/**
 * Expressiveness Level Configuration
 * Maps expressiveness levels (1-5) to emotion selection behavior
 */
export interface ExpressivenessConfig {
  useBaseline: number;      // % chance to use baseline emotion
  usePrimary: number;       // % chance to use primary emotions
  useAllowed: number;       // % chance to use any allowed emotion
  allowSpontaneous: boolean; // Whether AI can suggest emotions outside the allowed list
}

export const EXPRESSIVENESS_LEVELS: Record<number, ExpressivenessConfig> = {
  1: { useBaseline: 80, usePrimary: 20, useAllowed: 0, allowSpontaneous: false },  // Very subtle
  2: { useBaseline: 60, usePrimary: 35, useAllowed: 5, allowSpontaneous: false },  // Subtle
  3: { useBaseline: 40, usePrimary: 45, useAllowed: 15, allowSpontaneous: false }, // Balanced (default)
  4: { useBaseline: 20, usePrimary: 50, useAllowed: 30, allowSpontaneous: true },  // Expressive
  5: { useBaseline: 10, usePrimary: 40, useAllowed: 50, allowSpontaneous: true },  // Very expressive
};

/**
 * Cartesia emotion intensity levels
 * Maps expressiveness to emotion intensity suffix for more/less punch
 */
export type EmotionIntensity = '' | ':low' | ':high' | ':highest';

/**
 * Get emotion intensity suffix based on expressiveness level
 * Higher expressiveness = more emotional punch in the voice
 */
export function getEmotionIntensity(expressiveness: number = 3): EmotionIntensity {
  const level = Math.min(5, Math.max(1, expressiveness));
  if (level <= 1) return ':low';      // Very subtle - reduce intensity
  if (level <= 2) return '';           // Subtle - default intensity  
  if (level <= 3) return ':high';      // Balanced - now gets boost for more punch
  if (level <= 4) return ':high';      // Expressive - boost intensity
  return ':highest';                   // Very expressive - maximum punch
}

/**
 * Get emotion string with intensity suffix for Cartesia
 * Returns format like 'excited:high' or 'friendly' (no suffix for default)
 */
export function getEmotionWithIntensity(
  emotion: CartesiaEmotion,
  expressiveness: number = 3
): string {
  const intensity = getEmotionIntensity(expressiveness);
  return `${emotion}${intensity}`;
}

/**
 * Get allowed emotions for a personality and expressiveness level
 * Returns the emotions the AI should choose from
 */
export function getAllowedEmotions(
  personality: TutorPersonality = 'warm',
  expressiveness: number = 3
): CartesiaEmotion[] {
  const preset = PERSONALITY_PRESETS[personality];
  const config = EXPRESSIVENESS_LEVELS[Math.min(5, Math.max(1, expressiveness))];
  
  if (config.useAllowed > 0) {
    return preset.allowed;
  } else if (config.usePrimary > 0) {
    return preset.primary;
  }
  return [preset.baseline];
}

/**
 * Validate and constrain an AI-selected emotion to personality bounds
 * If the AI selects an emotion outside the allowed range, falls back to baseline
 */
export function constrainEmotion(
  aiSelectedEmotion: CartesiaEmotion | undefined,
  personality: TutorPersonality = 'warm',
  expressiveness: number = 3
): CartesiaEmotion {
  const preset = PERSONALITY_PRESETS[personality];
  const config = EXPRESSIVENESS_LEVELS[Math.min(5, Math.max(1, expressiveness))];
  
  // If no emotion provided, use baseline
  if (!aiSelectedEmotion) {
    return preset.baseline;
  }
  
  // If spontaneous is allowed (high expressiveness), accept any valid CartesiaEmotion
  if (config.allowSpontaneous) {
    return aiSelectedEmotion;
  }
  
  // Check if the emotion is in the allowed list
  if (preset.allowed.includes(aiSelectedEmotion)) {
    return aiSelectedEmotion;
  }
  
  // Fall back to baseline if emotion is not allowed
  console.log(`[Emotion] AI selected '${aiSelectedEmotion}' not in allowed list for ${personality}, using baseline '${preset.baseline}'`);
  return preset.baseline;
}

/**
 * Get the default (baseline) emotion for a personality type
 * Used for UI initialization and fallback scenarios
 */
export function getDefaultEmotion(personality: TutorPersonality = 'warm'): CartesiaEmotion {
  return PERSONALITY_PRESETS[personality]?.baseline || 'friendly';
}

/**
 * Estimate word-level timings based on text and audio duration
 * Uses word length weighting with punctuation-aware pauses for natural prosody
 * 
 * @param text - The original display text (should not contain phoneme tags)
 * @param audioDurationSeconds - Estimated audio duration in seconds
 * @returns Array of word timings with start/end times
 */
export function estimateWordTimings(text: string, audioDurationSeconds: number): WordTiming[] {
  // Replace laughter tags with space to preserve word count alignment
  // Phonemes should only be added when sending to TTS, not passed here
  const cleanedText = text.replace(/\[laughter\]/gi, ' ');
  
  const words = cleanedText
    .split(/\s+/)
    .map(w => w.trim())
    .filter(w => w.length > 0);
  
  if (words.length === 0) return [];
  
  // Calculate weight for each word:
  // - Base weight from character count
  // - Extra weight for punctuation pauses (commas, periods, etc.)
  const wordWeights = words.map(word => {
    let weight = Math.max(1, word.length);
    
    // Add pause weight for sentence-ending punctuation
    if (/[.!?]$/.test(word)) {
      weight += 2; // Longer pause after sentence ends
    } else if (/[,;:]$/.test(word)) {
      weight += 1; // Short pause after clauses
    }
    
    return weight;
  });
  
  const totalWeight = wordWeights.reduce((sum, w) => sum + w, 0);
  
  const timings: WordTiming[] = [];
  let currentTime = 0;
  
  // Small pause at start for natural pacing
  const startPause = 0.1;
  currentTime = startPause;
  
  // Distribute time proportionally by word weight
  const speakingDuration = audioDurationSeconds - startPause - 0.1; // Leave small buffer at end
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const wordWeight = wordWeights[i];
    const wordDuration = (wordWeight / totalWeight) * speakingDuration;
    
    // Minimum duration of 0.1s per word
    const actualDuration = Math.max(0.1, wordDuration);
    
    timings.push({
      word,
      startTime: currentTime,
      endTime: currentTime + actualDuration,
    });
    
    currentTime += actualDuration;
  }
  
  console.log(`[Word Timing] Estimated ${timings.length} words over ${audioDurationSeconds.toFixed(2)}s`);
  return timings;
}

/**
 * Estimate audio duration from MP3 buffer size
 * MP3 at 128kbps ≈ 16KB per second
 * 
 * @param bufferSize - Size of MP3 buffer in bytes
 * @param bitrateKbps - Bitrate in kilobits per second (default 128)
 * @returns Estimated duration in seconds
 */
function estimateAudioDuration(bufferSize: number, bitrateKbps: number = 128): number {
  // Convert bitrate to bytes per second: kbps * 1000 / 8
  const bytesPerSecond = (bitrateKbps * 1000) / 8;
  return bufferSize / bytesPerSecond;
}

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
  forceProvider?: TTSProvider; // Force a specific provider (bypasses primary provider selection)
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
  'hebrew': { name: 'he-IL-Chirp-HD-O', languageCode: 'he-IL' }, // Hebrew, Chirp 3 HD
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
  'hebrew': { name: 'he-IL-Wavenet-A', languageCode: 'he-IL' }, // Female Wavenet
};

/**
 * Google TTS Assistant Voice Map - Gendered voices for drill assistant (Aris)
 * Students can choose male or female assistant voice for each language
 * Uses Neural2/WaveNet for high quality with clear pronunciation
 * 
 * Voice naming conventions:
 * - Neural2: Generally A/B are female, C/D are male (varies by language)
 * - WaveNet: Similar pattern to Neural2
 */
export type AssistantVoiceGender = 'female' | 'male';

export interface GenderedVoiceConfig {
  female: { name: string; languageCode: string };
  male: { name: string; languageCode: string };
}

export const GOOGLE_ASSISTANT_VOICE_MAP: Record<string, GenderedVoiceConfig> = {
  'english': {
    female: { name: 'en-US-Neural2-F', languageCode: 'en-US' },
    male: { name: 'en-US-Neural2-D', languageCode: 'en-US' },
  },
  'spanish': {
    female: { name: 'es-US-Neural2-A', languageCode: 'es-US' },
    male: { name: 'es-US-Neural2-C', languageCode: 'es-US' },
  },
  'french': {
    female: { name: 'fr-FR-Neural2-A', languageCode: 'fr-FR' },
    male: { name: 'fr-FR-Neural2-D', languageCode: 'fr-FR' },
  },
  'german': {
    female: { name: 'de-DE-Neural2-A', languageCode: 'de-DE' },
    male: { name: 'de-DE-Neural2-B', languageCode: 'de-DE' },
  },
  'italian': {
    female: { name: 'it-IT-Neural2-A', languageCode: 'it-IT' },
    male: { name: 'it-IT-Neural2-C', languageCode: 'it-IT' },
  },
  'portuguese': {
    female: { name: 'pt-BR-Neural2-A', languageCode: 'pt-BR' },
    male: { name: 'pt-BR-Neural2-B', languageCode: 'pt-BR' },
  },
  'japanese': {
    female: { name: 'ja-JP-Neural2-B', languageCode: 'ja-JP' },
    male: { name: 'ja-JP-Neural2-C', languageCode: 'ja-JP' },
  },
  'mandarin chinese': {
    female: { name: 'cmn-CN-Wavenet-A', languageCode: 'cmn-CN' },
    male: { name: 'cmn-CN-Wavenet-B', languageCode: 'cmn-CN' },
  },
  'korean': {
    female: { name: 'ko-KR-Neural2-A', languageCode: 'ko-KR' },
    male: { name: 'ko-KR-Neural2-C', languageCode: 'ko-KR' },
  },
  'hebrew': {
    female: { name: 'he-IL-Wavenet-A', languageCode: 'he-IL' },
    male: { name: 'he-IL-Wavenet-D', languageCode: 'he-IL' },
  },
};

/**
 * Get assistant voice configuration for a language and gender
 */
export function getAssistantVoice(
  language: string,
  gender: AssistantVoiceGender = 'female'
): { name: string; languageCode: string } {
  const normalizedLang = language.toLowerCase();
  const voiceConfig = GOOGLE_ASSISTANT_VOICE_MAP[normalizedLang];
  
  if (!voiceConfig) {
    console.log(`[TTS] No assistant voice config for ${language}, using English`);
    return GOOGLE_ASSISTANT_VOICE_MAP['english'][gender];
  }
  
  return voiceConfig[gender];
}

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
export const MFA_IPA_PRONUNCIATIONS: Record<string, Record<string, string>> = {
  'spanish': {
    // Common greetings - Spanish MFA phonemes
    // Note: Include BOTH lowercase and Capitalized versions for dictionary matching
    'hola': 'o|l|a',                    // HO-la (2 syllables)
    'Hola': 'o|l|a',                    // Capitalized version
    'adiós': 'a|ð|j|o|s',               // a-DIOS
    'Adiós': 'a|ð|j|o|s',               // Capitalized
    'adios': 'a|ð|j|o|s',               // without accent
    'Adios': 'a|ð|j|o|s',               // Capitalized without accent
    'gracias': 'ɡ|ɾ|a|s|j|a|s',         // GRA-cias
    'Gracias': 'ɡ|ɾ|a|s|j|a|s',         // Capitalized
    'por favor': 'p|o|ɾ|f|a|β|o|ɾ',     // por fa-VOR
    'Por favor': 'p|o|ɾ|f|a|β|o|ɾ',     // Capitalized
    'sí': 's|i',                         // sí (1 syllable)
    'Sí': 's|i',                         // Capitalized
    'si': 's|i',                         // without accent
    'no': 'n|o',                         // no (1 syllable)
    
    // Common nouns - essential vocabulary
    'casa': 'k|a|s|a',                   // CA-sa (house)
    'Casa': 'k|a|s|a',                   // Capitalized
    'perro': 'p|e|r|o',                  // PE-rro (dog)
    'Perro': 'p|e|r|o',                  // Capitalized
    'gato': 'ɡ|a|t|o',                   // GA-to (cat)
    'Gato': 'ɡ|a|t|o',                   // Capitalized
    'agua': 'a|ɣ|w|a',                   // A-gua (water)
    'Agua': 'a|ɣ|w|a',                   // Capitalized
    'comida': 'k|o|m|i|ð|a',             // co-MI-da (food)
    'Comida': 'k|o|m|i|ð|a',             // Capitalized
    'amigo': 'a|m|i|ɣ|o',                // a-MI-go (friend masc)
    'Amigo': 'a|m|i|ɣ|o',                // Capitalized
    'amiga': 'a|m|i|ɣ|a',                // a-MI-ga (friend fem)
    'Amiga': 'a|m|i|ɣ|a',                // Capitalized
    'libro': 'l|i|β|ɾ|o',                // LI-bro (book)
    'Libro': 'l|i|β|ɾ|o',                // Capitalized
    'mesa': 'm|e|s|a',                   // ME-sa (table)
    'Mesa': 'm|e|s|a',                   // Capitalized
    'silla': 's|i|ʝ|a',                  // SI-lla (chair)
    'Silla': 's|i|ʝ|a',                  // Capitalized
    
    'buenos días': 'b|w|e|n|o|s|ð|i|a|s', // BUE-nos DI-as
    'Buenos días': 'b|w|e|n|o|s|ð|i|a|s', // Capitalized
    'buenos dias': 'b|w|e|n|o|s|ð|i|a|s', // without accent
    'Buenos dias': 'b|w|e|n|o|s|ð|i|a|s', // Capitalized without accent
    'buenas tardes': 'b|w|e|n|a|s|t|a|ɾ|ð|e|s', // BUE-nas TAR-des
    'Buenas tardes': 'b|w|e|n|a|s|t|a|ɾ|ð|e|s', // Capitalized
    'buenas noches': 'b|w|e|n|a|s|n|o|tʃ|e|s',  // BUE-nas NO-ches
    'Buenas noches': 'b|w|e|n|a|s|n|o|tʃ|e|s',  // Capitalized
    'qué tal': 'k|e|t|a|l',             // qué TAL
    'Qué tal': 'k|e|t|a|l',             // Capitalized
    'que tal': 'k|e|t|a|l',             // without accent
    'cómo estás': 'k|o|m|o|e|s|t|a|s',  // CÓ-mo es-TÁS
    'Cómo estás': 'k|o|m|o|e|s|t|a|s',  // Capitalized
    'como estas': 'k|o|m|o|e|s|t|a|s',  // without accents
    'perfecto': 'p|e|ɾ|f|e|k|t|o',      // per-FEC-to
    'Perfecto': 'p|e|ɾ|f|e|k|t|o',      // Capitalized
    'excelente': 'e|k|s|e|l|e|n|t|e',   // ex-ce-LEN-te
    'Excelente': 'e|k|s|e|l|e|n|t|e',   // Capitalized
    'maravilloso': 'm|a|ɾ|a|β|i|ʝ|o|s|o', // ma-ra-vi-LLO-so
    'Maravilloso': 'm|a|ɾ|a|β|i|ʝ|o|s|o', // Capitalized
    'fantástico': 'f|a|n|t|a|s|t|i|k|o', // fan-TÁS-ti-co
    'Fantástico': 'f|a|n|t|a|s|t|i|k|o', // Capitalized
    'fantastico': 'f|a|n|t|a|s|t|i|k|o', // without accent
    'estupendo': 'e|s|t|u|p|e|n|d|o',   // es-tu-PEN-do
    'Estupendo': 'e|s|t|u|p|e|n|d|o',   // Capitalized
    'genial': 'x|e|n|j|a|l',            // ge-NIAL
    'Genial': 'x|e|n|j|a|l',            // Capitalized
    'fenomenal': 'f|e|n|o|m|e|n|a|l',   // fe-no-me-NAL
    'Fenomenal': 'f|e|n|o|m|e|n|a|l',   // Capitalized
    'increíble': 'i|n|k|ɾ|e|i|β|l|e',   // in-cre-Í-ble
    'Increíble': 'i|n|k|ɾ|e|i|β|l|e',   // Capitalized
    'increible': 'i|n|k|ɾ|e|i|β|l|e',   // without accent
    'magnífico': 'm|a|ɣ|n|i|f|i|k|o',   // mag-NÍ-fi-co
    'Magnífico': 'm|a|ɣ|n|i|f|i|k|o',   // Capitalized
    'magnifico': 'm|a|ɣ|n|i|f|i|k|o',   // without accent
    'correcto': 'k|o|r|e|k|t|o',        // co-RREC-to
    'Correcto': 'k|o|r|e|k|t|o',        // Capitalized
    'bueno': 'b|w|e|n|o',               // BUE-no
    'Bueno': 'b|w|e|n|o',               // Capitalized
    'bien': 'b|j|e|n',                  // bien
    'Bien': 'b|j|e|n',                  // Capitalized
    'muy bien': 'm|u|i|b|j|e|n',        // muy bien
    'Muy bien': 'm|u|i|b|j|e|n',        // Capitalized
    'de nada': 'd|e|n|a|ð|a',           // de NA-da
    'De nada': 'd|e|n|a|ð|a',           // Capitalized
    'lo siento': 'l|o|s|j|e|n|t|o',     // lo SIEN-to
    'Lo siento': 'l|o|s|j|e|n|t|o',     // Capitalized
    'amigo': 'a|m|i|ɣ|o',               // friend
    'Amigo': 'a|m|i|ɣ|o',               // Capitalized
    'amiga': 'a|m|i|ɣ|a',               // friend (f)
    'Amiga': 'a|m|i|ɣ|a',               // Capitalized
    'español': 'e|s|p|a|ɲ|o|l',         // Spanish
    'Español': 'e|s|p|a|ɲ|o|l',         // Capitalized
    'inglés': 'i|n|ɡ|l|e|s',            // English
    'Inglés': 'i|n|ɡ|l|e|s',            // Capitalized
    'por qué': 'p|o|ɾ|k|e',             // why
    'Por qué': 'p|o|ɾ|k|e',             // Capitalized
    'porque': 'p|o|ɾ|k|e',              // because
    'Porque': 'p|o|ɾ|k|e',              // Capitalized
    'mucho': 'm|u|tʃ|o',                // much/many
    'Mucho': 'm|u|tʃ|o',                // Capitalized
    'también': 't|a|m|b|j|e|n',         // also
    'También': 't|a|m|b|j|e|n',         // Capitalized
    'siempre': 's|j|e|m|p|ɾ|e',         // always
    'Siempre': 's|j|e|m|p|ɾ|e',         // Capitalized
    'ahora': 'a|o|ɾ|a',                 // now
    'Ahora': 'a|o|ɾ|a',                 // Capitalized
    'y tú': 'i|t|u',                    // and you? (y = "ee", not "why")
    'tú': 't|u',                        // you (informal)
    'Tú': 't|u',                        // Capitalized
    'usted': 'u|s|t|e|ð',               // you (formal)
    'Usted': 'u|s|t|e|ð',               // Capitalized
    'estoy bien': 'e|s|t|o|i|b|j|e|n',  // I'm fine
    'Estoy bien': 'e|s|t|o|i|b|j|e|n',  // Capitalized
    'estoy bien, gracias': 'e|s|t|o|i|b|j|e|n|ɡ|ɾ|a|s|j|a|s', // I'm fine, thanks
    'me llamo': 'm|e|ʝ|a|m|o',          // my name is
    'Me llamo': 'm|e|ʝ|a|m|o',          // Capitalized
    'mucho gusto': 'm|u|tʃ|o|ɡ|u|s|t|o', // nice to meet you
    'Mucho gusto': 'm|u|tʃ|o|ɡ|u|s|t|o', // Capitalized
    'hasta luego': 'a|s|t|a|l|w|e|ɣ|o', // see you later
    'Hasta luego': 'a|s|t|a|l|w|e|ɣ|o', // Capitalized
    'hasta mañana': 'a|s|t|a|m|a|ɲ|a|n|a', // see you tomorrow
    'Hasta mañana': 'a|s|t|a|m|a|ɲ|a|n|a', // Capitalized
  },
  'french': {
    'bonjour': 'b|ɔ̃|ʒ|u|ʁ',            // hello
    'Bonjour': 'b|ɔ̃|ʒ|u|ʁ',            // Capitalized
    'merci': 'm|ɛ|ʁ|s|i',              // thank you
    'Merci': 'm|ɛ|ʁ|s|i',              // Capitalized
    'oui': 'w|i',                       // yes
    'Oui': 'w|i',                       // Capitalized
    'non': 'n|ɔ̃',                       // no
    'Non': 'n|ɔ̃',                       // Capitalized
    's\'il vous plaît': 's|i|l|v|u|p|l|ɛ', // please
    'S\'il vous plaît': 's|i|l|v|u|p|l|ɛ', // Capitalized
    'au revoir': 'o|ʁ|ə|v|w|a|ʁ',       // goodbye
    'Au revoir': 'o|ʁ|ə|v|w|a|ʁ',       // Capitalized
    'comment': 'k|ɔ|m|ɑ̃',               // how
    'Comment': 'k|ɔ|m|ɑ̃',               // Capitalized
    'très bien': 't|ʁ|ɛ|b|j|ɛ̃',         // very good
    'Très bien': 't|ʁ|ɛ|b|j|ɛ̃',         // Capitalized
    'excusez-moi': 'ɛ|k|s|k|y|z|e|m|w|a', // excuse me
    'Excusez-moi': 'ɛ|k|s|k|y|z|e|m|w|a', // Capitalized
    'je suis': 'ʒ|ə|s|ɥ|i',             // I am
    'Je suis': 'ʒ|ə|s|ɥ|i',             // Capitalized
  },
  'german': {
    'hallo': 'h|a|l|o',                 // hello
    'Hallo': 'h|a|l|o',                 // Capitalized
    'guten tag': 'ɡ|u|t|ə|n|t|a|k',     // good day
    'Guten Tag': 'ɡ|u|t|ə|n|t|a|k',     // Capitalized
    'Guten tag': 'ɡ|u|t|ə|n|t|a|k',     // Mixed case
    'danke': 'd|a|ŋ|k|ə',               // thank you
    'Danke': 'd|a|ŋ|k|ə',               // Capitalized
    'bitte': 'b|ɪ|t|ə',                 // please
    'Bitte': 'b|ɪ|t|ə',                 // Capitalized
    'ja': 'j|a',                        // yes
    'Ja': 'j|a',                        // Capitalized
    'nein': 'n|aɪ|n',                   // no
    'Nein': 'n|aɪ|n',                   // Capitalized
    'auf wiedersehen': 'a|ʊ|f|v|i|d|ɐ|z|e|ə|n', // goodbye
    'Auf Wiedersehen': 'a|ʊ|f|v|i|d|ɐ|z|e|ə|n', // Capitalized
    'Auf wiedersehen': 'a|ʊ|f|v|i|d|ɐ|z|e|ə|n', // Mixed case
    'ich': 'ɪ|ç',                       // I
    'Ich': 'ɪ|ç',                       // Capitalized
    'spreche': 'ʃ|p|ʁ|ɛ|ç|ə',           // speak
    'Spreche': 'ʃ|p|ʁ|ɛ|ç|ə',           // Capitalized
  },
  'italian': {
    'ciao': 'tʃ|a|o',                   // hello/goodbye
    'Ciao': 'tʃ|a|o',                   // Capitalized
    'buongiorno': 'b|w|ɔ|n|dʒ|ɔ|r|n|o', // good morning
    'Buongiorno': 'b|w|ɔ|n|dʒ|ɔ|r|n|o', // Capitalized
    'grazie': 'ɡ|r|a|t|s|j|e',          // thank you
    'Grazie': 'ɡ|r|a|t|s|j|e',          // Capitalized
    'prego': 'p|r|e|ɡ|o',               // you're welcome
    'Prego': 'p|r|e|ɡ|o',               // Capitalized
    'sì': 's|i',                        // yes
    'Sì': 's|i',                        // Capitalized
    'no': 'n|o',                        // no
    'No': 'n|o',                        // Capitalized
    'arrivederci': 'a|r|i|v|e|d|e|r|tʃ|i', // goodbye
    'Arrivederci': 'a|r|i|v|e|d|e|r|tʃ|i', // Capitalized
    'per favore': 'p|e|r|f|a|v|o|r|e',  // please
    'Per favore': 'p|e|r|f|a|v|o|r|e',  // Capitalized
  },
  'portuguese': {
    'olá': 'o|l|a',                     // hello
    'Olá': 'o|l|a',                     // Capitalized
    'bom dia': 'b|õ|dʒ|i|ɐ',            // good morning
    'Bom dia': 'b|õ|dʒ|i|ɐ',            // Capitalized
    'obrigado': 'o|b|ɾ|i|ɡ|a|d|u',      // thank you (m)
    'Obrigado': 'o|b|ɾ|i|ɡ|a|d|u',      // Capitalized
    'obrigada': 'o|b|ɾ|i|ɡ|a|d|ɐ',      // thank you (f)
    'Obrigada': 'o|b|ɾ|i|ɡ|a|d|ɐ',      // Capitalized
    'sim': 's|ĩ',                       // yes
    'Sim': 's|ĩ',                       // Capitalized
    'não': 'n|ɐ̃|w̃',                    // no
    'Não': 'n|ɐ̃|w̃',                    // Capitalized
    'por favor': 'p|o|ɾ|f|a|v|o|ɾ',     // please
    'Por favor': 'p|o|ɾ|f|a|v|o|ɾ',     // Capitalized
    'tchau': 'tʃ|a|w',                  // bye
    'Tchau': 'tʃ|a|w',                  // Capitalized
  },
  'japanese': {
    'konnichiwa': 'k|o|n|i|tʃ|i|w|a',   // hello
    'Konnichiwa': 'k|o|n|i|tʃ|i|w|a',   // Capitalized
    'arigatou': 'a|ɾ|i|ɡ|a|t|o|ɯ',      // thank you
    'Arigatou': 'a|ɾ|i|ɡ|a|t|o|ɯ',      // Capitalized
    'hai': 'h|a|i',                     // yes
    'Hai': 'h|a|i',                     // Capitalized
    'iie': 'i|i|e',                     // no
    'Iie': 'i|i|e',                     // Capitalized
    'sumimasen': 's|ɯ|m|i|m|a|s|e|n',   // excuse me
    'Sumimasen': 's|ɯ|m|i|m|a|s|e|n',   // Capitalized
    'ohayou': 'o|h|a|j|o|ɯ',            // good morning
    'Ohayou': 'o|h|a|j|o|ɯ',            // Capitalized
    'sayounara': 's|a|j|o|ɯ|n|a|ɾ|a',   // goodbye
    'Sayounara': 's|a|j|o|ɯ|n|a|ɾ|a',   // Capitalized
  },
  'mandarin chinese': {
    'nǐ hǎo': 'n|i|x|a|o',              // hello
    'Nǐ hǎo': 'n|i|x|a|o',              // Capitalized
    'xièxie': 'ɕ|j|e|ɕ|j|e',            // thank you
    'Xièxie': 'ɕ|j|e|ɕ|j|e',            // Capitalized
    'shì': 'ʂ|ɨ',                       // yes/is
    'Shì': 'ʂ|ɨ',                       // Capitalized
    'bù': 'p|u',                        // no/not
    'Bù': 'p|u',                        // Capitalized
    'zàijiàn': 't|s|a|i|tɕ|j|e|n',      // goodbye
    'Zàijiàn': 't|s|a|i|tɕ|j|e|n',      // Capitalized
  },
  'korean': {
    'annyeonghaseyo': 'a|n|j|ʌ|ŋ|h|a|s|e|j|o', // hello
    'Annyeonghaseyo': 'a|n|j|ʌ|ŋ|h|a|s|e|j|o', // Capitalized
    'kamsahamnida': 'k|a|m|s|a|h|a|m|n|i|d|a', // thank you
    'Kamsahamnida': 'k|a|m|s|a|h|a|m|n|i|d|a', // Capitalized
    'ne': 'n|e',                        // yes
    'Ne': 'n|e',                        // Capitalized
    'aniyo': 'a|n|i|j|o',               // no
    'Aniyo': 'a|n|i|j|o',               // Capitalized
  },
};

/**
 * Standalone function to add Cartesia phoneme tags for quoted foreign words
 * Can be used by both TTSService and CartesiaStreamingService
 */
export function addCartesiaPhonemesToText(text: string, targetLanguage?: string): string {
  if (!targetLanguage) {
    return text;
  }

  const languageKey = targetLanguage.toLowerCase();
  const pronunciations = MFA_IPA_PRONUNCIATIONS[languageKey];
  
  if (!pronunciations) {
    return text;
  }

  let hasReplacements = false;
  let processedText = text;

  // PASS 1: Process quoted words (single, double, smart quotes)
  const quotedWordPattern = /["""''']([^"""''']+)["""''']/g;
  
  processedText = processedText.replace(quotedWordPattern, (match, word) => {
    const normalizedWord = word.toLowerCase().trim();
    const phonemes = pronunciations[normalizedWord];
    if (phonemes) {
      hasReplacements = true;
      console.log(`[Streaming Phonemes] Quoted "${word}" → <<${phonemes}>>`);
      return `<<${phonemes}>>`;
    }
    return word;
  });

  // PASS 2: Process UNQUOTED multi-word phrases FIRST (before single words)
  // This ensures "por favor" is matched as a phrase before "por" is matched alone
  const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  // Sort by length (longest first) to match multi-word phrases before single words
  const sortedEntries = Object.entries(pronunciations).sort((a, b) => b[0].length - a[0].length);
  
  console.log(`[Streaming Phonemes] Processing text: "${processedText.substring(0, 80)}..." for ${targetLanguage}`);
  
  for (const [word, phonemes] of sortedEntries) {
    // Match words with flexible boundaries to handle punctuation like (adios) or adios.
    // Use word boundaries but also handle cases where word is followed by punctuation
    const simpleRegex = new RegExp(
      `(?<!<)\\b(${escapeRegex(word)})\\b(?![^<]*>>)`,
      'gi'
    );
    
    const beforeCount = processedText.length;
    processedText = processedText.replace(simpleRegex, (match) => {
      hasReplacements = true;
      console.log(`[Streaming Phonemes] Matched "${match}" → <<${phonemes}>>`);
      return `<<${phonemes}>>`;
    });
    
    // If no match with simple regex, try extended matching for edge cases:
    // 1. After Spanish inverted punctuation (¿, ¡)
    // 2. Before closing punctuation (., !, ?, ), ], etc.)
    // IMPORTANT: Use word boundary at start to avoid matching substrings (e.g., "adios" in "estadios")
    if (processedText.length === beforeCount) {
      // Match standalone word with optional Spanish inverted punctuation before
      // and punctuation/space/end after. Must have word boundary at start.
      const extendedRegex = new RegExp(
        `(?<!<)(?<=^|[\\s¿¡])(${escapeRegex(word)})(?=[?!.,;:)\\]\\s]|$)(?![^<]*>>)`,
        'gi'
      );
      processedText = processedText.replace(extendedRegex, (match) => {
        hasReplacements = true;
        console.log(`[Streaming Phonemes] Extended match "${match}" → <<${phonemes}>>`);
        return `<<${phonemes}>>`;
      });
    }
  }

  if (hasReplacements) {
    console.log(`[Streaming Phonemes] Processed: "${processedText.substring(0, 100)}..."`);
  }
  
  return processedText;
}

/**
 * TTS Service - Abstraction layer supporting multiple TTS providers
 * 
 * Supports:
 * - Cartesia Sonic-3/Turbo - Ultra-low latency (40-90ms), full SSML, emotion tags
 * - Google Cloud Chirp HD - High quality but slower (500-1500ms)
 * - OpenAI TTS (tts-1, tts-1-hd) - Fast but limited control (not used)
 * 
 * Provider selection via TTS_PRIMARY_PROVIDER env var:
 * - 'google': Use Google Cloud as primary (default - recommended for production)
 * - 'cartesia': Use Cartesia as primary (if CARTESIA_API_KEY set)
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

    // OpenAI client (legacy, not used for Daniela voice chat - see realtime-proxy.ts for OpenAI Realtime)
    if (process.env.USER_OPENAI_API_KEY) {
      this.openaiClient = new OpenAI({
        apiKey: process.env.USER_OPENAI_API_KEY,
        baseURL: 'https://api.openai.com/v1',
      });
    }

    // Determine primary provider based on env var or availability
    // VOICE ARCHITECTURE: Daniela uses Cartesia, Support/Assistant use Google
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
      // Fallback to openai if nothing else configured
      this.provider = 'openai';
    }
    
    // Log provider status
    console.log(`[TTS Service] Primary provider: ${this.provider.toUpperCase()}`);
    if (this.googleClient) {
      console.log(`[TTS Service] ├─ Google Cloud TTS: ✓ ${this.provider === 'google' ? 'PRIMARY' : 'Fallback ready'}`);
    } else {
      console.log('[TTS Service] ├─ Google Cloud TTS: ✗ Not configured');
    }
    if (this.cartesiaClient) {
      console.log(`[TTS Service] ├─ Cartesia: ✓ ${this.provider === 'cartesia' ? 'PRIMARY' : 'Available'} (${this.cartesiaModel})`);
    } else {
      console.log('[TTS Service] ├─ Cartesia: ✗ Not configured (set CARTESIA_API_KEY)');
    }
    if (this.openaiClient) {
      console.log(`[TTS Service] └─ OpenAI: ✓ Available`);
    } else {
      console.log('[TTS Service] └─ OpenAI: ✗ Not configured');
    }
    
    // Validate at least one provider is available
    if (!this.cartesiaClient && !this.googleClient && !this.openaiClient) {
      console.error('[TTS Service] CRITICAL: No TTS provider configured!');
      console.error('[TTS Service] Set GOOGLE_CLOUD_TTS_CREDENTIALS, CARTESIA_API_KEY, or OPENAI_API_KEY');
    }
  }

  /**
   * Synthesize speech from text using the configured primary provider
   * Falls back to Google Cloud TTS if primary fails and fallback is enabled
   */
  async synthesize(request: TTSRequest): Promise<TTSResponse> {
    const { text, language, voice, voiceId, targetLanguage, returnTimings, speakingRate, emotion, forceProvider } = request;
    const startTime = Date.now();

    // If forceProvider is specified, use that provider directly (bypass normal provider selection)
    // This is used for:
    // - Assistant tutors who need Google TTS even when Cartesia is primary
    // - Tutor voices that MUST use Cartesia (bypassing auto-remediation)
    if (forceProvider === 'google') {
      if (!this.googleClient) {
        throw new Error('Google Cloud TTS is not available. Set GOOGLE_CLOUD_TTS_CREDENTIALS.');
      }
      console.log(`[TTS] Force provider: Google (assistant mode)`);
      const result = await this.synthesizeWithGoogle(text, language, targetLanguage, returnTimings, speakingRate, voice);
      const elapsed = Date.now() - startTime;
      console.log(`[TTS] ✓ Google (forced) completed in ${elapsed}ms`);
      return result;
    }
    
    // Force Cartesia - bypass auto-remediation entirely
    // Tutors should ONLY use Cartesia, never fall back to Google
    if (forceProvider === 'cartesia') {
      if (!this.cartesiaClient) {
        throw new Error('Cartesia is not available. Set CARTESIA_API_KEY.');
      }
      console.log(`[TTS] Force provider: Cartesia (tutor mode - bypassing auto-remediation)`);
      const result = await this.synthesizeWithCartesia(text, language, speakingRate, emotion, voiceId, targetLanguage);
      const elapsed = Date.now() - startTime;
      console.log(`[TTS] ✓ Cartesia (forced) completed in ${elapsed}ms`);
      return result;
    }

    // Check auto-remediation state before selecting provider
    const { voiceDiagnostics } = await import('./voice-diagnostics-service');
    const shouldUseFallbackProvider = voiceDiagnostics.shouldUseFallback('general');
    
    // If auto-remediation says to use fallback, skip Cartesia and go directly to Google
    if (shouldUseFallbackProvider && this.googleClient) {
      console.log('[TTS] Auto-remediation active: skipping Cartesia, using Google fallback');
      try {
        const result = await this.synthesizeWithGoogle(text, language, targetLanguage, returnTimings, speakingRate, voice);
        const elapsed = Date.now() - startTime;
        console.log(`[TTS] ✓ Google (auto-remediation) completed in ${elapsed}ms`);
        voiceDiagnostics.recordTTSResult(true, elapsed, 'general');
        return result;
      } catch (googleError: any) {
        console.error(`[TTS] ❌ Google (auto-remediation) failed: ${googleError.message}`);
        voiceDiagnostics.recordTTSResult(false, undefined, 'general');
        throw new Error(`Google TTS failed during auto-remediation: ${googleError.message}`);
      }
    }
    
    // Try Cartesia first if it's the primary provider
    if (this.provider === 'cartesia' && this.cartesiaClient) {
      try {
        const result = await this.synthesizeWithCartesia(text, language, speakingRate, emotion, voiceId, targetLanguage);
        const elapsed = Date.now() - startTime;
        console.log(`[TTS] ✓ Cartesia completed in ${elapsed}ms (emotion: ${emotion || 'default'})`);
        // Record TTS success for auto-remediation (general persona for non-streaming TTS)
        voiceDiagnostics.recordTTSResult(true, elapsed, 'general');
        return result;
      } catch (error: any) {
        console.error(`[TTS] ⚠ Cartesia failed: ${error.message}`);
        // Record TTS failure for auto-remediation
        voiceDiagnostics.recordTTSResult(false, undefined, 'general');
        
        // Try fallback to Google if enabled
        if (this.fallbackEnabled && this.googleClient) {
          console.log('[TTS] Falling back to Google Cloud TTS...');
          try {
            const result = await this.synthesizeWithGoogle(text, language, targetLanguage, returnTimings, speakingRate, voice);
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
        const result = await this.synthesizeWithGoogle(text, language, targetLanguage, returnTimings, speakingRate, voice);
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
    // Our slow mode uses 0.7, normal is 0.9, extra slow (slow repeat) is 0.5
    let cartesiaSpeed = 1.0; // Default speed
    if (speakingRate !== undefined) {
      if (speakingRate <= 0.5) {
        cartesiaSpeed = 0.6; // Extra slow for slow repeat (Cartesia minimum)
      } else if (speakingRate <= 0.7) {
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

    // STEP 1: Strip whiteboard markup before any other processing
    // The tutor may include [WRITE]...[/WRITE] tags for visual display
    // These should NOT be sent to TTS - audio should sound natural
    const textWithoutMarkup = stripWhiteboardMarkup(text);

    // Apply Cartesia phoneme tags for quoted foreign words
    // This uses <<phoneme1|phoneme2>> syntax for correct pronunciation
    const phonemedText = this.addCartesiaPhonemes(textWithoutMarkup, targetLanguage);
    
    // Clean standalone quotes but PRESERVE apostrophes in contractions (I'm, don't, etc.)
    // Remove: "text", 'text', standalone quotes at word boundaries
    // Keep: I'm, don't, it's, you're (apostrophes between letters)
    const cleanedText = phonemedText
      .replace(/^["'"]+|["'"]+$/g, '')  // Remove leading/trailing quotes
      .replace(/\s["'"]+/g, ' ')         // Quote after space → just space
      .replace(/["'"]+\s/g, ' ')         // Quote before space → just space
      .replace(/["'"]{2,}/g, '')         // Multiple consecutive quotes → remove
      .replace(/(?<![a-zA-Z])["'"](?![a-zA-Z])/g, ''); // Standalone quotes not between letters

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

      // Estimate word timings from audio duration and ORIGINAL text (not phonemedText)
      // The display subtitles should show the original text without phoneme tags
      // MP3 at 128kbps: 16KB ≈ 1 second
      const estimatedDuration = estimateAudioDuration(audioBuffer.length, 128);
      const wordTimings = estimateWordTimings(text, estimatedDuration);

      return {
        audioBuffer,
        contentType: 'audio/mpeg',
        wordTimings, // Estimated timings for karaoke highlighting
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

    let hasReplacements = false;
    let processedText = text;

    // PASS 1: Process quoted words (single, double, smart quotes)
    // Matches: "Hola", 'Hola', "Hola", 'Hola'
    const quotedWordPattern = /["""''']([^"""''']+)["""''']/g;
    
    processedText = processedText.replace(quotedWordPattern, (match, word) => {
      // Normalize the word (lowercase, trim)
      const normalizedWord = word.toLowerCase().trim();
      
      // Check if we have a pronunciation for this word
      const phonemes = pronunciations[normalizedWord];
      if (phonemes) {
        hasReplacements = true;
        // Return Cartesia phoneme syntax: <<phoneme1|phoneme2|...>>
        console.log(`[Cartesia Phonemes] Quoted "${word}" → <<${phonemes}>>`);
        return `<<${phonemes}>>`;
      }
      
      // No pronunciation found, keep original with quotes stripped
      return word;
    });

    // PASS 2: Process UNQUOTED common foreign words
    // This catches cases like "Hola means hello" where Hola is not in quotes
    // Only process words that are word-bounded (not part of larger words)
    for (const [word, phonemes] of Object.entries(pronunciations)) {
      // Skip multi-word phrases for unquoted matching (too risky for false matches)
      if (word.includes(' ')) continue;
      
      // Create a regex that matches the word with word boundaries
      // Case-insensitive to catch "Hola", "hola", "HOLA"
      // Negative lookbehind/ahead for angle brackets to avoid double-processing
      const wordRegex = new RegExp(
        `(?<!<)\\b(${this.escapeRegex(word)})\\b(?![^<]*>>)`,
        'gi'
      );
      
      const before = processedText;
      processedText = processedText.replace(wordRegex, (match) => {
        hasReplacements = true;
        console.log(`[Cartesia Phonemes] Unquoted "${match}" → <<${phonemes}>>`);
        return `<<${phonemes}>>`;
      });
    }

    if (hasReplacements) {
      console.log(`[Cartesia Phonemes] Processed text: "${processedText.substring(0, 150)}..."`);
    }
    
    return processedText;
  }
  
  // Helper to escape special regex characters
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
  private async synthesizeWithGoogle(text: string, language?: string, targetLanguage?: string, returnTimings?: boolean, speakingRate?: number, voiceOverride?: string): Promise<TTSResponse> {
    if (!this.googleClient) {
      throw new Error('Google Cloud TTS client not initialized');
    }

    // STEP 1: Strip whiteboard markup before any other processing
    // The tutor may include [WRITE]...[/WRITE] tags for visual display
    // These should NOT be sent to TTS - audio should sound natural
    const textWithoutMarkup = stripWhiteboardMarkup(text);

    // Determine base language
    let selectedLanguage: string;
    if (language) {
      selectedLanguage = language.toLowerCase();
    } else {
      selectedLanguage = this.detectLanguage(textWithoutMarkup);
    }

    // If word timings are requested, use SSML with marks and Neural2 voice (Chirp doesn't support SSML)
    if (returnTimings && this.googleBetaClient) {
      console.log(`[Google TTS] Word timings requested - using SSML with marks`);
      return this.synthesizeWithTimings(textWithoutMarkup, selectedLanguage);
    }

    // Apply SSML phoneme tags for embedded target-language words if targetLanguage provided
    const { text: processedText, usesSSML } = this.addPhonemeTagsForTargetWords(textWithoutMarkup, targetLanguage);

    // CRITICAL: Chirp 3 HD voices do NOT support SSML!
    // If SSML is needed, switch to Neural2 voice which supports phoneme tags
    let voiceConfig: { name: string; languageCode: string };
    
    // If a specific voice override is provided (e.g., for assistant tutors), use it directly
    if (voiceOverride) {
      if (voiceOverride.includes('Chirp3-HD')) {
        const voiceParts = voiceOverride.split('-');
        const languageCode = voiceParts.length >= 2 ? `${voiceParts[0]}-${voiceParts[1]}` : 'en-US';
        voiceConfig = { name: voiceOverride, languageCode };
      } else if (!voiceOverride.includes('-')) {
        const langCode = 'en-US';
        voiceConfig = { name: `${langCode}-Chirp3-HD-${voiceOverride}`, languageCode: langCode };
      } else {
        const voiceParts = voiceOverride.split('-');
        const languageCode = voiceParts.length >= 2 ? `${voiceParts[0]}-${voiceParts[1]}` : 'en-US';
        voiceConfig = { name: voiceOverride, languageCode };
      }
      console.log(`[Google TTS] Using voice override: ${voiceConfig.name} (${voiceConfig.languageCode}) for assistant tutor`);
    } else if (usesSSML) {
      // Use Neural2 voice for SSML compatibility
      voiceConfig = GOOGLE_SSML_VOICE_MAP[selectedLanguage] || GOOGLE_SSML_VOICE_MAP['english'];
      console.log(`[Google TTS] Using SSML-compatible voice: ${voiceConfig.name} (${selectedLanguage}) for phoneme pronunciation`);
    } else {
      // Use Chirp 3 HD for best quality when no SSML needed
      voiceConfig = GOOGLE_VOICE_MAP[selectedLanguage] || GOOGLE_VOICE_MAP['english'];
      console.log(`[Google TTS] Using Chirp 3 HD voice: ${voiceConfig.name} (${selectedLanguage})`);
    }

    console.log(`[Google TTS] Synthesizing ${textWithoutMarkup.length} chars with ${voiceConfig.name}${usesSSML ? ' (with SSML phoneme tags)' : ''}`);

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
    
    const isChirp3HD = voiceConfig.name.includes('Chirp3-HD');
    const request: any = {
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
    if (isChirp3HD) {
      request.voice.model = 'chirp_3_hd';
    }

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
   * Synthesize speech using Google Cloud TTS streaming and return a complete WAV buffer.
   * Used by Voice Lab preview and other non-WebSocket contexts that need a playable audio file.
   * Uses the same streaming code path as voice sessions for consistency.
   */
  async streamSynthesizeToWavBuffer(params: {
    text: string;
    voiceId: string;
    speakingRate?: number;
  }): Promise<TTSResponse> {
    const chunks: Buffer[] = [];
    
    await this.streamSynthesizeWithGoogle({
      text: params.text,
      voiceId: params.voiceId,
      speakingRate: params.speakingRate,
      onAudioChunk: (chunk) => {
        chunks.push(chunk.audio);
      },
      onComplete: () => {},
      onError: (err) => {
        console.error('[Google TTS StreamToWav] Streaming error:', err.message);
      },
    });
    
    const pcmF32Data = Buffer.concat(chunks);
    const sampleCount = pcmF32Data.length / 4;
    const int16Data = Buffer.alloc(sampleCount * 2);
    for (let i = 0; i < sampleCount; i++) {
      const f32 = pcmF32Data.readFloatLE(i * 4);
      const clamped = Math.max(-1, Math.min(1, f32));
      int16Data.writeInt16LE(Math.round(clamped * 32767), i * 2);
    }
    
    const sampleRate = 24000;
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
    const blockAlign = numChannels * (bitsPerSample / 8);
    const dataSize = int16Data.length;
    const headerSize = 44;
    
    const wavBuffer = Buffer.alloc(headerSize + dataSize);
    wavBuffer.write('RIFF', 0);
    wavBuffer.writeUInt32LE(headerSize + dataSize - 8, 4);
    wavBuffer.write('WAVE', 8);
    wavBuffer.write('fmt ', 12);
    wavBuffer.writeUInt32LE(16, 16);
    wavBuffer.writeUInt16LE(1, 20);
    wavBuffer.writeUInt16LE(numChannels, 22);
    wavBuffer.writeUInt32LE(sampleRate, 24);
    wavBuffer.writeUInt32LE(byteRate, 28);
    wavBuffer.writeUInt16LE(blockAlign, 32);
    wavBuffer.writeUInt16LE(bitsPerSample, 34);
    wavBuffer.write('data', 36);
    wavBuffer.writeUInt32LE(dataSize, 40);
    int16Data.copy(wavBuffer, headerSize);
    
    console.log(`[Google TTS StreamToWav] Generated WAV: ${wavBuffer.length} bytes (${sampleCount} samples, ${(sampleCount / sampleRate).toFixed(2)}s)`);
    
    return {
      audioBuffer: wavBuffer,
      contentType: 'audio/wav',
    };
  }

  async streamSynthesizeWithGoogle(params: {
    text: string;
    voiceId: string;
    speakingRate?: number;
    targetLanguage?: string;
    accentLanguageCode?: string;
    onAudioChunk: (chunk: { audio: Buffer; durationMs: number; audioFormat: string; sampleRate: number; isLast?: boolean }) => void;
    onComplete: (totalBytes: number) => void;
    onError: (error: Error) => void;
  }): Promise<void> {
    if (!this.googleBetaClient) {
      throw new Error('Google Cloud TTS Beta client not available for streaming. Set GOOGLE_CLOUD_TTS_CREDENTIALS.');
    }

    const { text, voiceId, speakingRate = 1.0, targetLanguage, accentLanguageCode, onAudioChunk, onComplete, onError } = params;
    let resolvedVoiceId = voiceId;
    let languageCode: string;
    if (!voiceId || voiceId.trim() === '') {
      const langKey = targetLanguage?.toLowerCase() || 'english';
      const voiceConfig = GOOGLE_VOICE_MAP[langKey] || GOOGLE_VOICE_MAP['english'];
      resolvedVoiceId = voiceConfig.name;
      languageCode = voiceConfig.languageCode;
      // Apply accent override: swap locale prefix on resolved default voice
      if (accentLanguageCode && accentLanguageCode !== languageCode) {
        const baseVoiceName = resolvedVoiceId.split('-').pop();
        resolvedVoiceId = `${accentLanguageCode}-Chirp3-HD-${baseVoiceName}`;
        languageCode = accentLanguageCode;
        console.log(`[Google TTS Stream] No voiceId configured — resolved to ${resolvedVoiceId} (${languageCode}) with accent override from "${langKey}"`);
      } else {
        console.log(`[Google TTS Stream] No voiceId configured — resolved to ${resolvedVoiceId} (${languageCode}) from target language "${langKey}" for accent consistency`);
      }
    } else if (!voiceId.includes('Chirp3-HD') && !voiceId.includes('-')) {
      // Bare speaker name (e.g. "Aoede") — use accent override if set, otherwise en-US base voice
      // Default = clean base voice with no locale shaping; accent variants are explicit overrides
      languageCode = accentLanguageCode || 'en-US';
      resolvedVoiceId = `${languageCode}-Chirp3-HD-${voiceId}`;
      console.log(`[Google TTS Stream] Mapped bare voice "${voiceId}" → "${resolvedVoiceId}" (${languageCode})${accentLanguageCode ? ' (accent override)' : ' (default base voice)'}`);
    } else {
      const voiceParts = voiceId.split('-');
      languageCode = voiceParts.length >= 2 ? `${voiceParts[0]}-${voiceParts[1]}` : 'en-US';
      // Apply accent override: swap locale prefix while keeping voice name
      if (accentLanguageCode && accentLanguageCode !== languageCode) {
        const baseVoiceName = voiceParts[voiceParts.length - 1];
        resolvedVoiceId = `${accentLanguageCode}-Chirp3-HD-${baseVoiceName}`;
        languageCode = accentLanguageCode;
        console.log(`[Google TTS Stream] Accent override: swapped locale to "${resolvedVoiceId}" (${languageCode})`);
      }
    }
    const startTime = Date.now();
    let totalBytes = 0;
    let chunkCount = 0;
    let firstChunkTime: number | null = null;

    const wordsPerMinute = 150;
    const wordCount = text.split(/\s+/).length;
    const estimatedTotalDurationMs = Math.max(1000, (wordCount / wordsPerMinute) * 60000 / speakingRate);

    const STREAM_TIMEOUT_MS = 15000;
    console.log(`[Google TTS Stream] Starting bidirectional stream: ${text.length} chars, voice=${resolvedVoiceId} (${languageCode}), rate=${speakingRate}, est=${Math.round(estimatedTotalDurationMs)}ms, timeout=${STREAM_TIMEOUT_MS}ms`);

    return new Promise<void>((resolve, reject) => {
      const stream = (this.googleBetaClient as any).streamingSynthesize();
      let settled = false;

      let streamTimeout: ReturnType<typeof setTimeout> | null = setTimeout(() => {
        if (!settled) {
          console.error(`[Google TTS Stream] TIMEOUT after ${STREAM_TIMEOUT_MS}ms - stream hung. Received ${chunkCount} chunks, ${totalBytes} bytes so far. Force-completing with available audio.`);
          try { stream.destroy(); } catch (e) { /* ignore destroy errors */ }
          finish();
        }
      }, STREAM_TIMEOUT_MS);

      const finish = (err?: Error) => {
        if (settled) return;
        settled = true;
        if (streamTimeout) {
          clearTimeout(streamTimeout);
          streamTimeout = null;
        }
        if (err) {
          try { onError(err); } catch (e) { console.error('[Google TTS Stream] onError callback threw:', e); }
          reject(err);
        } else {
          const elapsed = Date.now() - startTime;
          const ttfc = firstChunkTime ? firstChunkTime - startTime : -1;
          console.log(`[Google TTS Stream] Complete: ${chunkCount} chunks, ${totalBytes} bytes, ${elapsed}ms total, TTFC=${ttfc}ms`);
          try { onComplete(totalBytes); } catch (e) { console.error('[Google TTS Stream] onComplete callback threw:', e); }
          resolve();
        }
      };

      stream.on('data', (response: any) => {
        try {
          if (response.audioContent && response.audioContent.length > 0) {
            const rawBuffer = Buffer.from(response.audioContent);
            if (rawBuffer.length === 0) return;

            if (!firstChunkTime) {
              firstChunkTime = Date.now();
              console.log(`[Google TTS Stream] First chunk: ${rawBuffer.length} bytes (int16) in ${firstChunkTime - startTime}ms`);
            }

            totalBytes += rawBuffer.length;
            chunkCount++;

            const sampleCount = Math.floor(rawBuffer.length / 2);
            const float32Buffer = Buffer.alloc(sampleCount * 4);
            for (let i = 0; i < sampleCount; i++) {
              const int16Val = rawBuffer.readInt16LE(i * 2);
              const float32Val = int16Val < 0 ? int16Val / 0x8000 : int16Val / 0x7FFF;
              float32Buffer.writeFloatLE(float32Val, i * 4);
            }

            const chunkDurationMs = (sampleCount / 24000) * 1000;

            onAudioChunk({
              audio: float32Buffer,
              durationMs: chunkDurationMs,
              audioFormat: 'pcm_f32le',
              sampleRate: 24000,
            });
          }
        } catch (e) {
          console.error('[Google TTS Stream] onAudioChunk callback threw:', e);
        }
      });

      stream.on('error', (err: Error) => {
        console.error(`[Google TTS Stream] Stream error after ${Date.now() - startTime}ms:`, err.message);
        finish(err);
      });

      stream.on('end', () => {
        finish();
      });

      stream.write({
        streamingConfig: {
          voice: {
            languageCode,
            name: resolvedVoiceId,
          },
          streamingAudioConfig: {
            audioEncoding: 'PCM',
            speakingRate,
            sampleRateHertz: 24000,
          },
        },
      });

      stream.write({
        input: { text },
      });

      stream.end();
    });
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
