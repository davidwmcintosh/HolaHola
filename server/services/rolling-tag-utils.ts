/**
 * rolling-tag-utils.ts
 *
 * Pure utility for detecting a misrouted rolling tag in conversation_memories.
 *
 * Extracted into its own file so it can be imported by both:
 *   - agent-session-autosave.ts  (Phase 3 of runStartupGapCheck)
 *   - server/scripts/test-rolling-episode-gap-check.ts  (--rolling-tag-self-check)
 *
 * NO module-level side effects — safe to import from CI scripts.
 */

export type RollingEpisodeRow = {
  title: string;
  tags: string[] | null;
  created_at: Date | string;
};

export type RollingTagMisroute =
  | { stale: false }
  | {
      stale: true;
      rollingLabel: string;
      rollingDate: string;
      newerLabel: string;
      newerDate: string;
    };

/**
 * Pure helper: given a list of rolling-protected episodes, detect whether the
 * 'rolling' tag is on the most recently created one.
 *
 * Returns { stale: false } when the tag is correctly placed (newest row has it).
 * Returns { stale: true, ... } with episode labels and dates when misrouted —
 * i.e. the 'rolling' tag is on an older row while a newer rolling-protected
 * episode exists without it.
 *
 * No DB access — purely a function of the input rows.
 */
export function detectRollingTagMisroute(episodes: RollingEpisodeRow[]): RollingTagMisroute {
  if (episodes.length === 0) return { stale: false };

  const toMs = (d: Date | string) =>
    d instanceof Date ? d.getTime() : new Date(String(d)).getTime();

  // Sort by created_at DESC so sorted[0] is the newest episode
  const sorted = [...episodes].sort((a, b) => toMs(b.created_at) - toMs(a.created_at));

  const newestEp = sorted[0];
  const hasRolling = (ep: RollingEpisodeRow) =>
    Array.isArray(ep.tags) && ep.tags.includes('rolling');

  // If the newest rolling-protected episode already carries the 'rolling' tag — all good
  if (hasRolling(newestEp)) return { stale: false };

  // Find whichever older episode has the 'rolling' tag
  const rollingEp = sorted.find(ep => hasRolling(ep));
  if (!rollingEp) return { stale: false }; // no 'rolling' tag anywhere — not our concern

  const toDateStr = (d: Date | string) => {
    const dt = d instanceof Date ? d : new Date(String(d));
    return dt.toISOString().slice(0, 10); // YYYY-MM-DD
  };

  const epLabel = (ep: RollingEpisodeRow) => {
    const m = /^Episode (\d+)/i.exec(String(ep.title));
    return m ? `ep-${parseInt(m[1], 10)}` : String(ep.title).slice(0, 30);
  };

  return {
    stale: true,
    rollingLabel: epLabel(rollingEp),
    rollingDate: toDateStr(rollingEp.created_at),
    newerLabel: epLabel(newestEp),
    newerDate: toDateStr(newestEp.created_at),
  };
}
