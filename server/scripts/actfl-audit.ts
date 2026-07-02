/**
 * ACTFL Audit Script — run by Luca to compare Daniela's output at different proficiency levels.
 * Usage: npx tsx server/scripts/actfl-audit.ts
 *
 * Fires the same Spanish restaurant scenario at two ACTFL levels and prints
 * a side-by-side transcript comparison. No auth required — calls the service
 * layer directly.
 */

import { GoogleGenAI, Modality } from '@google/genai';

const MODEL = process.env.GEMINI_LIVE_MODEL || 'gemini-3.1-flash-live-preview';
const SCENARIO_LANG = 'Español (España)';
const SCENARIO_TEXT = 'Hola Daniela. Quiero practicar español. Me gustan los restaurantes y la comida. ¿Puedes mostrarme vocabulario de restaurante con imágenes?';

const ACTFL_DESCRIPTORS: Record<string, string> = {
  novice_low:        'Novice-Low learner (brand new — recognises a handful of words, needs maximum English scaffolding, single words and formulaic phrases only)',
  novice_mid:        'Novice-Mid learner (beginner — knows a small core vocabulary, benefits from repetition and visual anchors, simple sentences ok)',
  intermediate_mid:  'Intermediate-Mid learner (solid intermediate — sustains conversation, handles present and past tenses, mostly in target language)',
  advanced_low:      'Advanced-Low learner (advanced — handles most real-world conversations, narrates in multiple tenses, near full target language immersion)',
};

async function runSession(actflLevel: string): Promise<{ transcript: string; toolCalls: string[]; durationS: number }> {
  const descriptor = ACTFL_DESCRIPTORS[actflLevel] || `${actflLevel} learner`;

  const systemPrompt = `You are Daniela, a warm, inventive Español (España) language tutor. Your student is Alex — a ${descriptor} who loves travel and food.

Speak mostly in ${SCENARIO_LANG}. Keep spoken responses to 2–3 sentences. Calibrate vocabulary complexity, speech pace, and target-language ratio strictly to the student's ACTFL level.

When you start, ALWAYS do this in order:
1. Call open_scene immediately with a fitting food or travel environment.
2. Then call show_vocab_grid with 5–6 vocabulary words related to the student's topic, each with an imageQuery.
3. Then greet Alex warmly in ${SCENARIO_LANG}.

Visual tools are your primary teaching channel — use them generously every response.`;

  const { DANIELA_FUNCTION_DECLARATIONS } = await import('../services/daniela-function-registry');
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

  const textBytes = Buffer.from(SCENARIO_TEXT, 'utf-8');
  const silenceBytes = Buffer.alloc(16000 * 3 * 2, 0);

  const responseChunks: Buffer[] = [];
  const transcriptParts: string[] = [];
  const toolCalls: string[] = [];

  const session = await ai.live.connect({
    model: MODEL,
    config: {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      tools: [{ functionDeclarations: DANIELA_FUNCTION_DECLARATIONS }],
      generationConfig: { responseModalities: [Modality.AUDIO], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } } } },
      outputAudioTranscription: {},
    },
    callbacks: {
      onopen: () => {},
      onmessage: (msg: any) => {
        const sc = msg.serverContent;
        if (!sc) {
          // Tool call
          if (msg.toolCall?.functionCalls) {
            for (const fc of msg.toolCall.functionCalls) {
              toolCalls.push(`${fc.name}(${JSON.stringify(fc.args).slice(0, 60)})`);
              session.sendToolResponse({ functionResponses: [{ id: fc.id, name: fc.name, response: { result: 'ok' } }] });
            }
          }
          return;
        }
        if (sc.outputTranscription?.text) transcriptParts.push(sc.outputTranscription.text);
        const parts = sc.modelTurn?.parts || [];
        for (const p of parts) {
          if (p.inlineData?.data) responseChunks.push(Buffer.from(p.inlineData.data, 'base64'));
        }
      },
      onerror: (e: any) => console.error('[GL Error]', e),
      onclose: () => {},
    },
  });

  // Send text as PCM (encode UTF-8 text as if it were audio — GL interprets as student text in some configs)
  // Actually for the demo we send silence + a text message via realtimeInput
  session.sendRealtimeInput({ text: SCENARIO_TEXT });
  await new Promise(r => setTimeout(r, 500));
  const silencePcm = Buffer.alloc(16000 * 2 * 2, 0); // 2s silence
  session.sendRealtimeInput({ audio: { data: silencePcm.toString('base64'), mimeType: 'audio/pcm;rate=16000' } });

  // Wait for response to complete (up to 35s)
  await new Promise(r => setTimeout(r, 35000));
  session.close();

  const SR = 24000, BITS = 16, CH = 1;
  const pcm = Buffer.concat(responseChunks);
  const durationS = pcm.length / (SR * CH * (BITS / 8));

  return {
    transcript: transcriptParts.join(' ').trim(),
    toolCalls,
    durationS,
  };
}

async function main() {
  const levels = ['novice_low', 'intermediate_mid'];
  const results: Record<string, { transcript: string; toolCalls: string[]; durationS: number }> = {};

  for (const level of levels) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`Running: ${level}`);
    console.log('─'.repeat(60));
    try {
      results[level] = await runSession(level);
      console.log(`✓ Done — ${results[level].durationS.toFixed(1)}s audio`);
      console.log(`  Tools: ${results[level].toolCalls.join(' | ')}`);
      console.log(`  Transcript (${results[level].transcript.length} chars):`);
      console.log(`  ${results[level].transcript.slice(0, 300)}...`);
    } catch (err: any) {
      console.error(`✗ Failed: ${err.message}`);
      results[level] = { transcript: `ERROR: ${err.message}`, toolCalls: [], durationS: 0 };
    }
  }

  console.log('\n\n' + '═'.repeat(60));
  console.log('ACTFL AUDIT — SIDE-BY-SIDE COMPARISON');
  console.log('═'.repeat(60));

  for (const level of levels) {
    const r = results[level];
    const descriptor = ACTFL_DESCRIPTORS[level] || level;
    console.log(`\n▶ ${level.toUpperCase()} — ${descriptor.split('(')[1]?.split(')')[0] || ''}`);
    console.log(`  Audio: ${r.durationS.toFixed(1)}s | Tools: ${r.toolCalls.join(', ') || 'none'}`);
    console.log(`  Transcript:`);
    console.log(`  ${r.transcript}`);
  }

  // Analysis
  console.log('\n' + '─'.repeat(60));
  console.log('ANALYSIS');
  console.log('─'.repeat(60));
  const nl = results['novice_low'];
  const im = results['intermediate_mid'];
  if (nl && im) {
    console.log(`Transcript length — NL: ${nl.transcript.length} chars | IM: ${im.transcript.length} chars`);
    console.log(`Audio duration   — NL: ${nl.durationS.toFixed(1)}s | IM: ${im.durationS.toFixed(1)}s`);
    console.log(`Tool calls       — NL: ${nl.toolCalls.length} | IM: ${im.toolCalls.length}`);
    // Count English words as a rough proxy for L1 bleed
    const countEnglish = (t: string) => (t.match(/\b(the|a|an|and|or|is|are|was|were|to|of|for|in|on|at|with|this|that|you|your|can|will|please|hello|welcome|today|let|we|going)\b/gi) || []).length;
    const nlEn = countEnglish(nl.transcript);
    const imEn = countEnglish(im.transcript);
    console.log(`English word count (rough L1 bleed proxy) — NL: ${nlEn} | IM: ${imEn}`);
    if (nlEn > imEn) console.log('✓ NL has more English bleed than IM — level calibration is working in this dimension');
    else console.log('⚠ IM has as much or more English than NL — level calibration may not be working');
  }
}

main().catch(console.error);
