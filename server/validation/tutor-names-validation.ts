/**
 * Tutor Names Validation
 * 
 * CRITICAL: This validation runs at startup to catch any drift between
 * frontend fallback names and database canonical names.
 * 
 * If you see warnings from this validation, the frontend fallbacks in
 * client/src/lib/tutor-avatars.ts need to be updated to match the database.
 * 
 * See replit.md "Tutor Naming Architecture" section for details.
 */

import { storage } from '../storage';

const EXPECTED_CANONICAL_NAMES: Record<string, { male: string; female: string }> = {
  spanish: { male: 'Agustin', female: 'Daniela' },
  french: { male: 'Vincent', female: 'Juliette' },
  german: { male: 'Lukas', female: 'Alina' },
  italian: { male: 'Luca', female: 'Liv' },
  portuguese: { male: 'Camilo', female: 'Isabel' },
  'mandarin chinese': { male: 'Tao', female: 'Hua' },
  japanese: { male: 'Daisuke', female: 'Sayuri' },
  korean: { male: 'Minho', female: 'Jihyun' },
  english: { male: 'Blake', female: 'Cindy' },
};

function normalizeLanguageKey(lang: string): string {
  const lower = lang.toLowerCase().trim();
  if (lower === 'mandarin' || lower === 'mandarin chinese' || lower === 'chinese') {
    return 'mandarin chinese';
  }
  return lower;
}

export async function validateTutorNames(): Promise<void> {
  console.log('[Tutor Names] Validating tutor naming consistency...');
  
  try {
    const allVoices = await storage.getAllTutorVoices();
    const mainTutors = allVoices.filter((v: any) => v.role === 'tutor' && v.isActive);
    
    let mismatches = 0;
    
    for (const voice of mainTutors) {
      const lang = normalizeLanguageKey(voice.language || '');
      const gender = (voice.gender?.toLowerCase() || '') as 'male' | 'female';
      const voiceNameParts = voice.voiceName?.split(/\s*[-–]\s*/) || [];
      const dbName = voiceNameParts[0]?.trim() || 'Unknown';
      
      const expected = EXPECTED_CANONICAL_NAMES[lang];
      if (!expected) {
        console.warn(`[Tutor Names] ⚠️  Unknown language in database: ${voice.language}`);
        mismatches++;
        continue;
      }
      
      const expectedName = expected[gender];
      if (dbName !== expectedName) {
        console.warn(`[Tutor Names] ⚠️  MISMATCH: ${lang} ${gender} - DB has "${dbName}", expected "${expectedName}"`);
        console.warn(`[Tutor Names]    Update EXPECTED_CANONICAL_NAMES in server/validation/tutor-names-validation.ts`);
        console.warn(`[Tutor Names]    Update tutorNames in client/src/lib/tutor-avatars.ts`);
        console.warn(`[Tutor Names]    Update replit.md "Tutor Naming Architecture" section`);
        mismatches++;
      }
    }
    
    if (mismatches === 0) {
      console.log('[Tutor Names] ✓ All tutor names match expected values');
    } else {
      console.warn(`[Tutor Names] ⚠️  ${mismatches} tutor name mismatches detected!`);
      console.warn('[Tutor Names]    See replit.md "Tutor Naming Architecture" for canonical names');
    }
  } catch (error: any) {
    console.error('[Tutor Names] Failed to validate:', error.message);
  }
}
