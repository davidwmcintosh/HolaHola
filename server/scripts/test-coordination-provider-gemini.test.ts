import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import {
  GeminiProviderAdapter,
  GEMINI_PROVIDER_DESCRIPTOR,
} from '../services/coordination-provider-adapters/gemini';
import {
  DEFAULT_PROVIDER_REGISTRY,
  CoordinationProviderRegistry,
  selectNextProvider,
} from '../services/coordination-provider-adapters/registry';
import { requestedProvidersHaveRegisteredDescriptors } from '../services/coordination-session-service';

const packet = {
  id: 'gemini-test-packet', version: 1, actor: 'luca-gemini' as const,
  runtimeRegistrationId: 'runtime', profileId: 'profile', createdAt: 1,
  supersedesClaimId: null, windowId: 'window', windowDigest: 'window-digest',
  orderedInboxItemIds: [], orderedEventIds: [], orderedThreadIds: [],
  assignment: {
    assignmentEventId: 'event', assignmentAuthor: 'alden' as const,
    taskId: '1448', threadId: 'thread', expectedSequence: 1,
  },
  inherited: [], envelope: {
    worktreeLabel: 'worktree', worktreePath: '/worktree',
    argv: ['true'], patchDigest: null,
  }, digest: 'packet-digest',
};

function adapter(body: unknown, status = 200) {
  return new GeminiProviderAdapter(
    async () => ({ status, body: JSON.stringify(body) }),
    'test-key',
    'https://gemini.example.test',
  );
}

test('Gemini decodes text and the first candidate only', async () => {
  const result = (await adapter({
    candidates: [
      { finishReason: 'STOP', content: { parts: [{ text: 'hello' }] } },
      { content: { parts: [{ text: 'not authoritative' }] } },
    ],
  }).turn(packet, 1))[0];
  assert.equal(result.outcome, 'consumed');
  assert.deepEqual(result.textParts, ['hello']);
  assert.equal(result.additionalCandidateHashes.length, 1);
  assert.match(result.additionalCandidateHashes[0], /^[0-9a-f]{64}$/);
});

test('Gemini retains exact raw arguments and fixed-target eligibility', async () => {
  const args = { path: 'server/scripts/test-coordination-runtime.test.ts' };
  const result = (await adapter({
    candidates: [{ content: { parts: [{ functionCall: { name: 'read_file', id: 'call-1', args } }] } }],
  }).turn(packet, 1))[0];
  const intent = result.intents[0];
  assert.equal(result.outcome, 'consumed');
  assert.equal(intent.executionEligible, true);
  assert.deepEqual(intent.rawArguments?.parsedValue, args);
  assert.equal(intent.rawArguments.canonicalUtf8, '{"path":"server/scripts/test-coordination-runtime.test.ts"}');
  assert.equal(intent.rawArguments.sha256, createHash('sha256').update(intent.rawArguments.canonicalUtf8, 'utf8').digest('hex'));

  const serverDerived = (await adapter({
    candidates: [{ content: { parts: [{ functionCall: { name: 'read_file', id: 'call-2', args: {} } }] } }],
  }).turn(packet, 1))[0];
  assert.equal(serverDerived.outcome, 'consumed');
  assert.equal(serverDerived.intents[0]?.executionEligible, true);
});

test('Gemini retains malformed arguments but marks them ineligible', async () => {
  const result = (await adapter({
    candidates: [{ content: { parts: [{ functionCall: { name: 'read_file', id: 'bad', args: [] } }] } }],
  }).turn(packet, 1))[0];
  assert.equal(result.outcome, 'malformed_function_call');
  assert.equal(result.intents[0]?.executionEligible, false);
  assert.deepEqual(result.intents[0]?.rawArguments.parsedValue, []);
});

test('Gemini maps status failures and bounds retries', async () => {
  let calls = 0;
  const result = await new GeminiProviderAdapter(
    async () => { calls += 1; return { status: 429, body: '{}' }; },
    'test-key',
    'https://gemini.example.test',
    9,
  ).turn(packet, 1);
  assert.equal(calls, 2);
  assert.equal(result.length, 2);
  assert.equal(result[0].outcome, 'retryable_provider_error');
  assert.equal(result[0].providerDetails.failure, 'rate_limited');
});

test('Gemini maps auth, outage, safety, context, refusal, and malformed responses', async () => {
  for (const [status, expected, failure] of [
    [401, 'terminal_provider_error', 'authentication_failed'],
    [403, 'terminal_provider_error', 'authentication_failed'],
    [503, 'retryable_provider_error', 'provider_outage'],
  ] as const) {
    const result = (await adapter({}, status).turn(packet, 1))[0];
    assert.equal(result.outcome, expected);
    assert.equal(result.providerDetails.failure, failure);
  }
  for (const [body, expected] of [
    [{ promptFeedback: { blockReason: 'SAFETY' } }, 'safety_blocked'],
    [{ candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [] } }] }, 'context_limit'],
    [{ candidates: [{ finishReason: 'RECITATION', content: { parts: [] } }] }, 'refused'],
    [{ candidates: [{ content: {} }] }, 'unsupported_provider_outcome'],
  ] as const) {
    assert.equal((await adapter(body).turn(packet, 1))[0].outcome, expected);
  }
  const invalidJson = new GeminiProviderAdapter(
    async () => ({ status: 200, body: '{not-json' }),
    'test-key', 'https://gemini.example.test',
  );
  assert.equal((await invalidJson.turn(packet, 1))[0].outcome, 'unsupported_provider_outcome');
});

test('Gemini rejects duplicate calls and disallowed fixed-target echoes', async () => {
  const duplicate = (await adapter({
    candidates: [{ content: { parts: [
      { functionCall: { name: 'git_status', id: 'same', args: {} } },
      { functionCall: { name: 'git_status', id: 'same', args: {} } },
    ] } }],
  }).turn(packet, 1))[0];
  assert.equal(duplicate.outcome, 'malformed_function_call');
  const disallowed = (await adapter({
    candidates: [{ content: { parts: [{
      functionCall: { name: 'read_file', id: 'other', args: { path: 'server/routes.ts' } },
    }] } }],
  }).turn(packet, 1))[0];
  assert.equal(disallowed.outcome, 'malformed_function_call');
  assert.equal(disallowed.intents[0]?.executionEligible, false);
});

test('Gemini bounds response, argument, intent, and request evidence', async () => {
  const oversizedResponse = await new GeminiProviderAdapter(
    async () => ({ status: 200, body: `{"candidates":[]}${' '.repeat(70_000)}` }),
    'test-key', 'https://gemini.example.test',
  ).turn(packet, 1);
  assert.equal(oversizedResponse[0].providerDetails.failure, 'limit_exhausted');
  const oversizedArguments = (await adapter({
    candidates: [{ content: { parts: [{ functionCall: {
      name: 'read_file', id: 'large', args: { path: 'x'.repeat(50_000) },
    } }] } }],
  }).turn(packet, 1))[0];
  assert.equal(oversizedArguments.outcome, 'malformed_function_call');
  assert.equal(oversizedArguments.intents[0]?.executionEligible, false);
  assert.equal(oversizedArguments.intents[0]?.rawArguments?.truncated, true);
  assert.equal(oversizedArguments.intents[0]?.rawArguments?.canonicalUtf8.includes('�'), false);

  const parts = Array.from({ length: 9 }, (_, index) => ({
    functionCall: { name: 'git_status', id: `call-${index}`, args: {} },
  }));
  const tooManyIntents = (await adapter({ candidates: [{ content: { parts } }] }).turn(packet, 1))[0];
  assert.equal(tooManyIntents.outcome, 'terminal_provider_error');
  assert.equal(tooManyIntents.providerDetails.failure, 'limit_exhausted');

  const requestBound = await adapter({ candidates: [] }).turn({
    ...packet, inherited: [{ text: 'z'.repeat(60_000) }],
  }, 1);
  assert.equal(requestBound[0].providerDetails.failure, 'limit_exhausted');
  assert(Buffer.byteLength(requestBound[0].requestBytes, 'utf8') <= 48_000);
});

test('additional candidate hashes are deterministic and selection honors classification history', async () => {
  const body = {
    candidates: [
      { content: { parts: [{ text: 'first' }] } },
      { content: { parts: [{ text: 'second' }] } },
    ],
  };
  const one = (await adapter(body).turn(packet, 1))[0];
  const two = (await adapter(body).turn(packet, 1))[0];
  assert.deepEqual(one.additionalCandidateHashes, two.additionalCandidateHashes);

  const policy = {
    providerOrder: ['gemini', 'other'], totalAttemptBudget: 4,
    providerAttemptBudgets: { gemini: 2, other: 2 },
    fallbackEligibleFailureClasses: ['terminal_rejection'],
  };
  const same = selectNextProvider([{
    attemptId: 'a', provider: 'gemini', model: GEMINI_PROVIDER_DESCRIPTOR.model,
    adapterVersion: GEMINI_PROVIDER_DESCRIPTOR.adapterVersion, ordinal: 1,
    classification: 'fresh_attempt_same_provider', terminalReason: 'provider_outage',
  }], policy, DEFAULT_PROVIDER_REGISTRY);
  assert.equal(same.ok, true);
  if (same.ok) assert.equal(same.descriptor.provider, 'gemini');
  assert.equal(selectNextProvider([{
    attemptId: 'a', provider: 'gemini', model: GEMINI_PROVIDER_DESCRIPTOR.model,
    adapterVersion: GEMINI_PROVIDER_DESCRIPTOR.adapterVersion, ordinal: 1,
    classification: 'resume_transport',
  }], policy, DEFAULT_PROVIDER_REGISTRY).ok, false);
});

test('default registry exposes only the exact live Gemini descriptor', () => {
  assert.deepEqual(DEFAULT_PROVIDER_REGISTRY.list(), [GEMINI_PROVIDER_DESCRIPTOR]);
  const policy = {
    providerOrder: ['gemini'], totalAttemptBudget: 2,
    providerConstraints: {
      gemini: {
        models: [GEMINI_PROVIDER_DESCRIPTOR.model],
        adapterVersions: [GEMINI_PROVIDER_DESCRIPTOR.adapterVersion],
      },
    },
  };
  const selected = selectNextProvider([], policy, DEFAULT_PROVIDER_REGISTRY);
  assert.equal(selected.ok, true);
  const empty = new CoordinationProviderRegistry();
  assert.equal(selectNextProvider([], policy, empty).ok, false);
  assert.equal(requestedProvidersHaveRegisteredDescriptors(['gemini'], policy), true);
  assert.equal(requestedProvidersHaveRegisteredDescriptors(['openai'], {
    ...policy, providerOrder: ['openai'],
  }), false);
});