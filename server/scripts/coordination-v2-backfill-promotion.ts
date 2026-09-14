import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { count } from 'drizzle-orm';
import { db } from '../db';
import {
  coordinationV2Attempts, coordinationV2HostEnrollments, coordinationV2Sessions,
  coordinationV2SourcePromotions,
} from '@shared/schema';
import { normalizeCoordinationRepositoryIdentity } from '../services/coordination-repository-identity';

const exec = promisify(execFile);
const SHA = /^[0-9a-f]{40}$/;
const DIGEST = /^[0-9a-f]{64}$/;

function fail(message: string): never { throw new Error(`V2_PROMOTION_BACKFILL_REFUSED:${message}`); }

async function main() {
  const path = process.argv[2];
  const configured = process.env.COORDINATION_V2_PROTECTED_RECEIPT_PATH;
  if (!path || !configured || path !== configured) fail('receipt_path_is_not_operator_pinned');
  if (process.env.COORDINATION_V2_ALLOW_M13_BACKFILL !== '1') fail('operator_gate_missing');
  const bytes = await readFile(path);
  const receipt = JSON.parse(bytes.toString('utf8')) as Record<string, unknown>;
  const sha = String(receipt.sha || '');
  const treeSha = String(receipt.treeSha || '');
  const publicationReference = String(receipt.publicationReference || '');
  const validationId = String(receipt.validationId || '');
  if (!SHA.test(sha) || !SHA.test(treeSha) || !publicationReference || !DIGEST.test(validationId)) fail('receipt_fields_invalid');
  const root = process.env.COORDINATION_V2_PROTECTED_WORKTREE;
  if (!root) fail('protected_worktree_missing');
  const configuredUrl = process.env.GITHUB_REPO_URL;
  if (!configuredUrl) fail('github_remote_not_configured');
  let repositoryIdentity: string;
  try {
    repositoryIdentity = normalizeCoordinationRepositoryIdentity(configuredUrl);
    const actual = (await exec('git', ['-C', root, 'config', '--get', 'remote.origin.url'])).stdout.trim();
    if (normalizeCoordinationRepositoryIdentity(actual) !== repositoryIdentity) fail('github_remote_mismatch');
    if (process.env.COORDINATION_V2_REPOSITORY_IDENTITY
      && normalizeCoordinationRepositoryIdentity(process.env.COORDINATION_V2_REPOSITORY_IDENTITY) !== repositoryIdentity) {
      fail('repository_identity_pin_mismatch');
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('V2_PROMOTION_BACKFILL_REFUSED:')) throw error;
    fail('repository_identity_invalid');
  }
  const head = (await exec('git', ['-C', root, 'rev-parse', 'HEAD'])).stdout.trim();
  const actualTree = (await exec('git', ['-C', root, 'rev-parse', `${sha}^{tree}`])).stdout.trim();
  if (head !== sha || actualTree !== treeSha) fail('receipt_commit_or_tree_mismatch');
  if (process.env.COORDINATION_V2_GITHUB_COMMIT_SHA !== sha
    || process.env.COORDINATION_V2_GITHUB_TREE_SHA !== treeSha
    || process.env.COORDINATION_V2_GITHUB_PUBLICATION_REFERENCE !== publicationReference) {
    fail('github_current_evidence_missing_or_mismatched');
  }
  const [enrollments, sessions, attempts] = await Promise.all([
    db.select({ value: count() }).from(coordinationV2HostEnrollments),
    db.select({ value: count() }).from(coordinationV2Sessions),
    db.select({ value: count() }).from(coordinationV2Attempts),
  ]);
  if ((enrollments[0]?.value || 0) > 0 || (sessions[0]?.value || 0) > 0 || (attempts[0]?.value || 0) > 0) fail('v2_authority_rows_exist');
  const receiptDigest = createHash('sha256').update(bytes).digest('hex');
  const recordDigest = createHash('sha256').update(JSON.stringify({
    repositoryIdentity,
    promotedCommitSha: sha, exactTreeSha: treeSha, publicationReference,
    protectedValidationId: validationId,
  })).digest('hex');
  await db.insert(coordinationV2SourcePromotions).values({
    repositoryIdentity,
    promotedCommitSha: sha, exactTreeSha: treeSha, publicationReference,
    protectedValidationId: validationId, canonicalRecordDigest: recordDigest,
    state: 'published', operationReceiptDigest: receiptDigest, operationReceiptReference: path,
  }).onConflictDoNothing({
    target: [coordinationV2SourcePromotions.promotedCommitSha, coordinationV2SourcePromotions.exactTreeSha,
      coordinationV2SourcePromotions.publicationReference, coordinationV2SourcePromotions.protectedValidationId],
  });
  process.stdout.write('V2_PROMOTION_BACKFILL_RECORDED\n');
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
