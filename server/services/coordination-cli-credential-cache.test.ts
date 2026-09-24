import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir, platform } from 'node:os';
import { join } from 'node:path';
import { FileCoordinationCliCredentialCache } from './coordination-cli-credential-cache';
import type { CoordinationCredentialCacheEntry } from './coordination-actor-client';

async function withTempCacheDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'coordination-cli-cred-cache-test-'));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function entry(overrides: Partial<CoordinationCredentialCacheEntry> = {}): CoordinationCredentialCacheEntry {
  return {
    actor: 'luca-claude-code',
    runtimeId: 'luca-claude-code-test-runtime',
    accessToken: 'ct_test-token',
    expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    ...overrides,
  };
}

function fileNameFor(actor: string, runtimeId: string): string {
  return `${createHash('sha256').update(`${actor}\u0000${runtimeId}`).digest('hex')}.json`;
}

test('FileCoordinationCliCredentialCache round-trips a saved credential for the same actor + runtimeId', async () => {
  await withTempCacheDir(async (dir) => {
    const cache = new FileCoordinationCliCredentialCache(dir);
    const saved = entry();
    await cache.save(saved);
    const loaded = await cache.load(saved.actor, saved.runtimeId);
    assert.deepEqual(loaded, saved);
  });
});

test('FileCoordinationCliCredentialCache returns null when nothing has been saved yet', async () => {
  await withTempCacheDir(async (dir) => {
    const cache = new FileCoordinationCliCredentialCache(dir);
    const loaded = await cache.load('luca-claude-code', 'never-saved-runtime');
    assert.equal(loaded, null);
  });
});

test("FileCoordinationCliCredentialCache never returns another actor's or runtime's credential", async () => {
  await withTempCacheDir(async (dir) => {
    const cache = new FileCoordinationCliCredentialCache(dir);
    await cache.save(entry({ actor: 'luca-claude-code', runtimeId: 'runtime-a', accessToken: 'ct_a' }));
    await cache.save(entry({ actor: 'luca-replit', runtimeId: 'runtime-b', accessToken: 'ct_b' }));

    assert.equal(await cache.load('luca-replit', 'runtime-a'), null);
    assert.equal(await cache.load('luca-claude-code', 'runtime-b'), null);
    assert.equal((await cache.load('luca-claude-code', 'runtime-a'))?.accessToken, 'ct_a');
    assert.equal((await cache.load('luca-replit', 'runtime-b'))?.accessToken, 'ct_b');
  });
});

test('FileCoordinationCliCredentialCache treats a corrupt cache file as absent, never throwing', async () => {
  await withTempCacheDir(async (dir) => {
    const cache = new FileCoordinationCliCredentialCache(dir);
    const saved = entry();
    await cache.save(saved); // creates the directory and a valid file first
    // Overwrite it with garbage, simulating a truncated write or manual edit.
    await writeFile(join(dir, fileNameFor(saved.actor, saved.runtimeId)), '{not valid json');
    const loaded = await cache.load(saved.actor, saved.runtimeId);
    assert.equal(loaded, null);
  });
});

test("FileCoordinationCliCredentialCache treats a file whose own contents mismatch the requested identity as absent", async () => {
  await withTempCacheDir(async (dir) => {
    const cache = new FileCoordinationCliCredentialCache(dir);
    const saved = entry({ actor: 'luca-claude-code', runtimeId: 'runtime-mismatch' });
    await cache.save(saved);
    // Simulate a hash collision or misrouted file: the file's own JSON claims
    // a different runtimeId than the hashed filename implies. The defense in
    // depth check inside load() must still refuse it.
    await writeFile(
      join(dir, fileNameFor(saved.actor, saved.runtimeId)),
      JSON.stringify({ ...saved, runtimeId: 'someone-elses-runtime' }),
    );
    const loaded = await cache.load(saved.actor, saved.runtimeId);
    assert.equal(loaded, null);
  });
});

test('FileCoordinationCliCredentialCache overwrites an existing entry on renewal (save is idempotent, not write-once)', async () => {
  await withTempCacheDir(async (dir) => {
    const cache = new FileCoordinationCliCredentialCache(dir);
    const first = entry({ accessToken: 'ct_first' });
    await cache.save(first);
    const renewed = entry({ accessToken: 'ct_renewed', expiresAt: new Date(Date.now() + 30 * 60_000).toISOString() });
    await cache.save(renewed);
    const loaded = await cache.load(renewed.actor, renewed.runtimeId);
    assert.deepEqual(loaded, renewed);
  });
});

test('FileCoordinationCliCredentialCache clear() removes a saved entry and is a no-op when nothing exists', async () => {
  await withTempCacheDir(async (dir) => {
    const cache = new FileCoordinationCliCredentialCache(dir);
    const saved = entry();
    await cache.save(saved);
    await cache.clear(saved.actor, saved.runtimeId);
    assert.equal(await cache.load(saved.actor, saved.runtimeId), null);
    await assert.doesNotReject(() => cache.clear(saved.actor, saved.runtimeId));
  });
});

if (platform() !== 'win32') {
  test('FileCoordinationCliCredentialCache writes the credential file with owner-only permissions', async () => {
    await withTempCacheDir(async (dir) => {
      const cache = new FileCoordinationCliCredentialCache(dir);
      const saved = entry();
      await cache.save(saved);
      const stats = await stat(join(dir, fileNameFor(saved.actor, saved.runtimeId)));
      assert.equal(stats.mode & 0o777, 0o600);
    });
  });
}
