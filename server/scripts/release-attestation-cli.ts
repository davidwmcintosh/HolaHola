import {
  ReleaseCutoverAttestationService,
} from '../services/release-cutover-attestation-service';
const MACHINE_RESULT_PREFIX = 'RELEASE_ATTESTATION_RESULT_JSON:';
function usage(): never {
  console.error(
    'Usage: release-attestation-cli.ts attest --decision-ref <ref> --actor <actor> --reason <text> [--ttl-ms <n>] '
    + '| get --decision-ref <ref> '
    + '| verify --decision-ref <ref> '
    + '| invalidate --decision-ref <ref> --actor <actor> --reason <text> '
    + '| consume --decision-ref <ref> --actor <actor> --action <text> '
    + '[--machine-readable]',
  );
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
function requireOption(name: string): string {
  return readOption(name) ?? usage();
}
async function main(): Promise<void> {
  const action = process.argv[2];
  const service = new ReleaseCutoverAttestationService();
  try {
    if (action === 'attest') {
      const ttlOption = readOption('--ttl-ms');
      const ttlMs = ttlOption !== undefined ? Number(ttlOption) : undefined;
      if (ttlOption !== undefined && !Number.isFinite(ttlMs)) {
        console.error('--ttl-ms must be a number');
        process.exit(64);
      }
      const attestation = await service.attest({
        decisionRef: requireOption('--decision-ref'),
        actor: requireOption('--actor'),
        reason: requireOption('--reason'),
        ttlMs,
      });
      writeResult({ ok: true, attestation });
      return;
    }
    if (action === 'get') {
      const active = await service.getActive(requireOption('--decision-ref'));
      if (!active) {
        writeResult({ ok: false, state: 'not_found' });
        process.exitCode = 1;
        return;
      }
      writeResult({ ok: true, attestation: active });
      return;
    }
    if (action === 'verify') {
      const attestation = await service.verifyStillLive(requireOption('--decision-ref'));
      writeResult({ ok: true, stillLive: true, attestation });
      return;
    }
    if (action === 'invalidate') {
      const attestation = await service.invalidate(
        requireOption('--decision-ref'),
        requireOption('--actor'),
        requireOption('--reason'),
      );
      writeResult({ ok: true, attestation });
      return;
    }
    if (action === 'consume') {
      const attestation = await service.consume(
        requireOption('--decision-ref'),
        requireOption('--actor'),
        requireOption('--action'),
      );
      writeResult({ ok: true, attestation });
      return;
    }
    usage();
  } catch (error) {
    writeResult({ ok: false, error: error instanceof Error ? error.message : String(error) });
    process.exitCode = 1;
  }
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
