/**
 * transcript-parser.ts
 *
 * Shared parsing logic for Luca↔David JSONL transcripts.
 *
 * Imported by:
 *   - server/services/agent-session-autosave.ts   (periodic + flush-trigger saves)
 *   - server/scripts/save-transcript-now.ts       (direct session-end save)
 *
 * Both consumers must use this module so pre-compression recovery and cursor
 * semantics stay exactly in sync. Never copy-paste these functions.
 */

import { existsSync, statSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

export const WORKSPACE      = '/home/runner/workspace';
export const TRANSCRIPT_DIR = join(WORKSPACE, '.local/state/replit/agent/transcript');
export const CURSOR_PATH    = join(WORKSPACE, '.local/.transcript_cursor.json');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DialogueTurn {
  speaker: 'DAVID' | 'LUCA';
  text: string;
  memoryId: number;
}

export interface TranscriptCursor {
  sessionId: string;
  lastMemoryId: number;
}

// ---------------------------------------------------------------------------
// Cursor persistence
// ---------------------------------------------------------------------------

export function loadCursor(): TranscriptCursor {
  try {
    if (existsSync(CURSOR_PATH)) {
      return JSON.parse(readFileSync(CURSOR_PATH, 'utf-8'));
    }
  } catch { /* ignore */ }
  return { sessionId: '', lastMemoryId: 0 };
}

export function saveCursor(cursor: TranscriptCursor): void {
  try {
    writeFileSync(CURSOR_PATH, JSON.stringify(cursor));
  } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// File discovery
// ---------------------------------------------------------------------------

export function findTranscriptPath(): { sessionId: string; path: string } | null {
  try {
    if (!existsSync(TRANSCRIPT_DIR)) return null;
    const sessions = readdirSync(TRANSCRIPT_DIR).filter(d => {
      try { return statSync(join(TRANSCRIPT_DIR, d)).isDirectory(); } catch { return false; }
    });
    if (sessions.length === 0) return null;
    const sorted = sessions.sort((a, b) => {
      try {
        return statSync(join(TRANSCRIPT_DIR, b)).mtimeMs -
               statSync(join(TRANSCRIPT_DIR, a)).mtimeMs;
      } catch { return 0; }
    });
    const sessionId = sorted[0];
    const path = join(TRANSCRIPT_DIR, sessionId, 'transcript.jsonl');
    return existsSync(path) ? { sessionId, path } : null;
  } catch { return null; }
}

// ---------------------------------------------------------------------------
// Text cleaning
// ---------------------------------------------------------------------------

export function cleanUserText(text: string): string {
  return text
    .replace(/<user_message>([\s\S]*?)<\/user_message>/g, '$1')
    .replace(/<automatic_updates>[\s\S]*?<\/automatic_updates>/g, '')
    .replace(/<system_reminder[^>]*>[\s\S]*?<\/system_reminder>/g, '')
    // Self-closing form: <pre_compression_transcript path="..." /> — strip entirely
    .replace(/<pre_compression_transcript[^>]*\/>/g, '')
    // Paired form: <pre_compression_transcript ...>...</pre_compression_transcript>
    .replace(
      /<pre_compression_transcript[^>]*>[\s\S]*?<\/pre_compression_transcript>/g,
      '[earlier session — compressed, recovered below if still on disk]',
    )
    .trim();
}

// ---------------------------------------------------------------------------
// Pre-compression path extraction
// ---------------------------------------------------------------------------

/**
 * Extracts any <pre_compression_transcript path="..."> pointers before they
 * get stripped down to a placeholder, so the raw turns they point to can
 * still be recovered from disk before that referenced file itself rotates away.
 */
export function extractPreCompressionPaths(text: string): string[] {
  const paths: string[] = [];
  const re = /<pre_compression_transcript\s+path="([^"]+)"[^>]*>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    paths.push(match[1]);
  }
  return paths;
}

// ---------------------------------------------------------------------------
// Dialogue chunking — record-safe, memoryId-grouped
// ---------------------------------------------------------------------------

export interface ChunkResult {
  dialogue: string;
  /** Cursor value to persist — only turns through this memoryId were saved. */
  lastIncludedMemoryId: number;
  includedCount: number;
  remainingCount: number;
}

/**
 * Build a single dialogue chunk from a flat turn list.
 *
 * Turns are grouped by memoryId before chunking.  A chunk boundary never
 * falls inside a memoryId group — all turns sharing an ID are persisted
 * atomically (or the whole group is deferred to the next chunk).
 *
 * If a single group exceeds maxChars by itself, its turns are individually
 * truncated so the cursor can advance past that record and not loop forever.
 */
export function buildDialogueChunk(
  turns: DialogueTurn[],
  afterId: number,
  maxChars = 80_000,
): ChunkResult {
  // Group consecutive turns by their memoryId
  const groups: { memoryId: number; turns: DialogueTurn[] }[] = [];
  for (const t of turns) {
    const last = groups[groups.length - 1];
    if (last && last.memoryId === t.memoryId) {
      last.turns.push(t);
    } else {
      groups.push({ memoryId: t.memoryId, turns: [t] });
    }
  }

  const lines: string[] = [];
  let charCount = 0;
  let lastIncludedMemoryId = afterId;
  let includedCount = 0;
  let remainingCount = 0;

  for (let gi = 0; gi < groups.length; gi++) {
    const group = groups[gi];
    const groupBlocks = group.turns.map(t => {
      const name = t.speaker.charAt(0) + t.speaker.slice(1).toLowerCase();
      return `${name}: ${t.text}\n`;
    });
    const groupSize = groupBlocks.reduce((s, b) => s + b.length, 0);

    if (charCount + groupSize > maxChars) {
      if (charCount === 0) {
        // First group alone exceeds the cap — truncate each turn individually
        // so the cursor advances and the record is not deferred indefinitely.
        let remaining = maxChars - 100;
        for (const block of groupBlocks) {
          if (remaining <= 0) {
            // Omit this turn but note it in the record
            lines.push('[turn omitted — group exceeded chunk limit]\n');
            break;
          }
          if (block.length <= remaining) {
            lines.push(block);
            remaining -= block.length;
          } else {
            lines.push(block.slice(0, remaining) + '\n[turn truncated — exceeded chunk limit]\n');
            remaining = 0;
          }
          includedCount++;
        }
        lastIncludedMemoryId = group.memoryId;
        // Remaining groups go to the next chunk
        remainingCount = groups.slice(gi + 1).reduce((s, g) => s + g.turns.length, 0);
      } else {
        // Defer the entire group to the next chunk — cursor does NOT advance past it
        remainingCount = groups.slice(gi).reduce((s, g) => s + g.turns.length, 0);
      }
      break;
    }

    for (const block of groupBlocks) lines.push(block);
    charCount += groupSize;
    lastIncludedMemoryId = group.memoryId;
    includedCount += group.turns.length;
  }

  return {
    dialogue: lines.join('\n'),
    lastIncludedMemoryId,
    includedCount,
    remainingCount,
  };
}

// ---------------------------------------------------------------------------
// Core JSONL turn extractor
// ---------------------------------------------------------------------------

export function extractTurns(
  jsonlPath: string,
  afterMemoryId: number,
  visitedPaths: Set<string> = new Set(),
): { turns: DialogueTurn[]; maxMemoryId: number } {
  const turns: DialogueTurn[] = [];
  const seen = new Set<string>();
  let maxMemoryId = afterMemoryId;
  visitedPaths.add(jsonlPath);

  try {
    const lines = readFileSync(jsonlPath, 'utf-8').split('\n');
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      let obj: any;
      try { obj = JSON.parse(line); } catch { continue; }

      const memoryId: number = obj.memory_id ?? 0;
      if (memoryId <= afterMemoryId) continue;
      if (memoryId > maxMemoryId) maxMemoryId = memoryId;

      for (const m of (obj.messages ?? [])) {
        const role: string = m.role;
        const content = m.content;

        if (role === 'user') {
          let rawText = '';
          if (typeof content === 'string') rawText = content;
          else if (Array.isArray(content)) {
            for (const c of content) {
              if (c?.type === 'text') rawText += c.text ?? '';
            }
          }

          // Recover pre-compression transcript turns BEFORE stripping the tag,
          // so dialogue that was compressed mid-cycle is not lost.
          for (const p of extractPreCompressionPaths(rawText)) {
            if (visitedPaths.has(p) || !existsSync(p)) continue;
            const recovered = extractTurns(p, 0, visitedPaths);
            for (const t of recovered.turns) {
              const key = t.speaker + '|' + t.text.slice(0, 80);
              if (seen.has(key)) continue;
              seen.add(key);
              turns.push(t);
            }
          }

          const text = cleanUserText(rawText);
          if (text.length < 5) continue;
          const key = 'DAVID|' + text.slice(0, 80);
          if (seen.has(key)) continue;
          seen.add(key);
          turns.push({ speaker: 'DAVID', text, memoryId });

        } else if (role === 'assistant') {
          let text = '';
          if (Array.isArray(content)) {
            for (const c of content) {
              if (c?.type === 'text') text += c.text ?? '';
            }
          }
          if (text.length < 5) continue;
          const key = 'LUCA|' + text.slice(0, 80);
          if (seen.has(key)) continue;
          seen.add(key);
          turns.push({ speaker: 'LUCA', text, memoryId });
        }
      }
    }
  } catch { /* file read error — return what we have */ }

  return { turns, maxMemoryId };
}
