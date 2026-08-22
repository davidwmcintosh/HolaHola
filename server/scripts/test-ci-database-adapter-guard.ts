import assert from 'node:assert/strict';
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

console.log('✓ CI database adapter guard passed');