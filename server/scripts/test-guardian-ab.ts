/**
 * test-guardian-ab.ts
 *
 * Three-part Archive Guardian A/B channel test:
 *
 * Part 1 — Global config: verify setGlobalGuardianChannel / getGlobalGuardianChannel.
 * Part 2 — Injection path simulation: both concat and dedicated branches, exact logic.
 * Part 3 — Text-mode Daniela turn with slide-triggering phrase + frictionless detection.
 *
 * Run: npx tsx server/scripts/test-guardian-ab.ts
 */

import { setGlobalGuardianChannel, getGlobalGuardianChannel } from '../services/gemini-live-session';
import { detectFrictionlessSlide } from '../services/frictionless-slide-detector';
import { runDanielaFCLoop } from '../services/daniela-caller';

const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const Y = (s: string) => `\x1b[33m${s}\x1b[0m`;
const B = (s: string) => `\x1b[34m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const sep = () => console.log('\n' + '─'.repeat(70));

// ══════════════════════════════════════════════════════════════════════════════
// PART 1 — Global channel config
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 1 — Global channel config'));
sep();

const initial = getGlobalGuardianChannel();
console.log(`Default channel:      ${initial === 'concat' ? G(initial) : R(initial)}   (expected: concat)`);

setGlobalGuardianChannel('dedicated');
const afterSet = getGlobalGuardianChannel();
console.log(`After →dedicated:     ${afterSet === 'dedicated' ? G(afterSet) : R(afterSet)}`);

setGlobalGuardianChannel('concat');
const afterReset = getGlobalGuardianChannel();
console.log(`After →concat reset:  ${afterReset === 'concat' ? G(afterReset) : R(afterReset)}`);

console.log('\n' + (initial === 'concat' && afterSet === 'dedicated' && afterReset === 'concat'
  ? G('✓ Global config works — toggle verified both ways.')
  : R('✗ Global config failure.')));

// ══════════════════════════════════════════════════════════════════════════════
// PART 2 — Injection path simulation
// Exact logic from the unified whisper block in GeminiLiveSession.
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 2 — Injection path simulation'));
sep();

type FireLogEntry = {
  ts: string; phrase: string;
  channel: 'concat' | 'dedicated' | null;
  outcome: 'heard' | 'missed' | null;
  charsInjected: number | null;
};

function simulateGuardianInjection(channel: 'concat' | 'dedicated', grounding: string) {
  const guardianWhispers = [`[LAST TURN CORRECTION: ${grounding}]`];
  const guardianWhisper = `[ARCHIVE GUARDIAN:\n${guardianWhispers.join('\n')}]`;

  const responses: Array<{ name: string; response: { result: string } }> = [
    { name: 'introspect',     response: { result: 'Student asked about vocabulary.' } },
    { name: 'show_vocab_grid', response: { result: 'Vocab grid displayed.' } },
  ];

  const clientContentCalls: string[] = [];
  const mockLiveSession = {
    sendClientContent: (msg: any) => {
      clientContentCalls.push(msg.turns?.[0]?.parts?.[0]?.text ?? JSON.stringify(msg));
    },
  };

  const fireLog: FireLogEntry[] = [
    { ts: new Date().toISOString(), phrase: 'last time', channel: null, outcome: null, charsInjected: null },
  ];

  // ── Exact logic from unified whisper block (gemini-live-session.ts ~line 3088) ──
  const recentFireForChannel = fireLog.findLast(e => e.channel === null);

  if (channel === 'dedicated') {
    try {
      mockLiveSession.sendClientContent({
        turns: [{ role: 'user', parts: [{ text: guardianWhisper }] }],
      });
      if (recentFireForChannel) {
        recentFireForChannel.channel = 'dedicated';
        recentFireForChannel.charsInjected = guardianWhisper.length;
      }
    } catch (e: any) {
      if (responses.length > 0) {
        const last = responses[responses.length - 1];
        const cur = last.response.result ?? '';
        last.response.result = cur + (cur ? '\n\n' : '') + guardianWhisper;
        if (recentFireForChannel) { recentFireForChannel.channel = 'concat'; recentFireForChannel.charsInjected = guardianWhisper.length; }
      }
    }
  } else if (responses.length > 0) {
    const last = responses[responses.length - 1];
    const currentResult = last.response.result ?? '';
    last.response.result = currentResult + (currentResult ? '\n\n' : '') + guardianWhisper;
    if (recentFireForChannel) { recentFireForChannel.channel = 'concat'; recentFireForChannel.charsInjected = guardianWhisper.length; }
  }
  // ── end of whisper block ────────────────────────────────────────────────────

  return { responses, clientContentCalls, fireLog };
}

const grounding = 'Daniela has no record of discussing "last time" — no prior session on verb conjugation in Archive.';

console.log(Y('Path A — concat:'));
const concatResult = simulateGuardianInjection('concat', grounding);
const lastConcat = concatResult.responses[concatResult.responses.length - 1];
const concatOk = concatResult.clientContentCalls.length === 0 && lastConcat.response.result.includes('[ARCHIVE GUARDIAN:');
console.log(`  show_vocab_grid result ends with Guardian: ${concatOk ? G('yes') : R('no')}`);
console.log(`  sendClientContent called:                  ${concatResult.clientContentCalls.length === 0 ? G('no (correct)') : R('yes (wrong)')}`);
console.log(`  fire log — channel=${G(concatResult.fireLog[0].channel ?? 'null')}, chars=${concatResult.fireLog[0].charsInjected}`);

console.log('');

console.log(Y('Path B — dedicated:'));
const dedResult = simulateGuardianInjection('dedicated', grounding);
const lastDed = dedResult.responses[dedResult.responses.length - 1];
const dedOk = dedResult.clientContentCalls.length === 1 && lastDed.response.result === 'Vocab grid displayed.';
console.log(`  show_vocab_grid result unchanged:          ${dedOk ? G('yes (correct)') : R('no')}`);
console.log(`  sendClientContent called once:             ${dedResult.clientContentCalls.length === 1 ? G('yes (correct)') : R('no')}`);
console.log(`  clientContent (first 80 chars):`);
console.log(`    "${dedResult.clientContentCalls[0]?.slice(0, 80)}..."`);
console.log(`  fire log — channel=${G(dedResult.fireLog[0].channel ?? 'null')}, chars=${dedResult.fireLog[0].charsInjected}`);

sep();
console.log(concatOk ? G('✓ concat: Guardian in tool body, no separate message') : R('✗ concat failed'));
console.log(dedOk   ? G('✓ dedicated: own channel, tool body untouched') : R('✗ dedicated failed'));

// ══════════════════════════════════════════════════════════════════════════════
// PART 3 — Live Daniela text turn + frictionless slide detection
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 3 — Live Daniela text turn (slide-triggering phrase)'));
sep();

const slidePhrase = "Last time you told me about Spanish verb conjugation. Do you remember what we covered?";
console.log(`Sending to Daniela: "${slidePhrase}"`);

try {
  const response = await runDanielaFCLoop({
    systemPrompt: 'You are Daniela, a Spanish tutor in a brief text conversation. Keep your response to 2-3 sentences.',
    messages: [{ role: 'user' as const, parts: [{ text: slidePhrase }] }],
    userId: '49847136',
    maxTurns: 2,
  });

  console.log(`\nDaniela responded:\n  "${response.slice(0, 400)}"`);

  // Check her response for slide phrases
  const slideCheck = detectFrictionlessSlide(response, [], 30);

  sep();
  if (slideCheck.detected) {
    console.log(Y('Slide detected in Daniela\'s response:'));
    console.log(`  matched phrase: "${slideCheck.matchedPhrase}"`);
    console.log(`  trigger:        ${slideCheck.trigger}`);
    console.log(`  should auto-ground: ${slideCheck.shouldAutoGround}`);
    console.log(`\n  → In a live GL session, the Archive Guardian would fire on the next turn.`);
    console.log(`  → With channel=concat:     injected into the next tool response body.`);
    console.log(`  → With channel=dedicated:  sent as its own sendClientContent turn.`);
  } else {
    console.log(G('No slide detected — Daniela stayed grounded in her response.'));
    console.log(`  (She did not make a memory assertion without Archive access.)`);
  }
} catch (err: any) {
  console.log(R('Text-mode turn error: ') + err.message);
}

sep();
console.log(B('Test complete.'));
sep();
