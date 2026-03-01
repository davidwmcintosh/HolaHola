// Language-specific tutor avatars
// Each language has male and female tutors with 3 states: listening, thinking, talking

// Female avatars by language
import chineseFemaleListening from "@assets/Tutor_Images/Female/Chinese_Female_Listening_No_Background.jpg";
import chineseFemaleTalking from "@assets/Tutor_Images/Female/Chinese_Female_Talking_No_Background.jpg";
import chineseFemaleThinking from "@assets/Tutor_Images/Female/Chinese_Female_Thinking_No_Background.jpg";

import englishFemaleListening from "@assets/Tutor_Images/Female/English_Listening_No_Background.jpg";
import englishFemaleTalking from "@assets/Cindy-No-Background_1771031411355.jpeg";
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

import italianMaleListening from "@assets/Tutor_Images/Male/Italian_Male_Listening_No_Background.jpg";
import italianMaleTalking from "@assets/Tutor_Images/Male/Italian_Male_Talking_No_Background.jpg";
import italianMaleThinking from "@assets/Tutor_Images/Male/Italian_Male_Thinking_No_Background.jpg";

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
  | 'chinese' | 'japanese' | 'korean' | 'english' | 'hebrew'
  | 'biology' | 'history' | 'math' | 'business';

interface TutorAvatarSet {
  listening: string;
  thinking: string;
  talking: string;
}

// Language accent colors for UI theming
export const languageAccentColors: Record<SupportedLanguage, string> = {
  spanish: '#F59E0B',    // Warm Orange
  french: '#3B82F6',     // Royal Blue
  german: '#CA8A04',     // Deep Gold
  italian: '#22C55E',    // Forest Green
  portuguese: '#14B8A6', // Ocean Teal
  chinese: '#EF4444',    // Imperial Red
  japanese: '#EC4899',   // Cherry Blossom
  korean: '#0EA5E9',     // Sky Blue
  english: '#8B5CF6',    // Purple
  hebrew: '#1D4ED8',     // Deep Blue (Star of David blue)
  biology: '#10B981',   // Emerald Green
  history: '#D97706',   // Amber
  math: '#3B82F6',      // Blue
  business: '#7C3AED',  // Violet
};

// Tutor personality taglines for showcase
export const tutorTaglines: Record<SupportedLanguage, { male: string; female: string }> = {
  spanish: { male: 'Patient & supportive', female: 'Warm & encouraging' },
  french: { male: 'Charming & witty', female: 'Elegant & precise' },
  german: { male: 'Structured & friendly', female: 'Clear & thorough' },
  italian: { male: 'Animated & fun', female: 'Expressive & passionate' },
  portuguese: { male: 'Relaxed & natural', female: 'Melodic & warm' },
  chinese: { male: 'Calm & wise', female: 'Gentle & patient' },
  japanese: { male: 'Thoughtful & precise', female: 'Polite & encouraging' },
  korean: { male: 'Cool & supportive', female: 'Energetic & modern' },
  english: { male: 'Casual & helpful', female: 'Friendly & clear' },
  hebrew: { male: 'Friendly & cultural', female: 'Warm & playful' },
  biology: { male: 'Methodical & curious', female: 'Precise & enthusiastic' },
  history: { male: 'Narrative & challenging', female: 'Socratic & empathetic' },
  math: { male: 'Logical & patient', female: 'Clear & encouraging' },
  business: { male: 'Strategic & direct', female: 'Insightful & practical' },
};

// Get accent color for a language
export function getLanguageAccentColor(language: string | null | undefined): string {
  const normalizedLanguage = normalizeLanguage(language);
  return languageAccentColors[normalizedLanguage];
}

// Get tutor tagline for a language and gender
export function getTutorTagline(language: string | null | undefined, gender: TutorGender): string {
  const normalizedLanguage = normalizeLanguage(language);
  return tutorTaglines[normalizedLanguage][gender];
}

// Export all tutor data for showcase component
export interface TutorShowcaseData {
  language: SupportedLanguage;
  gender: TutorGender;
  name: string;
  tagline: string;
  accentColor: string;
  avatar: string;
}

export function getAllTutorsForShowcase(): TutorShowcaseData[] {
  const languages: SupportedLanguage[] = [
    'spanish', 'french', 'german', 'italian', 'portuguese',
    'chinese', 'japanese', 'korean', 'english', 'hebrew'
  ];
  const genders: TutorGender[] = ['female', 'male'];
  
  const tutors: TutorShowcaseData[] = [];
  
  for (const language of languages) {
    for (const gender of genders) {
      tutors.push({
        language,
        gender,
        name: getTutorName(language, gender),
        tagline: tutorTaglines[language][gender],
        accentColor: languageAccentColors[language],
        avatar: getTutorAvatar(language, gender, 'listening'),
      });
    }
  }
  
  return tutors;
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
  hebrew: { listening: spanishFemaleListening, thinking: spanishFemaleThinking, talking: spanishFemaleTalking }, // Uses Daniela's avatar (hidden language)
  biology: { listening: spanishFemaleListening, thinking: spanishFemaleThinking, talking: spanishFemaleTalking },
  history: { listening: spanishFemaleListening, thinking: spanishFemaleThinking, talking: spanishFemaleTalking },
  math: { listening: spanishFemaleListening, thinking: spanishFemaleThinking, talking: spanishFemaleTalking },
  business: { listening: spanishFemaleListening, thinking: spanishFemaleThinking, talking: spanishFemaleTalking },
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
  hebrew: { listening: spanishMaleListening, thinking: spanishMaleThinking, talking: spanishMaleTalking }, // Uses Agustin's avatar (hidden language)
  biology: { listening: spanishMaleListening, thinking: spanishMaleThinking, talking: spanishMaleTalking },
  history: { listening: spanishMaleListening, thinking: spanishMaleThinking, talking: spanishMaleTalking },
  math: { listening: spanishMaleListening, thinking: spanishMaleThinking, talking: spanishMaleTalking },
  business: { listening: spanishMaleListening, thinking: spanishMaleThinking, talking: spanishMaleTalking },
};

// Normalize language string to match our supported languages
export function normalizeLanguage(language: string | null | undefined): SupportedLanguage {
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
    'hebrew': 'hebrew',
    'he': 'hebrew',
    'עברית': 'hebrew',
    'biology': 'biology',
    'history': 'history',
    'math': 'math',
    'mathematics': 'math',
    'business': 'business',
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

// Tutor Name Directory - Fallback names for UI elements when database isn't available
// These MUST match the first part of voice_name entries in the tutor_voices database table
// The primary source of truth for tutor names is the database (dynamic)
// Use getTutorName() for frontend display when backend data isn't yet loaded
const tutorNames: Record<SupportedLanguage, { male: string; female: string }> = {
  spanish: { male: 'Agustin', female: 'Daniela' },
  french: { male: 'Vincent', female: 'Juliette' },
  german: { male: 'Lukas', female: 'Greta' },
  italian: { male: 'Luca', female: 'Liv' },
  portuguese: { male: 'Camilo', female: 'Isabel' },
  chinese: { male: 'Tao', female: 'Hua' },
  japanese: { male: 'Daisuke', female: 'Sayuri' },
  korean: { male: 'Minho', female: 'Jihyun' },
  english: { male: 'Blake', female: 'Cindy' },
  hebrew: { male: 'Noam', female: 'Yael' }, // Hebrew tutors (hidden language - special unlock)
  biology: { male: 'Gene', female: 'Evelyn' },
  history: { male: 'Marcus', female: 'Clio' },
  math: { male: 'Leo', female: 'Ada' },
  business: { male: 'Sterling', female: 'Morgan' },
};

// Get the tutor's display name for a given language and gender
export function getTutorName(
  language: string | null | undefined,
  gender: TutorGender
): string {
  const normalizedLanguage = normalizeLanguage(language);
  return tutorNames[normalizedLanguage][gender];
}

// Get both tutor names for a language (for settings/preference UI)
export function getTutorNames(language: string | null | undefined): { male: string; female: string } {
  const normalizedLanguage = normalizeLanguage(language);
  return tutorNames[normalizedLanguage];
}
