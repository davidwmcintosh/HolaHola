// Episode lifecycle operations for the "HolaHola Episodes" arc in
// conversation_memories: creating a new episode row and promoting it to the
// "rolling" (currently active) episode, which atomically retires whichever
// episode held that status before.
//
// This arc has no separate "closed" state -- there is only ever one row
// tagged 'rolling' at a time. "Starting" the next episode IS what "closes"
// the previous one: promoting a new target strips 'rolling' from every other
// row in the arc in the same transaction. There is deliberately no
// standalone "close with no successor" operation -- the live capture
// pipeline (autosave watcher, chat/team-room episode hooks) always needs
// some row tagged 'rolling' to append to, so clearing it with nothing to
// replace it would silently break live capture.
//
// This module is the shared core behind server/scripts/set-rolling-episode.ts
// (CLI, human-operated) and Alden's start_next_episode / get_current_episode
// tools (conversational, LLM-operated) -- one atomic-swap implementation,
// two callers. Never call process.exit() from anything in this file: the
// Alden tool path runs in-process inside the long-lived server, and a
// script-style exit here would kill the whole server, not just a one-shot
// CLI invocation.
//
// Deliberately conservative for the LLM-facing path: createEpisode() never
// deletes or replaces an existing row (unlike POST /api/conversation-memories
// with allowDuplicate:true). A duplicate title is treated as "reuse the
// existing row", never as "overwrite it" -- an LLM-driven tool must not have
// a destructive replace option for narrative content.

import { and, eq, sql } from "drizzle-orm";
import { getSharedDb } from "../db";
import { conversationMemories, insertConversationMemorySchema } from "@shared/schema";

export const HOLAHOLA_EPISODES_ARC = "HolaHola Episodes";

/**
 * "episode-28", "episode28", "Episode 28", "Episode-28" -> "Episode 28".
 * Anything else passes through unchanged (already a full human title, e.g.
 * "Episode 35: The Long Way Home").
 *
 * Copied from server/scripts/set-rolling-episode.ts's normaliseToTitle --
 * kept here as the canonical version; the script re-exports/uses this one.
 */
export function normaliseEpisodeTitle(input: string): string {
  const s = input.trim();
  const slugMatch = /^episode[-\s]?(\d+)$/i.exec(s);
  if (slugMatch) return `Episode ${parseInt(slugMatch[1], 10)}`;
  return s;
}

function deriveEpisodeSlug(title: string): string {
  const m = /^Episode\s+(\d+)/i.exec(title);
  if (m) return `episode-${parseInt(m[1], 10)}`;
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export type PromoteRollingEpisodeResult =
  | { ok: true; alreadyRolling: boolean; target: { id: string; title: string }; previousRolling: string[] }
  | { ok: false; reason: "not_found"; searchedTitle: string };

/**
 * Atomically promotes the named episode to "rolling" (the live, currently
 * active episode), demoting whatever was rolling before it. Both steps run
 * in one transaction -- a failure after the demote step rolls back
 * automatically, so no episode is ever left without a rolling tag.
 *
 * Extracted from server/scripts/set-rolling-episode.ts's main(); that script
 * now calls this function instead of inlining the transaction, so there is
 * exactly one implementation of the atomic swap.
 */
export async function promoteRollingEpisode(episodeTitleRaw: string): Promise<PromoteRollingEpisodeResult> {
  const db = getSharedDb();
  const newTitle = normaliseEpisodeTitle(episodeTitleRaw);

  const targetRows = await db.execute(sql`
    SELECT id, title, tags
    FROM conversation_memories
    WHERE arc_name = ${HOLAHOLA_EPISODES_ARC}
      AND lower(title) = lower(${newTitle})
    ORDER BY created_at DESC
    LIMIT 1
  `);

  if (targetRows.rows.length === 0) {
    return { ok: false, reason: "not_found", searchedTitle: newTitle };
  }

  const target = targetRows.rows[0] as unknown as { id: string; title: string; tags: string[] };

  if (Array.isArray(target.tags) && target.tags.includes("rolling")) {
    return {
      ok: true,
      alreadyRolling: true,
      target: { id: target.id, title: target.title },
      previousRolling: [target.title],
    };
  }

  const currentRows = await db.execute(sql`
    SELECT title
    FROM conversation_memories
    WHERE arc_name = ${HOLAHOLA_EPISODES_ARC}
      AND 'rolling' = ANY(tags)
    ORDER BY created_at DESC
  `);
  const previousRolling = (currentRows.rows as unknown as Array<{ title: string }>).map((r) => r.title);

  // Step A0: permanently protect every episode that is currently rolling
  // before stripping the 'rolling' tag -- idempotent (CASE leaves tags
  // unchanged if 'rolling-protected' is already present).
  // Step A: clear 'rolling' from every arc row that currently has it.
  // Step B: add 'rolling' + 'rolling-protected' to the verified target.
  // If step B throws, steps A0/A roll back automatically.
  await db.transaction(async (tx) => {
    await tx.execute(sql`
      UPDATE conversation_memories
      SET tags = CASE WHEN 'rolling-protected' = ANY(tags)
                      THEN tags
                      ELSE array_append(tags, 'rolling-protected')
                 END
      WHERE arc_name = ${HOLAHOLA_EPISODES_ARC}
        AND 'rolling' = ANY(tags)
    `);

    await tx.execute(sql`
      UPDATE conversation_memories
      SET tags = array_remove(tags, 'rolling')
      WHERE arc_name = ${HOLAHOLA_EPISODES_ARC}
        AND 'rolling' = ANY(tags)
    `);

    await tx.execute(sql`
      UPDATE conversation_memories
      SET tags = array_append(
                   CASE WHEN 'rolling-protected' = ANY(tags)
                        THEN tags
                        ELSE array_append(tags, 'rolling-protected')
                   END,
                   'rolling'
                 )
      WHERE id = ${target.id}
    `);
  });

  return {
    ok: true,
    alreadyRolling: false,
    target: { id: target.id, title: target.title },
    previousRolling,
  };
}

/** Read-only: which episode row currently holds the 'rolling' tag, if any. */
export async function getCurrentRollingEpisode(): Promise<{ id: string; title: string } | null> {
  const db = getSharedDb();
  const rows = await db.execute(sql`
    SELECT id, title
    FROM conversation_memories
    WHERE arc_name = ${HOLAHOLA_EPISODES_ARC}
      AND 'rolling' = ANY(tags)
    ORDER BY created_at DESC
    LIMIT 1
  `);
  const row = rows.rows[0] as unknown as { id: string; title: string } | undefined;
  return row ?? null;
}

export interface CreateEpisodeParams {
  title: string;
  summary: string;
  content: string;
  importance?: number;
  tags?: string[];
  participants?: string;
}

export type CreateEpisodeResult =
  | { ok: true; created: boolean; episode: { id: string; title: string } }
  | { ok: false; reason: "invalid"; details: unknown };

/**
 * Creates a new episode row in the HolaHola Episodes arc, or reuses an
 * existing row with the same title if one already exists (created: false).
 * Never deletes or overwrites an existing row -- see module header.
 */
export async function createEpisode(params: CreateEpisodeParams): Promise<CreateEpisodeResult> {
  const db = getSharedDb();
  const title = normaliseEpisodeTitle(params.title.trim());

  const existing = await db
    .select({ id: conversationMemories.id, title: conversationMemories.title })
    .from(conversationMemories)
    .where(
      and(
        eq(conversationMemories.entryType, "episode" as any),
        eq(conversationMemories.arcName, HOLAHOLA_EPISODES_ARC),
        eq(conversationMemories.title, title),
      ),
    );

  if (existing.length > 0) {
    return { ok: true, created: false, episode: existing[0] };
  }

  const slugTag = deriveEpisodeSlug(title);
  const tags = Array.from(new Set([slugTag, ...(params.tags ?? [])].filter(Boolean)));

  const values: Record<string, unknown> = {
    title,
    summary: params.summary,
    content: params.content,
    entryType: "episode",
    arcName: HOLAHOLA_EPISODES_ARC,
    importance: params.importance ?? 10,
    tags,
  };
  if (params.participants) values.participants = params.participants;

  const parsed = insertConversationMemorySchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, reason: "invalid", details: parsed.error.flatten() };
  }

  const [inserted] = await db
    .insert(conversationMemories)
    .values(parsed.data)
    .returning({ id: conversationMemories.id, title: conversationMemories.title });

  // Fire-and-forget, mirroring POST /api/conversation-memories's own
  // post-insert side effects so an episode created through this path is
  // indexed and cross-linked exactly like one created through the route --
  // errors here must never fail the episode creation itself.
  import("../scripts/reembed-memory").then(({ reembedConversationMemory }) => {
    reembedConversationMemory(inserted.id).catch((err) =>
      console.warn("[episode-lifecycle-service] Embedding failed:", err.message),
    );
  });
  import("./agent-briefing").then(({ generateAgentBriefing }) => {
    generateAgentBriefing().catch((err) =>
      console.warn("[episode-lifecycle-service] Briefing refresh failed:", err.message),
    );
  });
  import("./context-sync-service").then(({ contextSyncService }) => {
    contextSyncService.scheduleNorthStarResync();
  });

  return { ok: true, created: true, episode: inserted };
}

export interface StartNextEpisodeParams extends CreateEpisodeParams {}

export type StartNextEpisodeResult =
  | {
      ok: true;
      episodeCreated: boolean;
      episode: { id: string; title: string };
      previousRolling: string[];
      alreadyRolling: boolean;
    }
  | { ok: false; reason: "invalid"; details: unknown }
  | { ok: false; reason: "promote_failed_unexpectedly"; searchedTitle: string };

/**
 * The combined "start the next episode" operation: creates the episode row
 * if it does not already exist (or reuses it if it does), then promotes it
 * to 'rolling', which atomically retires whatever was rolling before. This
 * is the single fused action that covers both "start episode N" and "close
 * the previous episode" -- see module header for why there is no separate
 * close step.
 */
export async function startNextEpisode(params: StartNextEpisodeParams): Promise<StartNextEpisodeResult> {
  const created = await createEpisode(params);
  if (!created.ok) return created;

  const promoted = await promoteRollingEpisode(created.episode.title);
  if (!promoted.ok) {
    // We just confirmed/created this exact row above, so this is a
    // defensive guard against a race (e.g. concurrent delete) rather than
    // an expected path.
    return { ok: false, reason: "promote_failed_unexpectedly", searchedTitle: created.episode.title };
  }

  return {
    ok: true,
    episodeCreated: created.created,
    episode: promoted.target,
    previousRolling: promoted.previousRolling,
    alreadyRolling: promoted.alreadyRolling,
  };
}
