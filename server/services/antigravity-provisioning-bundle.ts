import { createHash, createPublicKey } from 'node:crypto';

export const GATE3 = {
  runtimeId: 'luca-gemini-antigravity-primary',
  actor: 'luca-gemini',
  credentialCapabilities: ['coordination:read', 'coordination:write', 'coordination:inbox:ack', 'coordination:credential:renew'] as const,
  runtimeCapabilities: ['execute', 'model'] as const,
  tokenTtlSeconds: 900,
  taskRef: '1448',
  repositoryLabel: 'HolaHola',
  worktreeLabel: 'HolaHola-antigravity',
  branch: 'luca/gemini-experiment',
  provider: 'gemini',
  model: 'gemini-3-flash-preview',
  adapterVersion: 'coordination-gemini-v1',
} as const;

export type PublicProvisioningBundle = {
  runtimeId: string; actor: string; credentialCapabilities: string[]; runtimeCapabilities: string[]; tokenTtlSeconds: number;
  taskRef: string; artifactSha256: string; publicKey: string; keyFingerprint: string;
  bootstrapSha256: string; worktreeRealpathDigest: string; branch: string;
  startingCommit: string; provider: string; model: string; adapterVersion: string;
  repositoryLabel: string; worktreeLabel: string; bundleDigest: string;
  // Keeps older consumers type-compatible while the runtime rejects legacy fields.
  [key: string]: any;
};

const SHA = /^[0-9a-f]{64}$/;
const COMMIT = /^[0-9a-f]{40,64}$/;
const SECRET_KEYS = /(token|secret|credential|private|password|bootstrap|bearer|access)/i;
const json = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(json).join(',')}]`;
  return `{${Object.keys(value as object).sort().map((k) => `${JSON.stringify(k)}:${json((value as any)[k])}`).join(',')}}`;
};
const digest = (value: unknown): string => createHash('sha256').update(json(value)).digest('hex');

export class ProvisioningBundleError extends Error {
  readonly code: string;
  constructor(code: string) { super(`provisioning_bundle_${code}`); this.name = 'ProvisioningBundleError'; this.code = code; }
}

export function canonicalBundleJson(bundle: Omit<PublicProvisioningBundle, 'bundleDigest'>): string {
  return json(bundle);
}

export function createPublicProvisioningBundle(input: Omit<PublicProvisioningBundle, 'bundleDigest'>): PublicProvisioningBundle {
  validatePublicProvisioningBundle(input);
  return { ...input, bundleDigest: digest(input) } as PublicProvisioningBundle;
}

export function validatePublicProvisioningBundle(value: unknown): asserts value is Omit<PublicProvisioningBundle, 'bundleDigest'> & { bundleDigest?: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ProvisioningBundleError('shape');
  const object = value as Record<string, unknown>;
  const allowed = new Set(Object.keys(GATE3).concat([
    'artifactSha256', 'publicKey', 'keyFingerprint', 'bootstrapSha256',
    'worktreeRealpathDigest', 'startingCommit', 'bundleDigest',
  ]));
  for (const key of Object.keys(object)) {
    if (!allowed.has(key) || (SECRET_KEYS.test(key) && !['bootstrapSha256', 'tokenTtlSeconds', 'credentialCapabilities'].includes(key))) throw new ProvisioningBundleError('field');
  }
  for (const key of ['artifactSha256', 'bootstrapSha256', 'worktreeRealpathDigest', 'keyFingerprint'] as const) {
    if (typeof object[key] !== 'string' || !SHA.test(object[key])) throw new ProvisioningBundleError(key);
  }
  if (typeof object.startingCommit !== 'string' || !COMMIT.test(object.startingCommit)) throw new ProvisioningBundleError('commit');
  if (typeof object.publicKey !== 'string') throw new ProvisioningBundleError('public_key');
  let fingerprint: string;
  try {
    const der = Buffer.from(object.publicKey, 'base64url');
    const key = createPublicKey({ key: der, type: 'spki', format: 'der' });
    if (key.asymmetricKeyType !== 'ed25519') throw new Error();
    fingerprint = createHash('sha256').update(der).digest('hex');
  } catch { throw new ProvisioningBundleError('public_key'); }
  if (fingerprint !== object.keyFingerprint) throw new ProvisioningBundleError('key_binding');
  for (const key of Object.keys(GATE3) as (keyof typeof GATE3)[]) {
    if (json(object[key]) !== json(GATE3[key])) throw new ProvisioningBundleError('approved_field');
  }
  if (object.bundleDigest !== undefined) {
    const copy = { ...object }; delete copy.bundleDigest;
    if (object.bundleDigest !== digest(copy)) throw new ProvisioningBundleError('digest');
  }
}
