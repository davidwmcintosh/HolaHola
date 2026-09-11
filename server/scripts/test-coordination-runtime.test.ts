import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CoordinationRuntimeService,
  InMemoryCoordinationRepository,
  RuntimeProtocolError,
  canonicalJson,
  digestCanonical,
  type Assignment,
  type ExecutionEnvelope,
  type NormalizedOutcome,
  type RuntimePrincipal,
} from '../services/coordination-runtime';

const envelope: ExecutionEnvelope = {
  worktreeLabel: 'gate-1',
  worktreePath: '/isolated/antigravity',
  argv: ['true'],
  patchDigest: null,
};

const gemini: RuntimePrincipal = {
  actor: 'luca-gemini',
  runtimeRegistrationId: 'gemini-runtime',
  credentialId: 'credential-1',
  profileId: 'gemini-profile',
  capabilities: ['execute', 'model'],
  credentialExpiresAt: 10_000,
  runtimeEnabled: true,
  revoked: false,
};

const replitVerifier: RuntimePrincipal = {
  actor: 'luca-replit',
  runtimeRegistrationId: 'replit-runtime',
  credentialId: 'replit-credential',
  profileId: 'replit-profile',
  capabilities: ['verify'],
  credentialExpiresAt: 10_000,
  runtimeEnabled: true,
  revoked: false,
};

const claudeVerifier: RuntimePrincipal = {
  ...replitVerifier,
  actor: 'luca-claude-code',
  runtimeRegistrationId: 'claude-runtime',
};

async function expectCode(operation: () => unknown, code: string): Promise<void> {
  await assert.rejects(Promise.resolve().then(operation), (error: unknown) => error instanceof RuntimeProtocolError && error.code === code);
}

async function harness(author: Assignment['assignmentAuthor'] = 'alden') {
  const repository = new InMemoryCoordinationRepository();
  let now = 100;
  let nextId = 0;
  const service = new CoordinationRuntimeService(
    repository,
    () => now,
    () => `id-${++nextId}`,
    envelope,
    1_000,
  );
  const secondService = new CoordinationRuntimeService(
    repository,
    () => now,
    () => `second-${++nextId}`,
    envelope,
    1_000,
  );
  await repository.addInboxItem({
    id: 'item-1',
    eventId: 'context-event',
    threadId: 'thread-1',
    taskId: 'task-1',
    sequence: 1,
    payload: { content: { context: 'first', emoji: '😀' } },
  });
  await repository.addInboxItem({
    id: 'item-2',
    eventId: 'assignment-event',
    threadId: 'thread-1',
    taskId: 'task-1',
    sequence: 2,
    payload: { content: { assignment: 'bounded no-op' } },
  });
  const window = await repository.freezeInboxWindow('thread-1', 0, 2, 'stable-boundary');
  const assignment: Assignment = {
    assignmentEventId: 'assignment-event',
    assignmentAuthor: author,
    taskId: 'task-1',
    threadId: 'thread-1',
    expectedSequence: 2,
  };
  const packet = await service.createPacket(gemini, window.id, assignment, 'packet-key');
  const interaction = await service.recordInteraction(gemini, {
    packetId: packet.id,
    turn: 1,
    attempt: 1,
    requestDigest: 'request-digest',
    responseDigest: 'response-digest',
    outcome: 'consumed',
    normalizedEvidence: {
      textParts: [],
      intents: [],
      validatedIntents: [],
      additionalCandidateHashes: [],
      providerDetails: {},
      normalizedResponseDigest: 'response-digest',
    },
    idempotencyKey: 'interaction-key',
  });
  const receipt = await service.recordOutcomeReceipt(
    gemini,
    packet.id,
    packet.digest,
    interaction.id,
    'receipt-key',
  );
  return {
    repository,
    service,
    secondService,
    assignment,
    window,
    packet,
    interaction,
    receipt,
    setNow(value: number) { now = value; },
  };
}

test('success path stores an immutable evidence chain and independent approval', async () => {
  const fixture = await harness();
  const claim = await fixture.service.claim(
    gemini,
    fixture.packet.id,
    fixture.packet.digest,
    fixture.receipt.id,
    100,
    'claim-key',
  );
  const execution = await fixture.service.execute(gemini, claim.id, envelope, 'execution-key');
  const completion = await fixture.service.complete(
    gemini,
    execution.id,
    digestCanonical(execution),
    'completion-key',
  );
  const verification = await fixture.service.verify(
    replitVerifier,
    completion.id,
    completion.evidenceDigest,
    null,
    'verification-key',
  );
  assert.equal(verification.decision, 'approved');
  assert.equal((await fixture.repository.getClaim(claim.id))?.status, 'completed');
  assert(Object.isFrozen(fixture.repository.snapshots()));
});

test('canonical JSON accepts valid pairs and rejects ambiguous values', async () => {
  assert.match(digestCanonical({ emoji: '😀' }), /^[0-9a-f]{64}$/);
  assert.equal(canonicalJson({ z: 1, a: 2 }), '{"a":2,"z":1}');
  await expectCode(() => digestCanonical('\ud800'), 'invalid_json');
  await expectCode(() => digestCanonical('\udc00'), 'invalid_json');
  await expectCode(() => digestCanonical(Number.NaN), 'invalid_json');
  await expectCode(() => digestCanonical({ value: undefined }), 'invalid_json');
});

test('repository transactions roll back every write and reject reentrancy', async () => {
  const repository = new InMemoryCoordinationRepository();
  await assert.rejects(repository.transaction(async () => {
    // Direct repository insertion opens its own transaction and must not interleave.
    await repository.addInboxItem({
      id: 'nested',
      eventId: 'event',
      threadId: 'thread',
      taskId: 'task',
      sequence: 1,
      payload: { content: {} },
    });
  }), (error: unknown) => error instanceof RuntimeProtocolError && error.code === 'transaction_reentrant');
  assert.equal(await repository.getThreadSequence('thread'), undefined);
  await assert.rejects(repository.transaction(async () => {
    await repository.saveVerification({
      id: 'rolled-back',
      completionId: 'none',
      verifierActor: 'luca-replit',
      verifierRuntimeRegistrationId: 'none',
      evidenceDigest: 'none',
      patchDigest: null,
      decision: 'approved',
    });
    throw new Error('rollback');
  }));
  assert.equal(await repository.getVerification('rolled-back'), undefined);
});

test('frozen windows preserve all inherited items and cannot be caller-authored', async () => {
  const fixture = await harness();
  assert.equal(fixture.packet.inherited.length, 2);
  assert.equal(fixture.packet.inherited[0].content.context, 'first');
  assert.throws(() => {
    fixture.packet.inherited[0].content.context = 'mutated';
  }, TypeError);
  assert.equal(
    (await fixture.repository.getPacket(fixture.packet.id))?.inherited[0].content.context,
    'first',
  );
  await expectCode(
    async () => await fixture.service.createPacket(gemini, 'caller-window', fixture.assignment, 'other'),
    'inbox_window_incomplete',
  );
  assert.deepEqual(fixture.packet.envelope, envelope);
});

test('all ten outcomes persist as receipts but only consumed authorizes claims', async () => {
  const outcomes: NormalizedOutcome[] = [
    'consumed',
    'safety_blocked',
    'refused',
    'context_limit',
    'interrupted',
    'empty_response',
    'malformed_function_call',
    'unsupported_provider_outcome',
    'retryable_provider_error',
    'terminal_provider_error',
  ];
  for (const outcome of outcomes) {
    const fixture = await harness();
    const interaction = outcome === 'consumed'
      ? fixture.interaction
      : await fixture.service.recordInteraction(gemini, {
          packetId: fixture.packet.id,
          turn: 2,
          attempt: 1,
          requestDigest: `request-${outcome}`,
          responseDigest: `response-${outcome}`,
          outcome,
          idempotencyKey: `interaction-${outcome}`,
        });
    const receipt = outcome === 'consumed'
      ? fixture.receipt
      : await fixture.service.recordOutcomeReceipt(
          gemini,
          fixture.packet.id,
          fixture.packet.digest,
          interaction.id,
          `receipt-${outcome}`,
        );
    assert.equal(receipt.outcome, outcome);
    if (outcome === 'consumed') {
      assert.equal(
        (await fixture.service.claim(
          gemini,
          fixture.packet.id,
          fixture.packet.digest,
          receipt.id,
          10,
          'claim-outcome',
        )).status,
        'active',
      );
    } else {
      await expectCode(
        async () => await fixture.service.claim(
          gemini,
          fixture.packet.id,
          fixture.packet.digest,
          receipt.id,
          10,
          'claim-outcome',
        ),
        'consumption_not_authorized',
      );
    }
  }
});

test('runtime and profile own authority while renewed credentials remain valid', async () => {
  const fixture = await harness();
  const otherRuntime = { ...gemini, runtimeRegistrationId: 'other-runtime' };
  await expectCode(
    async () => await fixture.service.recordOutcomeReceipt(
      otherRuntime,
      fixture.packet.id,
      fixture.packet.digest,
      fixture.interaction.id,
      'cross-runtime-receipt',
    ),
    'consumption_not_authorized',
  );
  await expectCode(
    async () => await fixture.service.claim(
      otherRuntime,
      fixture.packet.id,
      fixture.packet.digest,
      fixture.receipt.id,
      10,
      'cross-runtime-claim',
    ),
    'consumption_not_authorized',
  );
  const claim = await fixture.service.claim(
    gemini,
    fixture.packet.id,
    fixture.packet.digest,
    fixture.receipt.id,
    20,
    'claim-owner',
  );
  const renewedCredential = { ...gemini, credentialId: 'credential-2' };
  const renewed = await fixture.service.renew(
    renewedCredential,
    claim.id,
    claim.epoch,
    20,
    'renew-owner',
  );
  assert.equal(renewed.credentialId, 'credential-2');
  assert.equal(
    (await fixture.service.execute(
      renewedCredential,
      renewed.id,
      envelope,
      'execute-renewed',
    )).claimEpoch,
    renewed.epoch,
  );
});

test('claim contention, expiry takeover, sequence, and TTL rules fail closed', async () => {
  const fixture = await harness();
  const first = await fixture.service.claim(
    gemini,
    fixture.packet.id,
    fixture.packet.digest,
    fixture.receipt.id,
    5,
    'claim-first',
  );
  await expectCode(async () => await fixture.secondService.claim(
    gemini,
    fixture.packet.id,
    fixture.packet.digest,
    fixture.receipt.id,
    5,
    'claim-second',
  ), 'claim_active_conflict');
  await expectCode(
    async () => await fixture.service.createPacket(
      gemini,
      fixture.window.id,
      fixture.assignment,
      'wrong-takeover-reference',
      2,
      'not-the-prior-claim',
    ),
    'takeover_reference_invalid',
  );
  await expectCode(
    async () => await fixture.service.createPacket(
      gemini,
      fixture.window.id,
      fixture.assignment,
      'premature-takeover',
      2,
      first.id,
    ),
    'takeover_not_ready',
  );
  fixture.setNow(106);
  await expectCode(
    async () => await fixture.service.claim(
      gemini,
      fixture.packet.id,
      fixture.packet.digest,
      fixture.receipt.id,
      5,
      'expired-same-packet',
    ),
    'fresh_consumption_required',
  );
  const takeoverPacket = await fixture.service.createPacket(
    gemini,
    fixture.window.id,
    fixture.assignment,
    'packet-takeover',
    2,
    first.id,
  );
  const { digest: _takeoverDigest, ...takeoverBase } = takeoverPacket;
  const predatedBase = {
    ...takeoverBase,
    id: 'predated-packet',
    version: 3,
    createdAt: 100,
  };
  const predatedPacket = {
    ...predatedBase,
    digest: digestCanonical(predatedBase),
  };
  await fixture.repository.savePacket(predatedPacket);
  await fixture.repository.saveInteraction({
    id: 'predated-interaction',
    packetId: predatedPacket.id,
    principal: {
      actor: gemini.actor,
      runtimeRegistrationId: gemini.runtimeRegistrationId,
      credentialId: gemini.credentialId,
      profileId: gemini.profileId,
    },
    turn: 4,
    attempt: 1,
    requestDigest: 'predated-request',
    responseDigest: 'predated-response',
    outcome: 'consumed',
    retryLineage: null,
    createdAt: 100,
  });
  await fixture.repository.saveReceipt({
    id: 'predated-receipt',
    packetId: predatedPacket.id,
    packetDigest: predatedPacket.digest,
    interactionId: 'predated-interaction',
    runtimeRegistrationId: gemini.runtimeRegistrationId,
    profileId: gemini.profileId,
    outcome: 'consumed',
    createdAt: 100,
  });
  await expectCode(
    async () => await fixture.service.claim(
      gemini,
      predatedPacket.id,
      predatedPacket.digest,
      'predated-receipt',
      5,
      'predated-claim',
    ),
    'fresh_consumption_required',
  );
  const takeoverInteraction = await fixture.service.recordInteraction(gemini, {
    packetId: takeoverPacket.id,
    turn: 2,
    attempt: 1,
    requestDigest: 'takeover-request',
    responseDigest: 'takeover-response',
    outcome: 'consumed',
    idempotencyKey: 'takeover-interaction',
  });
  const takeoverReceipt = await fixture.service.recordOutcomeReceipt(
    gemini,
    takeoverPacket.id,
    takeoverPacket.digest,
    takeoverInteraction.id,
    'takeover-receipt',
  );
  const takeover = await fixture.secondService.claim(
    gemini,
    takeoverPacket.id,
    takeoverPacket.digest,
    takeoverReceipt.id,
    5,
    'claim-takeover',
  );
  assert.equal(takeover.epoch, first.epoch + 1);
  assert.equal(takeover.priorClaimId, first.id);
  assert.equal((await fixture.repository.getClaim(first.id))?.status, 'expired');
  for (const ttl of [0, Number.NaN, Number.POSITIVE_INFINITY, 1_001]) {
    await expectCode(
      async () => await fixture.service.claim(
        gemini,
        fixture.packet.id,
        fixture.packet.digest,
        fixture.receipt.id,
        ttl,
        `bad-${String(ttl)}`,
      ),
      'claim_ttl_invalid',
    );
  }

  const stale = await harness();
  await stale.repository.addInboxItem({
    id: 'late-item',
    eventId: 'late-event',
    threadId: 'thread-1',
    taskId: 'task-1',
    sequence: 3,
    payload: { content: { late: true } },
  });
  await expectCode(
    async () => await stale.service.claim(
      gemini,
      stale.packet.id,
      stale.packet.digest,
      stale.receipt.id,
      5,
      'stale-sequence',
    ),
    'thread_sequence_stale',
  );
});

test('renewal rejects stale epochs, wrong owners, revoked and expired principals', async () => {
  const fixture = await harness();
  const claim = await fixture.service.claim(
    gemini,
    fixture.packet.id,
    fixture.packet.digest,
    fixture.receipt.id,
    10,
    'claim-renew',
  );
  await expectCode(
    async () => await fixture.service.renew(gemini, claim.id, claim.epoch + 1, 10, 'stale'),
    'claim_epoch_stale',
  );
  await expectCode(
    async () => await fixture.service.renew(
      { ...gemini, profileId: 'other-profile' },
      claim.id,
      claim.epoch,
      10,
      'profile',
    ),
    'claim_not_owned',
  );
  await expectCode(
    async () => await fixture.service.renew(
      { ...gemini, revoked: true },
      claim.id,
      claim.epoch,
      10,
      'revoked',
    ),
    'runtime_revoked',
  );
  fixture.setNow(10_001);
  await expectCode(
    async () => await fixture.service.renew(gemini, claim.id, claim.epoch, 10, 'expired-principal'),
    'credential_expired',
  );
});

test('model retries require retryable lineage and limit violations remain durable', async () => {
  const fixture = await harness();
  const claim = await fixture.service.claim(
    gemini,
    fixture.packet.id,
    fixture.packet.digest,
    fixture.receipt.id,
    100,
    'claim-model',
  );
  await expectCode(
    async () => await fixture.service.recordInteraction(gemini, {
      packetId: fixture.packet.id,
      turn: 1,
      attempt: 2,
      requestDigest: 'bad-retry',
      outcome: 'refused',
      retryLineage: fixture.interaction.id,
      idempotencyKey: 'bad-retry',
    }),
    'model_call_limit_exceeded',
  );
  assert.equal((await fixture.repository.getClaim(claim.id))?.status, 'violated');
  await expectCode(
    async () => await fixture.service.claim(
      gemini,
      fixture.packet.id,
      fixture.packet.digest,
      fixture.receipt.id,
      100,
      'violated-same-packet',
    ),
    'fresh_consumption_required',
  );

  const fresh = await harness();
  const priorClaim = await fresh.service.claim(
    gemini,
    fresh.packet.id,
    fresh.packet.digest,
    fresh.receipt.id,
    5,
    'limit-prior-claim',
  );
  fresh.setNow(106);
  const packet = await fresh.service.createPacket(
    gemini,
    fresh.window.id,
    fresh.assignment,
    'packet-limit',
    2,
    priorClaim.id,
  );
  await expectCode(
    async () => await fresh.service.recordInteraction(gemini, {
      packetId: packet.id,
      turn: 1,
      attempt: 1,
      requestDigest: 'duplicate-across-version',
      responseDigest: 'duplicate-across-version-response',
      outcome: 'consumed',
      idempotencyKey: 'duplicate-across-version',
    }),
    'duplicate_model_attempt',
  );
  const consumed = await fresh.service.recordInteraction(gemini, {
    packetId: packet.id,
    turn: 2,
    attempt: 1,
    requestDigest: 'limit-2-1',
    responseDigest: 'limit-2-1-response',
    outcome: 'consumed',
    idempotencyKey: 'limit-2-1',
  });
  const consumedReceipt = await fresh.service.recordOutcomeReceipt(
    gemini,
    packet.id,
    packet.digest,
    consumed.id,
    'limit-receipt',
  );
  const freshClaim = await fresh.service.claim(
    gemini,
    packet.id,
    packet.digest,
    consumedReceipt.id,
    100,
    'claim-limit',
  );
  for (const turn of [3, 4]) {
    const first = await fresh.service.recordInteraction(gemini, {
      packetId: packet.id,
      turn,
      attempt: 1,
      requestDigest: `limit-${turn}-1`,
      outcome: 'retryable_provider_error',
      responseDigest: `limit-${turn}-1-response`,
      idempotencyKey: `limit-${turn}-1`,
    });
    await fresh.service.recordInteraction(gemini, {
      packetId: packet.id,
      turn,
      attempt: 2,
      requestDigest: `limit-${turn}-2`,
      outcome: 'refused',
      responseDigest: `limit-${turn}-2-response`,
      retryLineage: first.id,
      idempotencyKey: `limit-${turn}-2`,
    });
  }
assert.equal((await fresh.repository.interactionsForAssignment(packet)).length, 6);
  await expectCode(
    async () => await fresh.service.recordInteraction(gemini, {
      packetId: packet.id,
      turn: 5,
      attempt: 1,
      requestDigest: 'limit-5-1',
      outcome: 'refused',
      idempotencyKey: 'limit-5-1',
    }),
    'model_call_limit_exceeded',
  );
  assert.equal((await fresh.repository.getClaim(freshClaim.id))?.status, 'violated');
  assert(
    fresh.repository.snapshots().claimEvents.some(
      (event) => event.claimId === freshClaim.id && event.kind === 'violated',
    ),
  );
});

test('execution and completion are bound to runtime, envelope, epoch, and live claim', async () => {
  const fixture = await harness();
  const claim = await fixture.service.claim(
    gemini,
    fixture.packet.id,
    fixture.packet.digest,
    fixture.receipt.id,
    100,
    'claim-execute',
  );
  await expectCode(
    async () => await fixture.service.execute(
      { ...gemini, runtimeRegistrationId: 'other-runtime' },
      claim.id,
      envelope,
      'cross-runtime-execute',
    ),
    'claim_not_owned',
  );
  await expectCode(
    async () => await fixture.service.execute(
      gemini,
      claim.id,
      { ...envelope, argv: ['rm', '-rf', '/'] },
      'bad-envelope',
    ),
    'execution_envelope_mismatch',
  );
  assert.equal((await fixture.repository.getClaim(claim.id))?.status, 'violated');

  const fresh = await harness();
  const freshClaim = await fresh.service.claim(
    gemini,
    fresh.packet.id,
    fresh.packet.digest,
    fresh.receipt.id,
    100,
    'claim-epoch',
  );
  const oldExecution = await fresh.service.execute(
    gemini,
    freshClaim.id,
    envelope,
    'old-execution',
  );
  await expectCode(
    async () => await fresh.service.renew(gemini, freshClaim.id, freshClaim.epoch, 100, 'renew-epoch'),
    'execution_already_recorded',
  );
  await fresh.repository.saveClaim({
    ...freshClaim,
    epoch: freshClaim.epoch + 1,
    credentialId: gemini.credentialId,
    expiresAt: 10_000,
  });
  await expectCode(
    async () => await fresh.service.complete(
      gemini,
      oldExecution.id,
      digestCanonical(oldExecution),
      'stale-completion',
    ),
    'claim_epoch_stale',
  );
  await expectCode(
    async () => await fresh.service.complete(gemini, 'forged', 'forged', 'forged-completion'),
    'completion_mismatch',
  );

  const expiredExecute = await harness();
  const expiredExecuteClaim = await expiredExecute.service.claim(
    gemini,
    expiredExecute.packet.id,
    expiredExecute.packet.digest,
    expiredExecute.receipt.id,
    5,
    'claim-expired-execute',
  );
  expiredExecute.setNow(106);
  await expectCode(
    async () => await expiredExecute.service.execute(
      gemini,
      expiredExecuteClaim.id,
      envelope,
      'expired-execute',
    ),
    'claim_expired',
  );

  const expiredComplete = await harness();
  const expiredCompleteClaim = await expiredComplete.service.claim(
    gemini,
    expiredComplete.packet.id,
    expiredComplete.packet.digest,
    expiredComplete.receipt.id,
    5,
    'claim-expired-complete',
  );
  const expiredExecution = await expiredComplete.service.execute(
    gemini,
    expiredCompleteClaim.id,
    envelope,
    'before-expiry-execute',
  );
  expiredComplete.setNow(106);
  await expectCode(
    async () => await expiredComplete.service.complete(
      gemini,
      expiredExecution.id,
      digestCanonical(expiredExecution),
      'expired-complete',
    ),
    'claim_expired',
  );
});

test('terminal claims require a fresh packet and packet identity is digest-bound', async () => {
  const fixture = await harness();
  const claim = await fixture.service.claim(
    gemini,
    fixture.packet.id,
    fixture.packet.digest,
    fixture.receipt.id,
    100,
    'terminal-claim',
  );
  const execution = await fixture.service.execute(
    gemini,
    claim.id,
    envelope,
    'terminal-execution',
  );
  await fixture.service.complete(
    gemini,
    execution.id,
    digestCanonical(execution),
    'terminal-completion',
  );
  await expectCode(
    async () => await fixture.service.claim(
      gemini,
      fixture.packet.id,
      fixture.packet.digest,
      fixture.receipt.id,
      100,
      'terminal-reclaim',
    ),
    'fresh_consumption_required',
  );
  await expectCode(
    async () => await fixture.service.createPacket(
      gemini,
      fixture.window.id,
      fixture.assignment,
      'duplicate-version',
      1,
    ),
    'packet_version_conflict',
  );
  const { digest, ...signedPacket } = fixture.packet;
  assert.equal(digestCanonical(signedPacket), digest);
  assert.notEqual(
    digestCanonical({ ...signedPacket, id: 'different-packet-id' }),
    digest,
  );
});

test('authentication failures use distinct stable error codes', async () => {
  const fixture = await harness();
  await expectCode(
    async () => await fixture.service.createPacket(
      { ...gemini, actor: 'daniela' },
      fixture.window.id,
      fixture.assignment,
      'wrong-actor',
      2,
    ),
    'actor_mismatch',
  );
  await expectCode(
    async () => await fixture.service.createPacket(
      { ...gemini, capabilities: [] },
      fixture.window.id,
      fixture.assignment,
      'missing-capability',
      2,
    ),
    'capability_required',
  );
  await expectCode(
    async () => await fixture.service.createPacket(
      { ...gemini, runtimeEnabled: false },
      fixture.window.id,
      fixture.assignment,
      'disabled-runtime',
      2,
    ),
    'runtime_disabled',
  );
  await expectCode(
    async () => await fixture.service.createPacket(
      { ...gemini, credentialExpiresAt: 100 },
      fixture.window.id,
      fixture.assignment,
      'expired-credential',
      2,
    ),
    'credential_expired',
  );
});

test('verification rejects unsupported, executor, assignment author, and bad evidence', async () => {
  const fixture = await harness('luca-replit');
  const claim = await fixture.service.claim(
    gemini,
    fixture.packet.id,
    fixture.packet.digest,
    fixture.receipt.id,
    100,
    'claim-verify',
  );
  const execution = await fixture.service.execute(gemini, claim.id, envelope, 'execute-verify');
  const completion = await fixture.service.complete(
    gemini,
    execution.id,
    digestCanonical(execution),
    'complete-verify',
  );
  await expectCode(
    async () => await fixture.service.verify(
      { ...replitVerifier, actor: 'daniela' },
      completion.id,
      completion.evidenceDigest,
      null,
      'unsupported-verifier',
    ),
    'verifier_not_allowed',
  );
  await expectCode(
    async () => await fixture.service.verify(
      replitVerifier,
      completion.id,
      completion.evidenceDigest,
      null,
      'assigner-verifier',
    ),
    'assigner_verification_denied',
  );
  await expectCode(
    async () => await fixture.service.verify(
      { ...claudeVerifier, runtimeRegistrationId: gemini.runtimeRegistrationId },
      completion.id,
      completion.evidenceDigest,
      null,
      'executor-verifier',
    ),
    'self_verification_denied',
  );
  await expectCode(
    async () => await fixture.service.verify(
      claudeVerifier,
      completion.id,
      'wrong',
      null,
      'wrong-evidence',
    ),
    'verification_digest_mismatch',
  );
  assert.equal(
    (await fixture.service.verify(
      claudeVerifier,
      completion.id,
      completion.evidenceDigest,
      null,
      'valid-verifier',
    )).decision,
    'approved',
  );
});

test('every mutation family replays exactly and rejects changed payloads', async () => {
  const fixture = await harness();
  assert.equal(
    (await fixture.service.createPacket(
      gemini,
      fixture.window.id,
      fixture.assignment,
      'packet-key',
    )).id,
    fixture.packet.id,
  );
  assert.equal(
    (await fixture.service.recordInteraction(gemini, {
      packetId: fixture.packet.id,
      turn: 1,
      attempt: 1,
      requestDigest: 'request-digest',
      responseDigest: 'response-digest',
      outcome: 'consumed',
       normalizedEvidence: {
         textParts: [], intents: [], validatedIntents: [], additionalCandidateHashes: [],
         providerDetails: {}, normalizedResponseDigest: 'response-digest',
       },
      idempotencyKey: 'interaction-key',
    })).id,
    fixture.interaction.id,
  );
  assert.equal(
    (await fixture.service.recordOutcomeReceipt(
      gemini,
      fixture.packet.id,
      fixture.packet.digest,
      fixture.interaction.id,
      'receipt-key',
    )).id,
    fixture.receipt.id,
  );
  const claim = await fixture.service.claim(
    gemini,
    fixture.packet.id,
    fixture.packet.digest,
    fixture.receipt.id,
    100,
    'claim-idem',
  );
  assert.equal(
    (await fixture.service.claim(
      gemini,
      fixture.packet.id,
      fixture.packet.digest,
      fixture.receipt.id,
      100,
      'claim-idem',
    )).id,
    claim.id,
  );
  const renewed = await fixture.service.renew(
    gemini,
    claim.id,
    claim.epoch,
    100,
    'renew-idem',
  );
  assert.equal(
    (await fixture.service.renew(
      gemini,
      claim.id,
      claim.epoch,
      100,
      'renew-idem',
    )).epoch,
    renewed.epoch,
  );
  const execution = await fixture.service.execute(
    gemini,
    renewed.id,
    envelope,
    'execution-idem',
  );
  assert.equal(
    (await fixture.service.execute(
      gemini,
      renewed.id,
      envelope,
      'execution-idem',
    )).id,
    execution.id,
  );
  const completion = await fixture.service.complete(
    gemini,
    execution.id,
    digestCanonical(execution),
    'completion-idem',
  );
  assert.equal(
    (await fixture.service.complete(
      gemini,
      execution.id,
      digestCanonical(execution),
      'completion-idem',
    )).id,
    completion.id,
  );
  const verification = await fixture.service.verify(
    replitVerifier,
    completion.id,
    completion.evidenceDigest,
    null,
    'verification-idem',
  );
  assert.equal(
    (await fixture.service.verify(
      replitVerifier,
      completion.id,
      completion.evidenceDigest,
      null,
      'verification-idem',
    )).id,
    verification.id,
  );
  await expectCode(
    async () => await fixture.service.claim(
      gemini,
      fixture.packet.id,
      fixture.packet.digest,
      fixture.receipt.id,
      99,
      'claim-idem',
    ),
    'idempotency_payload_mismatch',
  );
  await expectCode(
    async () => await fixture.service.complete(
      gemini,
      execution.id,
      'changed',
      'completion-idem',
    ),
    'idempotency_payload_mismatch',
  );
});

test('invalid provider intent leaves durable rejection evidence and violates the claim', async () => {
  const fixture = await harness();
  const claim = await fixture.service.claim(
    gemini, fixture.packet.id, fixture.packet.digest, fixture.receipt.id, 100, 'invalid-intent-claim',
  );
  await expectCode(
    async () => await fixture.service.recordInteraction(gemini, {
      packetId: fixture.packet.id, turn: 2, attempt: 1,
      requestDigest: digestCanonical('invalid-request'),
      responseDigest: digestCanonical('invalid-response'), outcome: 'consumed',
      normalizedEvidence: {
        textParts: [], intents: [{ name: 'run_test', arguments: { argv: ['rm', '-rf', '/'] }, callId: 'bad-call', candidateIndex: 0, executionEligible: true }],
        validatedIntents: [], additionalCandidateHashes: [], providerDetails: {},
        normalizedResponseDigest: digestCanonical('invalid-response'),
      },
      idempotencyKey: 'invalid-intent',
    }), 'malformed_function_call',
  );
  assert.equal((await fixture.repository.getClaim(claim.id))?.status, 'violated');
  const rejected = (await fixture.repository.interactionsForPacket(fixture.packet.id))
    .find((interaction) => interaction.normalizedEvidence?.providerDetails.rejected === true);
  assert(rejected);
  assert.equal(rejected?.normalizedEvidence?.intents.length, 0);
  assert.equal((rejected?.normalizedEvidence as any)?.rejectedIntents?.[0]?.callId, 'bad-call');
});