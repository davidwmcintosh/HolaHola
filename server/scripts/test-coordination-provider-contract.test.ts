import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import {
  createNormalizedIntent,
  createRawArgumentsEvidence,
  type ProviderAdapterDescriptor,
  type ProviderSelectionPolicy,
} from '../services/coordination-provider-adapters/types';
import {
  CoordinationProviderRegistry,
  ProviderRegistryError,
  selectNextProvider,
} from '../services/coordination-provider-adapters/registry';
import { mapProviderFailure } from '../services/coordination-provider-failure';

const geminiResponseShape = {
  candidates: [{ content: { parts: [{ functionCall: { name: 'read_file', args: { path: 'x' } } }] } }],
};
const claudeResponseShape = {
  content: [{ type: 'tool_use', name: 'read_file', input: { path: 'x' } }],
};
const openAiResponseShape = {
  choices: [{ message: { tool_calls: [{ function: { name: 'read_file', arguments: '{"path":"x"}' } }] } }],
};

const descriptor = (provider: string, model = 'model-1', adapterVersion = 'adapter-1'): ProviderAdapterDescriptor => ({
  provider,
  model,
  adapterVersion,
  supportedOperations: ['read_file', 'git_status'],
  limits: {
    maxRequestBytes: 20_000,
    maxResponseBytes: 20_000,
    maxIntents: 4,
    maxArgumentBytes: 4_000,
    maxInputTokens: 8_000,
    maxOutputTokens: 4_000,
  },
});

const policy: ProviderSelectionPolicy = {
  providerOrder: ['gemini', 'claude', 'openai'],
  providerConstraints: {
    gemini: { models: ['model-1'], adapterVersions: ['adapter-1'] },
    claude: { models: ['model-1'], adapterVersions: ['adapter-1'] },
    openai: { models: ['model-1'], adapterVersions: ['adapter-1'] },
  },
  fallbackEligibleFailureClasses: ['terminal_rejection'],
  totalAttemptBudget: 4,
  providerAttemptBudgets: { gemini: 2, claude: 1, openai: 1 },
};

test('native Gemini, Claude, and OpenAI shapes remain opaque at the neutral boundary', () => {
  assert.equal(typeof geminiResponseShape, 'object');
  assert.equal(typeof claudeResponseShape, 'object');
  assert.equal(typeof openAiResponseShape, 'object');
  const intent = createNormalizedIntent({
    callId: 'call-1',
    name: 'read_file',
    operation: 'read_file',
    arguments: { path: 'x' },
    executionEligible: true,
  });
  assert.deepEqual(Object.keys(intent).sort(), [
    'arguments', 'callId', 'candidateIndex', 'executionEligible', 'name', 'operation', 'rawArguments',
  ]);
  assert.equal('candidates' in intent, false);
  assert.equal('content' in intent, false);
  assert.equal('choices' in intent, false);
});

test('raw argument evidence preserves parsed value and canonical UTF-8 digest', () => {
  const parsed = { z: ['á', 2], a: true };
  const evidence = createRawArgumentsEvidence(parsed);
  assert.equal(evidence.parsedValue, parsed);
  assert.equal(evidence.canonicalUtf8, '{"a":true,"z":["á",2]}');
  assert.equal(
    evidence.sha256,
    createHash('sha256').update(evidence.canonicalUtf8, 'utf8').digest('hex'),
  );
  assert.equal(evidence.truncated, false);
  assert.equal(evidence.fullByteLength, Buffer.byteLength(evidence.canonicalUtf8, 'utf8'));
  assert.equal(evidence.fullDigest, undefined);
  assert(Object.isFrozen(evidence));
  assert(Object.isFrozen(parsed));
});

test('registry rejects duplicates, unknown descriptors, and disallowed model/version', () => {
  const registry = new CoordinationProviderRegistry();
  registry.register(descriptor('gemini'));
  assert.throws(
    () => registry.register(descriptor('gemini')),
    (error: unknown) => error instanceof ProviderRegistryError
      && error.code === 'duplicate_registration',
  );
  assert.throws(
    () => registry.get({ provider: 'missing', model: 'model-1', adapterVersion: 'adapter-1' }),
    (error: unknown) => error instanceof ProviderRegistryError
      && error.code === 'unknown_descriptor',
  );
  assert.throws(
    () => registry.resolve({ provider: 'gemini', model: 'model-1', adapterVersion: 'adapter-1' }, {
      ...policy,
      providerConstraints: { gemini: { models: ['other-model'] } },
    }),
    (error: unknown) => error instanceof ProviderRegistryError
      && error.code === 'policy_disallowed_model',
  );
  assert.throws(
    () => registry.resolve({ provider: 'gemini', model: 'model-1', adapterVersion: 'adapter-1' }, {
      ...policy,
      providerConstraints: { gemini: { adapterVersions: ['other-adapter'] } },
    }),
    (error: unknown) => error instanceof ProviderRegistryError
      && error.code === 'policy_disallowed_adapter_version',
  );
});

test('provider failures normalize to stable classification and fallback decisions', () => {
  const envelope = (kind: Parameters<typeof mapProviderFailure>[0]['failure']['kind']) => ({
    provider: 'gemini',
    model: 'model-1',
    adapterVersion: 'adapter-1',
    failure: { kind } as { kind: typeof kind },
  });
  assert.equal(mapProviderFailure(envelope('transport_interrupted')).classification, 'resume_transport');
  assert.equal(mapProviderFailure(envelope('provider_outage')).classification, 'fresh_attempt_same_provider');
  assert.equal(mapProviderFailure(envelope('rate_limited')).classification, 'fresh_attempt_same_provider');
  assert.equal(mapProviderFailure(envelope('limit_exhausted')).classification, 'terminal_failure');
  assert.equal(
    mapProviderFailure(envelope('terminal_rejection'), policy).classification,
    'fresh_attempt_next_provider',
  );
  assert.equal(
    mapProviderFailure(envelope('terminal_rejection')).classification,
    'terminal_failure',
  );
});

test('selection follows full history, policy order, budgets, and immutable provenance', () => {
  const registry = new CoordinationProviderRegistry()
    .register(descriptor('gemini'))
    .register(descriptor('claude'))
    .register(descriptor('openai'));
  const history = [
    { attemptId: 'a-1', provider: 'gemini', model: 'model-1', adapterVersion: 'adapter-1', ordinal: 1 },
    { attemptId: 'a-2', provider: 'claude', model: 'model-1', adapterVersion: 'adapter-1', ordinal: 2 },
  ] as const;
  const next = selectNextProvider(history, policy, registry);
  assert.equal(next.ok, true);
  if (next.ok) {
    assert.equal(next.descriptor.provider, 'openai');
    assert.deepEqual(next.provenance.priorAttemptIds, ['a-1', 'a-2']);
    assert.deepEqual(next.provenance.consideredProviders, ['openai']);
    assert(Object.isFrozen(next));
    assert(Object.isFrozen(next.provenance));
  }
  assert.equal(
    selectNextProvider([...history, {
      attemptId: 'a-3', provider: 'openai', model: 'model-1', adapterVersion: 'adapter-1', ordinal: 3,
    }], policy, registry).ok,
    false,
  );
  assert.equal(
    selectNextProvider([], { ...policy, totalAttemptBudget: 0 }, registry).reason,
    'attempt_budget_exhausted',
  );
});

test('policy and host-normalized operations contain no provider-native keys', () => {
  const normalizedOperation = { operation: 'read_file', arguments: createRawArgumentsEvidence({ path: 'x' }) };
  const forbidden = ['candidates', 'content', 'choices', 'tool_calls', 'functionCall', 'tool_use'];
  for (const key of forbidden) {
    assert.equal(key in policy, false);
    assert.equal(key in normalizedOperation, false);
    assert.equal(key in normalizedOperation.arguments, false);
  }
  assert.deepEqual(Object.keys(normalizedOperation), ['operation', 'arguments']);
});