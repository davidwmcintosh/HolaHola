import assert from 'node:assert/strict';
import {
  SCRATCHPAD_FIXTURE_SHA256,
  SYNTHETIC_FIXTURE_ALERT_FINGERPRINT,
  formatSyntheticFixtureAlert,
  refreshSyntheticFixtureAlert,
  scanForSyntheticFixtureDebris,
  syntheticFixtureMatchCount,
} from '../services/synthetic-fixture-sentinel';

const scratchpadContent = Array.from(
  { length: 50 },
  (_, index) => `[${index + 1}] Batch-1 note ${index + 1}`,
).join('\n\n');

const exactCoordinationPredicates = [
  "subject ~ '^\\[Coordination [0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\\] Coordination regression [0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'",
  "source_message_key ~ '^coordination:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}:agent_notes$'",
  "body LIKE 'Canonical coordination thread: %'",
  "body LIKE '%State at delivery: reassigned%'",
  "body LIKE '%Intended recipient: alden%'",
] as const;

const exactScratchpadPredicates = [
  "title LIKE 'Session notes batch #1 — %'",
  "tags @> ARRAY['session-scratchpad', 'auto-flush']::text[]",
  "participants = 'Daniela'",
  'importance = 6',
] as const;

function hasExactQueryContract(coordinationQuery: string, scratchpadQuery: string): boolean {
  return exactCoordinationPredicates.every((predicate) => coordinationQuery.includes(predicate))
    && exactScratchpadPredicates.every((predicate) => scratchpadQuery.includes(predicate));
}

assert.equal(
  (await import('node:crypto')).createHash('sha256').update(scratchpadContent).digest('hex'),
  SCRATCHPAD_FIXTURE_SHA256,
  'the sentinel hash must remain locked to the exact 50-note fixture',
);

async function scanWithRows(
  coordinationRows: Record<string, unknown>[],
  scratchpadRows: Record<string, unknown>[],
) {
  let queryNumber = 0;
  const queries: string[] = [];
  const result = await scanForSyntheticFixtureDebris({
    query: async (text) => {
      queries.push(text);
      return { rows: queryNumber++ === 0 ? coordinationRows : scratchpadRows };
    },
  });
  return { result, queries };
}

const { result: clean, queries } = await scanWithRows([], []);
assert.equal(syntheticFixtureMatchCount(clean), 0, 'clean data must pass');
assert.equal(
  hasExactQueryContract(queries[0], queries[1]),
  true,
  'scanner SQL must contain every exact fixture predicate',
);

for (const predicate of exactCoordinationPredicates) {
  assert.equal(
    hasExactQueryContract(queries[0].replace(predicate, 'TRUE'), queries[1]),
    false,
    `broadening coordination predicate must fail contract: ${predicate}`,
  );
}
for (const predicate of exactScratchpadPredicates) {
  assert.equal(
    hasExactQueryContract(queries[0], queries[1].replace(predicate, 'TRUE')),
    false,
    `broadening scratchpad predicate must fail contract: ${predicate}`,
  );
}

const coordinationId = '11111111-1111-4111-8111-111111111111';
const { result: coordinationFixture } = await scanWithRows([{
  id: coordinationId,
  created_at: new Date('2026-09-04T12:00:00.123Z'),
}], []);
assert.equal(
  syntheticFixtureMatchCount(coordinationFixture),
  1,
  'negative path: a coordination fixture projection must fail the sentinel',
);

const scratchpadId = '22222222-2222-4222-8222-222222222222';
const { result: scratchpadFixture } = await scanWithRows([], [{
  id: scratchpadId,
  created_at: new Date('2026-09-04T12:01:00.456Z'),
  content: scratchpadContent,
}]);
assert.equal(
  syntheticFixtureMatchCount(scratchpadFixture),
  1,
  'negative path: the exact scratchpad fixture must fail the sentinel',
);

const { result: nearMiss } = await scanWithRows([], [{
  id: 'near-miss',
  created_at: '2026-09-04T12:02:00.000Z',
  content: `${scratchpadContent}.`,
}]);
assert.equal(syntheticFixtureMatchCount(nearMiss), 0, 'a near-match hash must not alert');

const alert = formatSyntheticFixtureAlert({
  coordinationProjections: coordinationFixture.coordinationProjections,
  scratchpadMemories: scratchpadFixture.scratchpadMemories,
});
assert.match(alert, /coordination projections: 1/);
assert.match(alert, /scratchpad memories: 1/);
assert.match(alert, new RegExp(coordinationId));
assert.match(alert, new RegExp(scratchpadId));
assert.match(alert, /newest=2026-09-04T12:01:00.456Z/);
assert.match(alert, /No data was deleted/);

type AlertRow = { id: string; content: string; fingerprint: string; read: boolean };

function makeAlertPool() {
  const rows: AlertRow[] = [];
  let lockTail = Promise.resolve();

  return {
    rows,
    connect: async () => {
      let releaseLock = () => {};
      return {
        query: async (sql: string, values: unknown[] = []) => {
          if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
            if (sql !== 'BEGIN') releaseLock();
            return { rows: [] };
          }
          if (sql.startsWith('SELECT pg_advisory_xact_lock')) {
            const previous = lockTail;
            let unlock!: () => void;
            lockTail = new Promise<void>((resolve) => { unlock = resolve; });
            await previous;
            releaseLock = unlock;
            return { rows: [] };
          }
          if (sql.includes('UPDATE alden_notifications')) {
            const existing = rows.find((row) => (
              row.fingerprint === values[1] && row.read === false
            ));
            if (!existing) return { rows: [] };
            existing.content = String(values[0]);
            return { rows: [{ id: existing.id }] };
          }
          if (sql.includes('INSERT INTO alden_notifications')) {
            rows.push({
              id: `alert-${rows.length + 1}`,
              content: String(values[0]),
              fingerprint: String(values[1]),
              read: false,
            });
            return { rows: [{ id: rows.at(-1)!.id }] };
          }
          throw new Error(`Unexpected alert-pool SQL: ${sql}`);
        },
        release: () => {},
      };
    },
  };
}

const alertPool = makeAlertPool();
await refreshSyntheticFixtureAlert(alertPool, 'first fixture evidence');
await refreshSyntheticFixtureAlert(alertPool, 'newer fixture evidence');
assert.equal(alertPool.rows.length, 1, 'sequential refresh must retain one unread alert');
assert.equal(alertPool.rows[0].content, 'newer fixture evidence');
assert.equal(alertPool.rows[0].fingerprint, SYNTHETIC_FIXTURE_ALERT_FINGERPRINT);

const concurrentAlertPool = makeAlertPool();
await Promise.all([
  refreshSyntheticFixtureAlert(concurrentAlertPool, 'concurrent evidence A'),
  refreshSyntheticFixtureAlert(concurrentAlertPool, 'concurrent evidence B'),
]);
assert.equal(
  concurrentAlertPool.rows.length,
  1,
  'advisory lock must prevent duplicate alerts under concurrent refresh',
);
assert.ok(
  ['concurrent evidence A', 'concurrent evidence B'].includes(concurrentAlertPool.rows[0].content),
);

console.log('✓ synthetic fixture sentinel self-test passed');