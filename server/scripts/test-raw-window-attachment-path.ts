import { execFileSync } from 'child_process';
import { existsSync, rmSync, symlinkSync, writeFileSync } from 'fs';
import { join } from 'path';

const workspace = process.cwd();
const outsideFixture = '/tmp/raw-window-attachment-outside-fixture.bin';
const unsafeLink = join(workspace, 'attached_assets', 'ci-unsafe-attachment-link.bin');

function expect(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

try {
  writeFileSync(outsideFixture, 'must never enter the raw evidence ledger');
  rmSync(unsafeLink, { force: true });
  symlinkSync(outsideFixture, unsafeLink);
  let rejected = false;
  try {
    execFileSync(
      'npx',
      ['tsx', 'server/scripts/record-raw-window-attachment.ts', '--attachment', unsafeLink, '--episode', 'episode-31.md'],
      { cwd: workspace, stdio: 'pipe' },
    );
  } catch (error: any) {
    rejected = error.status !== 0
      && Buffer.from(error.stderr ?? '').toString('utf8').includes('must resolve to a regular file inside');
  }
  expect(rejected, 'An attached_assets symlink to an outside file was accepted.');
  console.log('[raw-window-attachment-path] PASS — outside symlink rejected before raw capture.');
} finally {
  if (existsSync(unsafeLink)) rmSync(unsafeLink, { force: true });
  if (existsSync(outsideFixture)) rmSync(outsideFixture, { force: true });
}