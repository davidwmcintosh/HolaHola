import { createHash } from 'node:crypto';

/**
 * The provider adapter boundary is intentionally a small, provider-neutral
 * vocabulary.  Provider SDK values must be decoded before they cross this
 * boundary; neither policy nor host code needs to understand an SDK shape.
 */

export type ProviderRole = 'system' | 'user' | 'assistant' | 'tool';

export type ProviderMessage = Readonly<{
  role: ProviderRole;
  text: string;
}>;

export type RawArgumentsEvidence = Readonly<{
  /** The parsed value, retained exactly only when truncated is false. */
  parsedValue: unknown;
  /** Canonical JSON retained as a valid UTF-8 string. */
  canonicalUtf8: string;
  /** SHA-256 of the retained canonicalUtf8 bytes. */
  sha256: string;
  /** True when canonicalUtf8 is bounded evidence rather than the full value. */
  truncated: boolean;
  /** Full canonical byte length before bounding. */
  fullByteLength: number;
  /** Digest of the full canonical value when truncated. */
  fullDigest?: string;
}>;

export type NormalizedIntent = Readonly<{
  callId: string;
  name: string;
  operation: string;
  arguments: unknown;
  rawArguments: RawArgumentsEvidence;
  candidateIndex: number;
  executionEligible: boolean;
}>;

export type AuthorizedOperation = Readonly<{
  operation: string;
  arguments: RawArgumentsEvidence;
}>;

export type ProviderRequest = Readonly<{
  requestId: string;
  model: string;
  messages: readonly ProviderMessage[];
  operations: readonly AuthorizedOperation[];
  maxOutputTokens?: number;
}>;

export type UsageMetadata = Readonly<{
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedInputTokens?: number;
}>;

export type ProviderResultBase = Readonly<{
  textParts: readonly string[];
  intents: readonly NormalizedIntent[];
  usage?: UsageMetadata;
  normalizedResponseDigest: string;
}>;

export type ProviderContinuationResult = ProviderResultBase & Readonly<{
  kind: 'continuation';
}>;

export type ProviderFinalResult = ProviderResultBase & Readonly<{
  kind: 'final';
  resultCode: string;
}>;

export type ProviderResult = ProviderContinuationResult | ProviderFinalResult;

export type ProviderLimits = Readonly<{
  maxRequestBytes: number;
  maxResponseBytes: number;
  maxIntents: number;
  maxArgumentBytes: number;
  maxInputTokens: number;
  maxOutputTokens: number;
}>;

export type ProviderAdapterDescriptor = Readonly<{
  provider: string;
  model: string;
  adapterVersion: string;
  supportedOperations: readonly string[];
  limits: ProviderLimits;
}>;
export type ProviderDescriptor = ProviderAdapterDescriptor;
export type NormalizedProviderIntent = NormalizedIntent;
export type ProviderUsageMetadata = UsageMetadata;

export type ProviderDescriptorKey = Readonly<{
  provider: string;
  model: string;
  adapterVersion: string;
}>;

export type ProviderPolicyConstraint = Readonly<{
  models?: readonly string[];
  adapterVersions?: readonly string[];
}>;

/**
 * This is the subset of canonical policy consumed by provider selection.
 * It contains identifiers and budgets only: no credentials and no provider
 * request/response payloads.
 */
export type ProviderSelectionPolicy = Readonly<{
  providerOrder: readonly string[];
  providerConstraints?: Readonly<Record<string, ProviderPolicyConstraint>>;
  fallbackEligibleFailureClasses?: readonly string[];
  totalAttemptBudget: number;
  providerAttemptBudgets?: Readonly<Record<string, number>>;
}>;

export type ProviderAttemptRecord = Readonly<{
  attemptId: string;
  provider: string;
  model: string;
  adapterVersion: string;
  ordinal: number;
  classification?: string | null;
  terminalReason?: string | null;
}>;

export type SelectionProvenance = Readonly<{
  reason: 'initial' | 'next_provider';
  selectedProviderOrderIndex: number;
  priorAttemptIds: readonly string[];
  consideredProviders: readonly string[];
  previousAttemptId?: string;
  previousProvider?: string;
  previousClassification?: string | null;
}>;

export type ProviderSelection =
  | Readonly<{
      ok: true;
      descriptor: ProviderAdapterDescriptor;
      provenance: SelectionProvenance;
    }>
  | Readonly<{
      ok: false;
      reason:
        | 'attempt_budget_exhausted'
        | 'provider_budget_exhausted'
        | 'provider_fallback_not_allowed'
        | 'unknown_descriptor'
        | 'no_provider_available';
    }>;

function hasUnpairedSurrogate(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (next < 0xdc00 || next > 0xdfff) return true;
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      return true;
    }
  }
  return false;
}

function canonicalize(value: unknown, active: Set<object>): string {
  if (value === null || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'string') {
    if (hasUnpairedSurrogate(value)) throw new TypeError('unpaired Unicode surrogate');
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('non-finite number');
    return JSON.stringify(value);
  }
  if (typeof value !== 'object' || value === undefined) throw new TypeError('unsupported JSON value');
  if (active.has(value)) throw new TypeError('cyclic JSON value');
  active.add(value);
  let result: string;
  if (Array.isArray(value)) {
    result = `[${value.map((item) => canonicalize(item, active)).join(',')}]`;
  } else {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) throw new TypeError('only plain objects are supported');
    const object = value as Record<string, unknown>;
    result = `{${Object.keys(object).sort().map((key) =>
      `${canonicalize(key, active)}:${canonicalize(object[key], active)}`).join(',')}}`;
  }
  active.delete(value);
  return result;
}

export function canonicalProviderJson(value: unknown): string {
  return canonicalize(value, new Set());
}

function freezeDeep<T>(value: T, active = new Set<object>()): T {
  if (value === null || typeof value !== 'object' || active.has(value as object)) return value;
  active.add(value as object);
  for (const child of Object.values(value as object)) freezeDeep(child, active);
  active.delete(value as object);
  return Object.freeze(value);
}

/** Capture evidence without converting or reserializing the parsed arguments. */
export function createRawArgumentsEvidence(parsedValue: unknown): RawArgumentsEvidence {
  const canonicalUtf8 = canonicalProviderJson(parsedValue);
  const sha256 = createHash('sha256').update(canonicalUtf8, 'utf8').digest('hex');
  return freezeDeep({
    parsedValue,
    canonicalUtf8,
    sha256,
    truncated: false,
    fullByteLength: Buffer.byteLength(canonicalUtf8, 'utf8'),
  });
}

export const createRawArgumentEvidence = createRawArgumentsEvidence;

export function createNormalizedIntent(input: {
  readonly callId: string;
  readonly name: string;
  readonly operation: string;
  readonly arguments: unknown;
  readonly candidateIndex?: number;
  readonly executionEligible: boolean;
}): NormalizedIntent {
  return freezeDeep({
    callId: input.callId,
    name: input.name,
    operation: input.operation,
    arguments: input.arguments,
    rawArguments: createRawArgumentsEvidence(input.arguments),
    candidateIndex: input.candidateIndex ?? 0,
    executionEligible: input.executionEligible,
  });
}

export function freezeProviderValue<T>(value: T): T {
  return freezeDeep(value);
}