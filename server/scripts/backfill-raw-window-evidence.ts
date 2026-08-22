/**
 * Re-run retained raw-window sources through the production origin pipeline.
 * The canonical raw-origin marker makes this safe to run repeatedly: source
 * bytes are verified by the immutable ledger and the DB-first episode append
 * refuses a duplicate marker.
 */
import { existsSync, readdirSync, readFileSync } from 'fs';
import { spawnSync } from 'child_process';
import { join } from 'path';

import { WORKSPACE } from '../services/transcript-parser';

const sourceDir = join(WORKSPACE, '.local', 'raw-window-captures');
const defaultEpisode = process.argv.includes('--episode')
  ? process.argv[process.argv.indexOf('--episode') + 1]
  : 'episode-31.md';

function episodeFor(rawPath: string): string {
  const metadataPath = rawPath.replace(/\.raw$/, '.json');
  if (!existsSync(metadataPath)) return defaultEpisode;
  try {
    const metadata = JSON.parse(readFileSync(metadataPath, 'utf8')) as { episodeContext?: unknown };
    return typeof metadata.episodeContext === 'string' ? metadata.episodeContext : defaultEpisode;
  } catch {
    return defaultEpisode;
  }
}

function main(): void {
  if (!existsSync(sourceDir)) {
    console.log('[raw-window-backfill] No retained raw-window sources found.');
    return;
  }
  const rawPaths = readdirSync(sourceDir)
    .filter(entry => entry.endsWith('.raw'))
    .sort()
    .map(entry => join(sourceDir, entry));
  let projected = 0;
  for (const rawPath of rawPaths) {
    const episode = episodeFor(rawPath);
    const result = spawnSync('npx', [
      'tsx', 'server/scripts/record-window.ts',
      '--window-file', rawPath,
      '--attach-existing',
      '--episode', episode,
    ], { cwd: WORKSPACE, stdio: 'inherit', env: process.env });
    if (result.status !== 0) {
      throw new Error(`Origin backfill failed for ${rawPath} (exit ${result.status ?? 'unknown'}).`);
    }
    projected++;
  }
  console.log(`[raw-window-backfill] Production origin pipeline completed for ${projected} source(s).`);
}

try {
  main();
} catch (error) {
  console.error('[raw-window-backfill] ERROR:', error);
  process.exit(1);
}