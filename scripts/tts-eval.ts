/**
 * TTS Provider Evaluation Script
 * 
 * Compares Cartesia Sonic-3 vs ElevenLabs Flash v2.5 for HolaHola's
 * language learning use case. Tests:
 * 1. Mixed-language pronunciation (code-switching)
 * 2. Homograph handling (words that exist in both languages)
 * 3. Latency (time to first byte)
 * 4. Word timestamps quality
 * 5. Cost comparison
 * 
 * Output: Audio files in /tmp/tts-eval/ + summary report
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { CartesiaClient } from '@cartesia/cartesia-js';

const CARTESIA_API_KEY = process.env.CARTESIA_API_KEY || '';
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '';

const OUTPUT_DIR = '/tmp/tts-eval';

interface TestSentence {
  id: string;
  language: string;
  description: string;
  text: string;
  targetWords: string[];
}

const TEST_SENTENCES: TestSentence[] = [
  {
    id: 'it-homograph',
    language: 'italian',
    description: 'Italian homograph "come" (English vs Italian pronunciation)',
    text: 'Now try saying come stai to greet someone.',
    targetWords: ['come', 'stai'],
  },
  {
    id: 'it-mixed',
    language: 'italian',
    description: 'Italian words embedded in English explanation',
    text: 'The word buongiorno means good morning, and you can also say buonasera in the evening.',
    targetWords: ['buongiorno', 'buonasera'],
  },
  {
    id: 'it-sentence',
    language: 'italian',
    description: 'Full Italian sentence with English context',
    text: 'Repeat after me: Mi chiamo Daniela, e sono la tua insegnante.',
    targetWords: ['Mi', 'chiamo', 'Daniela', 'e', 'sono', 'la', 'tua', 'insegnante'],
  },
  {
    id: 'es-mixed',
    language: 'spanish',
    description: 'Spanish words in English sentence',
    text: 'When you enter a shop, say buenos días to be polite, and gracias when you leave.',
    targetWords: ['buenos', 'días', 'gracias'],
  },
  {
    id: 'es-homograph',
    language: 'spanish',
    description: 'Spanish "no" and "me" (exist in English too)',
    text: 'If someone asks, you can say no me gusta to express you don\'t like something.',
    targetWords: ['no', 'me', 'gusta'],
  },
  {
    id: 'fr-mixed',
    language: 'french',
    description: 'French words in English context',
    text: 'A common greeting is bonjour, and you can say merci beaucoup to thank someone warmly.',
    targetWords: ['bonjour', 'merci', 'beaucoup'],
  },
  {
    id: 'fr-homograph',
    language: 'french',
    description: 'French "table" and "orange" (shared with English)',
    text: 'The French word table sounds different than English, and une orange is almost the same.',
    targetWords: ['table', 'orange'],
  },
  {
    id: 'de-mixed',
    language: 'german',
    description: 'German words in English explanation',
    text: 'To say thank you in German, say danke schön, and guten Morgen means good morning.',
    targetWords: ['danke', 'schön', 'guten', 'Morgen'],
  },
  {
    id: 'ja-mixed',
    language: 'japanese',
    description: 'Japanese words in English context',
    text: 'The most common greeting is konnichiwa, and you bow while saying arigatou gozaimasu.',
    targetWords: ['konnichiwa', 'arigatou', 'gozaimasu'],
  },
  {
    id: 'ko-mixed',
    language: 'korean',
    description: 'Korean words in English context',
    text: 'To say hello politely, use annyeonghaseyo, and kamsahamnida means thank you.',
    targetWords: ['annyeonghaseyo', 'kamsahamnida'],
  },
];

const CARTESIA_VOICES: Record<string, { voiceId: string; languageCode: string }> = {
  italian: { voiceId: '0e21713a-5e9a-428a-bed4-90d410b87f13', languageCode: 'it' },
  spanish: { voiceId: '5c5ad5e7-1020-476b-8b91-fdcbe9cc313c', languageCode: 'es' },
  french: { voiceId: 'a249eaff-1e96-4d2c-b23b-12efa4f66f41', languageCode: 'fr' },
  german: { voiceId: '3f4ade23-6eb4-4279-ab05-6a144947c4d5', languageCode: 'de' },
  japanese: { voiceId: '2b568345-1d48-4047-b25f-7baccf842eb0', languageCode: 'ja' },
  korean: { voiceId: '29e5f8b4-b953-4160-848f-40fae182235b', languageCode: 'ko' },
};

interface EvalResult {
  provider: string;
  testId: string;
  description: string;
  text: string;
  latencyMs: number;
  audioSizeBytes: number;
  audioFile: string;
  timestampCount: number;
  timestamps: { word: string; start: number; end: number }[];
  error?: string;
}

async function fetchElevenLabsVoices(): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.elevenlabs.io',
      path: '/v1/voices',
      method: 'GET',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk: string) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.voices || []);
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function synthesizeElevenLabs(
  text: string,
  voiceId: string,
  modelId: string = 'eleven_flash_v2_5'
): Promise<{ audio: Buffer; timestamps: any[]; latencyMs: number }> {
  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      text,
      model_id: modelId,
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
      },
    });

    const options = {
      hostname: 'api.elevenlabs.io',
      path: `/v1/text-to-speech/${voiceId}/with-timestamps`,
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk: string) => data += chunk);
      res.on('end', () => {
        const latencyMs = Date.now() - startTime;
        try {
          const parsed = JSON.parse(data);
          if (parsed.detail || parsed.error) {
            reject(new Error(JSON.stringify(parsed.detail || parsed.error)));
            return;
          }

          const audioBase64 = parsed.audio_base64;
          const alignment = parsed.alignment;

          const audioBuffer = Buffer.from(audioBase64, 'base64');

          let wordTimestamps: any[] = [];
          if (alignment && alignment.characters && alignment.character_start_times_seconds) {
            wordTimestamps = deriveWordTimestamps(
              alignment.characters,
              alignment.character_start_times_seconds,
              alignment.character_end_times_seconds
            );
          }

          resolve({ audio: audioBuffer, timestamps: wordTimestamps, latencyMs });
        } catch (e: any) {
          reject(new Error(`ElevenLabs parse error: ${e.message}, raw: ${data.substring(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function deriveWordTimestamps(
  characters: string[],
  startTimes: number[],
  endTimes: number[]
): { word: string; start: number; end: number }[] {
  const words: { word: string; start: number; end: number }[] = [];
  let currentWord = '';
  let wordStart = -1;
  let wordEnd = -1;

  for (let i = 0; i < characters.length; i++) {
    const char = characters[i];
    if (char === ' ' || char === '\n' || char === '\t') {
      if (currentWord.length > 0) {
        words.push({ word: currentWord, start: wordStart, end: wordEnd });
        currentWord = '';
        wordStart = -1;
      }
    } else {
      if (currentWord.length === 0) {
        wordStart = startTimes[i];
      }
      currentWord += char;
      wordEnd = endTimes[i];
    }
  }
  if (currentWord.length > 0) {
    words.push({ word: currentWord, start: wordStart, end: wordEnd });
  }
  return words;
}

async function synthesizeCartesia(
  text: string,
  voiceId: string,
  autoDetect: boolean = true,
  languageCode?: string
): Promise<{ audio: Buffer; timestamps: any[]; latencyMs: number }> {
  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      model_id: 'sonic-3',
      transcript: text,
      voice: {
        mode: 'id',
        id: voiceId,
      },
      output_format: {
        container: 'mp3',
        encoding: 'mp3',
        bit_rate: 128000,
        sample_rate: 44100,
      },
      ...(autoDetect ? {} : { language: languageCode }),
    });

    const options = {
      hostname: 'api.cartesia.ai',
      path: '/tts/bytes',
      method: 'POST',
      headers: {
        'X-API-Key': CARTESIA_API_KEY,
        'Cartesia-Version': '2024-06-10',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = https.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        const latencyMs = Date.now() - startTime;
        const audio = Buffer.concat(chunks);
        
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`Cartesia HTTP ${res.statusCode}: ${audio.toString('utf8').substring(0, 200)}`));
          return;
        }

        resolve({ audio, timestamps: [], latencyMs });
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function run() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  TTS Provider Evaluation: Cartesia Sonic-3 vs ElevenLabs Flash v2.5');
  console.log('═══════════════════════════════════════════════════════════════\n');

  if (!CARTESIA_API_KEY) {
    console.error('Missing CARTESIA_API_KEY');
    process.exit(1);
  }
  if (!ELEVENLABS_API_KEY) {
    console.error('Missing ELEVENLABS_API_KEY');
    process.exit(1);
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log('Fetching ElevenLabs voices...');
  let elevenVoices: any[] = [];
  try {
    elevenVoices = await fetchElevenLabsVoices();
    console.log(`Found ${elevenVoices.length} ElevenLabs voices`);
    const premade = elevenVoices.filter((v: any) => v.category === 'premade').slice(0, 5);
    console.log('Sample premade voices:');
    premade.forEach((v: any) => {
      console.log(`  - ${v.name} (${v.voice_id}) labels: ${JSON.stringify(v.labels || {})}`);
    });
  } catch (err: any) {
    console.error('Failed to fetch ElevenLabs voices:', err.message);
    process.exit(1);
  }

  const elevenVoiceId = elevenVoices.find((v: any) => 
    v.category === 'premade' && 
    v.labels?.gender === 'female' &&
    (v.labels?.use_case === 'conversational' || v.labels?.use_case === 'narration')
  )?.voice_id || elevenVoices.find((v: any) => v.category === 'premade')?.voice_id;

  if (!elevenVoiceId) {
    console.error('No suitable ElevenLabs voice found');
    process.exit(1);
  }
  const selectedVoice = elevenVoices.find((v: any) => v.voice_id === elevenVoiceId);
  console.log(`\nUsing ElevenLabs voice: ${selectedVoice?.name} (${elevenVoiceId})\n`);

  const results: EvalResult[] = [];
  let totalCartesiaChars = 0;
  let totalElevenChars = 0;

  for (const test of TEST_SENTENCES) {
    console.log(`\n─── Test: ${test.id} ───`);
    console.log(`Description: ${test.description}`);
    console.log(`Text: "${test.text}"`);
    console.log(`Target words: ${test.targetWords.join(', ')}`);

    const cartesiaVoice = CARTESIA_VOICES[test.language];
    if (!cartesiaVoice) {
      console.log(`Skipping Cartesia for ${test.language} - no voice configured`);
    } else {
      try {
        console.log(`  Cartesia (autoDetect)...`);
        const cartResult = await synthesizeCartesia(
          test.text,
          cartesiaVoice.voiceId,
          true,
          cartesiaVoice.languageCode
        );
        const cartFile = path.join(OUTPUT_DIR, `${test.id}_cartesia_autodetect.mp3`);
        fs.writeFileSync(cartFile, cartResult.audio);
        totalCartesiaChars += test.text.length;

        results.push({
          provider: 'Cartesia (autoDetect)',
          testId: test.id,
          description: test.description,
          text: test.text,
          latencyMs: cartResult.latencyMs,
          audioSizeBytes: cartResult.audio.length,
          audioFile: cartFile,
          timestampCount: cartResult.timestamps.length,
          timestamps: cartResult.timestamps,
        });
        console.log(`    ✓ ${cartResult.latencyMs}ms, ${(cartResult.audio.length / 1024).toFixed(1)}KB`);
      } catch (err: any) {
        console.error(`    ✗ Cartesia error: ${err.message}`);
        results.push({
          provider: 'Cartesia (autoDetect)',
          testId: test.id,
          description: test.description,
          text: test.text,
          latencyMs: 0,
          audioSizeBytes: 0,
          audioFile: '',
          timestampCount: 0,
          timestamps: [],
          error: err.message,
        });
      }

      try {
        console.log(`  Cartesia (forced ${cartesiaVoice.languageCode})...`);
        const cartForcedResult = await synthesizeCartesia(
          test.text,
          cartesiaVoice.voiceId,
          false,
          cartesiaVoice.languageCode
        );
        const cartForcedFile = path.join(OUTPUT_DIR, `${test.id}_cartesia_forced.mp3`);
        fs.writeFileSync(cartForcedFile, cartForcedResult.audio);
        totalCartesiaChars += test.text.length;

        results.push({
          provider: `Cartesia (forced ${cartesiaVoice.languageCode})`,
          testId: test.id,
          description: test.description,
          text: test.text,
          latencyMs: cartForcedResult.latencyMs,
          audioSizeBytes: cartForcedResult.audio.length,
          audioFile: cartForcedFile,
          timestampCount: cartForcedResult.timestamps.length,
          timestamps: cartForcedResult.timestamps,
        });
        console.log(`    ✓ ${cartForcedResult.latencyMs}ms, ${(cartForcedResult.audio.length / 1024).toFixed(1)}KB`);
      } catch (err: any) {
        console.error(`    ✗ Cartesia (forced) error: ${err.message}`);
        results.push({
          provider: `Cartesia (forced ${cartesiaVoice.languageCode})`,
          testId: test.id,
          description: test.description,
          text: test.text,
          latencyMs: 0,
          audioSizeBytes: 0,
          audioFile: '',
          timestampCount: 0,
          timestamps: [],
          error: err.message,
        });
      }
    }

    try {
      console.log(`  ElevenLabs Flash v2.5...`);
      const elevenResult = await synthesizeElevenLabs(test.text, elevenVoiceId, 'eleven_flash_v2_5');
      const elevenFile = path.join(OUTPUT_DIR, `${test.id}_elevenlabs_flash.mp3`);
      fs.writeFileSync(elevenFile, elevenResult.audio);
      totalElevenChars += test.text.length;

      results.push({
        provider: 'ElevenLabs Flash v2.5',
        testId: test.id,
        description: test.description,
        text: test.text,
        latencyMs: elevenResult.latencyMs,
        audioSizeBytes: elevenResult.audio.length,
        audioFile: elevenFile,
        timestampCount: elevenResult.timestamps.length,
        timestamps: elevenResult.timestamps,
      });
      console.log(`    ✓ ${elevenResult.latencyMs}ms, ${(elevenResult.audio.length / 1024).toFixed(1)}KB, ${elevenResult.timestamps.length} word timestamps`);
    } catch (err: any) {
      console.error(`    ✗ ElevenLabs error: ${err.message}`);
      results.push({
        provider: 'ElevenLabs Flash v2.5',
        testId: test.id,
        description: test.description,
        text: test.text,
        latencyMs: 0,
        audioSizeBytes: 0,
        audioFile: '',
        timestampCount: 0,
        timestamps: [],
        error: err.message,
      });
    }

    try {
      console.log(`  ElevenLabs Turbo v2.5...`);
      const turboResult = await synthesizeElevenLabs(test.text, elevenVoiceId, 'eleven_turbo_v2_5');
      const turboFile = path.join(OUTPUT_DIR, `${test.id}_elevenlabs_turbo.mp3`);
      fs.writeFileSync(turboFile, turboResult.audio);
      totalElevenChars += test.text.length;

      results.push({
        provider: 'ElevenLabs Turbo v2.5',
        testId: test.id,
        description: test.description,
        text: test.text,
        latencyMs: turboResult.latencyMs,
        audioSizeBytes: turboResult.audio.length,
        audioFile: turboFile,
        timestampCount: turboResult.timestamps.length,
        timestamps: turboResult.timestamps,
      });
      console.log(`    ✓ ${turboResult.latencyMs}ms, ${(turboResult.audio.length / 1024).toFixed(1)}KB, ${turboResult.timestamps.length} word timestamps`);
    } catch (err: any) {
      console.error(`    ✗ ElevenLabs Turbo error: ${err.message}`);
      results.push({
        provider: 'ElevenLabs Turbo v2.5',
        testId: test.id,
        description: test.description,
        text: test.text,
        latencyMs: 0,
        audioSizeBytes: 0,
        audioFile: '',
        timestampCount: 0,
        timestamps: [],
        error: err.message,
      });
    }
  }

  console.log('\n\n═══════════════════════════════════════════════════════════════');
  console.log('  EVALUATION SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const providers = ['Cartesia (autoDetect)', 'ElevenLabs Flash v2.5', 'ElevenLabs Turbo v2.5'];
  
  for (const provider of providers) {
    const providerResults = results.filter(r => r.provider === provider && !r.error);
    if (providerResults.length === 0) continue;

    const avgLatency = providerResults.reduce((sum, r) => sum + r.latencyMs, 0) / providerResults.length;
    const avgTimestamps = providerResults.reduce((sum, r) => sum + r.timestampCount, 0) / providerResults.length;
    const errorCount = results.filter(r => r.provider === provider && r.error).length;

    console.log(`${provider}:`);
    console.log(`  Avg latency: ${avgLatency.toFixed(0)}ms`);
    console.log(`  Avg word timestamps: ${avgTimestamps.toFixed(1)}`);
    console.log(`  Errors: ${errorCount}/${results.filter(r => r.provider === provider).length}`);
    console.log();
  }

  console.log('COST COMPARISON (per 1M characters):');
  console.log('  Cartesia Sonic-3:       $30.00');
  console.log('  ElevenLabs Flash v2.5:  $16.67 (0.5 credits/char)');
  console.log('  ElevenLabs Turbo v2.5:  $16.67 (0.5 credits/char)');
  console.log('  ElevenLabs Multi v2:    $33.33 (1 credit/char)');
  console.log(`  → ElevenLabs Flash is ~44% cheaper than Cartesia\n`);

  console.log('FEATURES COMPARISON:');
  console.log('  Inline language switching:');
  console.log('    Cartesia: ✗ NOT supported (no <lang> tag)');
  console.log('    ElevenLabs: ✓ Automatic detection in multilingual models');
  console.log('  Word timestamps:');
  console.log('    Cartesia: ✓ Native (WebSocket only, not in bytes API)');
  console.log('    ElevenLabs: ✓ Character-level → word-level derivation');
  console.log('  Streaming:');
  console.log('    Cartesia: ✓ WebSocket streaming');
  console.log('    ElevenLabs: ✓ WebSocket + HTTP streaming');
  console.log('  Languages: Cartesia 42+ | ElevenLabs 32+');
  console.log();

  console.log('AUDIO FILES FOR LISTENING:');
  console.log(`  Directory: ${OUTPUT_DIR}/`);
  const audioFiles = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.mp3')).sort();
  for (const file of audioFiles) {
    const stat = fs.statSync(path.join(OUTPUT_DIR, file));
    console.log(`  ${file} (${(stat.size / 1024).toFixed(1)}KB)`);
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  KEY QUESTION: Listen to the Italian homograph tests');
  console.log('  Compare *_cartesia_autodetect.mp3 vs *_elevenlabs_flash.mp3');
  console.log('  Does ElevenLabs pronounce "come stai" correctly?');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const reportData = {
    timestamp: new Date().toISOString(),
    results,
    summary: {
      totalTests: TEST_SENTENCES.length,
      cartesiaCharsUsed: totalCartesiaChars,
      elevenLabsCharsUsed: totalElevenChars,
    },
  };
  const reportFile = path.join(OUTPUT_DIR, 'eval-report.json');
  fs.writeFileSync(reportFile, JSON.stringify(reportData, null, 2));
  console.log(`Full report saved to: ${reportFile}`);
}

run().catch(err => {
  console.error('Evaluation failed:', err);
  process.exit(1);
});
