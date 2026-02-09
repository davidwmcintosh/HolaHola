import fs from 'fs';
import path from 'path';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '';
const OUTPUT_DIR = '/tmp/tts-eval-accented';

const ACCENT_VOICES: Record<string, { voiceId: string; name: string }> = {
  italian: { voiceId: 'Ap2b3ZnSIW7h0QbBbxCq', name: 'Alessandra - Elegant and Versatile' },
  spanish: { voiceId: 'zl1Ut8dvwcVSuQSB9XkG', name: 'Ninoska - Spanish Teacher' },
  french: { voiceId: 'ICk609TItINMseDpChFt', name: 'Léa - Calm and pedagogical' },
  german: { voiceId: 'XFigb6fqZPxl2Q2dFOXN', name: 'Nadine Convo - Conversation partner' },
  japanese: { voiceId: 'EkK6wL8GaH8IgBZTTDGJ', name: 'Akari - Bright & Natural' },
  korean: { voiceId: 'mYk0rAapHek2oTw18z8x', name: 'Salang - Calm, Clear and Warm' },
};

const ENGLISH_VOICE = { voiceId: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah (English premade)' };

interface TestSentence {
  id: string;
  language: string;
  text: string;
}

const TEST_SENTENCES: TestSentence[] = [
  { id: 'it-homograph', language: 'italian', text: 'Now try saying come stai to greet someone.' },
  { id: 'it-mixed', language: 'italian', text: 'The word buongiorno means good morning, and you can also say buonasera in the evening.' },
  { id: 'it-sentence', language: 'italian', text: 'Repeat after me: Mi chiamo Daniela, e sono la tua insegnante.' },
  { id: 'es-mixed', language: 'spanish', text: 'When you enter a shop, say buenos dias to be polite, and gracias when you leave.' },
  { id: 'es-homograph', language: 'spanish', text: "If someone asks, you can say no me gusta to express you don't like something." },
  { id: 'fr-mixed', language: 'french', text: 'A common greeting is bonjour, and you can say merci beaucoup to thank someone warmly.' },
  { id: 'fr-homograph', language: 'french', text: 'The French word table sounds different than English, and une orange is almost the same.' },
  { id: 'de-mixed', language: 'german', text: 'To say thank you in German, say danke schön, and guten Morgen means good morning.' },
  { id: 'ja-mixed', language: 'japanese', text: 'The most common greeting is konnichiwa, and you bow while saying arigatou gozaimasu.' },
  { id: 'ko-mixed', language: 'korean', text: 'To say hello politely, use annyeonghaseyo, and kamsahamnida means thank you.' },
];

async function generateElevenLabs(text: string, voiceId: string, modelId: string): Promise<{ audio: Buffer; latencyMs: number }> {
  const start = Date.now();
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': ELEVENLABS_API_KEY,
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: modelId,
      voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.0 },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`ElevenLabs error ${response.status}: ${err}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const latencyMs = Date.now() - start;
  return { audio: Buffer.from(arrayBuffer), latencyMs };
}

async function runTests() {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log('=== TTS Accent-Matched Voice Evaluation ===\n');
  console.log('Testing ElevenLabs Flash v2.5 with native-accent voices vs English voice\n');

  const results: Array<{ id: string; lang: string; voiceName: string; type: string; latencyMs: number }> = [];

  for (const test of TEST_SENTENCES) {
    const accentVoice = ACCENT_VOICES[test.language];
    console.log(`\n--- ${test.id} (${test.language}) ---`);
    console.log(`Text: "${test.text}"`);

    const configs = [
      { label: 'accent', voice: accentVoice, suffix: 'accented' },
      { label: 'english', voice: ENGLISH_VOICE, suffix: 'english' },
    ];

    for (const config of configs) {
      const filename = `${test.id}_eleven_${config.suffix}.mp3`;
      const filepath = path.join(OUTPUT_DIR, filename);

      try {
        console.log(`  ${config.label} (${config.voice.name})...`);
        const result = await generateElevenLabs(test.text, config.voice.voiceId, 'eleven_flash_v2_5');
        fs.writeFileSync(filepath, result.audio);
        console.log(`    ✓ ${result.latencyMs}ms, ${(result.audio.length / 1024).toFixed(1)}KB`);
        results.push({ id: test.id, lang: test.language, voiceName: config.voice.name, type: config.label, latencyMs: result.latencyMs });
      } catch (err: any) {
        console.log(`    ✗ ERROR: ${err.message}`);
      }

      await new Promise(r => setTimeout(r, 300));
    }
  }

  console.log('\n\n=== Summary ===');
  console.log('\nVoices used:');
  for (const [lang, voice] of Object.entries(ACCENT_VOICES)) {
    console.log(`  ${lang}: ${voice.name} (${voice.voiceId})`);
  }
  console.log(`  english: ${ENGLISH_VOICE.name} (${ENGLISH_VOICE.voiceId})`);

  const accentResults = results.filter(r => r.type === 'accent');
  const englishResults = results.filter(r => r.type === 'english');
  const avgAccent = accentResults.reduce((sum, r) => sum + r.latencyMs, 0) / accentResults.length;
  const avgEnglish = englishResults.reduce((sum, r) => sum + r.latencyMs, 0) / englishResults.length;
  console.log(`\nAvg latency (accent voices): ${avgAccent.toFixed(0)}ms`);
  console.log(`Avg latency (English voice): ${avgEnglish.toFixed(0)}ms`);
  console.log(`\nTotal files: ${results.length}`);
  console.log(`Output dir: ${OUTPUT_DIR}`);
}

runTests().catch(console.error);
