import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getVerifiedCiDatabaseUrl } from '../ci-database';

const localUrl = 'postgresql://postgres:postgres@127.0.0.1:5432/holahola_ci';

assert.equal(
  getVerifiedCiDatabaseUrl({ CI_DATABASE_URL: localUrl }),
  undefined,
  'A CI_DATABASE_URL alone must not reroute a non-CI application process',
);

assert.equal(
  getVerifiedCiDatabaseUrl({
    CI: 'true',
    CI_DATABASE_URL: localUrl,
    NEON_SHARED_DATABASE_URL: localUrl,
  }),
  localUrl,
  'A verified CI process may use its loopback PostgreSQL service',
);

assert.throws(
  () =>
    getVerifiedCiDatabaseUrl({
      CI: 'true',
      CI_DATABASE_URL: 'postgresql://postgres:postgres@db.example.com:5432/holahola_ci',
      NEON_SHARED_DATABASE_URL: 'postgresql://postgres:postgres@db.example.com:5432/holahola_ci',
    }),
  /job-local PostgreSQL service/,
  'CI must reject external PostgreSQL hosts',
);

assert.throws(
  () =>
    getVerifiedCiDatabaseUrl({
      CI: 'true',
      CI_DATABASE_URL: localUrl,
      NEON_SHARED_DATABASE_URL: 'postgresql://user:secret@live.example.com:5432/holahola',
    }),
  /must match CI_DATABASE_URL/,
  'CI must reject a mismatched Neon URL',
);

const coordinationTestSource = readFileSync(
  resolve(process.cwd(), 'server/scripts/test-coordination-ledger.test.ts'),
  'utf8',
);
const scratchpadTestSource = readFileSync(
  resolve(process.cwd(), 'server/scripts/test-scratchpad-reconnect-survival.ts'),
  'utf8',
);
const coordinationRoutesTestSource = readFileSync(
  resolve(process.cwd(), 'server/scripts/test-coordination-routes-auth.test.ts'),
  'utf8',
);
const observationBenchTestSource = readFileSync(
  resolve(process.cwd(), 'server/scripts/test-observation-bench.test.ts'),
  'utf8',
);

assert.match(
  coordinationTestSource,
  /const hasIsolatedCiDatabase = Boolean\(getVerifiedCiDatabaseUrl\(\)\);/,
  'DB-backed coordination tests must detect the verified isolated CI database',
);
assert.match(
  coordinationTestSource,
  /const databaseTest = hasIsolatedCiDatabase \? test : test\.skip;/,
  'DB-backed coordination tests must skip rather than write shared Neon',
);
assert.equal(
  (coordinationTestSource.match(/databaseTest\('/g) ?? []).length,
  4,
  'All four coordination tests that mutate lifecycle data must use the isolated database test wrapper',
);
assert.match(
  scratchpadTestSource,
  /if \(!hasIsolatedCiDatabase\) \{[\s\S]*?Overflow auto-flush persistence skipped[\s\S]*?return;[\s\S]*?\n  \}/,
  'Scratchpad overflow persistence must return before the 51st write without an isolated CI database',
);

for (const [label, source] of [
  ['coordination route-auth suite', coordinationRoutesTestSource],
  ['observation-bench suite', observationBenchTestSource],
] as const) {
  assert.match(
    source,
    /const hasIsolatedCiDatabase = Boolean\(getVerifiedCiDatabaseUrl\(\)\);/,
    `${label} must detect the verified isolated CI database`,
  );
  assert.match(
    source,
    /const databaseTest = hasIsolatedCiDatabase \? test : test\.skip;/,
    `${label} must skip rather than write shared Neon`,
  );
  assert.match(
    source,
    /after\(async \(\) => \{\n  if \(!hasIsolatedCiDatabase\) return;/,
    `${label} teardown must not initialize or mutate shared Neon when its DB tests are skipped`,
  );
}

console.log('✓ CI database adapter guard passed');