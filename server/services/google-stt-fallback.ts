/**
 * Google Cloud Speech-to-Text Fallback
 *
 * Used as a last-resort STT when both Deepgram Live and Prerecorded APIs fail.
 * Reuses the same GOOGLE_CLOUD_TTS_CREDENTIALS service account already configured
 * for Daniela's voice — no additional credentials required.
 *
 * API: Google Speech v1p1beta1 (synchronous recognition)
 *   - Supports WebM/Opus from browser MediaRecorder
 *   - Supports multilingual / alternative language codes
 *   - Suitable for PTT blobs (< 1 minute audio)
 *
 * This does NOT replace Deepgram. It only activates when Deepgram is fully
 * unavailable. It omits intelligence features (sentiment, intents, entities)
 * that are Deepgram-specific — transcript + confidence only.
 */

import { GoogleAuth } from 'google-auth-library';

// ─── Language mapping ──────────────────────────────────────────────────────

const LANGUAGE_PRIMARY: Record<string, string> = {
  spanish:    'es-ES',
  french:     'fr-FR',
  german:     'de-DE',
  hebrew:     'he-IL',
  japanese:   'ja-JP',
  korean:     'ko-KR',
  mandarin:   'zh',
  chinese:    'zh',
  portuguese: 'pt-BR',
  arabic:     'ar-XA',
  english:    'en-US',
};

/**
 * Map a HolaHola language name to a Google BCP-47 language code.
 * Falls back to English if the language is unrecognised.
 */
function getGoogleLanguageCode(language: string): string {
  return LANGUAGE_PRIMARY[language.toLowerCase()] ?? 'en-US';
}

/**
 * All language codes we teach — passed as alternativeLanguageCodes so Google
 * can handle code-switching when the student mixes their native and target language.
 */
const ALL_LANGUAGE_CODES = Object.values(LANGUAGE_PRIMARY);

// ─── Auth client (module-level singleton) ──────────────────────────────────

let _auth: GoogleAuth | null = null;

function getAuth(): GoogleAuth {
  if (_auth) return _auth;

  const raw = process.env.GOOGLE_CLOUD_TTS_CREDENTIALS;
  if (!raw) {
    throw new Error(
      'GOOGLE_CLOUD_TTS_CREDENTIALS is not set — Google STT fallback unavailable'
    );
  }

  const credentials = JSON.parse(raw);
  _auth = new GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });
  return _auth;
}

// ─── Public API ────────────────────────────────────────────────────────────

export interface GoogleSttResult {
  transcript: string;
  confidence: number;
  source: 'google-stt-fallback';
}

/**
 * Transcribe a complete audio blob using Google Cloud Speech v1p1beta1.
 *
 * @param audioData     Raw WebM/Opus audio buffer from the browser
 * @param targetLanguage HolaHola language name (e.g. "spanish")
 * @param nativeLanguage HolaHola language name (e.g. "english")
 */
export async function transcribeWithGoogleSTT(
  audioData: Buffer,
  targetLanguage: string,
  nativeLanguage: string = 'english'
): Promise<GoogleSttResult> {
  const start = Date.now();
  const primaryCode = getGoogleLanguageCode(targetLanguage);
  const nativeCode  = getGoogleLanguageCode(nativeLanguage);

  // Include both target and native as alternatives for code-switching support
  const alternativeCodes = ALL_LANGUAGE_CODES.filter(
    (c) => c !== primaryCode && c !== nativeCode
  );

  console.log(
    `[Google STT] Transcribing ${audioData.length} bytes | primary: ${primaryCode} | native: ${nativeCode}`
  );

  const auth  = getAuth();
  const token = await auth.getAccessToken();
  if (!token) {
    throw new Error('[Google STT] Failed to obtain access token');
  }

  const requestBody = {
    config: {
      encoding: 'WEBM_OPUS',
      sampleRateHertz: 48000,
      languageCode: primaryCode,
      alternativeLanguageCodes: [nativeCode, ...alternativeCodes].slice(0, 3), // Google allows up to 3 alternatives
      enableAutomaticPunctuation: true,
      model: 'latest_long',
      useEnhanced: true,
    },
    audio: {
      content: audioData.toString('base64'),
    },
  };

  const response = await fetch(
    'https://speech.googleapis.com/v1p1beta1/speech:recognize',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    }
  );

  if (!response.ok) {
    const errorText = await response.text().catch(() => '(unreadable)');
    throw new Error(
      `[Google STT] HTTP ${response.status}: ${errorText.slice(0, 200)}`
    );
  }

  const data: any = await response.json();
  const results     = data.results ?? [];
  const best        = results[0]?.alternatives?.[0];
  const transcript  = best?.transcript ?? '';
  const confidence  = best?.confidence ?? 0;

  console.log(
    `[Google STT] "${transcript.slice(0, 60)}${transcript.length > 60 ? '...' : ''}" ` +
    `(${(confidence * 100).toFixed(0)}%, ${Date.now() - start}ms)`
  );

  return { transcript, confidence, source: 'google-stt-fallback' };
}
