/**
 * test-e164-validation.ts
 *
 * Confirms that upsertContactPreferences() rejects a phone number that is
 * missing a country-code prefix and accepts a properly formatted E.164 number.
 *
 * This guards against regressions where the normalizeE164() guard is accidentally
 * bypassed (e.g. a dynamic-import failure or a catch silently swallowing the error).
 *
 * Run: npx tsx server/scripts/test-e164-validation.ts
 */

import { storage } from '../storage';
import { normalizeE164 } from '../services/voice-message-delivery';

// ── Colours ─────────────────────────────────────────────────────────────────
const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const B = (s: string) => `\x1b[34m${s}\x1b[0m`;

const pass = (msg: string) => console.log(`  ${G('✓')} ${msg}`);
const fail = (msg: string) => { console.log(`  ${R('✗')} ${msg}`); failures++; };

let failures = 0;

// ── Case 1: normalizeE164 rejects a bare 10-digit number ───────────────────
async function testNormalizeRejectsBadPhone(): Promise<void> {
  const bad = '5551234567';
  try {
    normalizeE164(bad);
    fail(`normalizeE164("${bad}") should have thrown but did not`);
  } catch (err: any) {
    const msg: string = err.message ?? '';
    if (msg.toLowerCase().includes('e.164')) {
      pass(`normalizeE164("${bad}") threw with E.164 message: "${msg.substring(0, 100)}"`);
    } else {
      fail(`normalizeE164("${bad}") threw, but message does not mention E.164: "${msg.substring(0, 100)}"`);
    }
  }
}

// ── Case 2: normalizeE164 accepts a well-formed E.164 number ───────────────
async function testNormalizeAcceptsGoodPhone(): Promise<void> {
  const good = '+15551234567';
  try {
    const result = normalizeE164(good);
    if (result === good) {
      pass(`normalizeE164("${good}") returned "${result}" (no throw)`);
    } else {
      fail(`normalizeE164("${good}") returned unexpected value: "${result}"`);
    }
  } catch (err: any) {
    fail(`normalizeE164("${good}") threw unexpectedly: ${err.message}`);
  }
}

// ── Case 3: upsertContactPreferences propagates the E.164 error ───────────
// The guard fires inside upsertContactPreferences before any DB write, so
// a non-existent userId is fine here — the function throws on phone validation.
async function testUpsertRejectsBadPhone(): Promise<void> {
  const fakeUserId = 'ci-test-nonexistent-user';
  const bad = '5551234567';
  try {
    await storage.upsertContactPreferences(fakeUserId, { phone: bad });
    fail(`upsertContactPreferences with phone="${bad}" should have thrown but did not`);
  } catch (err: any) {
    const msg: string = err.message ?? '';
    if (msg.toLowerCase().includes('e.164')) {
      pass(`upsertContactPreferences("${bad}") threw with E.164 message`);
    } else {
      // Any other error (e.g. DB FK violation) means the guard did NOT fire —
      // the phone made it past validation and hit the DB.
      fail(
        `upsertContactPreferences("${bad}") threw, but NOT an E.164 error ` +
        `(guard may have been bypassed). Error: "${msg.substring(0, 150)}"`,
      );
    }
  }
}

// ── Case 4: upsertContactPreferences does NOT throw an E.164 error for a
//    well-formed number (it may still fail on FK / DB, but not on validation).
async function testUpsertAllowsGoodPhone(): Promise<void> {
  const fakeUserId = 'ci-test-nonexistent-user';
  const good = '+15551234567';
  try {
    await storage.upsertContactPreferences(fakeUserId, { phone: good });
    // If it somehow succeeds (e.g. the user exists), that's also fine.
    pass(`upsertContactPreferences("${good}") completed without throwing`);
  } catch (err: any) {
    const msg: string = err.message ?? '';
    if (msg.toLowerCase().includes('e.164')) {
      fail(`upsertContactPreferences("${good}") incorrectly rejected a valid E.164 number: "${msg.substring(0, 150)}"`);
    } else {
      // Non-E.164 error (e.g. FK violation for the fake user) is expected and acceptable;
      // it proves validation passed and the call reached the DB layer.
      pass(
        `upsertContactPreferences("${good}") passed E.164 validation ` +
        `(threw at DB layer as expected for a non-existent user: "${msg.substring(0, 80)}")`,
      );
    }
  }
}

// ── Case 5: Full round-trip — encrypt → store → decrypt → normalizeE164 ───
// Uses the first real user in the DB so the FK constraint is satisfied.
// Saves and restores the user's original contact preferences afterwards.
async function testRoundTrip(): Promise<void> {
  const { getUserDb } = await import('../db');
  const { users } = await import('@shared/schema');
  const { asc } = await import('drizzle-orm');

  // Find a real user to work with.
  const [firstUser] = await getUserDb().select({ id: users.id }).from(users).orderBy(asc(users.createdAt)).limit(1);
  if (!firstUser) {
    fail('Round-trip test skipped — no users found in the database');
    return;
  }
  const testUserId = firstUser.id;

  // Snapshot the current contact preferences so we can restore them.
  const original = await storage.getContactPreferences(testUserId);

  const TEST_PHONE = '+15550199000';

  try {
    // 1. Upsert the test phone number.
    const upserted = await storage.upsertContactPreferences(testUserId, { phone: TEST_PHONE });
    if (upserted.phone !== TEST_PHONE) {
      fail(`upsert returned phone="${upserted.phone}" but expected "${TEST_PHONE}" (decrypt may be broken)`);
    } else {
      pass(`upsert returned decrypted phone="${upserted.phone}" (matches original)`);
    }

    // 2. Read it back via getContactPreferences().
    const readBack = await storage.getContactPreferences(testUserId);
    if (!readBack?.phone) {
      fail(`getContactPreferences() returned no phone — decryption failed or row missing`);
      return;
    }
    if (readBack.phone !== TEST_PHONE) {
      fail(`getContactPreferences() returned phone="${readBack.phone}" but expected "${TEST_PHONE}"`);
    } else {
      pass(`getContactPreferences() returned "${readBack.phone}" — exact match with original`);
    }

    // 3. normalizeE164() must not throw on the decrypted value.
    try {
      const normalized = normalizeE164(readBack.phone);
      if (normalized === TEST_PHONE) {
        pass(`normalizeE164("${readBack.phone}") succeeded and returned "${normalized}"`);
      } else {
        fail(`normalizeE164 returned "${normalized}" instead of "${TEST_PHONE}"`);
      }
    } catch (err: any) {
      fail(`normalizeE164 threw on the decrypted phone "${readBack.phone}": ${err.message}`);
    }
  } finally {
    // Restore original preferences so the test is non-destructive.
    try {
      await storage.upsertContactPreferences(testUserId, {
        phone: original?.phone ?? null,
        phoneConsentSms: original?.phoneConsentSms ?? false,
        phoneConsentVoice: original?.phoneConsentVoice ?? false,
        phoneConsentAt: original?.phoneConsentAt ?? undefined,
        phoneConsentSource: original?.phoneConsentSource ?? undefined,
      });
    } catch {
      // Best-effort cleanup; don't mask test failures.
    }
  }
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log(B('\n═══ E.164 Phone Validation — CI Check ═══\n'));

  console.log(B('Case 1: normalizeE164 rejects a bare 10-digit number (no country code)'));
  await testNormalizeRejectsBadPhone();

  console.log(B('\nCase 2: normalizeE164 accepts a valid +1 E.164 number'));
  await testNormalizeAcceptsGoodPhone();

  console.log(B('\nCase 3: upsertContactPreferences propagates the E.164 error'));
  await testUpsertRejectsBadPhone();

  console.log(B('\nCase 4: upsertContactPreferences allows a valid E.164 number past validation'));
  await testUpsertAllowsGoodPhone();

  console.log(B('\nCase 5: Full round-trip — upsert E.164 phone → read back → normalizeE164 still passes'));
  await testRoundTrip();

  console.log(B('\n═══ Summary ═══'));
  if (failures === 0) {
    console.log(G('ALL CHECKS PASSED\n'));
    process.exit(0);
  } else {
    console.log(R(`${failures} FAILURE(S) — see above\n`));
    process.exit(1);
  }
}

main().catch(err => {
  console.error(R('\nUnhandled error:'), err);
  process.exit(1);
});
