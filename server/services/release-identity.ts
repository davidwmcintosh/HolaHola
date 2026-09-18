import fs from 'node:fs';
import path from 'node:path';
import type { Request, Response } from 'express';

const SHA40 = /^[0-9a-f]{40}$/;
const SHA256 = /^[0-9a-f]{64}$/;

export interface ReleaseIdentity {
  schemaVersion: 1;
  authority: 'build' | 'development';
  promotable: boolean;
  commitSha: string | null;
  commitSource: string;
  sourceContextSha256: string;
  sourceContextAlgorithm: string;
  sourceFileCount: number;
  dirtyWorktree: boolean | null;
}

function unavailable(reason: string): ReleaseIdentity & { reason: string } {
  return {
    schemaVersion: 1,
    authority: 'development',
    promotable: false,
    commitSha: null,
    commitSource: 'unavailable',
    sourceContextSha256: '',
    sourceContextAlgorithm: 'sha256(path-nul-kind-nul-bytes-nul-v1)',
    sourceFileCount: 0,
    dirtyWorktree: null,
    reason,
  };
}

export function parseReleaseIdentity(raw: unknown): ReleaseIdentity {
  if (!raw || typeof raw !== 'object') throw new Error('manifest_not_object');
  const value = raw as Record<string, unknown>;
  const identity: ReleaseIdentity = {
    schemaVersion: value.schemaVersion as 1,
    authority: value.authority as ReleaseIdentity['authority'],
    promotable: value.promotable === true,
    commitSha: typeof value.commitSha === 'string' ? value.commitSha : null,
    commitSource: typeof value.commitSource === 'string' ? value.commitSource : '',
    sourceContextSha256: typeof value.sourceContextSha256 === 'string' ? value.sourceContextSha256 : '',
    sourceContextAlgorithm: typeof value.sourceContextAlgorithm === 'string' ? value.sourceContextAlgorithm : '',
    sourceFileCount: typeof value.sourceFileCount === 'number' ? value.sourceFileCount : -1,
    dirtyWorktree: typeof value.dirtyWorktree === 'boolean' ? value.dirtyWorktree : null,
  };

  if (identity.schemaVersion !== 1) throw new Error('manifest_schema_unsupported');
  if (!['build', 'development'].includes(identity.authority)) throw new Error('manifest_authority_invalid');
  if (identity.commitSha !== null && !SHA40.test(identity.commitSha)) throw new Error('manifest_commit_invalid');
  if (!SHA256.test(identity.sourceContextSha256)) throw new Error('manifest_source_digest_invalid');
  if (identity.sourceContextAlgorithm !== 'sha256(path-nul-kind-nul-bytes-nul-v1)') {
    throw new Error('manifest_source_algorithm_invalid');
  }
  if (!Number.isInteger(identity.sourceFileCount) || identity.sourceFileCount < 1) {
    throw new Error('manifest_source_file_count_invalid');
  }
  if (identity.promotable && (identity.authority !== 'build' || !identity.commitSha)) {
    throw new Error('manifest_promotable_claim_invalid');
  }
  return identity;
}

export function loadReleaseIdentity(
  manifestPath = path.resolve(process.cwd(), 'dist', 'release-manifest.json'),
): ReleaseIdentity & { reason?: string } {
  try {
    return parseReleaseIdentity(JSON.parse(fs.readFileSync(manifestPath, 'utf8')));
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'manifest_unavailable';
    return unavailable(reason);
  }
}

const releaseIdentity = loadReleaseIdentity();

export function getReleaseIdentity(): ReleaseIdentity & { reason?: string } {
  return { ...releaseIdentity };
}

export function releaseIdentityHandler(_req: Request, res: Response): void {
  const identity = getReleaseIdentity();
  res.status(identity.promotable ? 200 : 503).json(identity);
}