/**
 * monitor-founder-chat.js
 *
 * Lightweight real-time monitor for the active founder/admin conversation.
 * Uses plain pg (no server imports) so it never competes with the running server.
 *
 * Usage:
 *   node server/scripts/monitor-founder-chat.js
 *
 * Polls every 3 seconds, prints new messages as they arrive.
 * Runs for up to 30 minutes (600 iterations).
 */

const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function poll() {
  let lastMsgTime = null;
  let convId = null;

  process.stdout.write('[Luca Monitor] Watching for active founder session...\n');

  for (let i = 0; i < 600; i++) {
    try {
      // Find the most recently active founder conversation
      const r = await pool.query(`
        SELECT c.id, c.title, c.topic, c.last_message_at
        FROM conversations c
        JOIN users u ON u.id = c.user_id
        WHERE u.role IN ('admin','developer')
          AND c.last_message_at > NOW() - INTERVAL '15 minutes'
        ORDER BY c.last_message_at DESC NULLS LAST
        LIMIT 1
      `);

      if (!r.rows.length) {
        await sleep(3000);
        continue;
      }

      const conv = r.rows[0];
      if (conv.id !== convId) {
        convId = conv.id;
        lastMsgTime = null;
        process.stdout.write(`\n[Luca Monitor] === Session: ${conv.title || conv.topic || conv.id} ===\n`);
      }

      const msgs = await pool.query(
        lastMsgTime
          ? `SELECT id, role, content, created_at FROM messages WHERE conversation_id = $1 AND created_at > $2 ORDER BY created_at ASC`
          : `SELECT id, role, content, created_at FROM messages WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT 8`,
        lastMsgTime ? [convId, lastMsgTime] : [convId]
      );

      const rows = lastMsgTime ? msgs.rows : [...msgs.rows].reverse();
      for (const m of rows) {
        const speaker = m.role === 'user' ? 'David  ' : 'Daniela';
        const clean = (m.content || '')
          .replace(/\n/g, ' ')
          .replace(/self_write\{[^}]*\}/g, '[tool]')
          .replace(/^thought .{0,200}/, '[thought]')
          .slice(0, 500);
        const ts = (m.created_at?.toISOString?.() || '').slice(11, 19);
        process.stdout.write(`[${ts}][${speaker}] ${clean}\n---\n`);
        lastMsgTime = m.created_at;
      }
    } catch (e) {
      process.stdout.write(`[Luca Monitor] poll error: ${e.message}\n`);
    }

    await sleep(3000);
  }

  await pool.end();
  process.stdout.write('[Luca Monitor] Session ended (30 min limit).\n');
}

function sleep(ms) {
  return new Promise(res => setTimeout(res, ms));
}

poll().catch(e => {
  console.error(e);
  pool.end();
});
