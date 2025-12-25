/**
 * Tutor Names Validation
 * 
 * Logs the current tutor configuration at startup for visibility.
 * The database is the source of truth - names can be changed freely.
 * 
 * CRITICAL: The `role` field is what separates Cartesia tutors from Google assistants:
 * - role='tutor' → Main tutors (Cartesia Sonic-3)
 * - role='assistant' → Practice partners (Google Cloud TTS)
 * 
 * This filtering is enforced in unified-ws-handler.ts and routes.ts
 */

import { storage } from '../storage';

function normalizeLanguageKey(lang: string): string {
  const lower = lang.toLowerCase().trim();
  if (lower === 'mandarin' || lower === 'mandarin chinese' || lower === 'chinese') {
    return 'mandarin chinese';
  }
  return lower;
}

export async function validateTutorNames(): Promise<void> {
  console.log('[Tutor Names] Loading tutor configuration...');
  
  try {
    const allVoices = await storage.getAllTutorVoices();
    
    // Count by role to verify separation
    const mainTutors = allVoices.filter((v: any) => v.role === 'tutor' && v.isActive);
    const assistants = allVoices.filter((v: any) => v.role === 'assistant' && v.isActive);
    
    // Build summary by language
    const tutorsByLang: Record<string, { male?: string; female?: string }> = {};
    
    for (const voice of mainTutors) {
      const lang = normalizeLanguageKey(voice.language || '');
      const gender = voice.gender?.toLowerCase() as 'male' | 'female';
      const voiceNameParts = voice.voiceName?.split(/\s*[-–]\s*/) || [];
      const name = voiceNameParts[0]?.trim() || 'Unknown';
      
      if (!tutorsByLang[lang]) tutorsByLang[lang] = {};
      tutorsByLang[lang][gender] = name;
    }
    
    // Log current configuration
    console.log(`[Tutor Names] ✓ ${mainTutors.length} main tutors (Cartesia), ${assistants.length} assistants (Google TTS)`);
    
    // Verify role separation is intact
    if (mainTutors.length !== 18) {
      console.warn(`[Tutor Names] ⚠️  Expected 18 main tutors, found ${mainTutors.length}`);
    }
    if (assistants.length !== 18) {
      console.warn(`[Tutor Names] ⚠️  Expected 18 assistants, found ${assistants.length}`);
    }
    
    // Log tutor names for visibility
    const languages = Object.keys(tutorsByLang).sort();
    const summary = languages.map(lang => {
      const t = tutorsByLang[lang];
      return `${lang}: ${t.male || '?'}/${t.female || '?'}`;
    }).join(', ');
    console.log(`[Tutor Names] Current: ${summary}`);
    
  } catch (error: any) {
    console.error('[Tutor Names] Failed to load:', error.message);
  }
}
