/**
 * Seed Assistant Tutors into Neural Network
 * 
 * Populates the tutor_voices table with practice partner assistants for all languages.
 * These are stored alongside main tutors but with role='assistant' to distinguish them.
 * 
 * IMPORTANT: This seeder only creates NEW assistants if they don't exist.
 * It does NOT overwrite existing assistants, allowing admin customizations
 * (like switching to Chirp 3 HD voices) to persist across server restarts.
 * 
 * Default: Google Cloud TTS Neural2/WaveNet voices
 * Admin-customizable: Switch to Chirp 3 HD via Voice Console
 */

import { db } from "./db";
import { tutorVoices } from "@shared/schema";
import { eq, and } from "drizzle-orm";

/**
 * Assistant tutor definitions - names from assistant-tutor-config.ts
 * Combined with voice IDs from tts-service.ts GOOGLE_ASSISTANT_VOICE_MAP
 */
const ASSISTANT_TUTOR_SEEDS = [
  // Spanish
  { language: 'spanish', gender: 'female', name: 'Aris', voiceId: 'es-US-Neural2-A', languageCode: 'es-US' },
  { language: 'spanish', gender: 'male', name: 'Marco', voiceId: 'es-US-Neural2-C', languageCode: 'es-US' },
  // French
  { language: 'french', gender: 'female', name: 'Amélie', voiceId: 'fr-FR-Neural2-A', languageCode: 'fr-FR' },
  { language: 'french', gender: 'male', name: 'Étienne', voiceId: 'fr-FR-Neural2-D', languageCode: 'fr-FR' },
  // German
  { language: 'german', gender: 'female', name: 'Greta', voiceId: 'de-DE-Neural2-A', languageCode: 'de-DE' },
  { language: 'german', gender: 'male', name: 'Felix', voiceId: 'de-DE-Neural2-B', languageCode: 'de-DE' },
  // Italian
  { language: 'italian', gender: 'female', name: 'Chiara', voiceId: 'it-IT-Neural2-A', languageCode: 'it-IT' },
  { language: 'italian', gender: 'male', name: 'Matteo', voiceId: 'it-IT-Neural2-C', languageCode: 'it-IT' },
  // Japanese
  { language: 'japanese', gender: 'female', name: 'Hana', voiceId: 'ja-JP-Neural2-B', languageCode: 'ja-JP' },
  { language: 'japanese', gender: 'male', name: 'Kenji', voiceId: 'ja-JP-Neural2-C', languageCode: 'ja-JP' },
  // Mandarin Chinese
  { language: 'mandarin chinese', gender: 'female', name: 'Mei', voiceId: 'cmn-CN-Wavenet-A', languageCode: 'cmn-CN' },
  { language: 'mandarin chinese', gender: 'male', name: 'Wei', voiceId: 'cmn-CN-Wavenet-B', languageCode: 'cmn-CN' },
  // Portuguese
  { language: 'portuguese', gender: 'female', name: 'Clara', voiceId: 'pt-BR-Neural2-A', languageCode: 'pt-BR' },
  { language: 'portuguese', gender: 'male', name: 'Rafael', voiceId: 'pt-BR-Neural2-B', languageCode: 'pt-BR' },
  // English
  { language: 'english', gender: 'female', name: 'Emma', voiceId: 'en-US-Neural2-F', languageCode: 'en-US' },
  { language: 'english', gender: 'male', name: 'Jack', voiceId: 'en-US-Neural2-D', languageCode: 'en-US' },
  // Korean
  { language: 'korean', gender: 'female', name: 'Soo-yeon', voiceId: 'ko-KR-Neural2-A', languageCode: 'ko-KR' },
  { language: 'korean', gender: 'male', name: 'Ji-ho', voiceId: 'ko-KR-Neural2-C', languageCode: 'ko-KR' },
];

/**
 * Seed assistant tutors into the neural network (tutor_voices table)
 * Uses upsert logic to avoid duplicates
 */
export async function seedAssistantTutors(): Promise<void> {
  console.log('[Assistant Tutors Seed] Starting assistant tutor seeding...');
  
  let created = 0;
  let skipped = 0;
  
  for (const seed of ASSISTANT_TUTOR_SEEDS) {
    try {
      // Check if this assistant already exists
      const existing = await db
        .select()
        .from(tutorVoices)
        .where(
          and(
            eq(tutorVoices.language, seed.language),
            eq(tutorVoices.gender, seed.gender),
            eq(tutorVoices.role, 'assistant')
          )
        )
        .limit(1);
      
      if (existing.length > 0) {
        // Assistant already exists - DO NOT overwrite admin customizations!
        // Voice changes via admin console should persist
        skipped++;
        continue;
      }
      
      // Insert new assistant tutor
      await db.insert(tutorVoices).values({
        language: seed.language,
        gender: seed.gender,
        role: 'assistant',
        provider: 'google',
        voiceId: seed.voiceId,
        voiceName: `${seed.name} - Practice Partner`,
        languageCode: seed.languageCode,
        speakingRate: 1.0, // Standard rate for drills
        personality: 'precise', // Drill-focused personality
        expressiveness: 3,
        emotion: 'calm',
        isActive: true,
      });
      
      created++;
      console.log(`[Assistant Tutors Seed] Created: ${seed.name} (${seed.language}, ${seed.gender})`);
    } catch (err: any) {
      console.error(`[Assistant Tutors Seed] Error seeding ${seed.name}:`, err.message);
    }
  }
  
  console.log(`[Assistant Tutors Seed] Complete: ${created} created, ${skipped} skipped (already exist)`);
}
