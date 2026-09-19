import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getVerifiedCiDatabaseUrl } from '../ci-database';
import { closeDbConnections } from '../db';
import {
  DEFAULT_ATTESTATION_TTL_MS,
  MAX_ATTESTATION_TTL_MS,
  ReleaseCutoverAttestationConflictError,
  ReleaseCutoverAttestationDisagreementError,
  ReleaseCutoverAttestationInputError,
  ReleaseCutoverAttestationNotFoundError,
  ReleaseCutoverAttestationService,
  type ReleaseCutoverAttestationTargetConfig,
} from './release-cutover-attestation-service';
// Any test below that touches persistence must run against a positively
// verified disposable database, never a shared one. See
// .agents/memory/disposable-database-test-boundary.md.
function disposableTarget(): string | undefined {
  const ci = getVerifiedCiDatabaseUrl();
  if (ci) return ci;
  const url = process.env.RELEASE_CUTOVER_ATTESTATION_TEST_DATABASE_URL;
  if (!url) {
    if (process.env.RELEASE_CUTOVER_ATTESTATION_REQUIRE_DATABASE_TESTS === '1') {
      throw new Error('RELEASE_CUTOVER_ATTESTATION_TEST_DATABASE_URL is required by the migration gate');
    }
    return undefined;
  }
  if (process.env.RELEASE_CUTOVER_ATTESTATION_TEST_DATABASE_DISPOSABLE !== '1'
    || process.env.RELEASE_CUTOVER_ATTESTATION_FORBIDDEN_SHARED_URL === url
    || process.env.NEON_SHARED_DATABASE_URL !== url) {
    throw new Error('Release-cutover-attestation tests refuse a shared/unverified database');
  }
  return url;
}
// Every persistence-backed test below runs its queries through the app-wide
// `db` pool (server/db.ts), imported transitively via
// release-cutover-attestation-service's default `dbClient`. That pool sets
// idleTimeoutMillis but not `allowExitOnIdle`, so node-postgres (pg-pool)
// leaves a referenced eviction timer plus a referenced idle-client socket
// open after the last query. Without an explicit close, `node --test` waits
// out the full 2-minute idle timeout before the process can exit, adding
// ~2 minutes of wall time that no individual test reports (each subtest
// still finishes in milliseconds). Same pattern and fix already used by
// test-coordination-ledger.test.ts and other DB-backed *.test.ts files.
after(async () => {
  await closeDbConnections();
});
const OWN_SOURCE = readFileSync(fileURLToPath(import.meta.url), 'utf8');
test('this file hard-fails under the gate instead of silently skipping DB coverage', () => {
  assert.ok(OWN_SOURCE.includes("RELEASE_CUTOVER_ATTESTATION_REQUIRE_DATABASE_TESTS === '1'"));
  assert.ok(OWN_SOURCE.includes('RELEASE_CUTOVER_ATTESTATION_FORBIDDEN_SHARED_URL'));
  assert.ok(OWN_SOURCE.includes('context.skip('));
});
const sha1 = (c: string) => c.repeat(40);
const sha256 = (c: string) => c.repeat(64);
const ALGO = 'sha256(path-nul-kind-nul-bytes-nul-v1)';
function releaseIdentityBody(overrides: Partial<{
  authority: string;
  promotable: boolean;
  commitSha: string;
  sourceContextSha256: string;
}> = {}): string {
  return JSON.stringify({
    schemaVersion: 1,
    authority: overrides.authority ?? 'build',
    promotable: overrides.promotable ?? true,
    commitSha: overrides.commitSha ?? sha1('a'),
    commitSource: 'test',
    sourceContextSha256: overrides.sourceContextSha256 ?? sha256('b'),
    sourceContextAlgorithm: ALGO,
    sourceFileCount: 42,
    dirtyWorktree: false,
  });
}
const TEST_TARGETS: readonly ReleaseCutoverAttestationTargetConfig[] = [
  { label: 'host-a', url: 'https://host-a.example.com/health/release' },
  { label: 'host-b', url: 'https://host-b.example.com/health/release' },
  { label: 'host-c', url: 'https://host-c.example.com/health/release' },
];
function agreeingFetch(commitSha: string, sourceContextSha256: string): typeof fetch {
  return (async () => new Response(releaseIdentityBody({ commitSha, sourceContextSha256 }), { status: 200 })) as typeof fetch;
}
function byLabelFetch(bodies: Record<string, string>): typeof fetch {
  return (async (input: any) => {
    const url = typeof input === 'string' ? input : input.url;
    const match = TEST_TARGETS.find((target) => target.url === url);
    if (!match || !(match.label in bodies)) throw new Error(`unexpected fetch to ${url}`);
    return new Response(bodies[match.label], { status: 200 });
  }) as typeof fetch;
}
function neverRespondsUntilAborted(): typeof fetch {
  return (async (_input: any, init: any) => new Promise((_resolve, reject) => {
    init.signal.addEventListener('abort', () => {
      const error = new Error('aborted');
      error.name = 'AbortError';
      reject(error);
    });
  })) as typeof fetch;
}
// ── Pure validation and consensus tests: no DB, no network. ────────────────
test('constructor rejects a non-HTTPS pinned target', () => {
  assert.throws(() => new ReleaseCutoverAttestationService({
    targets: [{ label: 'x', url: 'http://example.com/health/release' }],
  }));
});
test('constructor rejects a pinned target with a query string', () => {
  assert.throws(() => new ReleaseCutoverAttestationService({
    targets: [{ label: 'x', url: 'https://example.com/health/release?override=1' }],
  }));
});
test('constructor rejects a pinned target with the wrong path', () => {
  assert.throws(() => new ReleaseCutoverAttestationService({
    targets: [{ label: 'x', url: 'https://example.com/other' }],
  }));
});
test('constructor rejects an empty target list', () => {
  assert.throws(() => new ReleaseCutoverAttestationService({ targets: [] }));
});
test('constructor rejects more than 8 targets', () => {
  const targets = Array.from({ length: 9 }, (_, i) => ({
    label: `t${i}`,
    url: `https://host-${i}.example.com/health/release`,
  }));
  assert.throws(() => new ReleaseCutoverAttestationService({ targets }));
});
test('attest rejects an unknown coordination actor before ever calling fetch', async () => {
  const service = new ReleaseCutoverAttestationService({
    targets: TEST_TARGETS,
    fetchImpl: (async () => { throw new Error('fetch must not be called'); }) as unknown as typeof fetch,
  });
  await assert.rejects(
    service.attest({ actor: 'not-a-real-actor', decisionRef: 'task-x', reason: 'test' }),
    ReleaseCutoverAttestationInputError,
  );
});
test('attest rejects a malformed decisionRef', async () => {
  const service = new ReleaseCutoverAttestationService({
    targets: TEST_TARGETS,
    fetchImpl: (async () => { throw new Error('fetch must not be called'); }) as unknown as typeof fetch,
  });
  await assert.rejects(
    service.attest({ actor: 'luca-holahola', decisionRef: 'has a space', reason: 'test' }),
    ReleaseCutoverAttestationInputError,
  );
});
test('attest rejects a blank reason', async () => {
  const service = new ReleaseCutoverAttestationService({
    targets: TEST_TARGETS,
    fetchImpl: (async () => { throw new Error('fetch must not be called'); }) as unknown as typeof fetch,
  });
  await assert.rejects(
    service.attest({ actor: 'luca-holahola', decisionRef: 'task-x', reason: '   ' }),
    ReleaseCutoverAttestationInputError,
  );
});
test('captureConsensus throws when targets disagree on commitSha', async () => {
  const service = new ReleaseCutoverAttestationService({
    targets: TEST_TARGETS,
    fetchImpl: byLabelFetch({
      'host-a': releaseIdentityBody({ commitSha: sha1('a') }),
      'host-b': releaseIdentityBody({ commitSha: sha1('a') }),
      'host-c': releaseIdentityBody({ commitSha: sha1('f') }),
    }),
  });
  await assert.rejects(service.captureConsensus(), ReleaseCutoverAttestationDisagreementError);
});
test('captureConsensus throws when a target is not promotable', async () => {
  const service = new ReleaseCutoverAttestationService({
    targets: TEST_TARGETS,
    fetchImpl: byLabelFetch({
      'host-a': releaseIdentityBody({}),
      'host-b': releaseIdentityBody({}),
      'host-c': releaseIdentityBody({ promotable: false }),
    }),
  });
  await assert.rejects(service.captureConsensus(), ReleaseCutoverAttestationDisagreementError);
});
test('captureConsensus throws on a non-200 target response', async () => {
  const service = new ReleaseCutoverAttestationService({
    targets: TEST_TARGETS,
    fetchImpl: (async () => new Response('', { status: 503 })) as typeof fetch,
  });
  await assert.rejects(service.captureConsensus(), /release_cutover_target_status_invalid/);
});
test('captureConsensus throws when a target declares an oversized body', async () => {
  const service = new ReleaseCutoverAttestationService({
    targets: TEST_TARGETS,
    fetchImpl: (async () => new Response(releaseIdentityBody(), {
      status: 200,
      headers: { 'content-length': String(10 * 1024 * 1024) },
    })) as typeof fetch,
  });
  await assert.rejects(service.captureConsensus(), /release_cutover_target_body_too_large/);
});
test('captureConsensus throws on target fetch timeout', async () => {
  const service = new ReleaseCutoverAttestationService({
    targets: TEST_TARGETS,
    fetchImpl: neverRespondsUntilAborted(),
    timeoutMs: 20,
  });
  await assert.rejects(service.captureConsensus(), /release_cutover_target_timeout/);
});
// ── Persistence-backed lifecycle tests: require a verified disposable DB. ──
test('attest stores one active row, getActive reads it, and a second attest is refused', async (context) => {
  const url = disposableTarget();
  if (!url) { context.skip('requires a verified disposable PostgreSQL URL'); return; }
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const decisionRef = `test-attest-${suffix}`;
  const commitSha = sha1('1');
  const digest = sha256('2');
  const service = new ReleaseCutoverAttestationService({
    targets: TEST_TARGETS,
    fetchImpl: agreeingFetch(commitSha, digest),
  });
  const attested = await service.attest({ actor: 'luca-holahola', decisionRef, reason: 'cutover decision test' });
  assert.equal(attested.state, 'active');
  assert.equal(attested.commitSha, commitSha);
  assert.equal(attested.sourceContextSha256, digest);
  assert.equal(attested.targets.length, 3);
  const active = await service.getActive(decisionRef);
  assert.ok(active);
  assert.equal(active!.id, attested.id);
  assert.equal(active!.expired, false);
  await assert.rejects(
    service.attest({ actor: 'luca-holahola', decisionRef, reason: 'second attempt' }),
    ReleaseCutoverAttestationConflictError,
  );
});
test('attest clamps a requested ttlMs to the 24-hour ceiling', async (context) => {
  const url = disposableTarget();
  if (!url) { context.skip('requires a verified disposable PostgreSQL URL'); return; }
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const decisionRef = `test-ttl-${suffix}`;
  const service = new ReleaseCutoverAttestationService({
    targets: TEST_TARGETS,
    fetchImpl: agreeingFetch(sha1('3'), sha256('4')),
  });
  const attested = await service.attest({
    actor: 'luca-holahola',
    decisionRef,
    reason: 'ttl ceiling test',
    ttlMs: MAX_ATTESTATION_TTL_MS * 10,
  });
  const ttl = attested.expiresAt.getTime() - attested.capturedAt.getTime();
  assert.ok(ttl <= MAX_ATTESTATION_TTL_MS);
  assert.ok(ttl > MAX_ATTESTATION_TTL_MS - 5_000);
});
test('attest applies the default TTL when none is requested', async (context) => {
  const url = disposableTarget();
  if (!url) { context.skip('requires a verified disposable PostgreSQL URL'); return; }
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const decisionRef = `test-default-ttl-${suffix}`;
  const service = new ReleaseCutoverAttestationService({
    targets: TEST_TARGETS,
    fetchImpl: agreeingFetch(sha1('5'), sha256('6')),
  });
  const attested = await service.attest({ actor: 'luca-holahola', decisionRef, reason: 'default ttl test' });
  const ttl = attested.expiresAt.getTime() - attested.capturedAt.getTime();
  assert.ok(Math.abs(ttl - DEFAULT_ATTESTATION_TTL_MS) < 5_000);
});
test('invalidate transitions active to invalidated, unblocks re-attest, and is idempotent', async (context) => {
  const url = disposableTarget();
  if (!url) { context.skip('requires a verified disposable PostgreSQL URL'); return; }
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const decisionRef = `test-invalidate-${suffix}`;
  const service = new ReleaseCutoverAttestationService({
    targets: TEST_TARGETS,
    fetchImpl: agreeingFetch(sha1('7'), sha256('8')),
  });
  await service.attest({ actor: 'luca-holahola', decisionRef, reason: 'to be invalidated' });
  const invalidated = await service.invalidate(decisionRef, 'alden', 'superseded decision');
  assert.equal(invalidated.state, 'invalidated');
  assert.equal(invalidated.invalidatedByActorId, 'alden');
  const replay = await service.invalidate(decisionRef, 'alden', 'superseded decision');
  assert.equal(replay.id, invalidated.id);
  assert.equal(replay.state, 'invalidated');
  assert.equal(await service.getActive(decisionRef), null);
  const reattested = await service.attest({ actor: 'luca-holahola', decisionRef, reason: 're-attest after invalidation' });
  assert.notEqual(reattested.id, invalidated.id);
  assert.equal(reattested.state, 'active');
});
test('invalidate on an unknown decisionRef throws not-found', async (context) => {
  const url = disposableTarget();
  if (!url) { context.skip('requires a verified disposable PostgreSQL URL'); return; }
  const service = new ReleaseCutoverAttestationService({ targets: TEST_TARGETS, fetchImpl: agreeingFetch(sha1('9'), sha256('0')) });
  await assert.rejects(
    service.invalidate(`test-missing-${Date.now()}`, 'alden', 'no such row'),
    ReleaseCutoverAttestationNotFoundError,
  );
});
test('invalidate replay with a different actor or reason reports a conflict instead of silent success', async (context) => {
  const url = disposableTarget();
  if (!url) { context.skip('requires a verified disposable PostgreSQL URL'); return; }
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const decisionRef = `test-invalidate-conflict-${suffix}`;
  const service = new ReleaseCutoverAttestationService({
    targets: TEST_TARGETS,
    fetchImpl: agreeingFetch(sha1('a'), sha256('b')),
  });
  await service.attest({ actor: 'luca-holahola', decisionRef, reason: 'to be invalidated' });
  await service.invalidate(decisionRef, 'alden', 'original reason');
  await assert.rejects(
    service.invalidate(decisionRef, 'luca-replit', 'original reason'),
    ReleaseCutoverAttestationConflictError,
  );
  await assert.rejects(
    service.invalidate(decisionRef, 'alden', 'a completely different reason'),
    ReleaseCutoverAttestationConflictError,
  );
  // Replaying with the exact same actor and reason is still idempotent.
  const replay = await service.invalidate(decisionRef, 'alden', 'original reason');
  assert.equal(replay.state, 'invalidated');
  assert.equal(replay.invalidatedByActorId, 'alden');
});
test('consume re-verifies live evidence, transitions to consumed, and is idempotent for the same action', async (context) => {
  const url = disposableTarget();
  if (!url) { context.skip('requires a verified disposable PostgreSQL URL'); return; }
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const decisionRef = `test-consume-${suffix}`;
  const commitSha = sha1('c');
  const digest = sha256('d');
  const service = new ReleaseCutoverAttestationService({
    targets: TEST_TARGETS,
    fetchImpl: agreeingFetch(commitSha, digest),
  });
  await service.attest({ actor: 'luca-holahola', decisionRef, reason: 'consume test' });
  const consumed = await service.consume(decisionRef, 'luca-replit', 'dns-cutover');
  assert.equal(consumed.state, 'consumed');
  assert.equal(consumed.consumedByActorId, 'luca-replit');
  assert.equal(consumed.consumedForAction, 'dns-cutover');
  const replay = await service.consume(decisionRef, 'luca-replit', 'dns-cutover');
  assert.equal(replay.id, consumed.id);
  assert.equal(replay.state, 'consumed');
  await assert.rejects(
    service.consume(decisionRef, 'luca-replit', 'a-different-action'),
    ReleaseCutoverAttestationConflictError,
  );
});
test('consume fails closed and leaves the row active when live evidence has moved on since attest', async (context) => {
  const url = disposableTarget();
  if (!url) { context.skip('requires a verified disposable PostgreSQL URL'); return; }
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const decisionRef = `test-drift-${suffix}`;
  const attestTimeService = new ReleaseCutoverAttestationService({
    targets: TEST_TARGETS,
    fetchImpl: agreeingFetch(sha1('e'), sha256('f')),
  });
  await attestTimeService.attest({ actor: 'luca-holahola', decisionRef, reason: 'about to drift' });
  // Simulate Render republishing a newer commit while the decision was pending.
  const consumeTimeService = new ReleaseCutoverAttestationService({
    targets: TEST_TARGETS,
    fetchImpl: agreeingFetch(sha1('1'), sha256('2')),
  });
  await assert.rejects(
    consumeTimeService.consume(decisionRef, 'luca-replit', 'dns-cutover'),
    ReleaseCutoverAttestationDisagreementError,
  );
  const stillActive = await attestTimeService.getActive(decisionRef);
  assert.ok(stillActive);
  assert.equal(stillActive!.state, 'active');
});
test('consume retry fails closed when the release has moved on since the first successful consume', async (context) => {
  const url = disposableTarget();
  if (!url) { context.skip('requires a verified disposable PostgreSQL URL'); return; }
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const decisionRef = `test-consume-retry-drift-${suffix}`;
  const firstCallService = new ReleaseCutoverAttestationService({
    targets: TEST_TARGETS,
    fetchImpl: agreeingFetch(sha1('a'), sha256('b')),
  });
  await firstCallService.attest({ actor: 'luca-holahola', decisionRef, reason: 'consume retry drift test' });
  const consumed = await firstCallService.consume(decisionRef, 'luca-replit', 'dns-cutover');
  assert.equal(consumed.state, 'consumed');
  // Simulate Render republishing a newer commit between the first successful
  // consume (e.g. right before a crash) and a caller's retry of the exact
  // same actor+action.
  const retryService = new ReleaseCutoverAttestationService({
    targets: TEST_TARGETS,
    fetchImpl: agreeingFetch(sha1('c'), sha256('d')),
  });
  await assert.rejects(
    retryService.consume(decisionRef, 'luca-replit', 'dns-cutover'),
    ReleaseCutoverAttestationDisagreementError,
  );
  // The historical fact that the cutover was consumed once is preserved --
  // a failed re-confirmation does not undo the first real-world action --
  // but the caller must not receive a fresh "yes" on stale evidence.
  const stillConsumed = await firstCallService.getById(consumed.id);
  assert.ok(stillConsumed);
  assert.equal(stillConsumed!.state, 'consumed');
});
test('consume retry fails closed once the attestation has expired since the first successful consume', async (context) => {
  const url = disposableTarget();
  if (!url) { context.skip('requires a verified disposable PostgreSQL URL'); return; }
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const decisionRef = `test-consume-retry-expiry-${suffix}`;
  const attestTime = new Date();
  const farFuture = new Date(attestTime.getTime() + MAX_ATTESTATION_TTL_MS * 2);
  const commitSha = sha1('e');
  const digest = sha256('f');
  const firstCallService = new ReleaseCutoverAttestationService({
    targets: TEST_TARGETS,
    fetchImpl: agreeingFetch(commitSha, digest),
    now: () => attestTime,
  });
  await firstCallService.attest({ actor: 'luca-holahola', decisionRef, reason: 'consume retry expiry test', ttlMs: 60_000 });
  const consumed = await firstCallService.consume(decisionRef, 'luca-replit', 'dns-cutover');
  assert.equal(consumed.state, 'consumed');
  // Same commit/digest as before -- only time has moved past the TTL -- so
  // this isolates the expiry check on the replay path from the live-match
  // check exercised by the previous test.
  const retryService = new ReleaseCutoverAttestationService({
    targets: TEST_TARGETS,
    fetchImpl: agreeingFetch(commitSha, digest),
    now: () => farFuture,
  });
  await assert.rejects(
    retryService.consume(decisionRef, 'luca-replit', 'dns-cutover'),
    ReleaseCutoverAttestationConflictError,
  );
});
test('verifyStillLive and consume throw once an attestation has expired', async (context) => {
  const url = disposableTarget();
  if (!url) { context.skip('requires a verified disposable PostgreSQL URL'); return; }
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const decisionRef = `test-expiry-${suffix}`;
  const attestTime = new Date();
  const farFuture = new Date(attestTime.getTime() + MAX_ATTESTATION_TTL_MS * 2);
  const attestingService = new ReleaseCutoverAttestationService({
    targets: TEST_TARGETS,
    fetchImpl: agreeingFetch(sha1('3'), sha256('4')),
    now: () => attestTime,
  });
  await attestingService.attest({ actor: 'luca-holahola', decisionRef, reason: 'will expire', ttlMs: 60_000 });
  const laterService = new ReleaseCutoverAttestationService({
    targets: TEST_TARGETS,
    fetchImpl: agreeingFetch(sha1('3'), sha256('4')),
    now: () => farFuture,
  });
  const active = await laterService.getActive(decisionRef);
  assert.ok(active);
  assert.equal(active!.expired, true);
  await assert.rejects(laterService.verifyStillLive(decisionRef), ReleaseCutoverAttestationConflictError);
  await assert.rejects(laterService.consume(decisionRef, 'luca-replit', 'dns-cutover'), ReleaseCutoverAttestationConflictError);
});
test('getActive returns null for a decisionRef with no attestation', async (context) => {
  const url = disposableTarget();
  if (!url) { context.skip('requires a verified disposable PostgreSQL URL'); return; }
  const service = new ReleaseCutoverAttestationService({ targets: TEST_TARGETS, fetchImpl: agreeingFetch(sha1('5'), sha256('6')) });
  const active = await service.getActive(`test-never-attested-${Date.now()}`);
  assert.equal(active, null);
});
