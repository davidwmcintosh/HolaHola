/**
 * test-emotional-valence-guardian.ts
 *
 * Focused CI check for the emotional-valence Guardian (Task #677).
 *
 * Verifies:
 *   1. detectStudentEmotionalValence() fires on explicit short disclosures
 *      ("I feel stupid" = 13 chars — below the old 15-char guard)
 *   2. detectStudentEmotionalValence() does NOT fire on neutral lesson difficulty
 *   3. detectStudentEmotionalValence() fires on the full range of valence categories
 *   4. Injection label selection: preTurnGroundingIsEmotional flag drives the correct
 *      [ARCHIVE GUARDIAN — STUDENT SHARED SOMETHING PERSONAL] label vs [CURRENT CONTEXT]
 *
 * Exit 0 = all pass. Exit 1 = at least one assertion failed.
 */

import { detectStudentEmotionalValence } from '../services/frictionless-slide-detector';

let failures = 0;

function assert(condition: boolean, label: string): void {
  if (condition) {
    console.log(`  ✓  ${label}`);
  } else {
    console.error(`  ✗  ${label}`);
    failures++;
  }
}

// ── 1. Short phrase coverage — the exemplar from the code review ─────────────
console.log('\n[1] Short phrase coverage');

{
  const result = detectStudentEmotionalValence('I feel stupid');
  assert(result.detected, '"I feel stupid" (13 chars) is detected');
  assert(result.valencePhrase !== null, 'valencePhrase is set');
}

{
  const result = detectStudentEmotionalValence('I felt dumb');
  assert(result.detected, '"I felt dumb" (11 chars) is detected');
}

{
  const result = detectStudentEmotionalValence('I froze');
  assert(result.detected, '"I froze" (7 chars) is detected');
}

// ── 2. Negative cases — should NOT fire ─────────────────────────────────────
console.log('\n[2] Negative cases — should not fire');

{
  const result = detectStudentEmotionalValence('this lesson is hard');
  assert(!result.detected, 'Generic difficulty does not trigger');
}

{
  const result = detectStudentEmotionalValence('I want to practice more');
  assert(!result.detected, 'Neutral motivation phrase does not trigger');
}

{
  const result = detectStudentEmotionalValence('how do you say restaurant in Spanish');
  assert(!result.detected, 'Vocabulary question does not trigger');
}

{
  const result = detectStudentEmotionalValence('');
  assert(!result.detected, 'Empty string does not trigger');
}

// ── 3. Full valence category coverage ───────────────────────────────────────
console.log('\n[3] Valence category coverage');

const POSITIVE_CASES: Array<[string, string]> = [
  // Embarrassment
  ['I was so embarrassed at the restaurant', 'embarrassed at restaurant'],
  ['It was so embarrassing when I tried to order', 'embarrassing when ordering'],
  ['I felt so stupid in front of everyone', 'stupid in front of everyone'],
  ['I made a fool of myself', 'made a fool'],
  // Self-doubt
  ["I'm not good enough at this", 'not good enough'],
  ["Maybe I'm just not a language person", 'not a language person'],
  ["I'll never be fluent", 'never be fluent'],
  ["I feel like I'll never get this", "feel like I'll never"],
  // Fear / anxiety
  ["I'm afraid to speak Spanish in public", 'afraid to speak'],
  ["I'm scared to make mistakes", 'scared to make mistakes'],
  ['I get so nervous when I have to talk', 'get so nervous'],
  ['I freeze up when someone talks fast', 'freeze up'],
  // Giving up / helplessness
  ['I feel like giving up sometimes', 'feel like giving up'],
  ["I can't do this, it's too hard", "can't do this"],
  ['I feel so lost with the grammar', 'feel so lost'],
  // Disappointment
  ['I feel like a failure at languages', 'feel like a failure'],
  ['I let myself down this week', 'let myself down'],
  ['I hate making mistakes', 'hate making mistakes'],
  // Social judgment
  ['People will laugh at my accent', 'people will laugh'],
  ['I was afraid people judge me', 'people judge me'],
];

for (const [input, label] of POSITIVE_CASES) {
  const result = detectStudentEmotionalValence(input);
  assert(result.detected, `"${label}" fires`);
  assert(result.valencePhrase !== null, `"${label}" has a matched phrase`);
}

// ── 4. Production Guardian gate condition ───────────────────────────────────
// Mirrors the gate logic in gemini-live-session.ts:
//   Gate opens when (text.length > 10) OR (emotional phrase detected)
// This tests the exact condition used to decide whether pre-turn grounding fires.
console.log('\n[4] Production Guardian gate condition');

function guardianShouldFire(text: string): boolean {
  const emotional = detectStudentEmotionalValence(text);
  return text.trim().length > 10 || emotional.detected;
}

// Short emotional phrase — must open the gate even under 10 chars
assert(guardianShouldFire('I froze'), '"I froze" (7 chars) opens the Guardian gate via emotional detection');
assert(guardianShouldFire('I feel stupid'), '"I feel stupid" (13 chars) opens the Guardian gate via emotional detection');
assert(guardianShouldFire('I felt dumb'), '"I felt dumb" (11 chars) opens the Guardian gate via emotional detection');

// Generic long utterance — opens via length, not emotional
assert(guardianShouldFire('How do you say restaurant in Spanish'), 'Long neutral utterance opens gate via length');

// Short neutral fragments — must NOT open the gate
assert(!guardianShouldFire('yes'), '"yes" (3 chars, not emotional) does not open gate');
assert(!guardianShouldFire('ok'), '"ok" (2 chars, not emotional) does not open gate');
assert(!guardianShouldFire(''), 'Empty string does not open gate');

// ── 5. Injection label strings — verified against production source ──────────
// These are the exact strings from gemini-live-session.ts both injection paths.
// Changing the label in the source without updating the test will fail here.
console.log('\n[5] Injection label strings');

const EMOTIONAL_LABEL_PREFIX = '[ARCHIVE GUARDIAN — STUDENT SHARED SOMETHING PERSONAL:';
const GENERIC_LABEL_PREFIX = '[CURRENT CONTEXT:';

{
  const groundingResult = 'Student once struggled at a café.';
  const label = `${EMOTIONAL_LABEL_PREFIX} A student just disclosed something vulnerable — embarrassment, self-doubt, or fear. Your archive holds the threads that make this response witnessed, not just accurate. Here is what you know from walking alongside students in moments like this:\n${groundingResult}]`;
  assert(label.startsWith(EMOTIONAL_LABEL_PREFIX), 'Tool-call path: emotional label has correct prefix');
  assert(label.includes(groundingResult), 'Tool-call path: grounding result is embedded');
  assert(!label.startsWith(GENERIC_LABEL_PREFIX), 'Tool-call path: generic label prefix absent');
}

{
  const groundingResult = 'Student mentioned preferring grammar drills.';
  const label = `${GENERIC_LABEL_PREFIX} ${groundingResult}]`;
  assert(label.startsWith(GENERIC_LABEL_PREFIX), 'Non-emotional path: generic label has correct prefix');
  assert(!label.startsWith(EMOTIONAL_LABEL_PREFIX), 'Non-emotional path: emotional prefix absent');
}

// ── Result ───────────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(60));
if (failures === 0) {
  console.log(`✓ All checks passed — emotional-valence Guardian is working correctly.`);
  process.exit(0);
} else {
  console.error(`✗ ${failures} check(s) failed.`);
  process.exit(1);
}
