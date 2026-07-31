/**
 * test-twilio-broken-creds-negative-path.ts
 *
 * Negative-path validator for the voice-SMS pipeline CI check.
 *
 * WHAT THIS PROVES
 * ────────────────
 * The SMS delivery path throws — and therefore causes CI to fail — when
 * credentials are present but invalid (Twilio 401/403), rather than silently
 * skipping as it does when credentials are absent.
 *
 * A green-only run of the pipeline check cannot prove the guard has real bite:
 * if the credentials are simply missing it always exits 0.  This script
 * exercises both paths in the same process:
 *
 *   Step 1 — Negative path (broken creds):
 *     Call sendSmsWithCredentials() with non-empty fake credentials and a mock
 *     fetch that returns HTTP 401.  Assert the function throws "Twilio 401".
 *     If it does NOT throw, the guard has been removed / broken — CI would
 *     silently pass a revoked credential.
 *
 *   Step 2 — Absent-credentials path (expected skip):
 *     Call sendSmsWithCredentials() with all-empty credentials.  Assert it
 *     returns false without calling fetch.  This confirms the "no credentials"
 *     skip behaviour is intact and distinct from the "broken credentials" error.
 *
 *   Step 3 — 403 variant:
 *     Same as Step 1 but with HTTP 403 (forbidden, e.g. number not in trial
 *     allowlist).  The error message must surface the status code.
 *
 * Exits 0 when all assertions hold; exits 1 with a clear diagnostic otherwise.
 *
 * Run: npx tsx server/scripts/test-twilio-broken-creds-negative-path.ts
 */

import { sendSmsWithCredentials } from '../services/voice-message-delivery.js';

// ─── Colour helpers ───────────────────────────────────────────────────────────
const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const Y = (s: string) => `\x1b[33m${s}\x1b[0m`;
const B = (s: string) => `\x1b[34m${s}\x1b[0m`;
const sep = () => console.log('\n' + '─'.repeat(70));

let allPassed = true;

function reportPass(msg: string) { console.log(`  ${G('✓')} ${msg}`); }
function reportFail(msg: string) { console.log(`  ${R('✗')} ${msg}`); allPassed = false; }

// ─── Fake credentials (non-empty, will reach the fetch call) ─────────────────
const FAKE_CREDS = {
  accountSid: 'ACfake00000000000000000000000000',
  authToken:  'deadbeef0000000000000000000000',
  fromNumber: '+15550000001',
};

// ─── Mock fetch factories ─────────────────────────────────────────────────────

/** Returns a mock fetch that yields the given HTTP status (non-ok). */
function mockFetchStatus(status: number): typeof fetch {
  return async () =>
    ({
      ok: false,
      status,
      text: async () => `Mock Twilio error for status ${status}`,
      json: async () => ({}),
    }) as Response;
}

/** A fetch that must never be called (absent-creds path). */
const fetchMustNotBeCalled: typeof fetch = () => {
  throw new Error('fetch must not be called when credentials are absent');
};

// ═══════════════════════════════════════════════════════════════════════════════
// STEP 1 — Negative path: broken credentials (HTTP 401)
// ═══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('Step 1 — Negative path: non-empty credentials + Twilio HTTP 401'));
console.log(Y('  sendSmsWithCredentials() must THROW when credentials are set but rejected.'));
console.log(Y('  Expected: throws with message matching /Twilio 401/'));

try {
  await sendSmsWithCredentials(FAKE_CREDS, '+15559990000', 'Test body', mockFetchStatus(401));
  // If we reach here the function did NOT throw — the guard is broken.
  reportFail(
    'sendSmsWithCredentials() returned without throwing on HTTP 401. ' +
    'The CI guard is broken: a revoked credential would pass CI silently.',
  );
  console.log(Y('  Possible causes:'));
  console.log(Y('    • The "if (!response.ok)" branch in sendSmsWithCredentials was removed'));
  console.log(Y('    • The function now returns false instead of throwing on API errors'));
  console.log(Y('    • The mock fetch was bypassed (check sendSmsWithCredentials signature)'));
} catch (err: any) {
  const msg: string = err?.message ?? String(err);
  if (/Twilio 401/.test(msg)) {
    reportPass(`Correctly threw: "${msg}"`);
    console.log(G('  NEGATIVE PATH PASSED — guard fires on invalid credentials.'));
  } else {
    reportFail(
      `Threw, but the error message did not match /Twilio 401/. Got: "${msg}". ` +
      'The error message format may have changed; update the regex in this script ' +
      'AND in voice-sms-delivery.test.ts.',
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP 2 — Absent-credentials path: must return false, not throw
// ═══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('Step 2 — Absent-credentials path: empty credentials must return false'));
console.log(Y('  When ALL three credential fields are empty strings the function'));
console.log(Y('  must return false immediately (skip) without calling fetch.'));
console.log(Y('  Expected: returns false; fetch is never invoked.'));

try {
  const result = await sendSmsWithCredentials(
    { accountSid: '', authToken: '', fromNumber: '' },
    '+15559990000',
    'Test body',
    fetchMustNotBeCalled,
  );
  if (result === false) {
    reportPass('Returned false without calling fetch — absent-creds skip works.');
    console.log(G('  ABSENT-CREDS PATH PASSED.'));
  } else {
    reportFail(
      `Expected false for empty credentials but got: ${JSON.stringify(result)}. ` +
      'The early-exit guard on empty credentials may have been removed.',
    );
  }
} catch (err: any) {
  reportFail(
    `Threw unexpectedly on empty credentials: "${err?.message ?? err}". ` +
    'The empty-credentials early-exit branch is broken.',
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP 3 — Negative path: broken credentials (HTTP 403 variant)
// ═══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('Step 3 — Negative path: non-empty credentials + Twilio HTTP 403'));
console.log(Y('  A 403 (e.g. trial-account number allowlist) must also throw.'));
console.log(Y('  Expected: throws with message matching /Twilio 403/'));

try {
  await sendSmsWithCredentials(FAKE_CREDS, '+15559990000', 'Test body', mockFetchStatus(403));
  reportFail(
    'sendSmsWithCredentials() returned without throwing on HTTP 403. ' +
    'A forbidden-number error would pass the CI check silently.',
  );
} catch (err: any) {
  const msg: string = err?.message ?? String(err);
  if (/Twilio 403/.test(msg)) {
    reportPass(`Correctly threw: "${msg}"`);
    console.log(G('  403 VARIANT PASSED.'));
  } else {
    reportFail(
      `Threw, but message did not match /Twilio 403/. Got: "${msg}".`,
    );
  }
}

// ─── Summary ──────────────────────────────────────────────────────────────────
sep();
if (allPassed) {
  console.log(G('ALL CHECKS PASSED'));
  console.log(G('The voice-SMS pipeline CI guard has real bite:'));
  console.log(G('  • It throws (and therefore fails CI) when credentials are set but rejected.'));
  console.log(G('  • It returns false (skip) when credentials are completely absent.'));
  console.log(G('  • Both HTTP 401 and 403 are caught.'));
  console.log('');
} else {
  console.log(R('ONE OR MORE CHECKS FAILED — see ✗ lines above.'));
  process.exit(1);
}
