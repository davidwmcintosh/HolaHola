import { readFile } from 'node:fs/promises';
import { SourceControlService } from '../services/source-control-service';
import { SourceReconciliationService } from '../services/source-reconciliation-service';

const MACHINE_RESULT_PREFIX = 'SOURCE_CONTROL_RESULT_JSON:';

function usage(): never {
  console.error('Usage: source-control-cli.ts status|sync|prepare|record <sha> | reconcile preflight --local-ref <sha> --remote <name> --remote-branch <name> | reconcile candidate|inspect --packet <path>');
  process.exit(64);
}

function writeResult(result: unknown): void {
  if (process.argv.includes('--machine-readable')) {
    console.log(`${MACHINE_RESULT_PREFIX}${JSON.stringify(result)}`);
    return;
  }
  console.log(JSON.stringify(result, null, 2));
}

function readOption(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main(): Promise<void> {
  const action = process.argv[2];
  const actor = readOption('--actor') || 'cli';
  const service = new SourceControlService();
  if (action === 'reconcile') {
    const reconciliation = new SourceReconciliationService();
    const operation = process.argv[3];
    const result = operation === 'preflight'
      ? await reconciliation.preflight(readOption('--local-ref') || usage(), readOption('--remote') || 'origin', readOption('--remote-branch') || 'main')
      : operation === 'candidate'
        ? await reconciliation.candidate(readOption('--packet') || usage())
        : operation === 'inspect'
          ? await reconciliation.inspect(readOption('--packet') || usage())
        : usage();
    writeResult(result);
    if (!result.ok) process.exitCode = result.state === 'lease_contended' || result.state === 'dirty_primary_worktree' ? 75 : 1;
    return;
  }

  if (action === 'status') {
    const status = await service.getStatus();
    if (!status) {
      writeResult({ state: 'unknown', error: 'No source-control status has been recorded.' });
      return;
    }
    writeResult(status);
    return;
  }

  const result = action === 'sync'
    ? await service.sync(actor)
    : action === 'prepare'
      ? await service.preparePromotion(actor)
      : action === 'record'
        ? await service.recordPromotion(
            process.argv[3] || usage(),
            actor,
            undefined,
            readOption('--publication-reference'),
          )
        : usage();

  writeResult(result);
  if (!result.ok) process.exitCode = result.state === 'dirty' || result.state === 'retrying' ? 75 : 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});