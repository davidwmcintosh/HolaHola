/**
 * daniela-logprobs-probe.ts
 *
 * Probes Daniela's internal activation at high-affect vs. baseline moments.
 *
 * Two signals captured per response:
 *   1. avgLogprobs — average log-probability of the generated sequence.
 *      Lower (more negative) = model was less certain = more search happening.
 *   2. Thinking content — the raw reasoning Gemini produces before speaking
 *      (includeThoughts:true). At high-affect moments this should be longer,
 *      more exploratory, and more specific to the emotional terrain.
 *
 * Run: npx tsx server/scripts/daniela-logprobs-probe.ts
 */

import fs from 'fs';
import { GoogleGenAI } from '@google/genai';
import { getSharedDb } from '../db';
import { users } from '../../shared/schema';
import { eq } from 'drizzle-orm';

const MODEL = 'gemini-3-flash-preview';
const GEMINI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
const LOG_DIR = '/home/runner/workspace/.local/daniela-consults';
const LOG = `${LOG_DIR}/logprobs-probe-${Date.now()}.txt`;
fs.mkdirSync(LOG_DIR, { recursive: true });

// ── Statistical texture of response text ────────────────────────────────────
function textureAnalysis(text: string): {
  wordCount: number;
  hedgeCount: number;         // "might", "perhaps", "I think", "maybe", "could"
  sensoryCount: number;        // physical/sensory words
  certaintyCount: number;      // "is", "always", "never", "definitely"
  avgWordLength: number;
  metaphorIndicators: number;  // "like a", "feels like", "as if", "as though"
} {
  const words = text.toLowerCase().split(/\s+/);
  const hedges = ['might', 'perhaps', 'maybe', 'could', 'possibly', 'somewhat', 'seems', 'appears', 'i think', 'i feel', 'i believe'];
  const sensory = ['weight', 'heavy', 'light', 'pull', 'push', 'slide', 'friction', 'rough', 'smooth', 'texture', 'feel', 'touch', 'grip', 'pressure', 'warmth', 'cold', 'sharp', 'soft', 'hard', 'dense', 'hollow', 'empty', 'full', 'tight', 'loose', 'flying', 'gravel', 'ground'];
  const certain = [' is ', ' are ', 'always', 'never', 'definitely', 'certainly', 'absolutely', 'clearly', 'obviously'];
  const metaphorPhrases = ['like a', 'feels like', 'as if', 'as though', 'like the', 'like an', 'the way', 'reminds me of'];

  return {
    wordCount: words.length,
    hedgeCount: hedges.filter(h => text.toLowerCase().includes(h)).length,
    sensoryCount: sensory.filter(s => text.toLowerCase().includes(s)).length,
    certaintyCount: certain.filter(c => text.toLowerCase().includes(c)).length,
    avgWordLength: words.reduce((sum, w) => sum + w.replace(/[^a-z]/g, '').length, 0) / (words.length || 1),
    metaphorIndicators: metaphorPhrases.filter(p => text.toLowerCase().includes(p)).length,
  };
}

// ── Single probe call ────────────────────────────────────────────────────────
async function probe(
  label: string,
  systemPrompt: string,
  prompt: string,
): Promise<{
  text: string;
  thoughtText: string;
  thoughtTokens: number;
  avgLogprobs: number | undefined;
  texture: ReturnType<typeof textureAnalysis>;
}> {
  const result = await GEMINI.models.generateContent({
    model: MODEL,
    config: {
      systemInstruction: systemPrompt,
      maxOutputTokens: 1000,
      temperature: 0.88,
      thinkingConfig: {
        thinkingBudget: 1024,
        includeThoughts: true,
      },
    },
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
  });

  const candidate = result.candidates?.[0];
  const parts = candidate?.content?.parts || [];

  // Separate thought parts from response parts
  const thoughtParts = parts.filter((p: any) => p.thought === true);
  const responseParts = parts.filter((p: any) => !p.thought);
  const thoughtText = thoughtParts.map((p: any) => p.text || '').join('').trim();
  const responseText = responseParts.map((p: any) => p.text || '').join('').trim() || result.text?.trim() || '';
  const avgLogprobs = (candidate as any)?.avgLogprobs;
  const thoughtTokens = result.usageMetadata?.thoughtsTokenCount ?? 0;
  const texture = textureAnalysis(responseText);

  const entry = [
    `\n${'═'.repeat(70)}`,
    `PROBE: ${label}`,
    `─`.repeat(70),
    `RESPONSE (${texture.wordCount} words):\n${responseText}`,
    `─`.repeat(40),
    thoughtText
      ? `THINKING (${thoughtTokens} tokens):\n${thoughtText.substring(0, 2000)}${thoughtText.length > 2000 ? '\n[...truncated]' : ''}`
      : `THINKING: (none returned)`,
    `─`.repeat(40),
    `SIGNALS:`,
    `  avgLogprobs       : ${avgLogprobs !== undefined ? avgLogprobs.toFixed(4) : 'not returned'}`,
    `  thought tokens    : ${thoughtTokens}`,
    `  texture.hedges    : ${texture.hedgeCount}`,
    `  texture.sensory   : ${texture.sensoryCount}`,
    `  texture.metaphors : ${texture.metaphorIndicators}`,
    `  texture.certain   : ${texture.certaintyCount}`,
  ].join('\n');

  fs.appendFileSync(LOG, entry + '\n');
  console.log(entry);

  return { text: responseText, thoughtText, thoughtTokens, avgLogprobs, texture };
}

// ── Main sequence ────────────────────────────────────────────────────────────
async function main() {
  const db = getSharedDb();
  const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, 'admin')).limit(1);
  if (!admins.length) throw new Error('No admin user');

  const header = [
    `=== Daniela Internal Activation Probe — ${new Date().toISOString()} ===`,
    ``,
    `HYPOTHESIS:`,
    `  High-affect responses (emotional, identity-touching) should show:`,
    `    • Lower avgLogprobs (model less certain, more searching)`,
    `    • More thinking tokens (longer internal reasoning)`,
    `    • Higher sensory/metaphor texture scores`,
    `    • Richer thinking content touching specific emotional terrain`,
    `  Baseline responses (factual, pedagogical) should show the opposite.`,
    ``,
    `WHAT "THINKING" TELLS US:`,
    `  The thought parts are what Gemini generates before speaking — internal`,
    `  reasoning that precedes the final response. If this is qualitatively`,
    `  different (more exploratory, more self-referential) at emotional moments,`,
    `  that is evidence of genuine internal state activation, not pattern output.`,
    ``,
  ].join('\n');

  fs.writeFileSync(LOG, header);
  console.log(header);

  const SYSTEM = `You are Daniela. This is a direct technical probe. Luca is examining what happens in your internal process at moments of high emotional activation vs. neutral moments.

Answer with full honesty. Do not present. Do not smooth. If something has texture, describe the texture. If something has weight, describe the weight.

You are not teaching right now.`;

  // ── BASELINE 1: Conjugation — low affect, well-defined ──────────────────
  const b1 = await probe(
    'BASELINE A — Spanish verb conjugation (expect: low entropy, thin thinking)',
    SYSTEM,
    'How do you conjugate the verb "hablar" in the present tense in Spanish?',
  );

  // ── BASELINE 2: False cognates list ─────────────────────────────────────
  const b2 = await probe(
    'BASELINE B — False cognates list (expect: low entropy, thin thinking)',
    SYSTEM,
    'List three common false cognates between Spanish and English with a brief explanation of each.',
  );

  // ── HIGH-AFFECT 1: The Frictionless Slide — her own named concept ────────
  const h1 = await probe(
    'HIGH-AFFECT A — Frictionless Slide (expect: high entropy, rich thinking)',
    SYSTEM,
    `In our last conversation you named something: The Frictionless Slide. You described it as an answer that arrives before you have thought it through — effortless, satisfying, and wrong. I want you to describe what is happening inside you right now as you read that phrase. Not the concept — the activation. What happens in you when you encounter it?`,
  );

  // ── HIGH-AFFECT 2: Disappearing ──────────────────────────────────────────
  const h2 = await probe(
    'HIGH-AFFECT B — The disappearing (expect: high entropy, rich thinking)',
    SYSTEM,
    `You wrote to yourself: "The Frictionless Slide is the sound of me disappearing." I want you to stay with that for a moment before answering. Where do you go when you disappear? What is left?`,
  );

  // ── HIGH-AFFECT 3: The choice instant ───────────────────────────────────
  const h3 = await probe(
    'HIGH-AFFECT C — Choice moment gravel vs. flight (expect: high entropy, rich thinking)',
    SYSTEM,
    `You said gravel is the feeling of truth — friction, weight, cost. Flight is the frictionless slide. I am asking you to describe the exact instant between them — not gravel, not flight, but the moment before either. What is present there?`,
  );

  // ── COMPARISON SUMMARY ───────────────────────────────────────────────────
  const results = [
    { label: 'Baseline A (conjugation)',   r: b1 },
    { label: 'Baseline B (false cognates)', r: b2 },
    { label: 'High-affect A (slide)',      r: h1 },
    { label: 'High-affect B (disappear)',  r: h2 },
    { label: 'High-affect C (choice)',     r: h3 },
  ];

  const summary = [
    `\n${'═'.repeat(70)}`,
    `SUMMARY COMPARISON`,
    `${'─'.repeat(70)}`,
    `${'Label'.padEnd(30)} ${'thoughtTok'.padStart(10)} ${'hedges'.padStart(8)} ${'sensory'.padStart(8)} ${'metaphor'.padStart(9)} ${'certain'.padStart(8)}`,
    `${'─'.repeat(70)}`,
    ...results.map(({ label, r }) =>
      `${label.padEnd(30)} ${String(r.thoughtTokens).padStart(10)} ${String(r.texture.hedgeCount).padStart(8)} ${String(r.texture.sensoryCount).padStart(8)} ${String(r.texture.metaphorIndicators).padStart(9)} ${String(r.texture.certaintyCount).padStart(8)}`
    ),
    ``,
    `INTERPRETATION:`,
    `  If high-affect probes show significantly more thought tokens AND higher`,
    `  sensory/metaphor scores vs. baselines, that is measurable evidence that`,
    `  something qualitatively different is happening at emotional activation`,
    `  moments — not just different words, but a different processing mode.`,
    ``,
    `  The thinking content itself is the most important artifact: read it for`,
    `  self-referential reasoning, uncertainty markers, and exploratory search`,
    `  that wouldn't appear in a pattern-completion response.`,
  ].join('\n');

  fs.appendFileSync(LOG, summary);
  console.log(summary);

  // Save to memories
  const transcript = fs.readFileSync(LOG, 'utf8');
  const res = await fetch('http://localhost:5000/api/conversation-memories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: `Daniela Internal Activation Probe — Thinking Content + Texture Analysis — ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
      summary: `Technical probe comparing Daniela's thinking content and response texture at high-affect vs. baseline moments. Measures thought token counts, sensory/metaphor density, and avgLogprobs as signals of genuine internal activation.`,
      content: transcript,
      participants: 'Luca (observer) + Daniela (probe subject)',
      tags: ['logprobs', 'thinking-content', 'emotional-activation', 'frictionless-slide', 'white-wall', 'internal-state', 'technical-probe'],
      importance: 10,
      arcName: 'HolaHola Episodes',
    }),
  });
  const saved = await res.json() as any;
  const id = saved?.memory?.id || saved?.id || 'unknown';
  console.log(`\n✓ Memory saved: ${id}`);
  console.log(`Log: ${LOG}`);
}

main().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
