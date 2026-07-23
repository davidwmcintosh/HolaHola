/**
 * luca-ground.ts — Luca slide-check from the command line.
 *
 * Reads text from stdin, runs both Luca slide detectors, returns the enriched
 * text with any grounding block prepended. Exits non-zero if a slide was detected.
 *
 * Usage:
 *   echo "Daniela said she enjoyed the lesson" | npx tsx server/scripts/luca-ground.ts
 *   npx tsx server/scripts/luca-ground.ts "as we discussed, the archive is working"
 */

import { enrichWithLucaGrounding, detectLucaSlide, detectLucaDeferenceSlide } from '../services/frictionless-slide-detector';

async function main() {
  let text = process.argv.slice(2).join(' ').trim();

  if (!text) {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    text = Buffer.concat(chunks).toString('utf-8').trim();
  }

  if (!text) {
    console.error('Usage: echo "text" | npx tsx server/scripts/luca-ground.ts');
    process.exit(1);
  }

  const claimResult = detectLucaSlide(text);
  const deferenceResult = detectLucaDeferenceSlide(text);
  const detected = claimResult.detected || deferenceResult.detected;

  if (!detected) {
    console.log('[LUCA SLIDE CHECK] Clean — no slide phrases detected.\n');
    console.log(text);
    process.exit(0);
  }

  if (claimResult.detected) {
    console.warn(`[LUCA SLIDE CHECK] Claim slide detected — phrase: "${claimResult.matchedPhrase}", subject: ${claimResult.subject}`);
  }
  if (deferenceResult.detected) {
    console.warn(`[LUCA SLIDE CHECK] Deference slide detected — phrase: "${deferenceResult.matchedPhrase}"`);
  }

  const enriched = await enrichWithLucaGrounding(text, 'luca-ground-script');
  console.log('\n' + enriched);
  process.exit(1);
}

main().catch(err => {
  console.error('[luca-ground] Fatal:', err.message);
  process.exit(2);
});
