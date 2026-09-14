import { createHash, createPrivateKey, createPublicKey, sign, verify, KeyObject } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const PUBLIC_KEY_PATH = join(process.cwd(), 'scripts', 'coordination-v2-server-signing-public.pem');

function fingerprint(key: KeyObject): string {
  const publicKey = key.type === 'private' ? createPublicKey(key) : key;
  const der = publicKey.export({ type: 'spki', format: 'der' });
  return createHash('sha256').update(der).digest('hex');
}

export function loadServerSigningPrivateKey(env: NodeJS.ProcessEnv = process.env): KeyObject {
  const value = env.COORDINATION_V2_SERVER_SIGNING_PRIVATE_KEY;
  if (!value) throw new Error('COORDINATION_V2_SERVER_SIGNING_KEY_MISSING');
  try {
    const key = createPrivateKey(value.replaceAll('\\n', '\n'));
    if (key.asymmetricKeyType !== 'ed25519') throw new Error('not-ed25519');
    return key;
  } catch {
    throw new Error('COORDINATION_V2_SERVER_SIGNING_KEY_INVALID');
  }
}

export async function loadPinnedServerSigningPublicKey(path = PUBLIC_KEY_PATH): Promise<{ key: KeyObject; fingerprint: string }> {
  try {
    const key = createPublicKey({ key: await readFile(path), format: 'pem' });
    if (key.asymmetricKeyType !== 'ed25519') throw new Error('not-ed25519');
    return { key, fingerprint: fingerprint(key) };
  } catch {
    throw new Error('COORDINATION_V2_SERVER_SIGNING_PUBLIC_PIN_MISSING_OR_INVALID');
  }
}

export function signCoordinationV2Envelope(payload: string, key = loadServerSigningPrivateKey()): { signature: string; keyFingerprint: string } {
  return {
    signature: sign(null, Buffer.from(payload, 'utf8'), key).toString('base64'),
    keyFingerprint: fingerprint(key),
  };
}

export function verifyCoordinationV2Envelope(payload: string, signature: string, pinnedKey: KeyObject, expectedFingerprint: string): boolean {
  return fingerprint(pinnedKey) === expectedFingerprint
    && verify(null, Buffer.from(payload, 'utf8'), pinnedKey, Buffer.from(signature, 'base64'));
}
