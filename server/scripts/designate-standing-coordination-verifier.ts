import type { CoordinationActorId } from '@shared/schema';
import { closeDbConnections } from '../db';
import { designateStandingCoordinationVerifier } from '../services/coordination-credential-broker';

/**
 * Operator-only CLI for designateStandingCoordinationVerifier(). This is
 * deliberately separate from coordination-runtime-bootstrap.ts: bootstrap
 * creates a runtime registration, this flips the standingVerifier flag on
 * one that already exists. Neither step should ever be triggered by
 * provisioning code (see the comment above designateStandingCoordinationVerifier
 * in coordination-credential-broker.ts) -- an operator runs this by hand.
 */

function option(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main(): Promise<void> {
  const runtimeId = option('runtime-id');
  const actor = option('actor') as CoordinationActorId | undefined;

  if (!runtimeId || !actor) {
    throw new Error('Usage: --runtime-id <stable-id> --actor <luca-replit|luca-claude-code>');
  }

  const ok = await designateStandingCoordinationVerifier(runtimeId, actor);
  if (!ok) {
    throw new Error(
      `Designation failed for ${runtimeId} (${actor}). Either the actor is not one of the two ` +
      'approved verifier identities, or no enabled, non-revoked registration with that exact ' +
      'id+actor exists yet -- run coordination-runtime-bootstrap.ts first.',
    );
  }
  process.stdout.write(`Registration ${runtimeId} is now designated as a standing verifier for ${actor}.\n`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(closeDbConnections);
