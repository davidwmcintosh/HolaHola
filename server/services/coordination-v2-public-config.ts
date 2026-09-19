import { createHash } from 'node:crypto';
import { canonicalJson, canonicalizePolicy } from './coordination-policy-canonicalization';

/**
 * Pure, DB-free half of the V2 public-material config builder.
 *
 * This module must never import `../db` (or anything that does). It is the
 * shared computation used both by the server at preparation time
 * (`coordination-v2-preparation-material-service.ts`) and by the offline
 * founder-facing digest CLI (`server/scripts/coordination-v2-public-material-digest.ts`).
 * The CLI needs to run without a live database connection, so the one function
 * that actually produces the hashed bytes cannot carry a transitive `db` import.
 */

const sha = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const CHILD_ROLES = ['coordinator-cli', 'gate3-executor'] as const;
const OPERATION_KINDS = ['poll', 'claim', 'result', 'cleanup'] as const;

/**
 * `hostConstraints.windowsPublicMaterialDigest` is the one policy field the
 * emitted config cannot carry: it is defined as the digest OF the task
 * artifact plus this config, so embedding its real value would make the
 * config's own hash a function of itself -- a SHA-256 preimage nobody could
 * ever satisfy. Strip it from the policy view that gets embedded/hashed here
 * so the config is well-defined; the real value is still fully enforced, just
 * as a separate pinned comparison at the reserve/prepare call sites (see
 * `coordination-lifecycle-facade-service.ts` and
 * `coordination-windows-generation.ts`), never as an input to the hash it is
 * compared against. The `policyDigest` returned by this function (identifying
 * *which* approved policy version this is) is unaffected -- it is still the
 * hash of the complete, real policy, matching what is stored at authoring
 * time in `coordinationV2PolicyVersions`.
 */
export function withoutSelfReferentialDigest(canonicalPolicy: Record<string, unknown>): Record<string, unknown> {
  const constraints = canonicalPolicy.hostConstraints;
  if (!constraints || typeof constraints !== 'object' || Array.isArray(constraints)
    || !('windowsPublicMaterialDigest' in (constraints as Record<string, unknown>))) {
    return canonicalPolicy;
  }
  const { windowsPublicMaterialDigest: _omit, ...operationalConstraints } = constraints as Record<string, unknown>;
  return { ...canonicalPolicy, hostConstraints: operationalConstraints };
}

export function buildCoordinationV2PublicConfig(input: {
  repositoryIdentity: string; promotedCommitSha: string; exactTreeSha: string;
  policy: Record<string, unknown>;
}): { config: string; canonicalPolicy: Record<string, unknown>; policyDigest: string } {
  const canonicalPolicy = canonicalizePolicy(input.policy) as Record<string, unknown>;
  const canonicalPolicyBytes = canonicalJson(canonicalPolicy);
  const operationalPolicy = withoutSelfReferentialDigest(canonicalPolicy);
  const operationalPolicyBytes = canonicalJson(operationalPolicy);
  return {
    canonicalPolicy,
    policyDigest: sha(canonicalPolicyBytes),
    config: canonicalJson({
      protocolVersion: 1, childRoles: CHILD_ROLES, operationKinds: OPERATION_KINDS,
      repositoryIdentity: input.repositoryIdentity, promotedCommitSha: input.promotedCommitSha,
      exactTreeSha: input.exactTreeSha, policy: operationalPolicy, policyDigest: sha(operationalPolicyBytes),
    }),
  };
}
