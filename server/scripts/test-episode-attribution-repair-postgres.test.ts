import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { Client } from 'pg';
import { getVerifiedCiDatabaseUrl } from '../ci-database';
import { commitEpisodeAttributionRepair, type AttributionRepairSql } from '../services/episode-attribution-repair-commit';
import { repairEpisodeClaudeAttribution } from '../services/episode-claude-attribution-repair';

const session = 'approved-synthetic-session';
const beforeContent = 'David [Claude Code]: Question?\n\nClaude Code: Exact words — punctuation! 🙂\nSecond line.\n';
const source = {
  id: 'synthetic-source',
  tags: ['source-claude-code', `capture-id:cc-${session}-1`],
  content: beforeContent,
};

// Real PostgreSQL transport for the SAME parameterized SQL template invoked by
// the Neon HTTP CLI. Never import the historical CLI (it targets a real record).
function postgresSql(client: Client): AttributionRepairSql {
  return async (strings, ...values) => {
    const text = strings.reduce((query, part, index) =>
      query + (index ? `$${index}` : '') + part, '');
    return (await client.query(text, values)).rows;
  };
}

test('isolated database gate refuses external and mismatched targets', () => {
  const local = 'postgresql://fixture@127.0.0.1:5432/disposable';
  assert.equal(getVerifiedCiDatabaseUrl({}), undefined);
  assert.equal(getVerifiedCiDatabaseUrl({ CI_DATABASE_URL: local }), undefined);
  assert.throws(() => getVerifiedCiDatabaseUrl({
    CI: 'true', CI_DATABASE_URL: 'postgresql://fixture@shared.example/disposable',
    NEON_SHARED_DATABASE_URL: 'postgresql://fixture@shared.example/disposable',
  }), /job-local/);
  assert.throws(() => getVerifiedCiDatabaseUrl({
    CI: 'true', CI_DATABASE_URL: local, NEON_SHARED_DATABASE_URL: 'postgresql://fixture@shared.example/live',
  }), /must match/);
});

test('historical attribution repair protects concurrent PostgreSQL authors', async context => {
  // Check before creating clients, schemas, fixtures, files, or cleanup paths.
  const url = getVerifiedCiDatabaseUrl();
  if (!url) {
    if (process.env.CI === 'true') throw new Error('CI requires a verified disposable database for attribution concurrency coverage');
    context.skip('requires CI=true and matching job-local CI_DATABASE_URL / NEON_SHARED_DATABASE_URL');
    return;
  }
  const repairClient = new Client({ connectionString: url });
  const authorClient = new Client({ connectionString: url });
  const schema = `attribution_fixture_${randomUUID().replaceAll('-', '')}`;
  const episodeId = randomUUID();
  const dir = mkdtempSync(join(tmpdir(), 'attribution-repair-'));
  const replica = join(dir, 'synthetic-episode.md');
  const sentinel = 'Existing replica must remain untouched.\n';
  const sql = postgresSql(repairClient);
  let schemaCreated = false;
  try {
    await repairClient.connect();
    await authorClient.connect();
    assert.notEqual(
      (await repairClient.query('SELECT pg_backend_pid() AS pid')).rows[0].pid,
      (await authorClient.query('SELECT pg_backend_pid() AS pid')).rows[0].pid,
      'the competing writer must use an independent database session',
    );
    await repairClient.query(`CREATE SCHEMA "${schema}"`);
    schemaCreated = true;
    await repairClient.query(`SET search_path TO "${schema}"`);
    await authorClient.query(`SET search_path TO "${schema}"`);
    await repairClient.query('CREATE TABLE conversation_memories (id uuid PRIMARY KEY, content text NOT NULL)');

    async function snapshot() {
      const { rows } = await repairClient.query('SELECT content FROM conversation_memories WHERE id = $1', [episodeId]);
      const before = rows[0].content as string;
      const repaired = repairEpisodeClaudeAttribution(before, [source], session);
      return { episodeId, beforeContent: before, content: repaired.content, editCount: repaired.edits.length };
    }
    async function reset() {
      await repairClient.query('INSERT INTO conversation_memories (id, content) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content', [episodeId, beforeContent]);
      writeFileSync(replica, sentinel);
    }
    async function stored() {
      return (await authorClient.query('SELECT content FROM conversation_memories WHERE id = $1', [episodeId])).rows[0].content as string;
    }
    function stages() {
      const starts: string[] = [];
      return {
        starts,
        writeReplica(content: string) {
          starts.push('markdown');
          writeFileSync(replica, content);
        },
        async reembed(content: string) {
          starts.push('embedding');
          assert.equal(readFileSync(replica, 'utf8'), content);
          return content;
        },
      };
    }
    async function authorWrite(content: string) {
      const result = await authorClient.query('UPDATE conversation_memories SET content = $1 WHERE id = $2 RETURNING content', [content, episodeId]);
      assert.equal(result.rowCount, 1);
      assert.equal(result.rows[0].content, content);
      // Autocommit has completed before the stale repair is resumed.
    }
    for (const [name, concurrent] of [
      ['intervening append', beforeContent + '\nLUCA [Other Hat]: New authored bytes — 🙂\n'],
      ['competing same-length edit', beforeContent.replace('Question?', 'Different')],
    ]) {
      await context.test(name, async () => {
        await reset();
        const stale = await snapshot();
        assert.equal(stale.editCount, 1, 'fixture must exercise the UPDATE, not an empty repair');
        if (name === 'competing same-length edit') {
          assert.equal(Buffer.byteLength(concurrent), Buffer.byteLength(stale.beforeContent));
          assert.equal(concurrent.length, stale.beforeContent.length);
        }
        await authorWrite(concurrent);
        const work = stages();
        await assert.rejects(commitEpisodeAttributionRepair(sql, stale, work), /Canonical content changed concurrently/);
        assert.equal(await stored(), concurrent, 'preserve the concurrent author byte-for-byte');
        assert.deepEqual(work.starts, [], 'neither Markdown nor embedding may start');
        assert.equal(readFileSync(replica, 'utf8'), sentinel);
      });
    }
    await context.test('successful uncontended repair and idempotent fresh retry', async () => {
      await reset();
      const original = await snapshot();
      const first = stages();
      assert.equal(await commitEpisodeAttributionRepair(sql, original, first), original.content);
      assert.deepEqual(first.starts, ['markdown', 'embedding']);
      assert.equal(await stored(), beforeContent.replace('Claude Code: Exact', 'LUCA [Claude Code]: Exact'));
      assert.equal(readFileSync(replica, 'utf8'), original.content);
      const retry = await snapshot();
      assert.equal(retry.editCount, 0);
      const second = stages();
      // Retrying refreshes downstream stages, as the CLI does, without issuing
      // another UPDATE. This also catches accidental writes on the no-op path.
      let updates = 0;
      const retrySql: AttributionRepairSql = async (strings, ...values) => {
        if (/UPDATE/.test(strings.join(''))) updates++;
        return sql(strings, ...values);
      };
      assert.equal(await commitEpisodeAttributionRepair(retrySql, retry, second), original.content);
      assert.equal(updates, 0);
      assert.deepEqual(second.starts, ['markdown', 'embedding']);
      assert.equal(await stored(), original.content);
    });
    await context.test('writer after successful UPDATE still blocks all downstream stages', async () => {
      await reset();
      const stale = await snapshot();
      const concurrent = stale.content + '\nDavid: A later committed addition.\n';
      let updated = false;
      const racedSql: AttributionRepairSql = async (strings, ...values) => {
        const rows = await sql(strings, ...values);
        if (/UPDATE/.test(strings.join(''))) {
          assert.equal(rows.length, 1);
          updated = true;
          await authorWrite(concurrent);
        }
        return rows;
      };
      const work = stages();
      await assert.rejects(commitEpisodeAttributionRepair(racedSql, stale, work), /Post-update canonical snapshot differs/);
      assert.equal(updated, true);
      assert.equal(await stored(), concurrent);
      assert.deepEqual(work.starts, []);
      assert.equal(readFileSync(replica, 'utf8'), sentinel);
    });
    await context.test('no-edit retry cannot publish a stale snapshot', async () => {
      await reset();
      await commitEpisodeAttributionRepair(sql, await snapshot(), stages());
      const stale = await snapshot();
      assert.equal(stale.editCount, 0);
      const concurrent = stale.content + '\nDavid: Addition before the retry.\n';
      await authorWrite(concurrent);
      writeFileSync(replica, sentinel);
      const work = stages();
      await assert.rejects(commitEpisodeAttributionRepair(sql, stale, work), /Post-update canonical snapshot differs/);
      assert.equal(await stored(), concurrent);
      assert.deepEqual(work.starts, []);
      assert.equal(readFileSync(replica, 'utf8'), sentinel);
    });
  } finally {
    try {
      if (schemaCreated) await repairClient.query(`DROP SCHEMA "${schema}" CASCADE`);
    } finally {
      await Promise.all([repairClient.end(), authorClient.end()]);
      rmSync(dir, { recursive: true, force: true });
    }
  }
});