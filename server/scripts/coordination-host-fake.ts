import {
  validateHostEnvelope,
  type HostEnvelope,
  type HostBinding,
} from '../services/coordination-host-protocol';
import type { HostOperationAdapter } from '../services/coordination-host-operation-service';
import { createHash } from 'node:crypto';
import { canonicalJson } from '../services/coordination-runtime';

export type FakeHostOptions = {
  adapter: HostOperationAdapter;
  now?: () => number;
  maxResultBytes?: number;
};

function digest(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');
}

/**
 * Deterministic in-process host.  It consumes only a coordinator-issued
 * operation_claim envelope and returns evidence under the exact same binding.
 * It has no persistence shortcut and cannot manufacture an authorization
 * binding.
 */
export class CoordinationHostFake {
  private readonly now: () => number;
  private readonly maxResultBytes: number;
  constructor(private readonly options: FakeHostOptions) {
    this.now = options.now ?? Date.now;
    this.maxResultBytes = options.maxResultBytes ?? 32 * 1024;
  }

  async execute(claim: unknown): Promise<HostEnvelope<'structured_result'>> {
    const envelope = validateHostEnvelope(claim, { now: this.now() });
    if (envelope.kind !== 'operation_claim') throw new Error('HOST_FAKE_EXPECTED_OPERATION_CLAIM');
    const payload = envelope.payload as Record<string, unknown>;
    const binding = payload.binding as HostBinding;
    const result = await this.options.adapter.execute({
      operation: binding.operation,
      operationDigest: binding.operationDigest!,
      input: {},
    });
    const resultDigest = digest(result);
    if (Buffer.byteLength(canonicalJson(result), 'utf8') > this.maxResultBytes) {
      throw new Error('HOST_FAKE_RESULT_BYTES_EXCEEDED');
    }
    const issuedAt = new Date(this.now()).toISOString();
    const expiresAt = new Date(this.now() + 30_000).toISOString();
    // Deliberately use the protocol constructor through a small local import
    // boundary to keep the fake's output identical to a real host response.
    const { createHostEnvelope } = await import('../services/coordination-host-protocol');
    return createHostEnvelope('structured_result', { binding, result, resultDigest }, {
      requestId: `${envelope.requestId}:result`,
      correlationId: envelope.correlationId,
      issuedAt,
      expiresAt,
    });
  }
}

export function createDeterministicFakeHost(adapter: HostOperationAdapter, now?: () => number): CoordinationHostFake {
  return new CoordinationHostFake({ adapter, now });
}