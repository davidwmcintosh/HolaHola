import assert from 'node:assert/strict';
import { generateKeyPairSync, sign, verify } from 'node:crypto';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  runtimeEvidenceDate,
  runtimeEvidenceDigest,
  selectRuntimeReplayManifest,
} from '../services/coordination-v2-runtime-evidence-canonicalization';
import { canonicalJson } from '../services/coordination-policy-canonicalization';

function fixture(milliseconds = 191) {
  const issued = new Date('2030-01-02T03:04:05.000Z');
  issued.setUTCMilliseconds(milliseconds);
  return {
    issueId: 'synthetic-issue', hostKeyFingerprint: 'a'.repeat(64),
    runtimeReleaseDigest: 'b'.repeat(64),
    artifacts: [{ artifactId: 'synthetic-artifact', objectDigest: 'c'.repeat(64) }],
    sourceMembers: [{ fixedPath: 'synthetic/source.ts', sha256: 'd'.repeat(64) }],
    issuedAt: runtimeEvidenceDate(issued).toISOString(),
    expiresAt: runtimeEvidenceDate(new Date(issued.getTime() + 300_000)).toISOString(),
  };
}

function legacyFixture(milliseconds: number) {
  const manifest = fixture(milliseconds);
  // Independently reproduce the ORIGINAL creation path, not the new fallback.
  return {
    ...manifest,
    issuedAt: new Date(String(new Date(manifest.issuedAt))).toISOString(),
    expiresAt: new Date(String(new Date(manifest.expiresAt))).toISOString(),
  };
}

test('Date and equivalent database strings preserve fractional epoch milliseconds', () => {
  for (const ms of [0, 1, 191, 822, 834, 97, 699, 207, 602, 715, 999]) {
    const date = new Date(fixture(ms).issuedAt);
    const copied = runtimeEvidenceDate(date);
    assert.notEqual(copied, date);
    assert.equal(copied.getTime(), date.getTime());
    assert.equal(copied.getTime(), runtimeEvidenceDate(date.toISOString()).getTime());
    assert.equal(copied.getUTCMilliseconds(), ms);
  }
});

test('invalid inputs remain invalid so the service retains its fail-closed error contract', () => {
  assert.ok(Number.isNaN(runtimeEvidenceDate(new Date(NaN)).getTime()));
  assert.ok(Number.isNaN(runtimeEvidenceDate('not-a-date').getTime()));
});

for (const ms of [191, 822, 834, 97, 699, 207, 602, 715, 999]) {
  test(`historical .${String(ms).padStart(3, '0')} replay returns exact .000Z bytes and digest`, () => {
    const full = fixture(ms);
    const historical = legacyFixture(ms);
    const stored = runtimeEvidenceDigest(historical);
    const before = structuredClone(full);
    assert.notEqual(runtimeEvidenceDigest(full), stored);
    const replay = selectRuntimeReplayManifest(full, stored);
    assert.deepEqual(replay, historical);
    assert.equal(runtimeEvidenceDigest(replay), stored);
    assert.match(replay!.issuedAt, /\.000Z$/);
    assert.match(replay!.expiresAt, /\.000Z$/);
    assert.deepEqual(full, before, 'fallback must not mutate input evidence');
  });
}

test('full-precision replay prefers the exact payload; whole-second payload remains identical', () => {
  for (const ms of [0, 123, 999]) {
    const manifest = fixture(ms);
    assert.equal(selectRuntimeReplayManifest(manifest, runtimeEvidenceDigest(manifest)), manifest);
  }
});

test('a Z-only historical candidate is not equivalent to the signed .000Z representation', () => {
  const manifest = fixture();
  const legacy = legacyFixture(191);
  const wrong = { ...legacy, issuedAt: legacy.issuedAt.replace('.000Z', 'Z'), expiresAt: legacy.expiresAt.replace('.000Z', 'Z') };
  assert.equal(selectRuntimeReplayManifest(manifest, runtimeEvidenceDigest(wrong)), null);
});

test('every other evidence change fails closed for BOTH stored timestamp formats', () => {
  const original = fixture();
  const mutations = [
    { ...original, issueId: 'synthetic-other-issue' },
    { ...original, hostKeyFingerprint: 'e'.repeat(64) },
    { ...original, runtimeReleaseDigest: 'f'.repeat(64) },
    { ...original, artifacts: [{ artifactId: 'synthetic-artifact', objectDigest: 'e'.repeat(64) }] },
    { ...original, artifacts: [] },
    { ...original, sourceMembers: [{ fixedPath: 'synthetic/source.ts', sha256: 'e'.repeat(64) }] },
  ];
  for (const stored of [runtimeEvidenceDigest(original), runtimeEvidenceDigest(legacyFixture(191))]) {
    for (const mutation of mutations) assert.equal(selectRuntimeReplayManifest(mutation, stored), null);
  }
  assert.equal(selectRuntimeReplayManifest(original, '0'.repeat(64)), null);
  assert.equal(selectRuntimeReplayManifest({ ...original, issuedAt: 'invalid' }, '0'.repeat(64)), null);
});

test('historical replay preserves signature verification, not just a matching digest', () => {
  const keys = generateKeyPairSync('ed25519');
  const wrongKeys = generateKeyPairSync('ed25519');
  const historical = legacyFixture(191);
  const signature = sign(null, Buffer.from(canonicalJson(historical)), keys.privateKey);
  const replay = selectRuntimeReplayManifest(fixture(), runtimeEvidenceDigest(historical))!;
  assert.equal(verify(null, Buffer.from(canonicalJson(replay)), keys.publicKey, signature), true);
  assert.equal(verify(null, Buffer.from(canonicalJson(fixture())), keys.publicKey, signature), false);
  assert.equal(verify(null, Buffer.from(canonicalJson(replay)), wrongKeys.publicKey, signature), false);
  const modified = Buffer.from(signature);
  modified[0] ^= 1;
  assert.equal(verify(null, Buffer.from(canonicalJson(replay)), keys.publicKey, modified), false);
});

test('compatibility cannot renew expired evidence or extend its signed expiry', () => {
  const full = fixture(999);
  const replay = selectRuntimeReplayManifest(full, runtimeEvidenceDigest(legacyFixture(999)))!;
  const now = new Date(full.expiresAt).getTime() + 1;
  assert.ok(new Date(full.expiresAt).getTime() < now, 'database expiry remains authoritative');
  assert.ok(new Date(replay.expiresAt).getTime() < now, 'historical signature remains expired');
  assert.ok(new Date(replay.expiresAt).getTime() <= new Date(full.expiresAt).getTime());
});

test('actual helper mutations prove precision, both digest guards, fallback, and ISO spelling', async () => {
  const sourceUrl = new URL('../services/coordination-v2-runtime-evidence-canonicalization.ts', import.meta.url);
  const canonicalUrl = new URL('../services/coordination-policy-canonicalization.ts', import.meta.url);
  const source = readFileSync(sourceUrl, 'utf8').replace(
    "'./coordination-policy-canonicalization'", JSON.stringify(canonicalUrl.href),
  );
  const cases: Array<[string, string, string]> = [
    ['Date truncation',
      'value instanceof Date ? new Date(value.getTime()) : new Date(String(value))',
      'new Date(String(value))'],
    ['legacy fallback removed',
      'return runtimeEvidenceDigest(legacy) === storedDigest ? legacy : null;',
      'return null;'],
    ['legacy ISO spelling changed',
      'issuedAt: issued.toISOString(),', "issuedAt: issued.toISOString().replace('.000Z', 'Z'),"],
    ['exact digest guard bypassed',
      'if (runtimeEvidenceDigest(manifest) === storedDigest) return manifest;',
      'return manifest;'],
    ['legacy digest guard bypassed',
      'return runtimeEvidenceDigest(legacy) === storedDigest ? legacy : null;',
      'return legacy;'],
  ];
  const directory = await mkdtemp(join(tmpdir(), 'runtime-timestamp-mutation-'));
  const oracle = (module: {
    runtimeEvidenceDate: typeof runtimeEvidenceDate;
    selectRuntimeReplayManifest: typeof selectRuntimeReplayManifest;
  }) => {
    const full = fixture();
    assert.equal(module.runtimeEvidenceDate(new Date(full.issuedAt)).getUTCMilliseconds(), 191);
    assert.equal(module.selectRuntimeReplayManifest(full, runtimeEvidenceDigest(full)), full);
    assert.deepEqual(module.selectRuntimeReplayManifest(full, runtimeEvidenceDigest(legacyFixture(191))), legacyFixture(191));
    assert.equal(module.selectRuntimeReplayManifest({ ...full, hostKeyFingerprint: 'f'.repeat(64) },
      runtimeEvidenceDigest(legacyFixture(191))), null);
  };
  try {
    const baseline = join(directory, 'baseline.mts');
    await writeFile(baseline, source);
    oracle(await import(pathToFileURL(baseline).href));
    for (const [label, needle, replacement] of cases) {
      assert.equal(source.split(needle).length, 2, `${label}: mutation must hit exactly once`);
      const path = join(directory, `${cases.findIndex((entry) => entry[0] === label)}.mts`);
      await writeFile(path, source.replace(needle, replacement));
      const mutated = await import(pathToFileURL(path).href);
      assert.throws(() => oracle(mutated), { name: 'AssertionError' }, label);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
