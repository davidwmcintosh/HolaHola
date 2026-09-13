import { createHash } from 'node:crypto';

/**
 * The policy document is deliberately a small, boring data language.  Do not
 * add an escape hatch (for example an arbitrary `metadata` member) here:
 * policy documents are authority, rather than configuration supplied to a
 * provider.
 */
export const POLICY_FIELDS = [
  'hostTypes',
  'hostConstraints',
  'tools',
  'paths',
  'commands',
  'providerOrder',
  'providerConstraints',
  'sessionDurationMs',
  'totalAttemptBudget',
  'perProviderAttemptBudgets',
  'transportLeaseDurationMs',
  'executionLeaseDurationMs',
  'retryableFailureClasses',
  'fallbackEligibleFailureClasses',
  'terminalFailureClasses',
  'requiredValidationCommands',
  'requiredCompletionEvidence',
  'credentialCapabilities',
  'maxCredentialLifetimeMs',
  'cleanupRequirements',
] as const;

export type CoordinationPolicyInput = Record<string, unknown>;
export type CanonicalCoordinationPolicy = Readonly<Record<string, unknown>>;

export type PolicyValidationCode =
  | 'policy_not_object'
  | 'policy_unknown_field'
  | 'policy_secret_field'
  | 'policy_invalid_string'
  | 'policy_invalid_array'
  | 'policy_invalid_map'
  | 'policy_invalid_provider_order'
  | 'policy_invalid_tool'
  | 'policy_invalid_path'
  | 'policy_invalid_command'
  | 'policy_invalid_duration'
  | 'policy_invalid_budget'
  | 'policy_provider_budget_mismatch';

export class PolicyValidationError extends Error {
  readonly code: PolicyValidationCode;
  readonly field?: string;

  constructor(code: PolicyValidationCode, field?: string) {
    super(field ? `${code}:${field}` : code);
    this.name = 'PolicyValidationError';
    this.code = code;
    this.field = field;
  }
}

const MAX_ARRAY = 64;
const MAX_MAP = 64;
const MAX_STRING = 255;
const MAX_POLICY_BYTES = 48_000;
const SECRET_KEY = /(?:secret|password|credential|private[_-]?key|access[_-]?token|api[_-]?key|bearer|authorization|refresh[_-]?token|client[_-]?secret|pem|cookie|passphrase)/i;
const PROVIDER = /^[a-z][a-z0-9_-]{0,79}$/;
const ACTOR_OR_CAPABILITY = /^[A-Za-z][A-Za-z0-9:_./-]{0,127}$/;
const FAILURE_CLASS = /^[a-z][a-z0-9_-]{0,39}$/;
const PATH = /^[A-Za-z0-9_./\\:*?${}[\]-]{1,255}$/;
const SAFE_COMMAND = /^[A-Za-z0-9_./\\:@%${}[\](),=+*? \t-]{1,255}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function rejectSecretKey(key: string): void {
  if (SECRET_KEY.test(key)) throw new PolicyValidationError('policy_secret_field', key);
}

function assertString(value: unknown, field: string, pattern?: RegExp): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_STRING || value.trim() !== value) {
    throw new PolicyValidationError('policy_invalid_string', field);
  }
  if (pattern && !pattern.test(value)) throw new PolicyValidationError('policy_invalid_string', field);
  return value;
}

function stringArray(value: unknown, field: string, pattern?: RegExp): string[] {
  if (!Array.isArray(value) || value.length > MAX_ARRAY) {
    throw new PolicyValidationError('policy_invalid_array', field);
  }
  const values = value.map((item, index) => assertString(item, `${field}[${index}]`, pattern));
  if (new Set(values).size !== values.length) throw new PolicyValidationError('policy_invalid_array', field);
  return values;
}

function number(value: unknown, field: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) {
    throw new PolicyValidationError(field.includes('Duration') || field.includes('duration')
      ? 'policy_invalid_duration'
      : 'policy_invalid_budget', field);
  }
  return value;
}

function mapOfNumbers(value: unknown, field: string, min: number, max: number): Record<string, number> {
  if (!isRecord(value) || Object.keys(value).length > MAX_MAP) {
    throw new PolicyValidationError('policy_invalid_map', field);
  }
  const result: Record<string, number> = {};
  for (const [key, item] of Object.entries(value)) {
    assertString(key, `${field}.${key}`, PROVIDER);
    result[key] = number(item, field, min, max);
  }
  return result;
}

function boundedMap(value: unknown, field: string): Record<string, unknown> {
  if (!isRecord(value) || Object.keys(value).length > MAX_MAP) {
    throw new PolicyValidationError('policy_invalid_map', field);
  }
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    rejectSecretKey(key);
    assertString(key, `${field}.${key}`);
    if (isRecord(item) || Array.isArray(item)) {
      throw new PolicyValidationError('policy_invalid_map', `${field}.${key}`);
    }
    result[key] = item;
  }
  return result;
}

function tools(value: unknown): unknown[] {
  if (!Array.isArray(value) || value.length > MAX_ARRAY) throw new PolicyValidationError('policy_invalid_tool', 'tools');
  return value.map((item, index) => {
    if (typeof item === 'string') return assertString(item, `tools[${index}]`, ACTOR_OR_CAPABILITY);
    if (!isRecord(item)) throw new PolicyValidationError('policy_invalid_tool', `tools[${index}]`);
    const keys = Object.keys(item);
    keys.forEach(rejectSecretKey);
    if (keys.some((key) => !['name', 'operations'].includes(key))) {
      throw new PolicyValidationError('policy_invalid_tool', `tools[${index}]`);
    }
    if (!('name' in item)) throw new PolicyValidationError('policy_invalid_tool', `tools[${index}]`);
    const tool: Record<string, unknown> = {
      name: assertString(item.name, `tools[${index}].name`, ACTOR_OR_CAPABILITY),
    };
    if (item.operations !== undefined) {
      tool.operations = stringArray(item.operations, `tools[${index}].operations`, ACTOR_OR_CAPABILITY);
    }
    return tool;
  });
}

function commands(value: unknown): unknown[] {
  if (!Array.isArray(value) || value.length > MAX_ARRAY) throw new PolicyValidationError('policy_invalid_command', 'commands');
  return value.map((item, index) => {
    if (typeof item === 'string') return assertString(item, `commands[${index}]`, SAFE_COMMAND);
    if (!isRecord(item)) throw new PolicyValidationError('policy_invalid_command', `commands[${index}]`);
    const keys = Object.keys(item);
    keys.forEach(rejectSecretKey);
    if (keys.some((key) => !['name', 'template', 'timeoutMs'].includes(key)) || !('name' in item) || !('template' in item)) {
      throw new PolicyValidationError('policy_invalid_command', `commands[${index}]`);
    }
    const command: Record<string, unknown> = {
      name: assertString(item.name, `commands[${index}].name`, ACTOR_OR_CAPABILITY),
      template: assertString(item.template, `commands[${index}].template`, SAFE_COMMAND),
    };
    if (SECRET_KEY.test(command.template as string)) {
      throw new PolicyValidationError('policy_secret_field', `commands[${index}].template`);
    }
    if (item.timeoutMs !== undefined) command.timeoutMs = number(item.timeoutMs, 'command.timeoutMs', 1, 86_400_000);
    return command;
  });
}

function paths(value: unknown): string[] {
  const values = stringArray(value, 'paths', PATH);
  for (const value of values) {
    const normalized = value.replaceAll('\\', '/');
    if (normalized.split('/').includes('..') || normalized.startsWith('~') || normalized.includes('\0')) {
      throw new PolicyValidationError('policy_invalid_path', 'paths');
    }
  }
  return values;
}

function providerConstraints(value: unknown): Record<string, unknown> {
  if (!isRecord(value) || Object.keys(value).length > MAX_MAP) {
    throw new PolicyValidationError('policy_invalid_map', 'providerConstraints');
  }
  const result: Record<string, unknown> = {};
  for (const [provider, raw] of Object.entries(value)) {
    assertString(provider, `providerConstraints.${provider}`, PROVIDER);
    if (!isRecord(raw)) throw new PolicyValidationError('policy_invalid_map', `providerConstraints.${provider}`);
    Object.keys(raw).forEach(rejectSecretKey);
    const allowed = ['models', 'adapterVersions'];
    if (Object.keys(raw).some((key) => !allowed.includes(key))) {
      throw new PolicyValidationError('policy_unknown_field', `providerConstraints.${provider}`);
    }
    const constraint: Record<string, unknown> = {};
    if (raw.models !== undefined) constraint.models = stringArray(raw.models, `${provider}.models`, ACTOR_OR_CAPABILITY);
    if (raw.adapterVersions !== undefined) constraint.adapterVersions = stringArray(raw.adapterVersions, `${provider}.adapterVersions`, ACTOR_OR_CAPABILITY);
    result[provider] = constraint;
  }
  return result;
}

function canonicalizeValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalizeValue);
  if (!isRecord(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalizeValue(value[key])]));
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalizeValue(value));
}

export function canonicalizePolicy(input: unknown): CanonicalCoordinationPolicy {
  if (!isRecord(input) || Object.getPrototypeOf(input) !== Object.prototype) {
    throw new PolicyValidationError('policy_not_object');
  }
  for (const key of Object.keys(input)) rejectSecretKey(key);
  const unknown = Object.keys(input).find((key) => !(POLICY_FIELDS as readonly string[]).includes(key));
  if (unknown) throw new PolicyValidationError('policy_unknown_field', unknown);

  const output: Record<string, unknown> = {};
  if (input.hostTypes !== undefined) output.hostTypes = stringArray(input.hostTypes, 'hostTypes', ACTOR_OR_CAPABILITY);
  if (input.hostConstraints !== undefined) output.hostConstraints = boundedMap(input.hostConstraints, 'hostConstraints');
  if (input.tools !== undefined) output.tools = tools(input.tools);
  if (input.paths !== undefined) output.paths = paths(input.paths);
  if (input.commands !== undefined) output.commands = commands(input.commands);
  if (input.providerOrder !== undefined) {
    const providerOrder = stringArray(input.providerOrder, 'providerOrder', PROVIDER);
    output.providerOrder = providerOrder;
    if (providerOrder.length === 0) throw new PolicyValidationError('policy_invalid_provider_order', 'providerOrder');
  } else {
    throw new PolicyValidationError('policy_invalid_provider_order', 'providerOrder');
  }
  if (input.providerConstraints !== undefined) {
    const constraints = providerConstraints(input.providerConstraints);
    for (const provider of Object.keys(constraints)) {
      if (!(output.providerOrder as string[]).includes(provider)) {
        throw new PolicyValidationError('policy_invalid_provider_order', provider);
      }
    }
    output.providerConstraints = constraints;
  }
  output.sessionDurationMs = number(input.sessionDurationMs, 'sessionDurationMs', 1_000, 7 * 24 * 60 * 60 * 1_000);
  output.totalAttemptBudget = number(input.totalAttemptBudget, 'totalAttemptBudget', 1, 100);
  if (input.perProviderAttemptBudgets !== undefined) {
    output.perProviderAttemptBudgets = mapOfNumbers(input.perProviderAttemptBudgets, 'perProviderAttemptBudgets', 1, 100);
    for (const provider of Object.keys(output.perProviderAttemptBudgets as object)) {
      if (!(output.providerOrder as string[]).includes(provider)) {
        throw new PolicyValidationError('policy_provider_budget_mismatch', provider);
      }
      if ((output.perProviderAttemptBudgets as Record<string, number>)[provider] > (output.totalAttemptBudget as number)) {
        throw new PolicyValidationError('policy_invalid_budget', `perProviderAttemptBudgets.${provider}`);
      }
    }
  }
  if (input.transportLeaseDurationMs !== undefined) output.transportLeaseDurationMs = number(input.transportLeaseDurationMs, 'transportLeaseDurationMs', 1_000, 24 * 60 * 60 * 1_000);
  if (input.executionLeaseDurationMs !== undefined) output.executionLeaseDurationMs = number(input.executionLeaseDurationMs, 'executionLeaseDurationMs', 1_000, 24 * 60 * 60 * 1_000);
  for (const field of ['retryableFailureClasses', 'fallbackEligibleFailureClasses', 'terminalFailureClasses'] as const) {
    if (input[field] !== undefined) output[field] = stringArray(input[field], field, FAILURE_CLASS);
  }
  if (input.requiredValidationCommands !== undefined) output.requiredValidationCommands = stringArray(input.requiredValidationCommands, 'requiredValidationCommands', ACTOR_OR_CAPABILITY);
  if (input.requiredCompletionEvidence !== undefined) output.requiredCompletionEvidence = stringArray(input.requiredCompletionEvidence, 'requiredCompletionEvidence', ACTOR_OR_CAPABILITY);
  if (input.credentialCapabilities !== undefined) output.credentialCapabilities = stringArray(input.credentialCapabilities, 'credentialCapabilities', ACTOR_OR_CAPABILITY);
  if (input.maxCredentialLifetimeMs !== undefined) output.maxCredentialLifetimeMs = number(input.maxCredentialLifetimeMs, 'maxCredentialLifetimeMs', 1_000, 7 * 24 * 60 * 60 * 1_000);
  if (input.cleanupRequirements !== undefined) output.cleanupRequirements = stringArray(input.cleanupRequirements, 'cleanupRequirements', ACTOR_OR_CAPABILITY);

  const canonical = canonicalizeValue(output) as CanonicalCoordinationPolicy;
  if (Buffer.byteLength(canonicalJson(canonical), 'utf8') > MAX_POLICY_BYTES) {
    throw new PolicyValidationError('policy_invalid_map', 'policy');
  }
  return Object.freeze(canonical);
}

export function hashCanonicalPolicy(policy: unknown): string {
  return createHash('sha256').update(canonicalJson(policy), 'utf8').digest('hex');
}

export function canonicalizeAndHashPolicy(input: unknown): {
  readonly canonicalPolicy: CanonicalCoordinationPolicy;
  readonly policyDigest: string;
} {
  const canonicalPolicy = canonicalizePolicy(input);
  return { canonicalPolicy, policyDigest: hashCanonicalPolicy(canonicalPolicy) };
}

/** Stable public names used by policy-authoring and test callers. */
export const validatePolicy = canonicalizePolicy;
export const canonicalizePolicyDocument = canonicalizePolicy;
export const computePolicyDigest = hashCanonicalPolicy;
