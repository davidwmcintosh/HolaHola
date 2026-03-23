export interface CharacterDefinition {
  id: string;
  displayName: string;
  gender: 'male' | 'female';
  role: string;
  language: string;
  voiceId: string;
  ttsProvider: 'cartesia' | 'elevenlabs' | 'google' | 'gemini';
  languageCode: string;
  description: string;
}

// All secondary characters use Google Chirp 3 HD — same provider as the main tutors
const SPANISH_CHARACTERS: CharacterDefinition[] = [
  {
    id: 'carlos',
    displayName: 'Carlos',
    gender: 'male',
    role: 'friend',
    language: 'spanish',
    voiceId: 'es-US-Chirp3-HD-Fenrir',
    ttsProvider: 'google',
    languageCode: 'es-US',
    description: 'A friendly male Spanish speaker — works as a friend, classmate, or colleague',
  },
  {
    id: 'el_mesero',
    displayName: 'El mesero',
    gender: 'male',
    role: 'waiter',
    language: 'spanish',
    voiceId: 'es-US-Chirp3-HD-Fenrir',
    ttsProvider: 'google',
    languageCode: 'es-US',
    description: 'A restaurant waiter',
  },
  {
    id: 'el_doctor',
    displayName: 'El doctor',
    gender: 'male',
    role: 'doctor',
    language: 'spanish',
    voiceId: 'es-US-Chirp3-HD-Fenrir',
    ttsProvider: 'google',
    languageCode: 'es-US',
    description: 'A male doctor or medical professional',
  },
  {
    id: 'el_vendedor',
    displayName: 'El vendedor',
    gender: 'male',
    role: 'vendor',
    language: 'spanish',
    voiceId: 'es-US-Chirp3-HD-Fenrir',
    ttsProvider: 'google',
    languageCode: 'es-US',
    description: 'A market or shop vendor',
  },
  {
    id: 'el_recepcionista',
    displayName: 'El recepcionista',
    gender: 'male',
    role: 'receptionist',
    language: 'spanish',
    voiceId: 'es-US-Chirp3-HD-Fenrir',
    ttsProvider: 'google',
    languageCode: 'es-US',
    description: 'A hotel or office receptionist',
  },
  {
    id: 'elena',
    displayName: 'Elena',
    gender: 'female',
    role: 'friend',
    language: 'spanish',
    voiceId: 'es-US-Chirp3-HD-Kore',
    ttsProvider: 'google',
    languageCode: 'es-US',
    description: 'A friendly female Spanish speaker — works as a friend, classmate, or colleague',
  },
  {
    id: 'la_doctora',
    displayName: 'La doctora',
    gender: 'female',
    role: 'doctor',
    language: 'spanish',
    voiceId: 'es-US-Chirp3-HD-Kore',
    ttsProvider: 'google',
    languageCode: 'es-US',
    description: 'A female doctor or medical professional',
  },
  {
    id: 'la_mesera',
    displayName: 'La mesera',
    gender: 'female',
    role: 'waitress',
    language: 'spanish',
    voiceId: 'es-US-Chirp3-HD-Kore',
    ttsProvider: 'google',
    languageCode: 'es-US',
    description: 'A restaurant waitress',
  },
];

const FRENCH_CHARACTERS: CharacterDefinition[] = [
  {
    id: 'pierre',
    displayName: 'Pierre',
    gender: 'male',
    role: 'friend',
    language: 'french',
    voiceId: 'fr-FR-Chirp3-HD-Orus',
    ttsProvider: 'google',
    languageCode: 'fr-FR',
    description: 'A friendly male French speaker',
  },
  {
    id: 'le_serveur',
    displayName: 'Le serveur',
    gender: 'male',
    role: 'waiter',
    language: 'french',
    voiceId: 'fr-FR-Chirp3-HD-Orus',
    ttsProvider: 'google',
    languageCode: 'fr-FR',
    description: 'A restaurant waiter',
  },
  {
    id: 'marie',
    displayName: 'Marie',
    gender: 'female',
    role: 'friend',
    language: 'french',
    voiceId: 'fr-FR-Chirp3-HD-Leda',
    ttsProvider: 'google',
    languageCode: 'fr-FR',
    description: 'A friendly female French speaker',
  },
];

const CHARACTER_REGISTRY: Record<string, CharacterDefinition[]> = {
  spanish: SPANISH_CHARACTERS,
  french: FRENCH_CHARACTERS,
};

export function getCharacter(language: string, characterId: string): CharacterDefinition | undefined {
  const lang = language.toLowerCase();
  const chars = CHARACTER_REGISTRY[lang] || [];
  return chars.find(c => c.id === characterId.toLowerCase().replace(/\s+/g, '_'));
}

export function getCharactersByLanguage(language: string): CharacterDefinition[] {
  return CHARACTER_REGISTRY[language.toLowerCase()] || [];
}

export function getCharacterListDescription(language: string): string {
  const chars = getCharactersByLanguage(language);
  if (chars.length === 0) return 'No secondary characters available for this language yet.';
  return chars.map(c => `• "${c.id}" — ${c.displayName} (${c.role}): ${c.description}`).join('\n');
}
