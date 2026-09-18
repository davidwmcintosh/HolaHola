import { sign } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { canonicalJson } from './task-ownership-service';
import { loadTaskAgentKey, type TaskAgentKey } from './task-ownership-key-custody';

export interface OwnershipHttp {
  request(path: string, init: { method: string; body?: unknown }): Promise<unknown>;
}

export type OwnershipProofResult = {
  ok: true; verified: true; receiptId: string; taskRef: string;
  intendedActor: string; artifactSha256: string; proofPayloadDigest: string; contextDigest: string;
  grant: { id: string; taskRef: string; artifactSha256: string; contextDigest: string; startingCommit: string; expiresAt: string };
};

export class TaskOwnershipHttpClient {
  constructor(
    private readonly baseUrl: string,
    coordinationToken: string,
    private readonly http: OwnershipHttp = fetchHttp(baseUrl, coordinationToken),
  ) {
    if (!/^https?:\/\/[^?#\s]+$/i.test(baseUrl)) throw new Error('A valid task ownership server URL is required.');
    if (coordinationToken.length < 32) throw new Error('A valid coordination token is required.');
  }
  challenge(payload: unknown) { return this.http.request('/api/task-ownership/challenges', { method: 'POST', body: payload }); }
  status(id: string) { return this.http.request(`/api/task-ownership/challenges/${encodeURIComponent(id)}`, { method: 'GET' }); }
  proofNonce(receiptId: string) {
    return this.http.request(`/api/task-ownership/receipts/${encodeURIComponent(receiptId)}/proof-nonce`, { method: 'POST' });
  }
  proof(payload: unknown) { return this.http.request('/api/task-ownership/proof', { method: 'POST', body: payload }); }
}

function fetchHttp(baseUrl: string, coordinationToken: string): OwnershipHttp {
  return {
    async request(path, init) {
      let response: Response;
      try {
        response = await fetch(new URL(path, baseUrl), {
          method: init.method,
           headers: {
             'content-type': 'application/json',
             'x-coordination-token': coordinationToken,
           },
          body: init.body === undefined ? undefined : JSON.stringify(init.body),
        });
      } catch {
        throw new Error('Task ownership endpoint unavailable.');
      }
      if (!response.ok) throw new Error(`Task ownership endpoint unavailable (${response.status}).`);
      try { return await response.json(); } catch { throw new Error('Task ownership endpoint returned malformed JSON.'); }
    },
  };
}

/** RFC-independent canonical JSON: sorted object keys and no insignificant whitespace. */
export function canonicalProofBytes(payload: unknown): Buffer {
  return Buffer.from(canonicalJson(payload), 'utf8');
}

export async function proveTaskOwnership(client: TaskOwnershipHttpClient, taskRef: string, actor: string, receiptId: string): Promise<OwnershipProofResult> {
  const key: TaskAgentKey = await loadTaskAgentKey(taskRef);
  const nonceResponse: any = await client.proofNonce(receiptId);
  if (
    !nonceResponse
    || typeof nonceResponse.nonceId !== 'string'
    || !nonceResponse.signedPayload
    || nonceResponse.signedPayload.taskRef !== taskRef
    || nonceResponse.signedPayload.intendedActor !== actor
    || nonceResponse.signedPayload.receiptId !== receiptId
    || nonceResponse.signedPayload.publicKey !== key.publicKey
    || nonceResponse.signedPayload.keyFingerprint !== key.fingerprint
  ) {
    throw new Error('Malformed proof nonce response.');
  }
  const signature = sign(
    null,
    canonicalProofBytes(nonceResponse.signedPayload),
    await readFile(key.privateKeyPath, 'utf8'),
  ).toString('base64url');
  const result = await client.proof({ nonceId: nonceResponse.nonceId, signature }) as OwnershipProofResult;
  if (!result || result.ok !== true || result.verified !== true || !/^[0-9a-f]{64}$/.test(result.proofPayloadDigest) ||
      !result.grant || typeof result.grant.id !== 'string' || typeof result.contextDigest !== 'string' ||
      typeof result.grant.expiresAt !== 'string') {
    throw new Error('Malformed ownership grant response.');
  }
  return result;
}