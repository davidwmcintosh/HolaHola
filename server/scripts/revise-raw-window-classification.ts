/**
 * Authoritative operational entrypoint for a later raw-window classification.
 * It preserves the original origin block and writes a subsequent append-only
 * classification revision into both the revision ledger and canonical episode.
 */
import { closeDbConnections } from '../db';
import { reviseRawWindowClassification } from '../services/raw-window-classification';

const args = process.argv.slice(2);
const get = (flag: string) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};
const sourceSha256 = get('--source-sha');
const classification = get('--classification');
const reason = get('--reason');
const episodeFilename = get('--episode');
const revisedBy = get('--revised-by') ?? 'luca';

if (!sourceSha256 || !classification || !reason || !episodeFilename) {
  console.error('Usage: revise-raw-window-classification --source-sha <sha256> --classification <label> --reason <why> --episode <episode.md> [--revised-by <actor>]');
  process.exit(1);
}

void reviseRawWindowClassification({
  sourceSha256,
  classification,
  reason,
  episodeFilename,
  revisedBy,
}).then(async () => {
  console.log(`[raw-window-classification] Recorded ${sourceSha256} → ${classification}.`);
  await closeDbConnections();
}).catch(async error => {
  console.error('[raw-window-classification] ERROR:', error);
  await closeDbConnections();
  process.exit(1);
});