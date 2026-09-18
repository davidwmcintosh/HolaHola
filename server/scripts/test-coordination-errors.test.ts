import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import {
  COORDINATION_ERROR_CATALOG,
  COORDINATION_SERVICE_ERROR_CODES,
  createCoordinationDiagnostic,
  sanitizeCoordinationProvenance,
  type CoordinationCatalogCode,
} from '../services/coordination-error-catalog';

const SERVICE_FILES = [
  'server/services/coordination-session-service.ts',
  'server/services/coordination-attempt-service.ts',
  'server/services/coordination-cleanup-service.ts',
  'server/services/coordination-lifecycle-facade-service.ts',
  'server/services/coordination-lifecycle-authorization.ts',
  'server/services/coordination-session-status.ts',
  'server/services/coordination-transport-lease-service.ts',
  'server/services/coordination-host-protocol.ts',
  'server/services/coordination-host-enrollment-service.ts',
  'server/services/coordination-host-operation-service.ts',
  'server/services/coordination-windows-generation.ts',
  'server/services/coordination-task-metadata-service.ts',
  'server/services/coordination-policy-service.ts',
  'server/services/coordination-policy-canonicalization.ts',
  'server/services/coordination-provider-adapters/registry.ts',
] as const;

async function serviceUnionCodes(): Promise<Set<string>> {
  const result = new Set<string>();
  for (const file of SERVICE_FILES) {
    const source = await readFile(file, 'utf8');
    // ErrorCode aliases and the policy validation alias are closed unions.
    for (const match of source.matchAll(
      /export type [A-Za-z]+(?:ErrorCode|PolicyValidationCode)\s*=([\s\S]*?);/g,
    )) {
      for (const code of match[1].matchAll(/['"]([^'"]+)['"]/g)) result.add(code[1]);
    }
    // A few small V2 services use an inline constructor union instead.
    for (const match of source.matchAll(/constructor\(readonly code:\s*([^)]*)\)/g)) {
      for (const code of match[1].matchAll(/['"]([^'"]+)['"]/g)) result.add(code[1]);
    }
    // The task metadata service declares its union on the code property.
    for (const match of source.matchAll(/readonly code:\s*([^;]+;)/g)) {
      for (const code of match[1].matchAll(/['"]([^'"]+)['"]/g)) result.add(code[1]);
    }
  }
  return result;
}

test('every Coordinator V2 service error union code has a stable catalog entry', async () => {
  const codes = await serviceUnionCodes();
  const catalogCodes = new Set(COORDINATION_SERVICE_ERROR_CODES);
  assert.equal(catalogCodes.size, COORDINATION_SERVICE_ERROR_CODES.length, 'catalog has duplicate codes');
  for (const code of codes) {
    assert.ok(catalogCodes.has(code), `service code is missing from catalog: ${code}`);
    const entry = COORDINATION_ERROR_CATALOG[code as CoordinationCatalogCode];
    assert.equal(entry.code, code);
    assert.ok(entry.phase);
    assert.ok(entry.retryClassification);
    assert.ok(entry.safeMessage);
    assert.ok(entry.evidenceReferenceType);
  }
});

test('catalog entries have bounded, fixed safe messages', () => {
  for (const code of COORDINATION_SERVICE_ERROR_CODES) {
    const diagnostic = createCoordinationDiagnostic(code);
    assert.equal(diagnostic.code, code);
    assert.ok(diagnostic.safeMessage.length <= 160);
    assert.deepEqual(diagnostic.provenance, {});
    assert.equal(typeof diagnostic.evidenceReferenceType, 'string');
  }
});

test('secret sentinels and raw stderr cannot enter safe messages or provenance', () => {
  const secretSentinel = 'COORDINATOR_SECRET_SENTINEL';
  const rawStderr = 'raw stderr: password=COORDINATOR_SECRET_SENTINEL';
  const provenance = sanitizeCoordinationProvenance({
    service: 'coordinator',
    executableRole: 'worker',
    exitStatus: 1,
    secret: secretSentinel,
    token: secretSentinel,
    stderr: rawStderr,
    diagnosticText: rawStderr,
    unknownField: secretSentinel,
    requestId: 'request-123',
  });
  const diagnostic = createCoordinationDiagnostic('host_child_unclassified_exit', {
    ...provenance,
    secret: secretSentinel,
    stderr: rawStderr,
  });
  const serialized = JSON.stringify(diagnostic);
  assert.equal(serialized.includes(secretSentinel), false);
  assert.equal(serialized.includes(rawStderr), false);
  assert.equal(diagnostic.safeMessage.includes(secretSentinel), false);
  assert.equal(diagnostic.safeMessage.includes(rawStderr), false);
  assert.deepEqual(diagnostic.provenance, {
    service: 'coordinator',
    executableRole: 'worker',
    exitStatus: 1,
    requestId: 'request-123',
  });
});

test('provenance is strictly bounded to non-secret primitive values', () => {
  const result = sanitizeCoordinationProvenance({
    service: 'coordinator',
    operation: 'validate',
    evidenceCount: 2,
    retryCount: 1,
    sessionId: 'session-1',
    nested: { secret: 'do-not-copy' },
    requestId: 'x'.repeat(129),
    attemptId: 'line\nbreak',
    exitStatus: 1.5,
    leaseId: 'lease-1',
  });
  assert.deepEqual(result, {
    service: 'coordinator',
    operation: 'validate',
    evidenceCount: 2,
    retryCount: 1,
    sessionId: 'session-1',
    leaseId: 'lease-1',
  });
  assert.equal(
    sanitizeCoordinationProvenance({ exitStatus: -1073741510 }).exitStatus,
    -1073741510,
  );
  assert.deepEqual(
    sanitizeCoordinationProvenance({ exitStatus: 2_147_483_648 }),
    {},
  );
});
