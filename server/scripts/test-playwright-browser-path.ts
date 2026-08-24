/**
 * Focused tests for Playwright Chromium path resolution.
 *
 * These tests do not launch a browser or require a display. They verify that
 * local Windows, Replit system Chromium, explicit overrides, and missing
 * installations have distinct, deterministic behavior.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveChromiumExecutable } from '../services/playwright-chromium-resolver';

const tempDir = mkdtempSync(join(tmpdir(), 'holahola-playwright-path-test-'));
try {
  const configured = join(tempDir, 'configured-chromium');
  const managed = join(tempDir, 'managed-chromium');
  const system = join(tempDir, 'system-chromium');
  for (const file of [configured, managed, system]) writeFileSync(file, '');

  assert.deepEqual(
    resolveChromiumExecutable({ configuredPath: configured, managedPath: managed, systemPaths: [system] }),
    { executablePath: configured, source: 'configured' },
    'explicit executable path must take priority'
  );
  assert.deepEqual(
    resolveChromiumExecutable({ managedPath: managed, systemPaths: [system] }),
    { executablePath: managed, source: 'playwright-managed' },
    'managed Playwright executable must take priority over system Chromium'
  );
  assert.deepEqual(
    resolveChromiumExecutable({ managedPath: join(tempDir, 'missing-managed'), systemPaths: [system] }),
    { executablePath: system, source: 'system' },
    'system Chromium must be used when managed Chromium is absent'
  );
  assert.equal(
    resolveChromiumExecutable({
      configuredPath: join(tempDir, 'missing-configured'),
      managedPath: join(tempDir, 'missing-managed'),
      systemPaths: [],
    }),
    null,
    'missing Chromium must be reported as unavailable'
  );
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}

console.log('Playwright Chromium path checks passed.');