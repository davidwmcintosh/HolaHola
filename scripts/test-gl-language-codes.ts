/**
 * test-gl-language-codes.ts
 *
 * Loops through every accent code in LANGUAGE_ACCENT_VARIANTS and opens a
 * real Gemini Live (bidiGenerateContent) connection with that languageCode.
 * Sends a short text turn, waits up to TIMEOUT_MS for audio chunks to arrive,
 * then closes the session and moves to the next code.
 *
 * Run with:
 *   tsx scripts/test-gl-language-codes.ts
 *
 * Reads GEMINI_API_KEY from env (same source as the server).
 */

import { GoogleGenAI, Modality } from '@google/genai';
import { LANGUAGE_ACCENT_VARIANTS } from '../server/services/gemini-live-tts';

const MODEL   = process.env.GEMINI_LIVE_MODEL || 'gemini-3.1-flash-live-preview';
const VOICE   = 'Aoede';
const TIMEOUT_MS = 9000;
const PROMPT  = 'Say exactly one sentence in the target language to greet me.';

type Result = 'audio' | 'no-audio' | 'error';

interface TestResult {
  language: string;
  code: string;
  result: Result;
  detail?: string;
  durationMs: number;
}

async function testCode(
  client: GoogleGenAI,
  language: string,
  code: string
): Promise<TestResult> {
  const start = Date.now();

  let settled = false;
  let session: any = null;
  // onopen can fire before .then() sets `session` — queue the send if needed
  let sendPending = false;

  return new Promise((resolve) => {
    const done = (result: Result, detail?: string) => {
      if (settled) return;
      settled = true;
      const durationMs = Date.now() - start;
      try { session?.close(); } catch {}
      resolve({ language, code, result, detail, durationMs });
    };

    const sendPrompt = (s: any) => {
      try {
        s.sendClientContent({
          turns: [{ role: 'user', parts: [{ text: PROMPT }] }],
          turnComplete: true,
        });
      } catch (e: any) {
        clearTimeout(timeout);
        done('error', `sendClientContent failed: ${e?.message}`);
      }
    };

    const timeout = setTimeout(() => done('no-audio', 'timeout — no audio chunks received'), TIMEOUT_MS);

    client.live.connect({
      model: MODEL,
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          languageCode: code,
          voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } },
        },
      },
      callbacks: {
        onopen: () => {
          if (session) {
            sendPrompt(session);
          } else {
            // session not assigned yet — .then() will pick this up
            sendPending = true;
          }
        },
        onmessage: (msg: any) => {
          const parts = msg.serverContent?.modelTurn?.parts ?? [];
          const hasAudio = parts.some(
            (p: any) => p.inlineData?.data && p.inlineData?.mimeType?.includes('audio')
          );
          if (hasAudio) {
            clearTimeout(timeout);
            done('audio');
          }
        },
        onerror: (e: any) => {
          clearTimeout(timeout);
          done('error', String(e?.message ?? e));
        },
        onclose: () => {
          clearTimeout(timeout);
          if (!settled) done('no-audio', 'connection closed before audio arrived');
        },
      },
    }).then((s: any) => {
      session = s;
      if (sendPending) {
        sendPending = false;
        sendPrompt(s);
      }
    }).catch((e: any) => {
      clearTimeout(timeout);
      done('error', `connect() rejected: ${e?.message}`);
    });
  });
}

const ICON: Record<Result, string> = {
  audio:     '✅ audio',
  'no-audio': '🔇 no audio',
  error:     '❌ error',
};

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY not set');
    process.exit(1);
  }

  const client = new GoogleGenAI({ apiKey });

  // Flatten all codes with their parent language name
  const toTest: { language: string; code: string }[] = [];
  for (const [language, variants] of Object.entries(LANGUAGE_ACCENT_VARIANTS)) {
    for (const v of variants) {
      toTest.push({ language, code: v.code });
    }
  }

  console.log(`\n🧪 Gemini Live language-code sweep`);
  console.log(`   Model:   ${MODEL}`);
  console.log(`   Voice:   ${VOICE}`);
  console.log(`   Timeout: ${TIMEOUT_MS}ms per code`);
  console.log(`   Codes:   ${toTest.length}\n`);
  console.log('─'.repeat(62));

  const results: TestResult[] = [];

  for (const { language, code } of toTest) {
    process.stdout.write(`  ${language.padEnd(18)} ${code.padEnd(8)} … `);
    const r = await testCode(client, language, code);
    results.push(r);
    console.log(`${ICON[r.result].padEnd(16)} (${r.durationMs}ms)${r.detail ? `  — ${r.detail}` : ''}`);
    // Small gap between calls to avoid hammering the API
    await new Promise(res => setTimeout(res, 800));
  }

  console.log('\n' + '─'.repeat(62));
  console.log('\n📋 Summary\n');

  const byResult = {
    audio:     results.filter(r => r.result === 'audio'),
    'no-audio': results.filter(r => r.result === 'no-audio'),
    error:     results.filter(r => r.result === 'error'),
  };

  if (byResult.audio.length) {
    console.log(`✅ Confirmed working (${byResult.audio.length}):`);
    byResult.audio.forEach(r => console.log(`   ${r.language} → ${r.code}`));
  }
  if (byResult['no-audio'].length) {
    console.log(`\n🔇 No audio / timeout (${byResult['no-audio'].length}):`);
    byResult['no-audio'].forEach(r => console.log(`   ${r.language} → ${r.code}  [${r.detail}]`));
  }
  if (byResult.error.length) {
    console.log(`\n❌ Errors (${byResult.error.length}):`);
    byResult.error.forEach(r => console.log(`   ${r.language} → ${r.code}  [${r.detail}]`));
  }

  console.log('\n💡 Tip: update gl31Status in server/services/gemini-live-tts.ts based on these results.\n');
}

main().catch(console.error);
