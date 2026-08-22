/**
 * Shared Lobe Snapshot Generator
 *
 * Generates docs/shared-lobe-snapshot.md from the editor_insights table
 * (category = 'shared') on every server start and automatically whenever a
 * new shared-category row is detected (via a 5-minute polling watcher).
 *
 * This is the "shared brain" between Alden and the Replit Agent:
 *   - Alden writes to it via save_to_memory with category: 'shared'
 *   - The Agent writes to it directly via SQL at the end of build sessions
 *   - The snapshot file is the Agent's read path (they can't query mid-session)
 *   - Alden reads all insights directly from the DB in his workspace context
 *
 * Staleness guard: startSharedLobeWatcher() polls every 5 minutes for new
 * rows and regenerates the snapshot automatically, even when a row is inserted
 * via direct SQL rather than through insert-luca-cobuilder-shared-lobe.ts.
 *
 * Format: Markdown with importance rating and author tag (alden / agent)
 */

import { writeFileSync } from 'fs';
import { join } from 'path';
import { getSharedDb } from '../neon-db';
import { editorInsights } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';

// ── Polling watcher ────────────────────────────────────────────────────────────
// Tracks the latest known created_at timestamp for shared-category rows so the
// watcher can detect direct DB inserts that bypass the insert script.
let _watcherWatermarkMs = 0;
const WATCHER_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Start a background polling loop that detects new editor_insights rows with
 * category='shared' and regenerates the snapshot automatically.
 *
 * This guards against the "silent stale" scenario where someone inserts a row
 * via direct SQL rather than through insert-luca-cobuilder-shared-lobe.ts,
 * which would leave docs/shared-lobe-snapshot.md out of date until the next
 * server restart.
 *
 * Call once on server boot (after the initial generateSharedLobeSnapshot()).
 */
export function startSharedLobeWatcher(): void {
  // Seed the watermark from the current moment so we only react to rows
  // inserted AFTER the server starts (the boot snapshot already covers older rows).
  _watcherWatermarkMs = Date.now();
  console.log('[SharedLobe] Watcher started — polling every 5 min for new shared-category rows');

  setInterval(async () => {
    try {
      const db = getSharedDb();
      const rows = await db
        .select({ createdAt: editorInsights.createdAt })
        .from(editorInsights)
        .where(eq(editorInsights.category, 'shared'))
        .orderBy(desc(editorInsights.createdAt))
        .limit(1);

      if (rows.length === 0) return;

      const latestMs = rows[0].createdAt ? new Date(rows[0].createdAt).getTime() : 0;
      if (latestMs > _watcherWatermarkMs) {
        console.log(
          `[SharedLobe] New shared-category row detected (created_at=${new Date(latestMs).toLocaleString()}) — regenerating snapshot`,
        );
        await generateSharedLobeSnapshot();
        _watcherWatermarkMs = latestMs;
      }
    } catch (err: any) {
      console.warn('[SharedLobe] Watcher poll error:', err.message);
    }
  }, WATCHER_INTERVAL_MS);
}

const SNAPSHOT_PATH = join(process.cwd(), 'docs/shared-lobe-snapshot.md');

export async function generateSharedLobeSnapshot(): Promise<void> {
  try {
    const db = getSharedDb();
    const insights = await db
      .select()
      .from(editorInsights)
      .where(eq(editorInsights.category, 'shared'))
      .orderBy(desc(editorInsights.importance), desc(editorInsights.createdAt));

    if (insights.length === 0) {
      writeFileSync(SNAPSHOT_PATH, `# Shared Lobe — Alden ↔ Agent Shared Memory

*No shared insights yet. Alden writes here via \`save_to_memory\` with \`category: 'shared'\`. The Agent writes here via SQL inserts at session end.*

Generated: ${new Date().toLocaleString()}
`, 'utf-8');
      console.log('[SharedLobe] Snapshot written — 0 shared insights');
      return;
    }

    const sections = insights.map(ins => {
      const tags = (ins.tags ?? []).join(', ');
      const author = (ins.tags ?? []).includes('agent') ? 'Replit Agent' : 'Alden';
      const date = ins.createdAt
        ? new Date(ins.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : 'unknown date';
      const importance = ins.importance ?? 5;
      const stars = '★'.repeat(Math.round(importance / 2)) + '☆'.repeat(5 - Math.round(importance / 2));

      return [
        `### ${ins.title}`,
        `*${author} — ${date} — importance ${importance}/10 ${stars}*`,
        '',
        ins.content,
        ins.context ? `\n> Context: ${ins.context}` : '',
        tags ? `\nTags: \`${tags}\`` : '',
      ].filter(l => l !== undefined).join('\n');
    });

    const content = `# Shared Lobe — Alden ↔ Agent Shared Memory

This is the part of the brain both Alden and the Replit Agent can write to and read from.
Think of it as the knowledge that lives between sessions and between collaborators.

**${insights.length} shared insight${insights.length === 1 ? '' : 's'}** | Snapshot generated: ${new Date().toLocaleString()}

---

${sections.join('\n\n---\n\n')}
`;

    writeFileSync(SNAPSHOT_PATH, content, 'utf-8');
    console.log(`[SharedLobe] Snapshot written — ${insights.length} shared insights`);
  } catch (err: any) {
    console.warn('[SharedLobe] Snapshot generation failed:', err.message);
  }
}
