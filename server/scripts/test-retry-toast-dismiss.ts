/**
 * test-retry-toast-dismiss.ts
 *
 * CI check for the GL retry toast dismiss chain.
 *
 * Failure mode being guarded:
 *   Student sees "Voice session disconnected" toast with a "Tap to reconnect"
 *   button. They tap it — the server reconnects and sends gl_reconnected — but
 *   the toast stays up because setGlDisconnectedForRetry(false) was removed
 *   from handleGlReconnected. The session is healthy but the student still
 *   sees a disconnection warning.
 *
 * Three-step chain verified:
 *
 *   Step 1 — GEMINI_LIVE_DISCONNECTED (non-recoverable) arms the flag:
 *             handleVoiceError → setGlDisconnectedForRetry(true)
 *             → toast appears.
 *
 *   Step 2 — Student taps "Tap to reconnect":
 *             retryGlSession → setGlDisconnectedForRetry(false)
 *             → toast dismisses immediately on tap (before reconnect completes).
 *
 *   Step 3 — GL reconnects successfully (gl_reconnected arrives):
 *             handleGlReconnected → setGlDisconnectedForRetry(false)
 *             → toast dismissed (covers the case where the flag was re-armed
 *                between tap and reconnect, or the tap path is bypassed).
 *
 *   Toast effect — useEffect reads glDisconnectedForRetry from state:
 *             false → else branch → glRetryToastRef.current?.dismiss()
 *
 * This is a deterministic static check: each needle corresponds to one link
 * in the chain. Remove any link and this script exits 1.
 *
 * --self-check mode:
 *   Temporarily patches handleGlReconnected to strip setGlDisconnectedForRetry(false),
 *   runs the same checks against the patched content, confirms the failure is
 *   detected, then restores the original file.
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const HOOK = 'client/src/hooks/useStreamingVoice.ts';
const CHAT = 'client/src/components/StreamingVoiceChat.tsx';

let failures = 0;

function check(
  label: string,
  needle: string | RegExp,
  content: string,
  file: string,
): void {
  const found =
    typeof needle === 'string' ? content.includes(needle) : needle.test(content);
  if (found) {
    console.log(`✓ ${label}`);
  } else {
    console.error(`✗ FAIL: ${label}\n    file: ${file}\n    missing: ${String(needle)}`);
    failures++;
  }
}

function runChecks(hookContent: string, chatContent: string): void {
  // ── Step 1: GEMINI_LIVE_DISCONNECTED arms the flag ───────────────────────
  check(
    "hook: handleVoiceError arms glDisconnectedForRetry on GEMINI_LIVE_DISCONNECTED",
    /GEMINI_LIVE_DISCONNECTED[\s\S]{0,300}?setGlDisconnectedForRetry\(true\)/,
    hookContent,
    HOOK,
  );
  check(
    "hook: handleVoiceError only arms for non-recoverable events",
    /GEMINI_LIVE_DISCONNECTED[\s\S]{0,300}?!event\.recoverable[\s\S]{0,300}?setGlDisconnectedForRetry\(true\)/,
    hookContent,
    HOOK,
  );

  // ── Step 2: Student tap resets the flag (retryGlSession) ─────────────────
  check(
    "hook: retryGlSession calls setGlDisconnectedForRetry(false) on student tap",
    /retryGlSession = useCallback[\s\S]{0,400}?setGlDisconnectedForRetry\(false\)/,
    hookContent,
    HOOK,
  );
  check(
    "hook: retryGlSession calls clientRef.current?.retryGlSession() to start reconnect",
    /retryGlSession = useCallback[\s\S]{0,400}?clientRef\.current\?\.retryGlSession\(\)/,
    hookContent,
    HOOK,
  );

  // ── Step 3: gl_reconnected also resets the flag ──────────────────────────
  check(
    "hook: handleGlReconnected calls setGlDisconnectedForRetry(false) on reconnect success",
    /handleGlReconnected = useCallback[\s\S]{0,800}?setGlDisconnectedForRetry\(false\)/,
    hookContent,
    HOOK,
  );

  // ── Toast effect: reads glDisconnectedForRetry from state ────────────────
  check(
    "component: toast effect depends on glDisconnectedForRetry state",
    /streamingVoice\.state\.glDisconnectedForRetry[\s\S]{0,2000}?glRetryToastRef\.current\?\.dismiss\(\)/,
    chatContent,
    CHAT,
  );
  check(
    "component: else branch dismisses toast when glDisconnectedForRetry is false",
    /\} else \{[\s\S]{0,300}?glRetryToastRef\.current[\s\S]{0,50}?\.dismiss\(\)/,
    chatContent,
    CHAT,
  );
  check(
    "component: glRetryToastRef nulled after dismiss (prevents double-dismiss)",
    /glRetryToastRef\.current\?\.dismiss\(\)[\s\S]{0,100}?glRetryToastRef\.current = null/,
    chatContent,
    CHAT,
  );
  check(
    "component: useEffect dependency includes glDisconnectedForRetry",
    /streamingVoice\.state\.glDisconnectedForRetry[\s\S]{0,200}?streamingVoice\.retryGlSession/,
    chatContent,
    CHAT,
  );
  check(
    "component: toast action button calls retryGlSession()",
    /glRetryToastRef\.current\?\.dismiss\(\)[\s\S]{0,300}?streamingVoice\.retryGlSession\(\)/,
    chatContent,
    CHAT,
  );
}

// ── Main run ────────────────────────────────────────────────────────────────
console.log('── GL retry toast dismiss chain ─────────────────────────────────');

const hookContent = readFileSync(resolve(process.cwd(), HOOK), 'utf8');
const chatContent = readFileSync(resolve(process.cwd(), CHAT), 'utf8');

runChecks(hookContent, chatContent);

// ── Self-check mode ──────────────────────────────────────────────────────────
if (process.argv.includes('--self-check')) {
  console.log('\n── Self-check: simulating missing setGlDisconnectedForRetry(false) in handleGlReconnected ──');

  // Patch: remove setGlDisconnectedForRetry(false) only inside handleGlReconnected.
  // We isolate the callback body between `handleGlReconnected = useCallback` and
  // its closing `}, [` so we don't accidentally strip the retryGlSession call.
  const PATCH_TARGET = /(\bhandleGlReconnected = useCallback\b[\s\S]{0,1500}?)setGlDisconnectedForRetry\(false\)([\s\S]{0,1200}?\}, \[)/;

  if (!PATCH_TARGET.test(hookContent)) {
    console.error('✗ SELF-CHECK SETUP FAILED: could not locate setGlDisconnectedForRetry(false) inside handleGlReconnected to patch it');
    process.exit(1);
  }

  // NOTE: the placeholder must NOT contain the needle text or the regex will
  // find it in the comment and the self-check will silently pass.
  const patchedHook = hookContent.replace(
    PATCH_TARGET,
    (_match, before, after) =>
      `${before}/* SELFCHECK_REMOVED_RETRY_RESET */${after}`,
  );

  // Temporarily write the patched file.
  writeFileSync(resolve(process.cwd(), HOOK), patchedHook, 'utf8');

  const selfCheckFailuresBefore = failures;
  let selfCheckFailures = 0;

  try {
    // Run checks against the patched content (in-memory, not re-read from disk).
    const savedFailures = failures;
    failures = 0;
    runChecks(patchedHook, chatContent);
    selfCheckFailures = failures;
    failures = savedFailures; // restore real failure count
  } finally {
    // Always restore the original file.
    writeFileSync(resolve(process.cwd(), HOOK), hookContent, 'utf8');
    console.log('  (original file restored)');
  }

  if (selfCheckFailures === 0) {
    console.error(
      '✗ SELF-CHECK BROKEN: removing setGlDisconnectedForRetry(false) from handleGlReconnected did not register a failure — the guard is not being tested',
    );
    process.exit(1);
  }

  console.log(
    `✓ self-check: detector correctly caught ${selfCheckFailures} failure(s) when setGlDisconnectedForRetry(false) is removed from handleGlReconnected`,
  );

  void selfCheckFailuresBefore; // suppress unused-var warning
}

console.log('─────────────────────────────────────────────────────────────────');
if (failures > 0) {
  console.error(
    `FAILED: ${failures} check(s) failed — GL retry toast dismiss chain is broken`,
  );
  process.exit(1);
}
console.log('PASS: GL retry toast dismiss chain intact — toast clears on gl_reconnected');
