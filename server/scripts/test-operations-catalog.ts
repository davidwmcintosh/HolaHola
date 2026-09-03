import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  findExactOperation,
  formatOperationForEmbedding,
  OPERATIONS_CATALOG,
  toPublicOperationManifest,
} from '../services/operations-catalog';

test('operation IDs, titles, and aliases resolve deterministically', () => {
  const burn = findExactOperation('  RUN   THE BURN REPORT ');
  assert.equal(burn?.id, 'cost.burn-report');
  assert.equal(findExactOperation('cost.burn-report')?.id, 'cost.burn-report');
  assert.equal(findExactOperation('Run the Burn Report')?.id, 'cost.burn-report');
  assert.equal(findExactOperation('not a known operation'), undefined);
});

test('catalogue aliases are unique after normalization', () => {
  const owners = new Map<string, string>();
  for (const operation of OPERATIONS_CATALOG) {
    for (const key of [operation.id, operation.title, ...operation.aliases]) {
      const normalized = key.trim().toLowerCase().replace(/\s+/g, ' ');
      const existingOwner = owners.get(normalized);
      assert.ok(
        existingOwner === undefined || existingOwner === operation.id,
        `Duplicate normalized operation key ${normalized}`,
      );
      owners.set(normalized, operation.id);
    }
  }
});

test('public projection excludes canonical executor details and secrets', () => {
  for (const operation of OPERATIONS_CATALOG) {
    const publicManifest = toPublicOperationManifest(operation);
    assert.equal('canonicalExecutor' in publicManifest, false);
    assert.doesNotMatch(JSON.stringify(publicManifest), /TOKEN|API_KEY|PASSWORD|SECRET/i);
  }
});

test('Burn Report manifest points to the existing canonical tool', () => {
  const burn = findExactOperation('burn report');
  assert.equal(burn?.canonicalExecutor.kind, 'tool');
  assert.equal(burn?.canonicalExecutor.reference, 'get_ai_cost_report');
  assert.match(formatOperationForEmbedding(burn!), /CANONICAL EXECUTOR: tool get_ai_cost_report/);
});

test('established audit aliases resolve to their canonical operations', () => {
  const expected = new Map([
    ['actfl audit', 'learning.actfl-audit'],
    ['check curriculum quality', 'learning.curriculum-audit'],
    ['find untagged lessons', 'learning.lesson-audit'],
    ['check textbook repetition', 'learning.textbook-audit'],
    ['episode integrity audit', 'capture.episode-integrity'],
    ['view audit logs', 'admin.audit-log'],
  ]);

  for (const [alias, id] of expected) {
    assert.equal(findExactOperation(alias)?.id, id, alias);
  }
});

test('audit manifests preserve canonical executors and safety metadata', () => {
  const expected = {
    'learning.actfl-audit': ['script', 'npx tsx server/scripts/actfl-audit.ts'],
    'learning.curriculum-audit': ['script', 'npx tsx server/scripts/curriculum-audit.ts'],
    'learning.lesson-audit': ['script', 'npx tsx server/scripts/lesson-audit.ts'],
    'learning.textbook-audit': ['script', 'npx tsx server/scripts/textbook_audit.ts'],
    'capture.episode-integrity': ['script', 'npx tsx server/scripts/audit-rolling-four-channel-continuity.ts --strict'],
    'admin.audit-log': ['endpoint', 'GET /api/admin/audit-logs'],
  } as const;

  for (const [id, [kind, reference]] of Object.entries(expected)) {
    const operation = findExactOperation(id);
    assert.ok(operation, id);
    assert.equal(operation.canonicalExecutor.kind, kind, id);
    assert.equal(operation.canonicalExecutor.reference, reference, id);
    assert.equal(operation.accessMode, 'read', id);
    assert.equal(operation.confirmation, 'none', id);
  }

  assert.deepEqual(findExactOperation('admin.audit-log')?.actorScope, ['david']);
  assert.match(
    findExactOperation('capture.episode-integrity')?.caveats.join(' ') ?? '',
    /patch.*require.*confirmation/i,
  );
});

test('mutating operations require confirmation', () => {
  for (const operation of OPERATIONS_CATALOG) {
    if (operation.accessMode === 'mutate') {
      assert.equal(operation.confirmation, 'required', operation.id);
    }
  }
});
