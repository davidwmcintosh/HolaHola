import { existsSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { join } from 'path';

import { closeDbConnections } from '../db';
import type { RawWindowAuditManifest } from '../services/raw-window-audit-service';
import { persistRawWindowEvidence } from '../services/raw-window-evidence-ledger';
import { WORKSPACE } from '../services/transcript-parser';

const sourceDir = join(WORKSPACE, '.local', 'raw-window-captures');

async function main(): Promise<void> {
  if (!existsSync(sourceDir)) {
    console.log('[raw-window-evidence] No retained sources to backfill.');
    return;
  }

  let restored = 0;
  let alreadyRecorded = 0;
  for (const entry of readdirSync(sourceDir)) {
    if (!entry.endsWith('.json') || entry.endsWith('.audit.json')) continue;
    const metadataPath = join(sourceDir, entry);
    const metadata = JSON.parse(readFileSync(metadataPath, 'utf8')) as Record<string, any>;
    if (metadata.evidenceLedger?.sourceEventId) {
      alreadyRecorded++;
      continue;
    }
    const rawSourcePath = typeof metadata.rawSourcePath === 'string'
      ? metadata.rawSourcePath
      : join(sourceDir, `${entry.slice(0, -'.json'.length)}.raw`);
    if (!existsSync(rawSourcePath) || !metadata.reconciliation || !metadata.sourceSha256) {
      console.warn(`[raw-window-evidence] Skipping incomplete source metadata: ${entry}`);
      continue;
    }

    const sourceKind = metadata.sourceKind === 'replit-window'
      ? 'replit-window'
      : 'david-reference-dump';
    const manifest: RawWindowAuditManifest = {
      version: 1,
      sourceSha256: metadata.sourceSha256,
      sourceKind,
      disposition: metadata.status,
      rawSourcePath,
      reconciliation: metadata.reconciliation,
      emittedTurnCount: Number(metadata.emittedTurnCount) || 0,
      emittedDialogueBytes: Number(metadata.reconciliation.emittedDialogueBytes) || 0,
      ...(metadata.reason ? { reason: String(metadata.reason) } : {}),
      ...(metadata.useConstraint ? { useConstraint: String(metadata.useConstraint) } : {}),
    };
    const result = await persistRawWindowEvidence(
      manifest,
      readFileSync(rawSourcePath, 'utf8'),
      typeof metadata.episodeContext === 'string' ? metadata.episodeContext : undefined,
    );
    const tempPath = `${metadataPath}.tmp-${process.pid}`;
    writeFileSync(tempPath, JSON.stringify({
      ...metadata,
      evidenceLedger: {
        sourceEventId: result.sourceEventId,
        persistedAt: new Date().toISOString(),
        backfilled: true,
      },
    }, null, 2) + '\n', 'utf8');
    renameSync(tempPath, metadataPath);
    restored++;
  }
  console.log(`[raw-window-evidence] Backfill complete: ${restored} persisted, ${alreadyRecorded} already recorded.`);
}

void main()
  .then(() => closeDbConnections())
  .catch(async error => {
    console.error('[raw-window-evidence] ERROR:', error);
    await closeDbConnections();
    process.exit(1);
  });