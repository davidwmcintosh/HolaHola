import { readFile } from 'node:fs/promises';
import { SourceControlService } from '../services/source-control-service';

function usage(): never {
  console.error('Usage: source-control-cli.ts status|sync|prepare|record <sha> [--actor <label>] [--publication-reference <text>]');
  process.exit(64);
}

function readOption(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main(): Promise<void> {
  const action = process.argv[2];
  const actor = readOption('--actor') || 'cli';
  const service = new SourceControlService();

  if (action === 'status') {
    const status = await service.getStatus();
    if (!status) {
      console.log(JSON.stringify({ state: 'unknown', error: 'No source-control status has been recorded.' }, null, 2));
      return;
    }
    console.log(JSON.stringify(status, null, 2));
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

  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = result.state === 'dirty' || result.state === 'retrying' ? 75 : 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});