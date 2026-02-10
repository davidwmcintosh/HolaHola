/**
 * Voice Configuration - Centralized Voice Stack Constants
 * 
 * ⚠️ CRITICAL: DANIELA'S VOICE PIPELINE IS LOCKED ⚠️
 * 
 * This file defines the non-negotiable voice stack for HolaHola.
 * Any changes to these constants require explicit founder approval
 * logged in docs/daniela-development-journal.md
 * 
 * DANIELA'S VOICE PIPELINE:
 * User Audio → Deepgram Nova-3 (LIVE API) → Gemini Streaming → Cartesia Sonic-3 → Audio Output
 * 
 * NEVER:
 * - Switch Daniela to OpenAI TTS/STT
 * - Switch from Deepgram LIVE API to PRERECORDED API
 * - Use nova-2 model (must be nova-3)
 * - Disable DEEPGRAM_INTELLIGENCE_ENABLED
 */

// ============================================================================
// DANIELA STT CONFIGURATION (Deepgram Nova-3 LIVE API)
// ============================================================================

/**
 * Required Deepgram model for Daniela's STT
 * Nova-3 is required for:
 * - Multi-language detection ('multi' mode)
 * - Intelligence features (sentiment, intents, entities)
 * - Reliable WebM/Opus transcription
 * 
 * WARNING: Nova-2 with 'multi' mode returns empty transcripts
 */
export const DANIELA_STT_MODEL = 'nova-3';

/**
 * Required API mode for Daniela's STT
 * LIVE API is required because:
 * - Prerecorded API returns "duration: unknown, channels: 0" for browser WebM/Opus
 * - Live API properly parses MediaRecorder WebM containers
 * 
 * WARNING: Do NOT use prerecorded API - it fails silently with browser audio
 */
export const DANIELA_STT_API_MODE = 'live' as const;

/**
 * Intelligence features must be enabled for:
 * - Sentiment tracking (student frustration/confidence)
 * - Intent recognition ("I don't understand", "repeat please")
 * - Entity detection (names, locations for personalization)
 */
export const DANIELA_STT_INTELLIGENCE_ENABLED = true;

// ============================================================================
// DANIELA TTS CONFIGURATION
// ============================================================================

/**
 * TTS provider for Daniela
 * 
 * 'elevenlabs' - ElevenLabs Flash v2.5 (DEFAULT)
 *   - 44% cheaper than Cartesia, 3-4x faster
 *   - Accent-matched voices per language (native speakers)
 *   - language_code parameter for correct pronunciation
 *   - Pronunciation dictionaries for homograph fixes
 * 
 * 'cartesia' - Cartesia Sonic-3 (LEGACY, kept for rollback)
 *   - 40ms latency, full SSML emotion tags
 *   - No inline language switching support
 * 
 * Override with TTS_PROVIDER env var (e.g. TTS_PROVIDER=cartesia)
 */
export const DANIELA_TTS_PROVIDER = (process.env.TTS_PROVIDER || 'elevenlabs') as 'elevenlabs' | 'cartesia';

/**
 * TTS model per provider
 */
export const DANIELA_TTS_MODEL = DANIELA_TTS_PROVIDER === 'elevenlabs' 
  ? 'eleven_flash_v2_5' 
  : 'sonic-3';

// ============================================================================
// RUNTIME VALIDATION
// ============================================================================

/**
 * Validate voice configuration at startup
 * Logs LOUD warnings if env vars deviate from required settings
 * Call this during server initialization
 * 
 * NOTE: This validates env vars. Services should import and use constants
 * from this file (DANIELA_STT_MODEL, etc.) rather than reading process.env directly.
 */
export function validateVoiceConfig(): { valid: boolean; warnings: string[]; critical: boolean } {
  const warnings: string[] = [];
  let critical = false;
  
  // Check Deepgram model - CRITICAL: Must be nova-3
  const deepgramModel = process.env.DEEPGRAM_MODEL || 'nova-3';
  if (deepgramModel !== DANIELA_STT_MODEL) {
    warnings.push(`❌ CRITICAL: DEEPGRAM_MODEL is "${deepgramModel}" but MUST be "${DANIELA_STT_MODEL}"`);
    warnings.push(`   Nova-2 with 'multi' mode returns EMPTY transcripts - voice chat will FAIL`);
    critical = true;
  }
  
  // Check intelligence features
  const intelligenceEnabled = process.env.DEEPGRAM_INTELLIGENCE_ENABLED !== 'false';
  if (!intelligenceEnabled) {
    warnings.push(`⚠️ DEEPGRAM_INTELLIGENCE_ENABLED is false but should be true`);
    warnings.push(`   Student sentiment/intent tracking will be disabled`);
  }
  
  // Check TTS provider API key - CRITICAL for Daniela
  if (DANIELA_TTS_PROVIDER === 'elevenlabs') {
    if (!process.env.ELEVENLABS_API_KEY) {
      warnings.push(`❌ CRITICAL: ELEVENLABS_API_KEY is not set - Daniela's voice will NOT work`);
      critical = true;
    }
  } else {
    if (!process.env.CARTESIA_API_KEY) {
      warnings.push(`❌ CRITICAL: CARTESIA_API_KEY is not set - Daniela's voice will NOT work`);
      critical = true;
    }
  }
  
  // Check Deepgram API key - CRITICAL for STT
  if (!process.env.DEEPGRAM_API_KEY) {
    warnings.push(`❌ CRITICAL: DEEPGRAM_API_KEY is not set - STT will NOT work`);
    critical = true;
  }
  
  // Log validation results
  if (warnings.length > 0) {
    console.error('');
    console.error('╔═════════════════════════════════════════════════════════════╗');
    console.error('║ ⚠️  VOICE CONFIG VALIDATION FAILED                          ║');
    console.error('╠═════════════════════════════════════════════════════════════╣');
    warnings.forEach(w => console.error(`║ ${w.padEnd(59)} ║`));
    console.error('╠═════════════════════════════════════════════════════════════╣');
    console.error('║ See replit.md "Voice Architecture" for required config      ║');
    console.error('╚═════════════════════════════════════════════════════════════╝');
    console.error('');
    
    if (critical) {
      console.error('🚨 VOICE CHAT WILL NOT WORK WITH CURRENT CONFIGURATION 🚨');
      console.error('');
    }
  } else {
    console.log('[Voice Config] ✓ All voice configuration validated');
    console.log(`[Voice Config] ├─ STT: Deepgram ${DANIELA_STT_MODEL} (${DANIELA_STT_API_MODE} API)`);
    console.log(`[Voice Config] └─ TTS: ${DANIELA_TTS_PROVIDER} ${DANIELA_TTS_MODEL}`);
  }
  
  return { valid: warnings.length === 0, warnings, critical };
}

/**
 * Get current voice config status for debugging
 */
export function getVoiceConfigStatus(): Record<string, string | boolean> {
  return {
    deepgramModel: process.env.DEEPGRAM_MODEL || 'nova-3 (default)',
    deepgramIntelligence: process.env.DEEPGRAM_INTELLIGENCE_ENABLED !== 'false',
    cartesiaConfigured: !!process.env.CARTESIA_API_KEY,
    elevenlabsConfigured: !!process.env.ELEVENLABS_API_KEY,
    deepgramConfigured: !!process.env.DEEPGRAM_API_KEY,
    googleTtsConfigured: !!process.env.GOOGLE_CLOUD_TTS_CREDENTIALS,
    requiredSttModel: DANIELA_STT_MODEL,
    requiredSttApiMode: DANIELA_STT_API_MODE,
    requiredTtsProvider: DANIELA_TTS_PROVIDER,
    requiredTtsModel: DANIELA_TTS_MODEL,
  };
}
