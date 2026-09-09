import { closeDbConnections } from '../db';
import {
  completeCoordinationRuntimeReplacement,
  rollbackCoordinationRuntimeReplacement,
  stageCoordinationRuntimeReplacement,
} from '../services/coordination-credential-broker';

function option(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function usage(): never {
  throw new Error([
    'Usage:',
    '  stage --from-runtime-id <current-id> --runtime-id <new-id> --display-name <name>',
    '  complete --from-runtime-id <current-id> --runtime-id <new-id>',
    '  rollback --from-runtime-id <current-id> --runtime-id <new-id>',
  ].join('\n'));
}

async function main(): Promise<void> {
  const action = process.argv[2];
  const sourceRuntimeId = option('from-runtime-id');
  const replacementRuntimeId = option('runtime-id');
  if (!sourceRuntimeId || !replacementRuntimeId) usage();

  if (action === 'stage') {
    const replacementDisplayName = option('display-name');
    if (!replacementDisplayName) usage();
    const result = await stageCoordinationRuntimeReplacement({
      sourceRuntimeId,
      replacementRuntimeId,
      replacementDisplayName,
    });
    if (!result.ok) throw new Error(`Rotation could not be staged: ${result.reason}`);
    process.stdout.write([
      `Replacement runtime ${replacementRuntimeId} staged for ${sourceRuntimeId} as ${result.actor}.`,
      `Capabilities and token TTL were copied exactly (${result.tokenTtlSeconds}s).`,
      'Store this bootstrap token in only the replacement runtime’s 1Password vault item.',
      'It is shown once and cannot be recovered from the database:',
      result.bootstrapToken,
      '',
      'Do not complete rotation yet. Start the replacement, exchange this bootstrap,',
      'then call POST /api/coordination/credentials/rotation-ready with its broker credential.',
      '',
    ].join('\n'));
    return;
  }

  if (action === 'complete') {
    const result = await completeCoordinationRuntimeReplacement({
      sourceRuntimeId,
      replacementRuntimeId,
    });
    if (!result.ok) throw new Error(`Rotation could not be completed: ${result.reason}`);
    process.stdout.write(
      `Rotation completed for ${result.actor}: ${sourceRuntimeId} is revoked and ${replacementRuntimeId} remains active.\n`,
    );
    return;
  }

  if (action === 'rollback') {
    const result = await rollbackCoordinationRuntimeReplacement({
      sourceRuntimeId,
      replacementRuntimeId,
    });
    if (!result.ok) throw new Error(`Rotation could not be rolled back: ${result.reason}`);
    process.stdout.write(
      `Rotation rolled back for ${result.actor}: ${replacementRuntimeId} is revoked and ${sourceRuntimeId} remains active.\n`,
    );
    return;
  }

  usage();
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(closeDbConnections);