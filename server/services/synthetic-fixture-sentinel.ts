import { createHash } from 'node:crypto';

export const SCRATCHPAD_FIXTURE_SHA256 =
  '3144ce482b7c1843e14674a6af94dd268258e8d0a5122842629dcc858ff71890';

export type SyntheticFixtureMatch = {
  id: string;
  createdAt: Date;
};

export type SyntheticFixtureSentinelResult = {
  coordinationProjections: SyntheticFixtureMatch[];
  scratchpadMemories: SyntheticFixtureMatch[];
};

type Queryable = {
  query: (text: string, values?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
};

type TransactionClient = Queryable & { release: () => void };

type Connectable = {
  connect: () => Promise<TransactionClient>;
};

export const SYNTHETIC_FIXTURE_ALERT_FINGERPRINT =
  'shared_neon_synthetic_fixture_debris';

function asMatch(row: Record<string, unknown>): SyntheticFixtureMatch {
  return {
    id: String(row.id),
    createdAt: row.created_at instanceof Date
      ? row.created_at
      : new Date(String(row.created_at)),
  };
}

/**
 * Read-only scan for the two exact synthetic fixtures that previously escaped
 * their disposable CI database boundary.
 */
export async function scanForSyntheticFixtureDebris(
  db: Queryable,
): Promise<SyntheticFixtureSentinelResult> {
  const coordination = await db.query(`
    SELECT id, created_at
    FROM agent_notes
    WHERE subject ~ '^\\[Coordination [0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\\] Coordination regression [0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      AND source_message_key ~ '^coordination:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}:agent_notes$'
      AND body LIKE 'Canonical coordination thread: %'
      AND body LIKE '%State at delivery: reassigned%'
      AND body LIKE '%Intended recipient: alden%'
    ORDER BY created_at DESC, id
  `);

  const scratchpadCandidates = await db.query(`
    SELECT id, created_at, content
    FROM conversation_memories
    WHERE title LIKE 'Session notes batch #1 — %'
      AND tags @> ARRAY['session-scratchpad', 'auto-flush']::text[]
      AND participants = 'Daniela'
      AND importance = 6
    ORDER BY created_at DESC, id
  `);

  const scratchpadMemories = scratchpadCandidates.rows
    .filter((row) => (
      createHash('sha256').update(String(row.content)).digest('hex')
      === SCRATCHPAD_FIXTURE_SHA256
    ))
    .map(asMatch);

  return {
    coordinationProjections: coordination.rows.map(asMatch),
    scratchpadMemories,
  };
}

export function syntheticFixtureMatchCount(result: SyntheticFixtureSentinelResult): number {
  return result.coordinationProjections.length + result.scratchpadMemories.length;
}

function summarizeMatches(label: string, matches: SyntheticFixtureMatch[]): string {
  if (matches.length === 0) return `${label}: 0`;
  const newest = matches.reduce(
    (latest, match) => match.createdAt > latest ? match.createdAt : latest,
    matches[0].createdAt,
  );
  return `${label}: ${matches.length}; newest=${newest.toISOString()}; IDs=${matches.map((m) => m.id).join(',')}`;
}

export function formatSyntheticFixtureAlert(result: SyntheticFixtureSentinelResult): string {
  return [
    'Synthetic CI fixture records were detected in shared Neon. No data was deleted.',
    summarizeMatches('coordination projections', result.coordinationProjections),
    summarizeMatches('scratchpad memories', result.scratchpadMemories),
    'Investigate the database-boundary regression and remove records only through an explicitly approved cleanup.',
  ].join('\n');
}

/**
 * Refreshes the single unread founder alert under a transaction-scoped
 * PostgreSQL advisory lock, so concurrent verifier runs cannot both insert.
 */
export async function refreshSyntheticFixtureAlert(
  db: Connectable,
  content: string,
): Promise<void> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      [SYNTHETIC_FIXTURE_ALERT_FINGERPRINT],
    );
    const updated = await client.query(
      `UPDATE alden_notifications
       SET content = $1, created_at = NOW()
       WHERE id = (
         SELECT id
         FROM alden_notifications
         WHERE fingerprint = $2 AND read = false
         ORDER BY created_at DESC
         LIMIT 1
       )
       RETURNING id`,
      [content, SYNTHETIC_FIXTURE_ALERT_FINGERPRINT],
    );
    if (updated.rows.length === 0) {
      await client.query(
        `INSERT INTO alden_notifications
           (content, triggered_by, severity, read, fingerprint)
         VALUES ($1, 'system-health-verifier', 'alert', false, $2)`,
        [content, SYNTHETIC_FIXTURE_ALERT_FINGERPRINT],
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Preserve the original transaction error.
    }
    throw error;
  } finally {
    client.release();
  }
}