import { createHash } from 'node:crypto';
import { canonicalJson } from './coordination-policy-canonicalization';

/** Date.toString() discards milliseconds; database strings may retain them. */
export function runtimeEvidenceDate(value: unknown): Date {
  return value instanceof Date ? new Date(value.getTime()) : new Date(String(value));
}

export function runtimeEvidenceDigest(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');
}

type TimestampedManifest = { issuedAt: string; expiresAt: string };

/**
 * Restore original signed bytes only when the complete immutable digest agrees.
 * This does not renew a lease, change other evidence, or rewrite a stored digest.
 */
export function selectRuntimeReplayManifest<T extends TimestampedManifest>(
  manifest: T,
  storedDigest: string,
): T | null {
  if (runtimeEvidenceDigest(manifest) === storedDigest) return manifest;

  const issued = runtimeEvidenceDate(manifest.issuedAt);
  const expires = runtimeEvidenceDate(manifest.expiresAt);
  if (!Number.isFinite(issued.getTime()) || !Number.isFinite(expires.getTime())) return null;
  issued.setUTCMilliseconds(0);
  expires.setUTCMilliseconds(0);
  const legacy = {
    ...manifest,
    issuedAt: issued.toISOString(),
    expiresAt: expires.toISOString(),
  };
  return runtimeEvidenceDigest(legacy) === storedDigest ? legacy : null;
}
