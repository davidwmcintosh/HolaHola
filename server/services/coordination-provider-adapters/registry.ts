import {
  freezeProviderValue,
  type ProviderAttemptRecord,
  type ProviderAdapterDescriptor,
  type ProviderDescriptorKey,
  type ProviderPolicyConstraint,
  type ProviderSelection,
  type ProviderSelectionPolicy,
} from './types';
import {
  GEMINI_PROVIDER_DESCRIPTOR,
} from './gemini';

export type ProviderRegistryErrorCode =
  | 'duplicate_registration'
  | 'invalid_descriptor'
  | 'unknown_descriptor'
  | 'policy_disallowed_provider'
  | 'policy_disallowed_model'
  | 'policy_disallowed_adapter_version';

export class ProviderRegistryError extends Error {
  readonly code: ProviderRegistryErrorCode;
  readonly key: string;

  constructor(code: ProviderRegistryErrorCode, key: string) {
    super(`${code}:${key}`);
    this.name = 'ProviderRegistryError';
    this.code = code;
    this.key = key;
  }
}

export function providerDescriptorKey(key: ProviderDescriptorKey): string {
  return `${key.provider}\u0000${key.model}\u0000${key.adapterVersion}`;
}

const IDENTIFIER = /^[a-zA-Z][a-zA-Z0-9._:-]{0,127}$/;

function validPositiveBound(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function validateDescriptor(descriptor: ProviderAdapterDescriptor): void {
  if (!descriptor || typeof descriptor !== 'object' || Array.isArray(descriptor)) {
    throw new ProviderRegistryError('invalid_descriptor', 'descriptor');
  }
  const descriptorKeys = Object.keys(descriptor);
  if (!descriptor || !IDENTIFIER.test(descriptor.provider)
    || !IDENTIFIER.test(descriptor.model) || !IDENTIFIER.test(descriptor.adapterVersion)
    || descriptorKeys.some((key) => !['provider', 'model', 'adapterVersion', 'supportedOperations', 'limits'].includes(key))
    || !Array.isArray(descriptor.supportedOperations)
    || descriptor.supportedOperations.length === 0
    || new Set(descriptor.supportedOperations).size !== descriptor.supportedOperations.length
    || descriptor.supportedOperations.some((operation) => !IDENTIFIER.test(operation))) {
    throw new ProviderRegistryError('invalid_descriptor', 'descriptor');
  }
  const limits = descriptor.limits;
  const limitKeys = limits ? Object.keys(limits) : [];
  if (!limits
    || limitKeys.some((key) => ![
      'maxRequestBytes', 'maxResponseBytes', 'maxIntents', 'maxArgumentBytes',
      'maxInputTokens', 'maxOutputTokens',
    ].includes(key))
    || limitKeys.length !== 6
    || Object.values(limits).some((value) => !validPositiveBound(value))) {
    throw new ProviderRegistryError('invalid_descriptor', providerDescriptorKey(descriptor));
  }
}

function constraintFor(policy: ProviderSelectionPolicy, provider: string): ProviderPolicyConstraint | undefined {
  return policy.providerConstraints?.[provider];
}

export function descriptorAllowedByPolicy(
  descriptor: ProviderAdapterDescriptor,
  policy: ProviderSelectionPolicy,
): boolean {
  if (!policy.providerOrder.includes(descriptor.provider)) return false;
  const constraint = constraintFor(policy, descriptor.provider);
  if (constraint?.models && !constraint.models.includes(descriptor.model)) return false;
  if (constraint?.adapterVersions && !constraint.adapterVersions.includes(descriptor.adapterVersion)) return false;
  return true;
}

export class CoordinationProviderRegistry {
  private readonly descriptors = new Map<string, ProviderAdapterDescriptor>();

  register(descriptor: ProviderAdapterDescriptor): this {
    validateDescriptor(descriptor);
    const key = providerDescriptorKey(descriptor);
    if (this.descriptors.has(key)) throw new ProviderRegistryError('duplicate_registration', key);
    this.descriptors.set(key, freezeProviderValue({
      ...descriptor,
      supportedOperations: [...descriptor.supportedOperations],
      limits: { ...descriptor.limits },
    }));
    return this;
  }

  get(key: ProviderDescriptorKey): ProviderAdapterDescriptor {
    const descriptor = this.descriptors.get(providerDescriptorKey(key));
    if (!descriptor) throw new ProviderRegistryError('unknown_descriptor', providerDescriptorKey(key));
    return descriptor;
  }

  resolve(key: ProviderDescriptorKey, policy: ProviderSelectionPolicy): ProviderAdapterDescriptor {
    const descriptor = this.get(key);
    if (!policy.providerOrder.includes(descriptor.provider)) {
      throw new ProviderRegistryError('policy_disallowed_provider', providerDescriptorKey(key));
    }
    const constraint = constraintFor(policy, descriptor.provider);
    if (constraint?.models && !constraint.models.includes(descriptor.model)) {
      throw new ProviderRegistryError('policy_disallowed_model', providerDescriptorKey(key));
    }
    if (constraint?.adapterVersions && !constraint.adapterVersions.includes(descriptor.adapterVersion)) {
      throw new ProviderRegistryError('policy_disallowed_adapter_version', providerDescriptorKey(key));
    }
    return descriptor;
  }

  list(): readonly ProviderAdapterDescriptor[] {
    return Object.freeze([...this.descriptors.values()]);
  }

  descriptorsForProvider(provider: string): readonly ProviderAdapterDescriptor[] {
    return Object.freeze([...this.descriptors.values()].filter((descriptor) => descriptor.provider === provider));
  }
}

/**
 * Coordinator V2 deliberately ships one live adapter.  Other providers may
 * still appear in policy fixtures, but cannot become executable until a
 * descriptor and adapter are registered explicitly.
 */
export function createDefaultProviderRegistry(): CoordinationProviderRegistry {
  return new CoordinationProviderRegistry().register(GEMINI_PROVIDER_DESCRIPTOR);
}

export const DEFAULT_PROVIDER_REGISTRY = createDefaultProviderRegistry();
export const defaultProviderRegistry = DEFAULT_PROVIDER_REGISTRY;
export const DEFAULT_GEMINI_PROVIDER_REGISTRY = DEFAULT_PROVIDER_REGISTRY;
export const createGeminiProviderRegistry = createDefaultProviderRegistry;

/**
 * Selects a fresh provider from the complete attempt history.  This function
 * only reads policy, descriptors, and history; it does not create an attempt
 * or perform persistence.
 */
export function selectNextProvider(
  history: readonly ProviderAttemptRecord[],
  policy: ProviderSelectionPolicy,
  registry: CoordinationProviderRegistry,
): ProviderSelection {
  if (history.length >= policy.totalAttemptBudget) {
    return freezeProviderValue({ ok: false as const, reason: 'attempt_budget_exhausted' as const });
  }

  const latest = history.reduce<ProviderAttemptRecord | null>((current, attempt) => {
    if (!current || attempt.ordinal >= current.ordinal) return attempt;
    return current;
  }, null);
  const latestIndex = latest ? policy.providerOrder.indexOf(latest.provider) : -1;
  if (latest && latestIndex < 0) {
    return freezeProviderValue({ ok: false as const, reason: 'provider_fallback_not_allowed' as const });
  }

  const sameProviderRetry = latest?.classification === 'fresh_attempt_same_provider';
  if (sameProviderRetry && latest) {
    const providerBudget = policy.providerAttemptBudgets?.[latest.provider] ?? policy.totalAttemptBudget;
    const providerAttempts = history.filter((attempt) => attempt.provider === latest.provider).length;
    if (providerAttempts >= providerBudget) {
      return freezeProviderValue({ ok: false as const, reason: 'provider_budget_exhausted' as const });
    }
    let descriptor: ProviderAdapterDescriptor;
    try {
      descriptor = registry.resolve({
        provider: latest.provider,
        model: latest.model,
        adapterVersion: latest.adapterVersion,
      }, policy);
    } catch {
      return freezeProviderValue({ ok: false as const, reason: 'unknown_descriptor' as const });
    }
    return freezeProviderValue({
      ok: true as const,
      descriptor,
      provenance: {
        reason: 'next_provider' as const,
        selectedProviderOrderIndex: latestIndex,
        priorAttemptIds: history.map((attempt) => attempt.attemptId),
        consideredProviders: [latest.provider],
        previousAttemptId: latest.attemptId,
        previousProvider: latest.provider,
        previousClassification: latest.classification ?? null,
      },
    });
  }

  if (latest?.classification === 'resume_transport') {
    return freezeProviderValue({ ok: false as const, reason: 'provider_fallback_not_allowed' as const });
  }
  if (latest?.classification === 'terminal_failure' && latest.terminalReason
      && !policy.fallbackEligibleFailureClasses?.includes(latest.terminalReason)) {
    return freezeProviderValue({ ok: false as const, reason: 'provider_fallback_not_allowed' as const });
  }
  if (latest?.classification === 'terminal_failure' && !latest.terminalReason) {
    return freezeProviderValue({ ok: false as const, reason: 'provider_fallback_not_allowed' as const });
  }

  const start = latest ? latestIndex + 1 : 0;
  const consideredProviders = policy.providerOrder.slice(start);
  let sawKnownProvider = false;
  let sawBudgetExhaustion = false;

  for (let index = start; index < policy.providerOrder.length; index += 1) {
    const provider = policy.providerOrder[index];
    const providerAttempts = history.filter((attempt) => attempt.provider === provider).length;
    const providerBudget = policy.providerAttemptBudgets?.[provider] ?? policy.totalAttemptBudget;
    if (providerAttempts >= providerBudget) {
      sawBudgetExhaustion = true;
      continue;
    }

    const descriptors = registry.descriptorsForProvider(provider)
      .filter((descriptor) => descriptorAllowedByPolicy(descriptor, policy));
    if (descriptors.length === 0) continue;
    sawKnownProvider = true;

    const descriptor = descriptors[0];
    return freezeProviderValue({
      ok: true as const,
      descriptor,
      provenance: {
        reason: latest ? 'next_provider' as const : 'initial' as const,
        selectedProviderOrderIndex: index,
        priorAttemptIds: history.map((attempt) => attempt.attemptId),
        consideredProviders,
        ...(latest ? {
          previousAttemptId: latest.attemptId,
          previousProvider: latest.provider,
          previousClassification: latest.classification ?? null,
        } : {}),
      },
    });
  }

  if (sawBudgetExhaustion && !sawKnownProvider) {
    return freezeProviderValue({ ok: false as const, reason: 'provider_budget_exhausted' as const });
  }
  if (sawBudgetExhaustion && latest) {
    return freezeProviderValue({ ok: false as const, reason: 'provider_budget_exhausted' as const });
  }
  return freezeProviderValue({
    ok: false as const,
    reason: latest ? 'provider_fallback_not_allowed' as const : 'unknown_descriptor' as const,
  });
}

export const ProviderAdapterRegistry = CoordinationProviderRegistry;
export const ProviderRegistry = CoordinationProviderRegistry;
export const createProviderRegistry = (): CoordinationProviderRegistry => new CoordinationProviderRegistry();