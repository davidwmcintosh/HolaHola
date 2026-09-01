/**
 * Regression guard for the autoscale startup schema boundary.
 *
 * Normal mode proves the required-column set passes and that server startup
 * invokes the read-only assertion before opening normal application traffic.
 *
 * Self-check mode removes one required column from an in-memory fixture and
 * proves the assertion fails closed without mutating a database.
 */

import { readFileSync } from 'node:fs';
import {
  assertMemoryDecayColumnsPresent,
  MEMORY_DECAY_REQUIRED_COLUMNS,
} from '../services/memory-decay-service';
import { createStartupReadinessGate } from '../startup-readiness-gate';

const selfCheck = process.argv.includes('--self-check');
const source = readFileSync(new URL('../index.ts', import.meta.url), 'utf8');
const serviceSource = readFileSync(
  new URL('../services/memory-decay-service.ts', import.meta.url),
  'utf8',
);

let failures = 0;

function check(condition: boolean, label: string): void {
  if (condition) {
    console.log(`✓ ${label}`);
  } else {
    console.error(`✗ ${label}`);
    failures++;
  }
}

function invokeGate(
  gate: ReturnType<typeof createStartupReadinessGate>,
  method: string,
  path: string,
): { statusCode: number; nextCalled: boolean; body: unknown } {
  let statusCode = 0;
  let nextCalled = false;
  let body: unknown;

  const response = {
    setHeader() {
      return response;
    },
    status(code: number) {
      statusCode = code;
      return response;
    },
    json(value: unknown) {
      body = value;
      return response;
    },
  };

  gate.middleware(
    { method, path } as any,
    response as any,
    () => {
      nextCalled = true;
    },
  );

  return { statusCode, nextCalled, body };
}

if (selfCheck) {
  const columnsWithoutImportance = MEMORY_DECAY_REQUIRED_COLUMNS.filter(
    column => column !== 'importance',
  );
  let errorMessage = '';

  try {
    assertMemoryDecayColumnsPresent(columnsWithoutImportance);
  } catch (error: any) {
    errorMessage = error?.message ?? String(error);
  }

  check(Boolean(errorMessage), 'missing required column aborts the schema assertion');
  check(errorMessage.includes('importance'), 'failure identifies the missing column');
  check(
    errorMessage.includes('reviewed Drizzle migration'),
    'failure directs operators to the migration path',
  );
} else {
  let validSetThrew = false;
  try {
    assertMemoryDecayColumnsPresent(MEMORY_DECAY_REQUIRED_COLUMNS);
  } catch {
    validSetThrew = true;
  }

  const assertionCall = source.indexOf('await assertMemoryDecaySchema()');
  const founderCorrectionCall = source.indexOf('await correctFounderEmbeddingScopes()');
  const listenCall = source.indexOf('server.listen({');
  const socketIoAttachCall = source.indexOf('io = new SocketIOServer(server');
  const unifiedWsAttachCall = source.indexOf('unifiedWss = setupUnifiedWebSocketHandler(server)');
  const readyCall = source.indexOf('startupReadiness.markReady()');
  const startingGate = createStartupReadinessGate();
  const startingHealth = invokeGate(startingGate, 'GET', '/health');
  const startingRoot = invokeGate(startingGate, 'GET', '/');
  const startingApi = invokeGate(startingGate, 'GET', '/api/me');
  startingGate.markReady();
  const readyApi = invokeGate(startingGate, 'GET', '/api/me');
  const failedGate = createStartupReadinessGate();
  failedGate.markFailed(new Error('startup sentinel'));
  const failedHealth = invokeGate(failedGate, 'GET', '/health');

  check(!validSetThrew, 'complete required-column set passes');
  check(assertionCall >= 0, 'server startup invokes assertMemoryDecaySchema');
  check(listenCall >= 0, 'server startup contains server.listen');
  check(readyCall >= 0, 'server startup contains an explicit readiness release');
  check(
    listenCall >= 0 && assertionCall >= 0 && listenCall < assertionCall,
    'health gate listens before the schema assertion',
  );
  check(
    assertionCall >= 0 && readyCall >= 0 && assertionCall < readyCall,
    'schema assertion runs before normal traffic is enabled',
  );
  check(
    founderCorrectionCall >= 0 && readyCall >= 0 && founderCorrectionCall < readyCall,
    'founder-scope correction runs before normal traffic is enabled',
  );
  check(
    founderCorrectionCall >= 0
      && socketIoAttachCall > founderCorrectionCall
      && socketIoAttachCall < readyCall,
    'Socket.IO attaches only after critical checks and immediately before readiness',
  );
  check(
    founderCorrectionCall >= 0
      && unifiedWsAttachCall > founderCorrectionCall
      && unifiedWsAttachCall < readyCall,
    'raw WebSocket handlers attach only after critical checks and before readiness',
  );
  check(
    source.includes('io!.close(() => resolve())')
      && source.includes('for (const client of unifiedWss.clients)')
      && source.includes('client.terminate()')
      && source.includes("unifiedWss!.close(() => resolve())")
      && source.includes('server.closeAllConnections?.()'),
    'critical startup failure terminates raw clients and closes socket transports',
  );
  check(
    source.includes('Promise.race([')
      && source.includes('setTimeout(resolve, 2000)'),
    'critical startup failure has a bounded HTTP shutdown fallback',
  );
  check(
    startingHealth.statusCode === 200 && !startingHealth.nextCalled,
    'startup gate serves GET /health while initialization is pending',
  );
  check(
    startingRoot.statusCode === 200 && !startingRoot.nextCalled,
    'startup gate serves GET / while initialization is pending',
  );
  check(
    startingApi.statusCode === 503 && !startingApi.nextCalled,
    'startup gate blocks normal API traffic while initialization is pending',
  );
  check(
    readyApi.nextCalled && readyApi.statusCode === 0,
    'startup gate releases normal traffic only after markReady',
  );
  check(
    failedHealth.statusCode === 500 && !failedHealth.nextCalled,
    'startup gate fails closed when critical initialization fails',
  );
  check(
    !source.includes('runMemoryDecayMigration'),
    'server startup no longer invokes a schema migration',
  );
  check(
    !serviceSource.includes('ALTER TABLE memory_embeddings'),
    'memory-decay startup service contains no ALTER TABLE',
  );
  check(
    serviceSource.includes('information_schema.columns'),
    'schema assertion uses a read-only catalog query',
  );
}

if (failures > 0) {
  console.error(`\nFAILED: ${failures} assertion(s)`);
  process.exit(1);
}

console.log(
  selfCheck
    ? '\nSELF-CHECK PASS — missing schema is detected without database mutation.'
    : '\nPASS — autoscale startup schema guard is read-only and fail-closed.',
);