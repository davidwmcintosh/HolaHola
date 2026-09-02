/**
 * Durable retry queue for rolling-episode projections.
 *
 * The canonical conversation row and chat-capture cursor must not wait on the
 * episode mirror. Each item is written atomically before the projection cursor
 * advances, then removed only after the DB-first mirror and acknowledgement
 * cursor have both succeeded.
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
import {
  CHAT_CAPTURE_ACK_CURSOR_PATH,
  WORKSPACE,
  type ChatCaptureCursor,
} from './transcript-parser';

export const EPISODE_MIRROR_OUTBOX_PATH = join(WORKSPACE, '.local/episode-mirror-outbox');

export interface EpisodeMirrorOutboxItem {
  startCursor: number;
  endOffset: number;
  liveEpisode: string;
  formattedContent: string;
  appendMarker: string;
  captureIds: string[];
  lastSavedTurnFingerprint?: string;
}

export interface EpisodeMirrorOutboxPaths {
  directory?: string;
  acknowledgementCursorPath?: string;
}

function pathsWithDefaults(paths: EpisodeMirrorOutboxPaths = {}) {
  return {
    directory: paths.directory ?? EPISODE_MIRROR_OUTBOX_PATH,
    acknowledgementCursorPath: paths.acknowledgementCursorPath ?? CHAT_CAPTURE_ACK_CURSOR_PATH,
  };
}

function itemKey(item: EpisodeMirrorOutboxItem): string {
  return createHash('sha256')
    .update(`${item.startCursor}:${item.endOffset}:${item.appendMarker}`, 'utf8')
    .digest('hex')
    .slice(0, 24);
}

function itemPath(item: EpisodeMirrorOutboxItem, directory: string): string {
  return join(
    directory,
    `${String(item.endOffset).padStart(20, '0')}-${itemKey(item)}.json`,
  );
}

function writeAtomic(path: string, content: string): void {
  const tempPath = `${path}.tmp-${process.pid}`;
  writeFileSync(tempPath, content, 'utf8');
  renameSync(tempPath, path);
}

export function enqueueEpisodeMirror(
  item: EpisodeMirrorOutboxItem,
  paths: EpisodeMirrorOutboxPaths = {},
): string {
  const resolved = pathsWithDefaults(paths);
  mkdirSync(resolved.directory, { recursive: true });
  const path = itemPath(item, resolved.directory);
  // A missing acknowledgement cursor is initialized at the item's beginning.
  // Never move an existing cursor backwards.
  if (!existsSync(resolved.acknowledgementCursorPath)) {
    writeAtomic(
      resolved.acknowledgementCursorPath,
      JSON.stringify({ byteOffset: item.startCursor } satisfies ChatCaptureCursor),
    );
  }
  writeAtomic(path, JSON.stringify(item));
  return path;
}

export function listEpisodeMirrorOutbox(
  paths: EpisodeMirrorOutboxPaths = {},
): Array<{ path: string; item: EpisodeMirrorOutboxItem }> {
  const { directory } = pathsWithDefaults(paths);
  if (!existsSync(directory)) return [];
  return readdirSync(directory)
    .filter(name => name.endsWith('.json'))
    .sort()
    .map(name => {
      try {
        const path = join(directory, name);
        const item = JSON.parse(readFileSync(path, 'utf8')) as EpisodeMirrorOutboxItem;
        if (
          Number.isFinite(item.startCursor) &&
          Number.isFinite(item.endOffset) &&
          item.endOffset >= item.startCursor &&
          typeof item.liveEpisode === 'string' &&
          typeof item.formattedContent === 'string' &&
          typeof item.appendMarker === 'string' &&
          Array.isArray(item.captureIds)
        ) {
          return { path, item };
        }
        throw new Error(`malformed episode mirror outbox item: ${name}`);
      } catch (error: any) {
        // A malformed earlier item is an unknown acknowledgement boundary.
        // Fail closed instead of skipping it and acknowledging later captures.
        throw new Error(`[EpisodeOutbox] Could not read ${name}: ${error?.message ?? error}`);
      }
    });
}

export async function processEpisodeMirrorOutbox(
  processor: (item: EpisodeMirrorOutboxItem) => Promise<boolean>,
  paths: EpisodeMirrorOutboxPaths = {},
): Promise<{ processed: number; pending: number }> {
  const items = listEpisodeMirrorOutbox(paths);
  let processed = 0;
  for (const entry of items) {
    try {
      const complete = await processor(entry.item);
      if (!complete) break;
      unlinkSync(entry.path);
      processed++;
    } catch (error: any) {
      console.error(`[EpisodeOutbox] Mirror retry failed: ${error?.message ?? error}`);
      break;
    }
  }
  return { processed, pending: items.length - processed };
}