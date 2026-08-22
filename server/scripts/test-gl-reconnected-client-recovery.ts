/**
 * test-gl-reconnected-client-recovery.ts
 *
 * CI check for the GL 1008 recovery path (Gemini drops its server-side WS,
 * server auto-reconnects, client must trust the reconnected session).
 *
 * Failure mode being guarded: Gemini Live closes with code 1008 mid-session.
 * The server reconnects within ~1.5s and sends `gl_reconnected`, but if the
 * client has no consumer for that message the student is left with a
 * "connection failed" popup, a mic gated on the stale 'thinking'/processing
 * state, and no way to continue without a page reload.
 *
 * This is a deterministic static check (same style as the other needle-check
 * CI scripts): each needle below corresponds to one link in the recovery
 * chain. If any link is removed or renamed, this script exits 1.
 *
 * Chain verified:
 *   1. Server: 1008 is retriable → gl_reconnecting sent → on success
 *      gl_reconnected sent to the client.
 *   2. Client lib: gl_reconnecting → state 'reconnecting' (drives the
 *      transient "Reconnecting…" toast); gl_reconnected → state 'ready'
 *      (clears the toast) + emits 'glReconnected'.
 *   3. Hook: registers a 'glReconnected' listener that clears the error,
 *      the processing flag, and the 'thinking' playback state (mic gate).
 *   4. Component: both onGlReconnected registrations clear the RENDERED
 *      processing state via setIsProcessing(false) — not just the ref —
 *      because the isUsersTurn condition reads the state, and restore
 *      open-mic readiness.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

let failures = 0;

function check(file: string, needle: string | RegExp, label: string): void {
  const content = readFileSync(resolve(process.cwd(), file), 'utf8');
  const found = typeof needle === 'string' ? content.includes(needle) : needle.test(content);
  if (found) {
    console.log(`✓ ${label}`);
  } else {
    console.error(`✗ FAIL: ${label}\n    file: ${file}\n    missing: ${needle}`);
    failures++;
  }
}

function countOccurrences(file: string, needle: string, min: number, label: string): void {
  const content = readFileSync(resolve(process.cwd(), file), 'utf8');
  const count = content.split(needle).length - 1;
  if (count >= min) {
    console.log(`✓ ${label} (found ${count}, need ≥${min})`);
  } else {
    console.error(`✗ FAIL: ${label} — found ${count}, need ≥${min}\n    file: ${file}`);
    failures++;
  }
}

console.log('── GL 1008 recovery chain ──────────────────────────────────────');

// 1. Server side
const GLS = 'server/services/gemini-live-session.ts';
check(GLS, /RETRIABLE_CLOSE_CODES = new Set\(\[[\s\S]{0,400}?\b1008\b/, 'server: 1008 is in RETRIABLE_CLOSE_CODES');
check(GLS, "type: 'gl_reconnecting',", 'server: sends gl_reconnecting when scheduling a reconnect');
countOccurrences(GLS, "{ type: 'gl_reconnected' }", 2, 'server: sends gl_reconnected on successful reconnect (retriable + proactive paths)');
check(GLS, 'private retryFailedReconnectStart(reconnectPrompt: string): void', 'server: failed GL starts have an explicit bounded retry continuation');
check(
  GLS,
  /Reconnect attempt \$\{this\.reconnectAttempts\} failed:[\s\S]{0,500}?this\.retryFailedReconnectStart\(reconnectPrompt\)/,
  'server: failed GL start advances the retry chain instead of waiting for a nonexistent onclose',
);
check(
  GLS,
  /Reconnect attempts exhausted after failed start\(\)[\s\S]{0,500}?recoverable: false/,
  'server: exhausted failed-start retries surface one terminal state',
);
check(
  GLS,
  /stop\(\): void \{[\s\S]{0,350}?clearTimeout\(this\.reconnectTimer\)/,
  'server: intentional stop cancels a scheduled failed-start retry',
);

// 2. Client library
const SVC = 'client/src/lib/streamingVoiceClient.ts';
check(SVC, "case 'gl_reconnecting':", 'client lib: handles gl_reconnecting');
check(SVC, /case 'gl_reconnecting':[\s\S]{0,300}?setState\('reconnecting'\)/, "client lib: gl_reconnecting → state 'reconnecting' (drives reconnecting indicator)");
check(SVC, /case 'gl_reconnected':[\s\S]{0,300}?setState\('ready'\)/, "client lib: gl_reconnected → state 'ready' (clears reconnecting indicator)");
check(SVC, /case 'gl_reconnected':[\s\S]{0,300}?this\.emit\('glReconnected'/, "client lib: gl_reconnected emits 'glReconnected' event");

// 3. Hook
const HOOK = 'client/src/hooks/useStreamingVoice.ts';
check(HOOK, "on('glReconnected', handleGlReconnected)", "hook: registers 'glReconnected' listener");
check(HOOK, "off('glReconnected', handleGlReconnected)", "hook: unregisters 'glReconnected' listener on cleanup");
check(HOOK, /handleGlReconnected = useCallback[\s\S]{0,600}?setError\(null\)/, 'hook: gl_reconnected clears error (removes connection-failed popup)');
check(HOOK, /handleGlReconnected = useCallback[\s\S]{0,600}?setIsProcessingRef\.current\(false\)/, 'hook: gl_reconnected clears hook processing state');
check(HOOK, /handleGlReconnected = useCallback[\s\S]{0,1200}?setGlobalPlaybackState\('idle'\)/, "hook: gl_reconnected clears 'thinking' playback state (lifts mic gate)");
// ECHO GUARD: a 1008 drop can arrive after the server sealed the subturn
// (hadAudioInCurrentSubturn already false → no gl_audio_reset sent) while the
// client still has pre-drop audio scheduled in the AudioContext. The handler
// must stop the player BEFORE forcing playback idle, or the mic opens over
// still-playing Daniela audio and her own voice echoes back as student input.
{
  const hookContent = readFileSync(resolve(process.cwd(), HOOK), 'utf8');
  const m = hookContent.match(/handleGlReconnected = useCallback[\s\S]{0,1500}?\}, \[/);
  const body = m ? m[0] : '';
  const stopIdx = body.indexOf('playerRef.current?.stop');
  const resetIdx = body.indexOf('resetForNewTurn');
  const subsIdx = body.indexOf('subtitles.stopPlayback');
  const idleIdx = body.indexOf("setGlobalPlaybackState('idle')");
  if (stopIdx !== -1 && resetIdx !== -1 && subsIdx !== -1 && idleIdx !== -1 && stopIdx < idleIdx) {
    console.log('✓ hook: gl_reconnected stops player + resets dedup + stops subtitles BEFORE forcing idle (echo guard for reconnect-after-seal with playback still active)');
  } else {
    console.error(`✗ FAIL: hook: gl_reconnected must call playerRef.stop() (idx ${stopIdx}), resetForNewTurn (idx ${resetIdx}), subtitles.stopPlayback (idx ${subsIdx}) before setGlobalPlaybackState('idle') (idx ${idleIdx})`);
    failures++;
  }
}
check(HOOK, /handleGlReconnecting = useCallback[\s\S]{0,600}?setError\(null\)/, 'hook: gl_reconnecting clears stale error so reconnecting indicator replaces popup');
check(HOOK, 'onGlReconnected?: () => void', 'hook: session config exposes onGlReconnected callback');

// 4. Component — the rendered processing state must be cleared via setIsProcessing(false),
//    not just isProcessingRef, because isUsersTurn reads the state. Both session-config
//    registrations (primary + reconnect context) must do it.
const CHAT = 'client/src/components/StreamingVoiceChat.tsx';
const chatContent = readFileSync(resolve(process.cwd(), CHAT), 'utf8');
const glBlocks = chatContent.split('onGlReconnected:').slice(1);
if (glBlocks.length < 2) {
  console.error(`✗ FAIL: component: expected 2 onGlReconnected registrations, found ${glBlocks.length}`);
  failures++;
} else {
  console.log(`✓ component: ${glBlocks.length} onGlReconnected registrations present`);
  glBlocks.forEach((block, i) => {
    const head = block.slice(0, 1500); // the callback body (comments included)
    const wants: Array<[string, string]> = [
      ['setError(null)', 'clears error popup'],
      ['setIsProcessing(false)', 'clears RENDERED processing state (unlocks isUsersTurn)'],
      ['isProcessingRef.current = false', 'clears processing ref'],
      ["setOpenMicState('idle')", 'restores open-mic readiness'],
      ["setAvatarState('idle')", 'resets avatar'],
    ];
    for (const [needle, why] of wants) {
      if (head.includes(needle)) {
        console.log(`✓ component: onGlReconnected #${i + 1} ${why}`);
      } else {
        console.error(`✗ FAIL: component: onGlReconnected #${i + 1} missing ${needle} (${why})`);
        failures++;
      }
    }
  });
}

// Self-check mode: verify this script FAILS when a critical needle is absent.
if (process.argv.includes('--self-check')) {
  const bogus = 'THIS_NEEDLE_DOES_NOT_EXIST_ANYWHERE_12345';
  const before = failures;
  check(HOOK, bogus, 'self-check: bogus needle must fail');
  if (failures === before) {
    console.error('✗ SELF-CHECK BROKEN: bogus needle did not register a failure');
    process.exit(1);
  }
  console.log('✓ self-check: detector correctly fails on missing needle');
  failures = before; // the intentional failure doesn't count against the real run
}

console.log('────────────────────────────────────────────────────────────────');
if (failures > 0) {
  console.error(`FAILED: ${failures} check(s) failed — GL 1008 recovery chain is broken`);
  process.exit(1);
}
console.log('PASS: GL 1008 recovery chain intact — client resumes without reload');
