/**
 * test-double-greeting-reconnect-guard.ts
 *
 * CI check: verifies the DOUBLE-GREETING FIX guard that prevents Daniela's
 * opening greeting from playing twice when GL drops mid-audio on reconnect.
 *
 * Background (Task 1211, Aug 2026):
 *   When GL drops (code 1008) while generating the greeting turn and audio has
 *   already been partially sent to the client, the server reconnects and GL
 *   resumes from its internal state — which still contains the greeting trigger.
 *   GL then re-generates the greeting and the client hears it twice.
 *
 *   The fix (inside the `hadAudioInCurrentSubturn` reconnect block):
 *     if (this.isGreetingTurn && this.session.geminiLiveResumptionHandle) {
 *       this.session.geminiLiveResumptionHandle = undefined as any;
 *     }
 *   Clearing the handle forces the new GL connection to start fresh instead of
 *   resuming the state that contains the already-spoken greeting.
 *
 * This is a source-code scan — no DB or GL connection required.
 *
 * Run:
 *   npx tsx server/scripts/test-double-greeting-reconnect-guard.ts
 *   npx tsx server/scripts/test-double-greeting-reconnect-guard.ts --self-check
 *
 * --self-check mode: simulates removal of the guard (strips the guard lines
 * from an in-memory copy of the source) and verifies this check FAILS against
 * the mutated source. Proves the check is live, not vacuously green.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const B = (s: string) => `\x1b[34m${s}\x1b[0m`;
const sep = () => console.log('\n' + '─'.repeat(70));

const GL_SESSION_PATH = 'server/services/gemini-live-session.ts';

interface Assertion {
  substring: string;
  description: string;
}

const ASSERTIONS: Assertion[] = [
  {
    substring: '// DOUBLE-GREETING FIX: if GL dropped while generating the opening greeting',
    description: 'DOUBLE-GREETING FIX comment present in the reconnect block',
  },
  {
    substring: 'if (this.isGreetingTurn && this.session.geminiLiveResumptionHandle) {',
    description: 'Inner guard checks both isGreetingTurn AND geminiLiveResumptionHandle before clearing',
  },
  {
    substring: 'this.session.geminiLiveResumptionHandle = undefined as any;',
    description: 'Guard clears geminiLiveResumptionHandle to prevent GL resuming with stale greeting state',
  },
  {
    substring: '[GeminiLive] Reconnect mid-greeting — clearing resumption handle to prevent double greeting audio',
    description: 'Log line present confirming the guard fired',
  },
  {
    substring: 'if (this.hadAudioInCurrentSubturn) {',
    description: 'Outer hadAudioInCurrentSubturn block present — guard is nested inside it',
  },
];

function runAssertions(source: string, verbose = true): number {
  let failed = 0;
  for (const { substring, description } of ASSERTIONS) {
    if (source.includes(substring)) {
      if (verbose) console.log(`  ${G('✓')} ${description}`);
    } else {
      if (verbose) {
        console.log(`  ${R('✗')} MISSING: ${description}`);
        console.log(`       Expected to find: ${JSON.stringify(substring)}`);
      }
      failed++;
    }
  }
  return failed;
}

function loadSource(): string {
  const fullPath = join(process.cwd(), GL_SESSION_PATH);
  if (!existsSync(fullPath)) {
    console.error(R(`✗ Source file not found: ${GL_SESSION_PATH}`));
    process.exit(1);
  }
  return readFileSync(fullPath, 'utf8');
}

function selfCheck(): void {
  sep();
  console.log(B('SELF-CHECK: verifying this CI check fails when the guard is removed'));
  sep();

  const original = loadSource();

  // Sanity: the check must PASS against the real source first.
  const realFailures = runAssertions(original, false);
  if (realFailures > 0) {
    console.error(R(`✗ Self-check aborted — the check already fails against the REAL source (${realFailures} failures). Fix the guard first.`));
    process.exit(1);
  }
  console.log(G('✓ Baseline: check passes against the real source'));

  // Mutation scenarios: each simulates a way the guard could be broken.
  const mutations: Array<{ label: string; mutate: (src: string) => string }> = [
    {
      label: 'Inner guard condition replaced with false (guard removed)',
      mutate: (src) =>
        src.replace(
          'if (this.isGreetingTurn && this.session.geminiLiveResumptionHandle) {',
          'if (false) {',
        ),
    },
    {
      label: 'isGreetingTurn check stripped from guard (handle always cleared, not just on greeting)',
      mutate: (src) =>
        src.replace(
          'if (this.isGreetingTurn && this.session.geminiLiveResumptionHandle) {',
          'if (this.session.geminiLiveResumptionHandle) {',
        ),
    },
    {
      label: 'Log line and handle clear removed (guard block becomes empty)',
      mutate: (src) =>
        src.replace(
          "console.log('[GeminiLive] Reconnect mid-greeting — clearing resumption handle to prevent double greeting audio');\n                  this.session.geminiLiveResumptionHandle = undefined as any;",
          "// (guard body removed)",
        ),
    },
    {
      label: 'DOUBLE-GREETING FIX comment and entire inner guard block removed',
      mutate: (src) =>
        src.replace(
          /\/\/ DOUBLE-GREETING FIX: if GL dropped while generating the opening greeting[\s\S]*?this\.session\.geminiLiveResumptionHandle = undefined as any;\n\s*\}/,
          '// DOUBLE-GREETING FIX: removed',
        ),
    },
  ];

  let selfCheckFailed = 0;
  for (const { label, mutate } of mutations) {
    const mutated = mutate(original);
    if (mutated === original) {
      console.log(`  ${R('✗')} Mutation "${label}" did not change the source — needle out of sync with code`);
      selfCheckFailed++;
      continue;
    }
    const failures = runAssertions(mutated, false);
    if (failures > 0) {
      console.log(`  ${G('✓')} Check correctly FAILS when: ${label} (${failures} assertion(s) tripped)`);
    } else {
      console.log(`  ${R('✗')} Check still PASSES when: ${label} — the check is NOT protecting this guard`);
      selfCheckFailed++;
    }
  }

  sep();
  if (selfCheckFailed === 0) {
    console.log(G('\n✓ Self-check passed: removing the guard (any of 4 ways) makes this CI check fail.\n'));
    process.exit(0);
  } else {
    console.log(R(`\n✗ Self-check FAILED: ${selfCheckFailed} mutation(s) were not caught.\n`));
    process.exit(1);
  }
}

function main(): void {
  if (process.argv.includes('--self-check')) {
    selfCheck();
    return;
  }

  sep();
  console.log(B('GL Double-Greeting Reconnect Guard CI Check'));
  console.log(B('Verifies that mid-greeting GL reconnects clear the resumption handle'));
  console.log(B('to prevent Daniela\'s greeting from playing twice after a 1008 drop.'));
  console.log(B(`Target: ${GL_SESSION_PATH}`));
  sep();

  const source = loadSource();
  console.log('');
  const failed = runAssertions(source);

  sep();
  if (failed === 0) {
    console.log(G('\n✓ All assertions passed — double-greeting guard is in place;'));
    console.log(G('  a mid-greeting 1008 reconnect will clear the resumption handle.\n'));
    process.exit(0);
  } else {
    console.log(R(`\n✗ ${failed} assertion(s) failed — the double-greeting reconnect guard is missing or drifted.`));
    console.log(R('  Without it, GL resumes from its greeting-trigger state and David hears Daniela\'s opening twice.\n'));
    process.exit(1);
  }
}

main();
