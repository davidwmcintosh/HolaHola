import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { after, test } from 'node:test';
import { closeDbConnections } from '../db';
import { getVerifiedCiDatabaseUrl } from '../ci-database';
import {
  disableCoordinationRuntimeRegistration,
  registerCoordinationRuntime,
  stageCoordinationRuntimeReplacement,
} from '../services/coordination-credential-broker';
import {
  formatCoordinationRuntimeStatusJson,
  formatCoordinationRuntimeStatusText,
  getCoordinationRuntimeStatus,
} from './coordination-runtime-status';

const hasDisposableDatabase = Boolean(
  getVerifiedCiDatabaseUrl() || process.env.COORDINATION_INBOX_DISPOSABLE_BRANCH_ID,
);
const databaseTest = hasDisposableDatabase ? test : test.skip;
const runtimeId = `coordination-runtime-status-${Date.now()}`;

after(async () => {
  if (!hasDisposableDatabase) return;
  await closeDbConnections();
});

databaseTest('surfaces stored provider/model, and renders a never-set pair as "unknown" in text and as null (not omitted) in JSON', async () => {
  const withProviderModelId = `${runtimeId}-with-provider-model`;
  const withoutProviderModelId = `${runtimeId}-without-provider-model`;

  await registerCoordinationRuntime({
    runtimeId: withProviderModelId,
    actor: 'luca-replit',
    displayName: 'Status CI runtime with provider/model',
    capabilities: ['coordination:read'],
    tokenTtlSeconds: 60,
    provider: 'anthropic',
    model: 'claude-sonnet-4-5',
  });
  await registerCoordinationRuntime({
    runtimeId: withoutProviderModelId,
    actor: 'luca-replit',
    displayName: 'Status CI runtime without provider/model',
    capabilities: ['coordination:read'],
    tokenTtlSeconds: 60,
  });

  const rows = await getCoordinationRuntimeStatus({
    runtimeIds: [withProviderModelId, withoutProviderModelId],
  });
  assert.equal(rows.length, 2);
  const withProviderModelRow = rows.find((row) => row.runtimeId === withProviderModelId)!;
  const withoutProviderModelRow = rows.find((row) => row.runtimeId === withoutProviderModelId)!;
  assert.equal(withProviderModelRow.provider, 'anthropic');
  assert.equal(withProviderModelRow.model, 'claude-sonnet-4-5');
  assert.equal(withoutProviderModelRow.provider, null);
  assert.equal(withoutProviderModelRow.model, null);
  assert.equal(withoutProviderModelRow.rotatedFrom, null);
  assert.equal(withoutProviderModelRow.rotatedTo, null);

  // Positive control: a real value must pass through unchanged, not get
  // coerced into "unknown" too.
  const textWithValue = formatCoordinationRuntimeStatusText([withProviderModelRow]);
  assert.match(textWithValue, /provider:\s+anthropic/);
  assert.match(textWithValue, /model:\s+claude-sonnet-4-5/);

  const textWithoutValue = formatCoordinationRuntimeStatusText([withoutProviderModelRow]);
  assert.match(textWithoutValue, /provider:\s+unknown/);
  assert.match(textWithoutValue, /model:\s+unknown/);
  assert.equal(textWithoutValue.includes('null'), false);

  const parsedWithoutValue = JSON.parse(formatCoordinationRuntimeStatusJson([withoutProviderModelRow]));
  assert.equal(Object.prototype.hasOwnProperty.call(parsedWithoutValue[0], 'provider'), true);
  assert.equal(Object.prototype.hasOwnProperty.call(parsedWithoutValue[0], 'model'), true);
  assert.equal(parsedWithoutValue[0].provider, null);
  assert.equal(parsedWithoutValue[0].model, null);
});

databaseTest('filters by actor, combined with an explicit runtime-id set as an AND', async () => {
  const replitActorId = `${runtimeId}-actor-filter-replit`;
  const geminiActorId = `${runtimeId}-actor-filter-gemini`;
  await registerCoordinationRuntime({
    runtimeId: replitActorId,
    actor: 'luca-replit',
    displayName: 'Status CI actor-filter runtime (replit)',
    capabilities: ['coordination:read'],
    tokenTtlSeconds: 60,
  });
  await registerCoordinationRuntime({
    runtimeId: geminiActorId,
    actor: 'luca-gemini',
    displayName: 'Status CI actor-filter runtime (gemini)',
    capabilities: ['coordination:read'],
    tokenTtlSeconds: 60,
  });

  const rows = await getCoordinationRuntimeStatus({
    actor: 'luca-gemini',
    runtimeIds: [replitActorId, geminiActorId],
  });
  assert.deepEqual(rows.map((row) => row.runtimeId), [geminiActorId]);
});

databaseTest('reflects rotation lineage on both sides of a staged rotation, and keeps the still-enabled source visible by default', async () => {
  const sourceId = `${runtimeId}-rotation-source`;
  const replacementId = `${runtimeId}-rotation-replacement`;
  await registerCoordinationRuntime({
    runtimeId: sourceId,
    actor: 'luca-replit',
    displayName: 'Status CI rotation source',
    capabilities: ['coordination:read'],
    tokenTtlSeconds: 60,
    provider: 'anthropic',
    model: 'claude-sonnet-4-5',
  });
  const staged = await stageCoordinationRuntimeReplacement({
    sourceRuntimeId: sourceId,
    replacementRuntimeId: replacementId,
    replacementDisplayName: 'Status CI rotation replacement',
  });
  assert.equal(staged.ok, true);

  const rows = await getCoordinationRuntimeStatus({ runtimeIds: [sourceId, replacementId] });
  // The source is untouched by staging alone (only completeCoordinationRuntimeReplacement
  // revokes it), so it must still appear in the default active-only view.
  assert.equal(rows.length, 2);
  const sourceRow = rows.find((row) => row.runtimeId === sourceId)!;
  const replacementRow = rows.find((row) => row.runtimeId === replacementId)!;

  assert.equal(sourceRow.rotatedFrom, null);
  assert.equal(sourceRow.rotatedTo?.counterpartRuntimeId, replacementId);
  assert.equal(sourceRow.rotatedTo?.state, 'staged');

  assert.equal(replacementRow.rotatedTo, null);
  assert.equal(replacementRow.rotatedFrom?.counterpartRuntimeId, sourceId);
  assert.equal(replacementRow.rotatedFrom?.state, 'staged');
  // Carried-forward provider/model (set by stageCoordinationRuntimeReplacement)
  // must round-trip through this read surface too.
  assert.equal(replacementRow.provider, 'anthropic');
  assert.equal(replacementRow.model, 'claude-sonnet-4-5');

  assert.match(formatCoordinationRuntimeStatusText([sourceRow]), new RegExp(`rotated to:\\s+${replacementId} \\(staged,`));
  assert.match(formatCoordinationRuntimeStatusText([replacementRow]), new RegExp(`rotated from:\\s+${sourceId} \\(staged,`));
});

databaseTest('excludes disabled/revoked registrations by default, and includes them with includeDisabled showing status + revokedAt', async () => {
  const disabledId = `${runtimeId}-disabled`;
  await registerCoordinationRuntime({
    runtimeId: disabledId,
    actor: 'luca-replit',
    displayName: 'Status CI disabled runtime',
    capabilities: ['coordination:read'],
    tokenTtlSeconds: 60,
    provider: 'openai',
    model: 'gpt-5',
  });
  const disabled = await disableCoordinationRuntimeRegistration(disabledId);
  assert.equal(disabled.ok, true);

  const defaultRows = await getCoordinationRuntimeStatus({ runtimeIds: [disabledId] });
  assert.equal(defaultRows.length, 0);

  const allRows = await getCoordinationRuntimeStatus({ runtimeIds: [disabledId], includeDisabled: true });
  assert.equal(allRows.length, 1);
  assert.equal(allRows[0].enabled, false);
  assert.ok(allRows[0].revokedAt instanceof Date);

  const text = formatCoordinationRuntimeStatusText(allRows);
  assert.match(text, /status:\s+disabled \(revoked \d{4}-\d{2}-\d{2}T/);
});

databaseTest('CLI entrypoint lists one runtime by --runtime-id in --json mode', async () => {
  const cliId = `${runtimeId}-cli`;
  await registerCoordinationRuntime({
    runtimeId: cliId,
    actor: 'luca-replit',
    displayName: 'Status CI CLI runtime',
    capabilities: ['coordination:read'],
    tokenTtlSeconds: 60,
    provider: 'anthropic',
    model: 'claude-opus-4',
  });

  const result = spawnSync(
    'npx',
    ['tsx', 'server/scripts/coordination-runtime-status.ts', '--runtime-id', cliId, '--json'],
    { cwd: process.cwd(), encoding: 'utf8', env: process.env, timeout: 30_000 },
  );
  assert.equal(result.status, 0, result.stderr);
  // server/db.ts logs its "[DB] ..." banners to stderr specifically so that
  // any CLI's --json stdout stays limited to its actual data -- assert that
  // contract directly (no stdout filtering) rather than masking a broken one.
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].runtimeId, cliId);
  assert.equal(parsed[0].provider, 'anthropic');
  assert.equal(parsed[0].model, 'claude-opus-4');
  assert.match(result.stderr, /\[DB\]/, 'DB banners should still appear, just on stderr, not silently dropped');
});
