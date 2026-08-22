/**
 * global-pool-conversation-leak-guard.test.ts
 *
 * Regression guard for the conversation-memory ownership model:
 *
 *   • GLOBAL (userId=NULL) conversation_memory rows are globally accessible —
 *     correct and intentional for episodes, teaching notes, team decisions.
 *
 *   • PRIVATE (userId=ownerUserId) conversation_memory rows are accessible
 *     ONLY to the owning user via the user-pool query arm, never to other users.
 *
 *   • The production write path (reembedConversationMemory with a userId) stores
 *     the embedding under the supplied userId, ensuring founder chat transcripts
 *     written by founder-chat-sync are user-scoped from the moment of indexing.
 *
 * Tests
 * ─────
 * 1. Owner retrieves their user-scoped conversation_memory embedding (user pool).
 * 2. Another user CANNOT retrieve the owner's user-scoped embedding (not in their
 *    user pool, and not in the global pool since the row has a userId).
 * 3. A null-scoped conversation_memory (simulating an episode) IS returned to any
 *    user who searches with that type — global access is intentional.
 * 4. Production write-path smoke-test: reembedConversationMemory(id, ownerUserId)
 *    inserts a memory_embeddings row with the correct userId; skipped if no
 *    OPENAI_API_KEY is available so the test suite remains runnable offline.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { sql, eq, and } from 'drizzle-orm';
import { getSharedDb, getUserDb } from '../db';
import { users, conversationMemories, memoryEmbeddings } from '@shared/schema';
import { semanticSearchByVector } from '../services/semantic-memory-service';
import { runMemoryDecayMigration } from '../services/memory-decay-service';
import { correctFounderEmbeddingScopes } from '../services/memory-embedding-indexer';

// ── Test fixtures ─────────────────────────────────────────────────────────────

// 768-dimensional unit vector along the first axis.
// This is the dimension used by text-embedding-3-small (with dimensions=768).
// Cosine similarity with this exact vector is 1.0 — guaranteed top-ranked if reachable.
const DIM = 768;
const UNIT_VEC: number[] = Array.from({ length: DIM }, (_, i) => (i === 0 ? 1.0 : 0.0));

// Sentinel IDs — unique prefix prevents collision with real data.
// OWNER: the user who owns the private transcript.
// OTHER: a different user who should NOT see it.
const OWNER_USER_ID  = 'ci-leak-guard-owner-user-0001';
const OTHER_USER_ID  = 'ci-leak-guard-other-user-0001';
// Memory IDs used across tests
const PRIVATE_MEM_ID = 'ci-leak-guard-private-mem-0001';
const GLOBAL_MEM_ID  = 'ci-leak-guard-global-mem-0001';
// Content hash sentinels
const PRIVATE_HASH   = 'ci-leak-guard-private-hash-0001';
const GLOBAL_HASH    = 'ci-leak-guard-global-hash-0001';

// ── Fallback-resolver test fixtures (5th subtest) ─────────────────────────────
// A second "founder" whose conversation is stored in the conversations table.
// reembedConversationMemory is called WITHOUT an explicit userId — the resolver
// must find FOUNDER2_USER_ID via the cid: tag, not fall back to any hard-coded ID.
const FOUNDER2_USER_ID  = 'ci-leak-guard-founder2-user-0001';
const FOUNDER2_CONV_ID  = 'ci-leak-guard-founder2-conv-0001';
const FOUNDER2_MEM_ID   = 'ci-leak-guard-founder2-mem-0001';
const FOUNDER2_MEM_HASH = 'ci-leak-guard-founder2-hash-0001';

// ── Production write-path test (requires OpenAI) ──────────────────────────────
const PROD_MEM_TITLE = 'CI Leak Guard Production Write Test';
let prodMemId: string | null = null;

// ─────────────────────────────────────────────────────────────────────────────

describe('Global pool security — conversation-memory ownership model', () => {
  let db: ReturnType<typeof getSharedDb>;

  before(async () => {
    db = getSharedDb();

    // Ensure strength/last_reinforced_at/pinned/importance columns exist.
    // runMemoryDecayMigration uses ADD COLUMN IF NOT EXISTS — safe to call repeatedly.
    // This is needed in CI where the server's delayed boot-time migration has not run.
    await runMemoryDecayMigration();

    // Create real user rows (FK constraint on memory_embeddings.user_id).
    await db.execute(sql`
      INSERT INTO users (id, role)
      VALUES (${OWNER_USER_ID}, 'student'), (${OTHER_USER_ID}, 'student'), (${FOUNDER2_USER_ID}, 'developer')
      ON CONFLICT (id) DO NOTHING
    `);

    // ── Fallback-resolver fixtures ─────────────────────────────────────────────
    // Create a conversations row owned by FOUNDER2 so the resolver can look it up.
    const userDb = getUserDb();
    await userDb.execute(sql.raw(`
      INSERT INTO conversations (id, user_id, language, difficulty, message_count)
      VALUES ('${FOUNDER2_CONV_ID}', '${FOUNDER2_USER_ID}', 'english', 'intermediate', 3)
      ON CONFLICT (id) DO NOTHING
    `));
    // Create a conversation_memories row tagged founder-chat with cid: pointing to FOUNDER2_CONV_ID.
    // The resolver must extract the cid: tag and return FOUNDER2_USER_ID (not any hard-coded value).
    await db.execute(sql`
      INSERT INTO conversation_memories
        (id, title, summary, content, entry_type, importance, arc_name, tags)
      VALUES (
        ${FOUNDER2_MEM_ID},
        'CI Fallback Resolver Test — Founder 2',
        'Regression: fallback resolver must derive userId from cid: tag',
        'Founder2: Hello.\nDaniela: Hi Founder2.',
        'conversation',
        7,
        'ci-regression',
        ARRAY['founder-chat', ${'cid:' + FOUNDER2_CONV_ID}]
      )
      ON CONFLICT (id) DO NOTHING
    `);

    // ── Private embedding (owner-scoped) ─────────────────────────────────────
    // Simulates what reembedConversationMemory(id, OWNER_USER_ID) writes.
    // The row has userId = OWNER_USER_ID → user-pool only for OWNER.
    await db.execute(sql`
      INSERT INTO memory_embeddings
        (memory_type, memory_id, user_id, embedding, content_hash, strength, pinned)
      VALUES (
        'conversation_memory',
        ${PRIVATE_MEM_ID},
        ${OWNER_USER_ID},
        ${JSON.stringify(UNIT_VEC)}::jsonb,
        ${PRIVATE_HASH},
        0.9,
        false
      )
      ON CONFLICT (memory_type, memory_id) DO UPDATE
        SET user_id       = EXCLUDED.user_id,
            embedding     = EXCLUDED.embedding,
            content_hash  = EXCLUDED.content_hash,
            strength      = EXCLUDED.strength
    `);

    // ── Global embedding (null-scoped, simulating an episode) ─────────────────
    // Episodes are stored in conversation_memories with userId=NULL — globally visible.
    // importance=10 / strength=1.0 ensures this fixture deterministically ranks at the
    // top of the 5000-row global pool cap regardless of how many other rows exist in
    // the live DB.  Without high importance it could be cut by the cap on a busy DB.
    await db.execute(sql`
      INSERT INTO memory_embeddings
        (memory_type, memory_id, user_id, embedding, content_hash, strength, pinned, importance)
      VALUES (
        'conversation_memory',
        ${GLOBAL_MEM_ID},
        NULL,
        ${JSON.stringify(UNIT_VEC)}::jsonb,
        ${GLOBAL_HASH},
        1.0,
        false,
        10
      )
      ON CONFLICT (memory_type, memory_id) DO UPDATE
        SET user_id       = EXCLUDED.user_id,
            embedding     = EXCLUDED.embedding,
            content_hash  = EXCLUDED.content_hash,
            strength      = EXCLUDED.strength,
            importance    = EXCLUDED.importance
    `);
  });

  after(async () => {
    // Always clean up — even if assertions failed.
    try {
      await db.execute(sql`
        DELETE FROM memory_embeddings
        WHERE memory_id IN (${PRIVATE_MEM_ID}, ${GLOBAL_MEM_ID})
          AND memory_type = 'conversation_memory'
      `);
      if (prodMemId) {
        await db.execute(sql`
          DELETE FROM memory_embeddings WHERE memory_id = ${prodMemId}
            AND memory_type IN ('conversation_memory', 'conversation_summary', 'conversation_chunk')
        `);
        await db.execute(sql`
          DELETE FROM conversation_memories WHERE id = ${prodMemId}
        `);
      }
    } catch { /* non-fatal */ }
    // ── Fallback-resolver fixtures cleanup ─────────────────────────────────────
    try {
      await db.execute(sql`
        DELETE FROM memory_embeddings
        WHERE memory_id = ${FOUNDER2_MEM_ID}
          OR memory_id LIKE ${FOUNDER2_MEM_ID + ':chunk:%'}
      `);
      await db.execute(sql`DELETE FROM conversation_memories WHERE id = ${FOUNDER2_MEM_ID}`);
      const userDb = getUserDb();
      await userDb.execute(sql.raw(`DELETE FROM conversations WHERE id = '${FOUNDER2_CONV_ID}'`));
    } catch { /* non-fatal */ }
    try {
      await db.execute(sql`
        DELETE FROM users WHERE id IN (${OWNER_USER_ID}, ${OTHER_USER_ID}, ${FOUNDER2_USER_ID})
      `);
    } catch { /* non-fatal */ }
  });

  it('owner retrieves their user-scoped conversation_memory (user pool)', async () => {
    const results = await semanticSearchByVector(
      OWNER_USER_ID,
      UNIT_VEC,
      50,
      ['conversation_memory'],
    );
    const found = results.find(r => r.memoryId === PRIVATE_MEM_ID);
    assert.ok(
      found !== undefined && found.similarity > 0.99,
      `Owner should find their private embedding via user pool — results: ${JSON.stringify(results.map(r => r.memoryId))}`,
    );
  });

  it('other user cannot retrieve the owner\'s user-scoped embedding', async () => {
    const results = await semanticSearchByVector(
      OTHER_USER_ID,
      UNIT_VEC,
      50,
      ['conversation_memory'],
    );
    const leaked = results.find(r => r.memoryId === PRIVATE_MEM_ID);
    assert.equal(
      leaked,
      undefined,
      `Owner-scoped conversation_memory (${PRIVATE_MEM_ID}) leaked to another user — ownership breach`,
    );
  });

  it('null-scoped conversation_memory (episode) is globally accessible to any user', async () => {
    const results = await semanticSearchByVector(
      OTHER_USER_ID,
      UNIT_VEC,
      50,
      ['conversation_memory'],
    );
    const found = results.find(r => r.memoryId === GLOBAL_MEM_ID);
    assert.ok(
      found !== undefined,
      `Null-scoped conversation_memory (episode) should be globally accessible — results: ${JSON.stringify(results.map(r => r.memoryId))}`,
    );
  });

  it('production write-path: reembedConversationMemory(id, userId) stores embedding under owner userId', async () => {
    const hasKey = !!(process.env.USER_OPENAI_API_KEY || process.env.OPENAI_API_KEY);
    if (!hasKey) {
      // Skip when no API key is available (offline / CI environments without embeddings).
      console.log('  [SKIP] No OpenAI API key — production write-path test skipped');
      return;
    }

    // 1. Seed a real conversation_memories row.
    const inserted = await db.execute(sql`
      INSERT INTO conversation_memories
        (title, summary, content, entry_type, importance, arc_name)
      VALUES (
        ${PROD_MEM_TITLE},
        'CI regression for ownership write path',
        'Luca: This is a CI test.\nDaniela: I see.',
        'conversation',
        7,
        'ci-regression'
      )
      RETURNING id
    `);
    const row = (inserted as any).rows?.[0] ?? (inserted as any)[0];
    prodMemId = row?.id ?? null;
    assert.ok(prodMemId, 'Failed to seed conversation_memories row for production write test');

    // 2. Call the production write path with OWNER_USER_ID.
    const { reembedConversationMemory } = await import('../scripts/reembed-memory');
    await reembedConversationMemory(prodMemId!, OWNER_USER_ID);

    // 3. Verify the embedding was stored under OWNER_USER_ID (not null).
    const embRows = await db.execute(sql`
      SELECT user_id FROM memory_embeddings
      WHERE memory_id = ${prodMemId}
        AND memory_type = 'conversation_memory'
      LIMIT 1
    `);
    const embRow = (embRows as any).rows?.[0] ?? (embRows as any)[0];
    assert.equal(
      embRow?.user_id,
      OWNER_USER_ID,
      `reembedConversationMemory should write userId=${OWNER_USER_ID} but got userId=${embRow?.user_id}`,
    );

    // 4. OWNER retrieves it; OTHER cannot.
    const ownerResults = await semanticSearchByVector(OWNER_USER_ID, UNIT_VEC, 10, ['conversation_memory']);
    // (similarity will be low since the embedding is real text, not UNIT_VEC — just check DB userId)
    const otherResults = await semanticSearchByVector(OTHER_USER_ID, UNIT_VEC, 10, ['conversation_memory']);
    const leakToOther = otherResults.find(r => r.memoryId === prodMemId);
    assert.equal(
      leakToOther,
      undefined,
      `Production-written owner-scoped embedding leaked to OTHER_USER_ID — ownership breach`,
    );
  });

  it('quarantine: correctFounderEmbeddingScopes deletes pre-existing null-scoped embedding for cid-absent founder row', async () => {
    // Regression: a founder-chat row with NO cid: tag that already has a null-scoped
    // embedding (e.g. from a previous indexer run before this fix) must have that
    // embedding DELETED by correctFounderEmbeddingScopes, not left in the global pool.
    const ORPHAN_MEM_ID = 'ci-leak-guard-orphan-mem-0001';
    try {
      // Seed conversation_memories row with NO cid: tag
      await db.execute(sql`
        INSERT INTO conversation_memories
          (id, title, summary, content, entry_type, importance, arc_name, tags)
        VALUES (
          ${ORPHAN_MEM_ID},
          'CI Quarantine Test — Pre-existing Global Founder Embedding',
          'Regression: correctFounderEmbeddingScopes must delete this null-scoped embedding',
          'David: Hello orphan.\nDaniela: Hi David orphan.',
          'conversation',
          7,
          'ci-regression',
          ARRAY['founder-chat']
        )
        ON CONFLICT (id) DO NOTHING
      `);

      // Seed a null-scoped (global) embedding — simulates a pre-fix indexer run
      await db.execute(sql`
        INSERT INTO memory_embeddings
          (memory_type, memory_id, user_id, embedding, content_hash, strength, pinned)
        VALUES (
          'conversation_memory',
          ${ORPHAN_MEM_ID},
          NULL,
          ${JSON.stringify(UNIT_VEC)}::jsonb,
          'ci-orphan-hash-0001',
          0.9,
          false
        )
        ON CONFLICT (memory_type, memory_id) DO UPDATE
          SET user_id      = NULL,
              embedding    = EXCLUDED.embedding,
              content_hash = EXCLUDED.content_hash
      `);

      // Confirm the null-scoped embedding exists before correction
      const before = await db.execute(sql`
        SELECT user_id FROM memory_embeddings
        WHERE memory_id = ${ORPHAN_MEM_ID} AND memory_type = 'conversation_memory'
        LIMIT 1
      `);
      const beforeRow = (before as any).rows?.[0] ?? (before as any)[0];
      assert.equal(beforeRow?.user_id, null, 'pre-condition: embedding should be null-scoped before correction');

      // Run correctFounderEmbeddingScopes (imported dynamically to avoid import-time side effects)
      const { correctFounderEmbeddingScopes } = await import('../services/memory-embedding-indexer');
      await correctFounderEmbeddingScopes();

      // Verify: the null-scoped embedding must have been DELETED (quarantined)
      const after = await db.execute(sql`
        SELECT user_id FROM memory_embeddings
        WHERE memory_id = ${ORPHAN_MEM_ID} AND memory_type = 'conversation_memory'
        LIMIT 1
      `);
      const afterRow = (after as any).rows?.[0] ?? (after as any)[0];
      assert.equal(
        afterRow,
        undefined,
        `Pre-existing null-scoped founder embedding was not deleted by correctFounderEmbeddingScopes — ` +
        `it remains in the global pool (user_id=${afterRow?.user_id}) and can be returned to any student`,
      );

      // Verify: cannot be retrieved via semanticSearchByVector for OTHER_USER_ID
      const results = await semanticSearchByVector(OTHER_USER_ID, UNIT_VEC, 10, ['conversation_memory']);
      const leaked = results.find(r => r.memoryId === ORPHAN_MEM_ID);
      assert.equal(
        leaked,
        undefined,
        `Quarantined orphan embedding still shows up in OTHER_USER_ID semantic search — global pool is poisoned`,
      );
    } finally {
      await db.execute(sql`DELETE FROM memory_embeddings WHERE memory_id = ${ORPHAN_MEM_ID}`);
      await db.execute(sql`DELETE FROM conversation_memories WHERE id = ${ORPHAN_MEM_ID}`);
    }
  });

  it('cid-absent guard: founder-tagged row without cid: tag produces NO embedding (global pool not poisoned)', async () => {
    // This subtest verifies the security invariant: if a conversation_memories row is
    // tagged 'founder-chat' but has no cid: tag, reembedConversationMemory must not
    // create ANY embedding (not even a null-scoped one), because null-scoped embeddings
    // enter the global recall pool accessible to ALL students.
    const hasKey = !!(process.env.USER_OPENAI_API_KEY || process.env.OPENAI_API_KEY);
    if (!hasKey) {
      console.log('  [SKIP] No OpenAI API key — cid-absent guard test skipped');
      return;
    }

    const NO_CID_MEM_ID = 'ci-leak-guard-no-cid-mem-0001';
    try {
      // Seed a founder-chat row with NO cid: tag
      await db.execute(sql`
        INSERT INTO conversation_memories
          (id, title, summary, content, entry_type, importance, arc_name, tags)
        VALUES (
          ${NO_CID_MEM_ID},
          'CI Guard Test — Founder Chat Without CID Tag',
          'Should never be embedded — no cid: tag means owner is unresolvable',
          'David: Hello.\nDaniela: Hi David.',
          'conversation',
          7,
          'ci-regression',
          ARRAY['founder-chat']
        )
        ON CONFLICT (id) DO NOTHING
      `);

      // Ensure no prior embedding exists
      await db.execute(sql`
        DELETE FROM memory_embeddings WHERE memory_id = ${NO_CID_MEM_ID}
      `);

      // Call reembedConversationMemory without explicit userId — must skip, not create a global embedding
      const { reembedConversationMemory } = await import('../scripts/reembed-memory');
      await reembedConversationMemory(NO_CID_MEM_ID /* no explicit userId */);

      // Verify: NO embedding was created for this row
      const embRows = await db.execute(sql`
        SELECT memory_id, user_id FROM memory_embeddings
        WHERE memory_id = ${NO_CID_MEM_ID}
        LIMIT 1
      `);
      const emb = (embRows as any).rows?.[0] ?? (embRows as any)[0];
      assert.equal(
        emb,
        undefined,
        `founder-chat row without cid: should produce NO embedding (got userId=${emb?.user_id}); null-scoped embedding would expose private content globally`,
      );
    } finally {
      // Clean up
      await db.execute(sql`DELETE FROM memory_embeddings WHERE memory_id = ${NO_CID_MEM_ID}`);
      await db.execute(sql`DELETE FROM conversation_memories WHERE id = ${NO_CID_MEM_ID}`);
    }
  });

  it('straggler patch: founder-tagged row with valid cid: embeds under the correct owner, not a hard-coded ID', async () => {
    // Regression: the straggler auto-patch path (postCycleStragglerCheck / patchSingleStraggler)
    // must derive userId from cid: → conversations.user_id, not from a hard-coded admin ID.
    // This subtest seeds a founder-chat straggler owned by FOUNDER2_USER_ID and confirms:
    //   • patchSingleStraggler returns 'patched'
    //   • the embedding is stored under FOUNDER2_USER_ID (not null, not a hard-coded ID)
    const hasKey = !!(process.env.USER_OPENAI_API_KEY || process.env.OPENAI_API_KEY);
    if (!hasKey) {
      console.log('  [SKIP] No OpenAI API key — straggler ownership test skipped');
      return;
    }

    const STRAG_MEM_ID = 'ci-leak-guard-straggler-owned-0001';
    try {
      // Seed a founder-chat row with cid: → FOUNDER2_CONV_ID (owned by FOUNDER2_USER_ID).
      await db.execute(sql`
        INSERT INTO conversation_memories
          (id, title, summary, content, entry_type, importance, arc_name, tags)
        VALUES (
          ${STRAG_MEM_ID},
          'CI Straggler Ownership Test — Founder 2',
          'Straggler path must use data-derived userId, not hard-coded admin ID',
          'Founder2: This is a straggler test.',
          'conversation',
          7,
          'ci-regression',
          ARRAY['founder-chat', ${'cid:' + FOUNDER2_CONV_ID}]
        )
        ON CONFLICT (id) DO NOTHING
      `);
      // Ensure no prior embedding exists (simulate a true straggler).
      await db.execute(sql`DELETE FROM memory_embeddings WHERE memory_id = ${STRAG_MEM_ID}`);

      const { patchSingleStraggler } = await import('../services/memory-embedding-indexer');
      const outcome = await patchSingleStraggler(STRAG_MEM_ID);
      assert.equal(outcome, 'patched', `patchSingleStraggler should return 'patched' for a row with a valid cid:`);

      // The embedding must be stored under FOUNDER2_USER_ID — NOT null, NOT a hard-coded ID.
      const embRows = await db.execute(sql`
        SELECT user_id FROM memory_embeddings
        WHERE memory_id = ${STRAG_MEM_ID}
          AND memory_type = 'conversation_memory'
        LIMIT 1
      `);
      const embRow = (embRows as any).rows?.[0] ?? (embRows as any)[0];
      assert.equal(
        embRow?.user_id,
        FOUNDER2_USER_ID,
        `Straggler patch must write userId=${FOUNDER2_USER_ID} (from cid: lookup). ` +
        `Got userId=${embRow?.user_id}. Hard-coded admin IDs or null-scope are both ownership breaches.`,
      );
    } finally {
      await db.execute(sql`DELETE FROM memory_embeddings WHERE memory_id = ${STRAG_MEM_ID}`);
      await db.execute(sql`DELETE FROM conversation_memories WHERE id = ${STRAG_MEM_ID}`);
    }
  });

  it('straggler patch: founder-tagged row without cid: tag is skipped — no embedding written (global pool not poisoned)', async () => {
    // Regression: the straggler auto-patch path must NOT create any embedding for a
    // founder-tagged row that has no cid: tag. Without a cid: tag, the owner cannot
    // be determined, and creating a null-scoped embedding would expose the private
    // transcript in every student's global recall pool.
    const STRAG_NO_CID_ID = 'ci-leak-guard-straggler-nocid-0001';
    try {
      await db.execute(sql`
        INSERT INTO conversation_memories
          (id, title, summary, content, entry_type, importance, arc_name, tags)
        VALUES (
          ${STRAG_NO_CID_ID},
          'CI Straggler No-CID Test',
          'Should be skipped — no cid: tag means owner is unresolvable',
          'Founder: This straggler has no cid tag.',
          'conversation',
          7,
          'ci-regression',
          ARRAY['founder-chat']
        )
        ON CONFLICT (id) DO NOTHING
      `);
      await db.execute(sql`DELETE FROM memory_embeddings WHERE memory_id = ${STRAG_NO_CID_ID}`);

      const { patchSingleStraggler } = await import('../services/memory-embedding-indexer');
      const outcome = await patchSingleStraggler(STRAG_NO_CID_ID);
      assert.equal(outcome, 'skipped', `patchSingleStraggler should return 'skipped' for a founder row without cid:`);

      // Verify: no embedding was created.
      const embRows = await db.execute(sql`
        SELECT memory_id, user_id FROM memory_embeddings
        WHERE memory_id = ${STRAG_NO_CID_ID}
        LIMIT 1
      `);
      const emb = (embRows as any).rows?.[0] ?? (embRows as any)[0];
      assert.equal(
        emb,
        undefined,
        `Straggler patch must not create ANY embedding for a cid-absent founder row. ` +
        `Got userId=${emb?.user_id}. A null-scoped embedding would expose private content globally.`,
      );
    } finally {
      await db.execute(sql`DELETE FROM memory_embeddings WHERE memory_id = ${STRAG_NO_CID_ID}`);
      await db.execute(sql`DELETE FROM conversation_memories WHERE id = ${STRAG_NO_CID_ID}`);
    }
  });

  it('route write-path: non-founder memory (episode / teaching note) gets null-scoped embedding — globally accessible, not David-private', async () => {
    // Regression guard for the /api/conversation-memories POST route.
    // The route now calls reembedConversationMemory(id) instead of
    // generateAndStoreEmbedding(..., DAVID_USER_ID, ...).
    // For non-founder rows (episodes, teaching notes, team decisions), the
    // correct scope is userId=null (globally accessible), NOT a specific user's
    // private pool.  A null-scoped row is intentionally visible to all users.
    const hasKey = !!(process.env.USER_OPENAI_API_KEY || process.env.OPENAI_API_KEY);
    if (!hasKey) {
      console.log('  [SKIP] No OpenAI API key — route global-scope test skipped');
      return;
    }

    const ROUTE_GLOBAL_MEM_ID = 'ci-leak-guard-route-global-0001';
    try {
      // Seed a non-founder memory (no founder-chat / founder-private tag).
      await db.execute(sql`
        INSERT INTO conversation_memories
          (id, title, summary, content, entry_type, importance, arc_name, tags)
        VALUES (
          ${ROUTE_GLOBAL_MEM_ID},
          'CI Route Global Scope Test — Episode',
          'Route write-path: global memory must use null scope',
          'Daniela: Welcome to the lesson.',
          'episode',
          8,
          'ci-regression',
          ARRAY['holahola']
        )
        ON CONFLICT (id) DO NOTHING
      `);
      await db.execute(sql`DELETE FROM memory_embeddings WHERE memory_id = ${ROUTE_GLOBAL_MEM_ID}`);

      // Simulate the route: call reembedConversationMemory without explicit userId.
      const { reembedConversationMemory } = await import('../scripts/reembed-memory');
      await reembedConversationMemory(ROUTE_GLOBAL_MEM_ID);

      // Verify: embedding must be null-scoped (userId=null), not David-private.
      const embRows = await db.execute(sql`
        SELECT user_id FROM memory_embeddings
        WHERE memory_id = ${ROUTE_GLOBAL_MEM_ID}
          AND memory_type = 'conversation_memory'
        LIMIT 1
      `);
      const embRow = (embRows as any).rows?.[0] ?? (embRows as any)[0];
      assert.ok(embRow, 'Embedding must be created for a non-founder memory row');
      assert.equal(
        embRow?.user_id,
        null,
        `Non-founder memory must have null-scoped embedding (globally accessible). ` +
        `Got userId=${embRow?.user_id}. A private (userId-scoped) embedding would hide it from all students.`,
      );

      // Verify the null-scoped row is accessible to any student.
      const results = await semanticSearchByVector(OTHER_USER_ID, UNIT_VEC, 50, ['conversation_memory']);
      // Note: this row uses real content so cosine similarity won't be 1.0.
      // We just verify the embedding exists with null scope; the access test uses
      // the pre-seeded GLOBAL_MEM_ID with UNIT_VEC for exact cosine=1.0 matching.
    } finally {
      await db.execute(sql`DELETE FROM memory_embeddings WHERE memory_id = ${ROUTE_GLOBAL_MEM_ID}`);
      await db.execute(sql`DELETE FROM conversation_memories WHERE id = ${ROUTE_GLOBAL_MEM_ID}`);
    }
  });

  it('route write-path: founder-tagged memory with cid: gets the correct owner userId — not a hard-coded ID', async () => {
    // Regression guard for the /api/conversation-memories POST route.
    // The route now calls reembedConversationMemory(id) instead of
    // generateAndStoreEmbedding(..., DAVID_USER_ID, ...).
    // For founder-tagged rows, the correct scope is the actual conversation owner
    // derived from the cid: tag → conversations.user_id.  Using a hard-coded admin
    // ID here would assign all founders' transcripts to one account, creating an
    // access-control breach (any founder would see another's private memories).
    const hasKey = !!(process.env.USER_OPENAI_API_KEY || process.env.OPENAI_API_KEY);
    if (!hasKey) {
      console.log('  [SKIP] No OpenAI API key — route founder-ownership test skipped');
      return;
    }

    const ROUTE_FOUNDER_MEM_ID = 'ci-leak-guard-route-founder-0001';
    try {
      // Seed a founder-chat row for FOUNDER2 (cid: → FOUNDER2_CONV_ID).
      await db.execute(sql`
        INSERT INTO conversation_memories
          (id, title, summary, content, entry_type, importance, arc_name, tags)
        VALUES (
          ${ROUTE_FOUNDER_MEM_ID},
          'CI Route Founder Ownership Test — Founder 2',
          'Route write-path: founder memory must use data-derived userId',
          'Founder2: This is a route-path founder test.',
          'conversation',
          7,
          'ci-regression',
          ARRAY['founder-chat', ${'cid:' + FOUNDER2_CONV_ID}]
        )
        ON CONFLICT (id) DO NOTHING
      `);
      await db.execute(sql`DELETE FROM memory_embeddings WHERE memory_id = ${ROUTE_FOUNDER_MEM_ID}`);

      // Simulate the route: call reembedConversationMemory without explicit userId.
      const { reembedConversationMemory } = await import('../scripts/reembed-memory');
      await reembedConversationMemory(ROUTE_FOUNDER_MEM_ID);

      // Verify: embedding must be stored under FOUNDER2_USER_ID (from cid: lookup).
      const embRows = await db.execute(sql`
        SELECT user_id FROM memory_embeddings
        WHERE memory_id = ${ROUTE_FOUNDER_MEM_ID}
          AND memory_type = 'conversation_memory'
        LIMIT 1
      `);
      const embRow = (embRows as any).rows?.[0] ?? (embRows as any)[0];
      assert.equal(
        embRow?.user_id,
        FOUNDER2_USER_ID,
        `Route write-path must store founder memory under userId=${FOUNDER2_USER_ID} (derived from cid: tag). ` +
        `Got userId=${embRow?.user_id}. A hard-coded admin ID or null scope are both access-control breaches.`,
      );

      // OTHER_USER must NOT see FOUNDER2's private memory in their global search pool.
      const otherResults = await semanticSearchByVector(OTHER_USER_ID, UNIT_VEC, 50, ['conversation_memory']);
      const leaked = otherResults.find(r => r.memoryId === ROUTE_FOUNDER_MEM_ID);
      assert.equal(
        leaked,
        undefined,
        `Founder2 memory stored via route write-path leaked to OTHER_USER_ID — ownership breach`,
      );
    } finally {
      await db.execute(sql`DELETE FROM memory_embeddings WHERE memory_id = ${ROUTE_FOUNDER_MEM_ID}`);
      await db.execute(sql`DELETE FROM conversation_memories WHERE id = ${ROUTE_FOUNDER_MEM_ID}`);
    }
  });

  it('fallback resolver: reembedConversationMemory without explicit userId uses cid: tag to find actual owner', async () => {
    const hasKey = !!(process.env.USER_OPENAI_API_KEY || process.env.OPENAI_API_KEY);
    if (!hasKey) {
      console.log('  [SKIP] No OpenAI API key — fallback resolver test skipped');
      return;
    }

    // Call reembedConversationMemory WITHOUT an explicit userId.
    // The resolver must extract the cid: tag from the memory row, look up
    // conversations.user_id in the DB, and store the embedding under FOUNDER2_USER_ID —
    // NOT under any hard-coded administrator ID.
    const { reembedConversationMemory } = await import('../scripts/reembed-memory');
    await reembedConversationMemory(FOUNDER2_MEM_ID /* no explicit userId */);

    // Verify the embedding was stored under FOUNDER2_USER_ID (derived from cid: tag lookup).
    const embRows = await db.execute(sql`
      SELECT user_id FROM memory_embeddings
      WHERE memory_id = ${FOUNDER2_MEM_ID}
        AND memory_type = 'conversation_memory'
      LIMIT 1
    `);
    const embRow = (embRows as any).rows?.[0] ?? (embRows as any)[0];
    assert.equal(
      embRow?.user_id,
      FOUNDER2_USER_ID,
      `Fallback resolver should write userId=${FOUNDER2_USER_ID} (from conversations.user_id via cid: tag) but got userId=${embRow?.user_id}`,
    );

    // OTHER_USER cannot retrieve FOUNDER2's embedding via semantic search.
    const otherResults = await semanticSearchByVector(OTHER_USER_ID, UNIT_VEC, 10, ['conversation_memory']);
    const leaked = otherResults.find(r => r.memoryId === FOUNDER2_MEM_ID);
    assert.equal(
      leaked,
      undefined,
      `Fallback-resolver embedding for FOUNDER2 leaked to OTHER_USER_ID — ownership breach`,
    );
  });

  it('correctFounderEmbeddingScopes: NULL-scoped importance-10 founder row is quarantined — never reaches any student', async () => {
    // Regression guard for the most dangerous failure mode:
    // A NULL-scoped founder-tagged embedding with high importance would rank at the
    // TOP of every student's global recall pool (importance-first ORDER BY).
    // correctFounderEmbeddingScopes() must quarantine it (delete the null-scoped row)
    // because the cid:/backfill-cid: tag is absent, so the owner cannot be determined.
    //
    // This test proves correctFounderEmbeddingScopes() provides fail-closed behavior:
    // unresolvable founder rows are deleted, not left globally accessible.
    const NULL_FOUNDER_MEM_ID = 'ci-leak-guard-null-founder-importance10-0001';
    try {
      // Seed a NULL-scoped founder embedding with maximum importance/strength.
      // In the old (wrong) strength-filter model this would pass the filter
      // (strength=1.0 ≥ 0.7) and appear in every student's pool ranked first.
      await db.execute(sql`
        INSERT INTO memory_embeddings
          (memory_type, memory_id, user_id, embedding, content_hash, strength, pinned, importance)
        VALUES (
          'conversation_memory',
          ${NULL_FOUNDER_MEM_ID},
          NULL,
          ${JSON.stringify(UNIT_VEC)}::jsonb,
          'ci-leak-guard-null-founder-hash-0001',
          1.0,
          false,
          10
        )
        ON CONFLICT (memory_type, memory_id) DO UPDATE
          SET user_id = EXCLUDED.user_id,
              strength = EXCLUDED.strength,
              importance = EXCLUDED.importance
      `);

      // Seed a conversation_memories row tagged founder-chat WITHOUT any cid: tag.
      // The scope correction must recognize it as unresolvable and quarantine (delete)
      // the NULL-scoped embedding rather than leaving it in the global pool.
      await db.execute(sql`
        INSERT INTO conversation_memories
          (id, title, summary, content, entry_type, importance, arc_name, tags)
        VALUES (
          ${NULL_FOUNDER_MEM_ID},
          'CI Null-Founder Importance-10 Test',
          'Regression: null-scoped high-importance founder row must be quarantined',
          'Founder: This is a secret transcript.',
          'conversation',
          10,
          'ci-regression',
          ARRAY['founder-chat']
        )
        ON CONFLICT (id) DO NOTHING
      `);

      // Run correctFounderEmbeddingScopes — simulates the boot-time pass.
      await correctFounderEmbeddingScopes();

      // Verify: the NULL-scoped embedding must be DELETED (quarantined) because
      // the founder-chat row has no cid: tag and the owner cannot be determined.
      const remaining = await db.execute(sql`
        SELECT user_id FROM memory_embeddings
        WHERE memory_id = ${NULL_FOUNDER_MEM_ID}
          AND memory_type = 'conversation_memory'
        LIMIT 1
      `);
      const remainingRow = (remaining as any).rows?.[0] ?? (remaining as any)[0];
      assert.equal(
        remainingRow,
        undefined,
        `NULL-scoped founder embedding with importance=10 was NOT quarantined by correctFounderEmbeddingScopes. ` +
        `It would rank first in every student's global pool. Found: userId=${remainingRow?.user_id}`,
      );

      // Also verify it does not appear in semantic search results for any user.
      const leakResults = await semanticSearchByVector(OTHER_USER_ID, UNIT_VEC, 100, ['conversation_memory']);
      const leaked = leakResults.find(r => r.memoryId === NULL_FOUNDER_MEM_ID);
      assert.equal(
        leaked,
        undefined,
        `Quarantined NULL-scoped founder row still returned by semanticSearchByVector — scope correction did not prevent leak`,
      );
    } finally {
      await db.execute(sql`DELETE FROM memory_embeddings WHERE memory_id = ${NULL_FOUNDER_MEM_ID}`);
      await db.execute(sql`DELETE FROM conversation_memories WHERE id = ${NULL_FOUNDER_MEM_ID}`);
    }
  });
});
