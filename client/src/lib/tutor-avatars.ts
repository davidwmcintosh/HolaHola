// Language-specific tutor avatars
// Each language has male and female tutors with 3 states: listening, thinking, talking

// Female avatars by language
import chineseFemaleListening from "@assets/Tutor_Images/Female/Chinese_Female_Listening_No_Background.jpg";
import chineseFemaleTalking from "@assets/Tutor_Images/Female/Chinese_Female_Talking_No_Background.jpg";
import chineseFemaleThinking from "@assets/Tutor_Images/Female/Chinese_Female_Thinking_No_Background.jpg";

import englishFemaleListening from "@assets/Tutor_Images/Female/English_Listening_No_Background.jpg";
import englishFemaleTalking from "@assets/Tutor_Images/Female/English_Talking-No_Background.jpg";
import englishFemaleThinking from "@assets/Tutor_Images/Female/English_Thinking_No_Background.jpg";

import frenchFemaleListening from "@assets/Tutor_Images/Female/French_Female_Listening_No_Background.jpg";
import frenchFemaleTalking from "@assets/Tutor_Images/Female/French_Female_Speaking_No_Background.jpg";
import frenchFemaleThinking from "@assets/Tutor_Images/Female/French_Female_thinking-No_Background.jpg";

import germanFemaleListening from "@assets/Tutor_Images/Female/German_Female_listening_No_Background.jpg";
import germanFemaleTalking from "@assets/Tutor_Images/Female/German_Female_Talking_No_Background.jpg";
import germanFemaleThinking from "@assets/Tutor_Images/Female/German_Female_thinking_No_Background.jpg";

import italianFemaleListening from "@assets/Tutor_Images/Female/Italian_Female_Listening_No_Background.jpg";
import italianFemaleTalking from "@assets/Tutor_Images/Female/Italian_Female_Talking_No_Background.jpg";
import italianFemaleThinking from "@assets/Tutor_Images/Female/Italian_Female_Thinking-No_Background.jpg";

import japaneseFemaleListening from "@assets/Tutor_Images/Female/Japanese_Female_Listening_No_Backgroud.jpg";
import japaneseFemaleTalking from "@assets/Tutor_Images/Female/Japanese_Female_Talking_No_Background.jpg";
import japaneseFemaleThinking from "@assets/Tutor_Images/Female/Japanese_Female_Thinking-_No_Background.jpg";

import koreanFemaleListening from "@assets/Tutor_Images/Female/Korean_Female_Listening-_No_Background.jpg";
import koreanFemaleTalking from "@assets/Tutor_Images/Female/Korean_Female_Talking_No_Background.jpg";
import koreanFemaleThinking from "@assets/Tutor_Images/Female/Korean_Female_Thinking_No_Background.jpg";

import portugueseFemaleListening from "@assets/Tutor_Images/Female/Portuguese_Female_Listening_No_Background.jpg";
import portugueseFemaleTalking from "@assets/Tutor_Images/Female/Portuguese_Female_Talking_No_Background.jpg";
import portugueseFemaleThinking from "@assets/Tutor_Images/Female/Portuguese_Female_Thinking_No_Background.jpg";

// Spanish female uses original Daniela assets
import spanishFemaleListening from "@assets/tutor-listening-no-background_1764099971094.png";
import spanishFemaleThinking from "@assets/daniela_thinking_No_Background_1766161816613.jpg";
import spanishFemaleTalking from "@assets/daniela-speaking-No-Background_1766611262497.png";

// Male avatars by language
import chineseMaleListening from "@assets/Tutor_Images/Male/Chinese_Male_Listening.jpg";
import chineseMaleTalking from "@assets/Tutor_Images/Male/Chinese_Male_Talking.jpg";
import chineseMaleThinking from "@assets/Tutor_Images/Male/Chinese_Male_Thinking.jpg";

import englishMaleListening from "@assets/Tutor_Images/Male/English_Male_Listening.jpg";
import englishMaleTalking from "@assets/Tutor_Images/Male/English_Male_Talking.jpg";
import englishMaleThinking from "@assets/Tutor_Images/Male/English_Male_Thinking.jpg";

import frenchMaleListening from "@assets/Tutor_Images/Male/French_Male_Listening.jpg";
import frenchMaleTalking from "@assets/Tutor_Images/Male/French_Male_Talking.jpg";
import frenchMaleThinking from "@assets/Tutor_Images/Male/French_Male_Thinking.jpg";

import germanMaleListening from "@assets/Tutor_Images/Male/German_Male_Listening.jpg";
import germanMaleTalking from "@assets/Tutor_Images/Male/German_Male_Talking.jpg";
import germanMaleThinking from "@assets/Tutor_Images/Male/German_Male_Thinking.jpg";

import italianMaleListening from "@assets/Tutor_Images/Male/Italian_Male_listening.jpg";
import italianMaleTalking from "@assets/Tutor_Images/Male/Italian_Male_Talking.jpg";
import italianMaleThinking from "@assets/Tutor_Images/Male/Italian_Male_Thinking.jpg";

import japaneseMaleListening from "@assets/Tutor_Images/Male/Japanese_Male_Listening.jpg";
import japaneseMaleTalking from "@assets/Tutor_Images/Male/Japanese_Male_Talking.jpg";
import japaneseMaleThinking from "@assets/Tutor_Images/Male/Japanese_Male_Thinking.jpg";

import koreanMaleListening from "@assets/Tutor_Images/Male/Korean_Male_Listening.jpg";
import koreanMaleTalking from "@assets/Tutor_Images/Male/Korean_Male_Talking.jpg";
import koreanMaleThinking from "@assets/Tutor_Images/Male/Korean_Male_Thinking.jpg";

import portugueseMaleListening from "@assets/Tutor_Images/Male/Portuguese_Male_Listening.jpg";
import portugueseMaleTalking from "@assets/Tutor_Images/Male/Portuguese_Male_Talking.jpg";
import portugueseMaleThinking from "@assets/Tutor_Images/Male/Portuguese_Male_Thinking.jpg";

// Spanish male uses original boy tutor assets
import spanishMaleListening from "@assets/Boy-tutor-waiting-No-Background_1764186322051.png";
import spanishMaleThinking from "@assets/Boy_Tutor_Thinking_No_Background_1766162338594.jpg";
import spanishMaleTalking from "@assets/Boy-tutor-speaking-No-Background_1764186322050.png";

export type TutorState = 'listening' | 'thinking' | 'talking' | 'idle';
export type TutorGender = 'male' | 'female';
export type SupportedLanguage = 
  | 'spanish' | 'french' | 'german' | 'italian' | 'portuguese'
  | 'chinese' | 'japanese' | 'korean' | 'english';

interface TutorAvatarSet {
  listening: string;
  thinking: string;
  talking: string;
}

const femaleAvatars: Record<SupportedLanguage, TutorAvatarSet> = {
  chinese: { listening: chineseFemaleListening, thinking: chineseFemaleThinking, talking: chineseFemaleTalking },
  english: { listening: englishFemaleListening, thinking: englishFemaleThinking, talking: englishFemaleTalking },
  french: { listening: frenchFemaleListening, thinking: frenchFemaleThinking, talking: frenchFemaleTalking },
  german: { listening: germanFemaleListening, thinking: germanFemaleThinking, talking: germanFemaleTalking },
  italian: { listening: italianFemaleListening, thinking: italianFemaleThinking, talking: italianFemaleTalking },
  japanese: { listening: japaneseFemaleListening, thinking: japaneseFemaleThinking, talking: japaneseFemaleTalking },
  korean: { listening: koreanFemaleListening, thinking: koreanFemaleThinking, talking: koreanFemaleTalking },
  portuguese: { listening: portugueseFemaleListening, thinking: portugueseFemaleThinking, talking: portugueseFemaleTalking },
  spanish: { listening: spanishFemaleListening, thinking: spanishFemaleThinking, talking: spanishFemaleTalking },
};

const maleAvatars: Record<SupportedLanguage, TutorAvatarSet> = {
  chinese: { listening: chineseMaleListening, thinking: chineseMaleThinking, talking: chineseMaleTalking },
  english: { listening: englishMaleListening, thinking: englishMaleThinking, talking: englishMaleTalking },
  french: { listening: frenchMaleListening, thinking: frenchMaleThinking, talking: frenchMaleTalking },
  german: { listening: germanMaleListening, thinking: germanMaleThinking, talking: germanMaleTalking },
  italian: { listening: italianMaleListening, thinking: italianMaleThinking, talking: italianMaleTalking },
  japanese: { listening: japaneseMaleListening, thinking: japaneseMaleThinking, talking: japaneseMaleTalking },
  korean: { listening: koreanMaleListening, thinking: koreanMaleThinking, talking: koreanMaleTalking },
  portuguese: { listening: portugueseMaleListening, thinking: portugueseMaleThinking, talking: portugueseMaleTalking },
  spanish: { listening: spanishMaleListening, thinking: spanishMaleThinking, talking: spanishMaleTalking },
};

// Normalize language string to match our supported languages
function normalizeLanguage(language: string | null | undefined): SupportedLanguage {
  if (!language) return 'spanish'; // Default to Spanish (Daniela's original language)
  
  const normalized = language.toLowerCase().trim();
  
  // Handle various formats
  const languageMap: Record<string, SupportedLanguage> = {
    'spanish': 'spanish',
    'español': 'spanish',
    'es': 'spanish',
    'french': 'french',
    'français': 'french',
    'fr': 'french',
    'german': 'german',
    'deutsch': 'german',
    'de': 'german',
    'italian': 'italian',
    'italiano': 'italian',
    'it': 'italian',
    'portuguese': 'portuguese',
    'português': 'portuguese',
    'pt': 'portuguese',
    'chinese': 'chinese',
    'mandarin': 'chinese',
    'zh': 'chinese',
    '中文': 'chinese',
    'japanese': 'japanese',
    'ja': 'japanese',
    '日本語': 'japanese',
    'korean': 'korean',
    'ko': 'korean',
    '한국어': 'korean',
    'english': 'english',
    'en': 'english',
  };
  
  return languageMap[normalized] || 'spanish';
}

// Get the avatar URL for a specific language, gender, and state
export function getTutorAvatar(
  language: string | null | undefined,
  gender: TutorGender,
  state: TutorState
): string {
  const normalizedLanguage = normalizeLanguage(language);
  const avatarSet = gender === 'male' ? maleAvatars[normalizedLanguage] : femaleAvatars[normalizedLanguage];
  
  // Map state to avatar
  switch (state) {
    case 'thinking':
      return avatarSet.thinking;
    case 'talking':
      return avatarSet.talking;
    case 'listening':
    case 'idle':
    default:
      return avatarSet.listening;
  }
}

// Get all avatar URLs for a specific language and gender (for preloading)
export function getTutorAvatarSet(
  language: string | null | undefined,
  gender: TutorGender
): TutorAvatarSet {
  const normalizedLanguage = normalizeLanguage(language);
  return gender === 'male' ? maleAvatars[normalizedLanguage] : femaleAvatars[normalizedLanguage];
}

// NOTE: Tutor names are stored dynamically in the database (tutor_voices.voice_name)
// Main tutors (Cartesia): Names like "Daniela", "Agustin", "Juliette", "Vincent" come from Cartesia voice catalog
// Assistant tutors (Google): Names like "Aris", "Marco", "Amélie" are custom names since Google TTS doesn't include names
// Use the /api/tutor-voice endpoint to fetch the current tutor's name for display
// The [SWITCH_TUTOR] command uses the tutor directory from the database for handoffs
