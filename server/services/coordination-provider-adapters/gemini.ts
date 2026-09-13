import { createHash } from 'node:crypto';
import {
  canonicalJson,
  isPlainRecord,
  RuntimeProtocolError,
  type InheritancePacket,
  type NormalizedOutcome,
} from '../coordination-runtime';
import {
  createRawArgumentsEvidence,
  type ProviderAdapterDescriptor,
  type RawArgumentsEvidence,
  type ProviderLimits,
} from './types';

export const COORDINATION_GEMINI_MODEL = 'gemini-3-flash-preview';
export const COORDINATION_GEMINI_ADAPTER_VERSION = 'coordination-gemini-v1';

export type GeminiTransport = (request: {
  url: string;
  headers: Record<string, string>;
  body: string;
  signal?: AbortSignal;
}) => Promise<{ status: number; body: string }>;

export type NormalizedToolIntent = {
  name: string;
  operation: string;
  arguments: unknown;
  rawArguments: RawArgumentsEvidence;
  callId: string;
  candidateIndex: 0;
  executionEligible: boolean;
};

export type GeminiTurnResult = {
  outcome: NormalizedOutcome;
  requestBytes: string;
  requestDigest: string;
  normalizedResponseBytes: string;
  responseDigest: string;
  intents: NormalizedToolIntent[];
  textParts: string[];
  additionalCandidateHashes: string[];
  providerDetails: Record<string, unknown>;
  usage?: Record<string, unknown>;
};

const retryable = new Set([408, 409, 425, 429, 500, 502, 503, 504]);
const knownTools = new Set(['git_status', 'git_diff', 'run_test', 'read_file', 'replace_once']);
const MAX_REQUEST_BYTES = 48_000;
const MAX_RESPONSE_BYTES = 64_000;
const MAX_ARGUMENT_BYTES = 40_960;
const MAX_INTENTS = 8;

function sha(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function safeJson(value: unknown): string {
  try { return canonicalJson(value); } catch { return '{"malformed":true}'; }
}

function boundedJson(value: unknown, limit: number): string {
  const full = safeJson(value);
  if (Buffer.byteLength(full, 'utf8') <= limit) return full;
  return safeJson({
    truncated: true,
    fullDigest: sha(full),
    fullByteLength: Buffer.byteLength(full, 'utf8'),
  });
}

function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.length > 20_000 ? `${value.slice(0, 20_000)}...[truncated]` : value;
  if (Array.isArray(value)) return value.slice(0, 100).map((entry) => sanitize(entry, depth + 1));
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !/token|secret|password|api.?key|credential/i.test(key))
      .map(([key, entry]) => [key, sanitize(entry, depth + 1)]));
  }
  return null;
}

function operationFor(name: string): string {
  return name === 'git_diff' || name === 'read_file' ? 'fixed-target' :
    name === 'run_test' ? 'fixed-test' :
      name === 'replace_once' ? 'fixed-target-replace-once' : name;
}

function executionEligible(name: string, args: unknown): boolean {
  if (!isPlainRecord(args)) return false;
  const keys = Object.keys(args).sort();
  if ((name === 'git_status' || name === 'git_diff' || name === 'run_test') && keys.length === 0) return true;
  if (name === 'read_file') {
    return keys.length === 0 || (
      keys.length === 1 && keys[0] === 'path' &&
      args.path === 'server/scripts/test-coordination-runtime.test.ts'
    );
  }
  return name === 'replace_once' && keys.join(',') === 'newText,oldText' &&
    typeof args.oldText === 'string' && typeof args.newText === 'string' &&
    args.oldText.length > 0 && args.oldText !== args.newText &&
    Buffer.byteLength(args.oldText, 'utf8') + Buffer.byteLength(args.newText, 'utf8') <= MAX_ARGUMENT_BYTES;
}

function rawArgumentEvidence(value: unknown): { evidence: RawArgumentsEvidence; persistedValue: unknown } {
  const full = createRawArgumentsEvidence(value);
  if (full.fullByteLength <= MAX_ARGUMENT_BYTES) return { evidence: full, persistedValue: value };
  // Do not cut a JSON string at an arbitrary byte boundary. A valid marker
  // carries the complete digest and size while keeping persisted evidence
  // bounded and explicitly non-authorizing.
  const marker = {
    truncated: true,
    fullDigest: full.sha256,
    fullByteLength: full.fullByteLength,
  };
  const canonicalUtf8 = canonicalJson(marker);
  return {
    evidence: Object.freeze({
      parsedValue: Object.freeze(marker),
      canonicalUtf8,
      sha256: sha(canonicalUtf8),
      truncated: true,
      fullByteLength: full.fullByteLength,
      fullDigest: full.sha256,
    }),
    persistedValue: marker,
  };
}

export function buildPacketBoundGeminiRequest(packet: InheritancePacket, priorToolResults: unknown[] = []): {
  bytes: string;
  digest: string;
} {
  const request = {
    contents: [{ role: 'user', parts: [
      { text: `[INHERITANCE_PACKET]\n${canonicalJson(packet)}` },
      ...(priorToolResults.length ? [{ text: `[TOOL_RESULTS]\n${canonicalJson(priorToolResults.map((result) => sanitize(result)))}` }] : []),
    ] }],
    tools: [{ functionDeclarations: [...knownTools].sort().map((name) => ({
      name, description: `Bounded coordinator tool: ${name}`,
      parameters: name === 'replace_once'
        ? {
          type: 'OBJECT',
          properties: { oldText: { type: 'STRING' }, newText: { type: 'STRING' } },
          required: ['oldText', 'newText'],
        }
        : { type: 'OBJECT', properties: {} },
    })) }],
  };
  const bytes = canonicalJson(request);
  return { bytes, digest: sha(bytes) };
}

function normalized(value: unknown, callSeed = ''): {
  outcome: NormalizedOutcome;
  intents: NormalizedToolIntent[];
  textParts: string[];
  additionalCandidateHashes: string[];
  usage?: Record<string, unknown>;
  providerDetails: Record<string, unknown>;
} {
  if (!value || typeof value !== 'object') return { outcome: 'unsupported_provider_outcome', intents: [], textParts: [], additionalCandidateHashes: [], providerDetails: {} };
  const root = value as Record<string, any>;
  const candidates = Array.isArray(root.candidates) ? root.candidates : [];
  const additionalCandidateHashes = candidates.slice(1).map((candidate: unknown) =>
    sha(safeJson(sanitize(candidate))));
  if (root.promptFeedback?.blockReason || root.blockReason) {
    return { outcome: 'safety_blocked', intents: [], textParts: [], additionalCandidateHashes, providerDetails: { blockReason: root.promptFeedback?.blockReason ?? root.blockReason } };
  }
  if (!candidates.length) return { outcome: 'empty_response', intents: [], textParts: [], additionalCandidateHashes, providerDetails: {} };
  const first = candidates[0];
  if (!first || typeof first !== 'object') return { outcome: 'unsupported_provider_outcome', intents: [], textParts: [], additionalCandidateHashes, providerDetails: {} };
  if (first.finishReason === 'SAFETY' || first.finishReason === 'BLOCKLIST') return { outcome: 'safety_blocked', intents: [], textParts: [], additionalCandidateHashes, providerDetails: { finishReason: first.finishReason } };
  if (first.finishReason === 'MAX_TOKENS') return { outcome: 'context_limit', intents: [], textParts: [], additionalCandidateHashes, providerDetails: { finishReason: first.finishReason } };
  if (first.finishReason === 'RECITATION') return { outcome: 'refused', intents: [], textParts: [], additionalCandidateHashes, providerDetails: { finishReason: first.finishReason } };
  const parts = first.content?.parts;
  if (!Array.isArray(parts)) return { outcome: 'unsupported_provider_outcome', intents: [], textParts: [], additionalCandidateHashes, providerDetails: {} };
  const calls: NormalizedToolIntent[] = [];
  const textParts: string[] = [];
  let usable = false;
  for (let partIndex = 0; partIndex < parts.length; partIndex += 1) {
    const part = parts[partIndex];
    if (typeof part.text === 'string' && part.text.length) { usable = true; textParts.push(part.text); }
    if (part.functionCall !== undefined) {
      const call = part.functionCall;
      if (!call || typeof call.name !== 'string' || !call.name.length ||
          call.args === undefined || (call.id !== undefined && typeof call.id !== 'string')) {
        return { outcome: 'malformed_function_call', intents: [], textParts: [], additionalCandidateHashes, providerDetails: {} };
      }
      const captured = rawArgumentEvidence(call.args);
      const callId = call.id ?? sha(`${callSeed}:${partIndex}:${call.name}:${captured.evidence.fullDigest ?? captured.evidence.sha256}`);
      const eligible = !captured.evidence.truncated && executionEligible(call.name, call.args);
      const intent: NormalizedToolIntent = {
        name: call.name, operation: operationFor(call.name),
        arguments: captured.persistedValue, rawArguments: captured.evidence,
        callId, candidateIndex: 0, executionEligible: eligible,
      };
      if (calls.some((item) => item.callId === callId)) {
        return { outcome: 'malformed_function_call', intents: [], textParts: [], additionalCandidateHashes, providerDetails: {} };
      }
      calls.push(intent);
      if (!eligible) return { outcome: 'malformed_function_call', intents: calls, textParts: [], additionalCandidateHashes, providerDetails: {} };
      usable = true;
    } else if (part.text === undefined) {
      return { outcome: 'unsupported_provider_outcome', intents: [], textParts: [], additionalCandidateHashes, providerDetails: {} };
    }
  }
  return {
    outcome: usable ? 'consumed' : 'empty_response', intents: calls, textParts,
    additionalCandidateHashes, usage: root.usageMetadata,
    providerDetails: {
      finishReason: first.finishReason,
      ...(calls.some((call) => !((first.content?.parts ?? []).find((part: any) => part.functionCall?.id === call.callId)))
        ? { serverDerivedCallIds: calls.map((call) => call.callId) } : {}),
    },
  };
}

export class CoordinationGeminiAdapter {
  private readonly apiKey: string;
  private readonly endpointUrl: string;

  constructor(
    private readonly transport: GeminiTransport,
    apiKey: string | undefined = process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
    baseUrl: string | undefined = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
    private readonly maxAttempts = 2,
  ) {
    if (!apiKey) throw new Error('AI_INTEGRATIONS_GEMINI_API_KEY is not configured');
    if (!baseUrl) throw new Error('AI_INTEGRATIONS_GEMINI_BASE_URL is not configured');
    let parsedBaseUrl: URL;
    try { parsedBaseUrl = new URL(baseUrl); } catch { throw new Error('AI_INTEGRATIONS_GEMINI_BASE_URL is invalid'); }
    if (!['http:', 'https:'].includes(parsedBaseUrl.protocol) || parsedBaseUrl.username ||
        parsedBaseUrl.password || parsedBaseUrl.search || parsedBaseUrl.hash) {
      throw new Error('AI_INTEGRATIONS_GEMINI_BASE_URL must be a credential-free HTTP(S) base URL');
    }
    this.apiKey = apiKey;
    this.endpointUrl = `${baseUrl.replace(/\/+$/, '')}/models/${COORDINATION_GEMINI_MODEL}:generateContent`;
  }

  async turn(packet: InheritancePacket, turn: number, priorToolResults: unknown[] = [], signal?: AbortSignal): Promise<GeminiTurnResult[]> {
    if (!Number.isInteger(turn) || turn < 1 || turn > 4) {
      throw new RuntimeProtocolError('model_call_limit_exceeded', 'Model turn is outside the approved limit');
    }
    const request = buildPacketBoundGeminiRequest(packet, priorToolResults);
    const requestBytes = request.bytes;
    const requestDigest = request.digest;
    if (Buffer.byteLength(requestBytes, 'utf8') > MAX_REQUEST_BYTES) {
      const boundedRequestBytes = safeJson({
        truncated: true,
        fullDigest: requestDigest,
        fullByteLength: Buffer.byteLength(requestBytes, 'utf8'),
      });
      const normalizedResponseBytes = boundedJson({ outcome: 'terminal_provider_error', failure: 'limit_exhausted', requestBytes: Buffer.byteLength(requestBytes, 'utf8'), retainedBytes: MAX_REQUEST_BYTES }, MAX_RESPONSE_BYTES);
      return [{
        outcome: 'terminal_provider_error', requestBytes: boundedRequestBytes, requestDigest: sha(boundedRequestBytes),
        normalizedResponseBytes, responseDigest: sha(normalizedResponseBytes), intents: [], textParts: [],
        additionalCandidateHashes: [], providerDetails: { failure: 'limit_exhausted', requestBytes: Buffer.byteLength(requestBytes, 'utf8') },
      }];
    }
    const results: GeminiTurnResult[] = [];
    const attemptLimit = Math.max(1, Math.min(this.maxAttempts, 2));
    for (let attempt = 1; attempt <= attemptLimit; attempt += 1) {
      let status = 0;
      try {
        const response = await this.transport({
          url: this.endpointUrl, headers: { 'content-type': 'application/json', 'x-goog-api-key': this.apiKey },
          body: requestBytes, signal,
        });
        status = response.status;
        const responseByteLength = Buffer.byteLength(response.body, 'utf8');
        if (responseByteLength > MAX_RESPONSE_BYTES) {
          const normalizedResponseBytes = boundedJson({ outcome: 'terminal_provider_error', failure: 'limit_exhausted', status, responseBytes: responseByteLength, retainedBytes: MAX_RESPONSE_BYTES }, MAX_RESPONSE_BYTES);
          results.push({ outcome: 'terminal_provider_error', requestBytes, requestDigest, normalizedResponseBytes, responseDigest: sha(normalizedResponseBytes), intents: [], textParts: [], additionalCandidateHashes: [], providerDetails: { status, failure: 'limit_exhausted', responseBytes: responseByteLength } });
          break;
        }
        if (status < 200 || status >= 300) {
          const outcome: NormalizedOutcome = status === 401 || status === 403 ? 'terminal_provider_error' : retryable.has(status) ? 'retryable_provider_error' : 'terminal_provider_error';
          const normalizedResponseBytes = boundedJson({ status, outcome }, MAX_RESPONSE_BYTES);
          results.push({ outcome, requestBytes, requestDigest, normalizedResponseBytes, responseDigest: sha(normalizedResponseBytes), intents: [], textParts: [], additionalCandidateHashes: [], providerDetails: { status, failure: status === 401 || status === 403 ? 'authentication_failed' : status === 429 ? 'rate_limited' : retryable.has(status) ? 'provider_outage' : 'terminal_rejection' } });
          if (!retryable.has(status)) break;
          continue;
        }
        let parsed: unknown;
        try { parsed = JSON.parse(response.body); } catch {
          const normalizedResponseBytes = '{"outcome":"unsupported_provider_outcome"}';
          results.push({ outcome: 'unsupported_provider_outcome', requestBytes, requestDigest, normalizedResponseBytes, responseDigest: sha(normalizedResponseBytes), intents: [], textParts: [], additionalCandidateHashes: [], providerDetails: { status } });
          break;
        }
        const result = normalized(parsed, `${requestDigest}:1:0`);
        if (result.intents.length > MAX_INTENTS) {
          const normalizedResponseBytes = boundedJson({ outcome: 'terminal_provider_error', failure: 'limit_exhausted', intentCount: result.intents.length, retainedIntents: MAX_INTENTS }, MAX_RESPONSE_BYTES);
          results.push({ outcome: 'terminal_provider_error', requestBytes, requestDigest, normalizedResponseBytes, responseDigest: sha(normalizedResponseBytes), intents: result.intents.slice(0, MAX_INTENTS), textParts: result.textParts, additionalCandidateHashes: result.additionalCandidateHashes, providerDetails: { ...result.providerDetails, failure: 'limit_exhausted', intentCount: result.intents.length } });
          break;
        }
        const normalizedResponseBytes = boundedJson({ outcome: result.outcome, intents: result.intents, textParts: result.textParts, additionalCandidateHashes: result.additionalCandidateHashes, providerDetails: result.providerDetails, ...(result.usage ? { usage: result.usage } : {}) }, MAX_RESPONSE_BYTES);
        results.push({ ...result, requestBytes, requestDigest, normalizedResponseBytes, responseDigest: sha(normalizedResponseBytes) });
        break;
      } catch {
        const outcome: NormalizedOutcome = signal?.aborted ? 'interrupted' : 'retryable_provider_error';
        const normalizedResponseBytes = safeJson({ outcome, transport: true });
        results.push({ outcome, requestBytes, requestDigest, normalizedResponseBytes, responseDigest: sha(normalizedResponseBytes), intents: [], textParts: [], additionalCandidateHashes: [], providerDetails: { transport: true } });
        if (outcome === 'interrupted' || attempt === attemptLimit) break;
      }
    }
    return results;
  }
}

export const GeminiProviderAdapter = CoordinationGeminiAdapter;
export const GeminiAdapter = CoordinationGeminiAdapter;

export const GEMINI_PROVIDER_DESCRIPTOR: ProviderAdapterDescriptor = Object.freeze({
  provider: 'gemini',
  model: COORDINATION_GEMINI_MODEL,
  adapterVersion: COORDINATION_GEMINI_ADAPTER_VERSION,
  supportedOperations: Object.freeze(['git_status', 'git_diff', 'run_test', 'read_file', 'replace_once']),
  limits: Object.freeze({
    maxRequestBytes: MAX_REQUEST_BYTES, maxResponseBytes: MAX_RESPONSE_BYTES,
    maxIntents: MAX_INTENTS, maxArgumentBytes: MAX_ARGUMENT_BYTES,
    maxInputTokens: 32_000, maxOutputTokens: 4_096,
  } satisfies ProviderLimits),
});
export const COORDINATION_GEMINI_DESCRIPTOR = GEMINI_PROVIDER_DESCRIPTOR;
export const GEMINI_DESCRIPTOR = GEMINI_PROVIDER_DESCRIPTOR;