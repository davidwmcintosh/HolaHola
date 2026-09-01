/**
 * Regression guard for the autoscale startup schema boundary.
 *
 * Normal mode proves the required-column set passes and that server startup
 * invokes the read-only assertion before server.listen().
 *
 * Self-check mode removes one required column from an in-memory fixture and
 * proves the assertion fails closed without mutating a database.
 */

import { readFileSync } from 'node:fs';
import {
  assertMemoryDecayColumnsPresent,
  MEMORY_DECAY_REQUIRED_COLUMNS,
} from '../services/memory-decay-service';

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
  const listenCall = source.indexOf('server.listen({');

  check(!validSetThrew, 'complete required-column set passes');
  check(assertionCall >= 0, 'server startup invokes assertMemoryDecaySchema');
  check(listenCall >= 0, 'server startup contains server.listen');
  check(
    assertionCall >= 0 && listenCall >= 0 && assertionCall < listenCall,
    'schema assertion runs before server.listen',
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