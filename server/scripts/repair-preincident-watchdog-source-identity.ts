/**
 * Evidence-gated repair for the ten watchdog conversation rows created before
 * capture IDs and SOURCE headers were added to .chat_capture.
 *
 * Default mode is read-only:
 *   npx tsx server/scripts/repair-preincident-watchdog-source-identity.ts
 *
 * Apply the nine evidence-backed metadata repairs and re-embed edited rows:
 *   npx tsx server/scripts/repair-preincident-watchdog-source-identity.ts --apply
 *
 * Dialogue is never rewritten. A row is repairable only when its immutable
 * content hash matches this reviewed manifest and its full turn sequence has
 * exactly one contiguous match in the retained raw capture. Legacy
 * `SPEAKER: Luca Replit` is exact source evidence for source-replit, but it is
 * not evidence for a capture ID; no capture-id tag is synthesized.
 */

import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { basename } from 'path';
import { neon } from '@neondatabase/serverless';
import { CHAT_CAPTURE_PATH } from '../services/transcript-parser';

export interface RepairManifestEntry {
  id: string;
  contentSha256: string;
  expectedOutcome: 'source-replit' | 'ambiguous';
}

export const PREINCIDENT_WATCHDOG_MANIFEST: RepairManifestEntry[] = [
  {
    id: 'ae65ed5b-eae5-4680-b1a0-15d6f4db676f',
    contentSha256: 'd23927c9de77fb4160d66482d6072a729d02b89a8e9d10cfc2f89a4e90e1a30a',
    expectedOutcome: 'ambiguous',
  },
  {
    id: 'c81d8427-55b9-43d3-bc6b-d7e9d73216bc',
    contentSha256: '443ea28b5b5d3d319f9b5d41e731bb973d8cf9ed28dd51dcf660892089cd0524',
    expectedOutcome: 'source-replit',
  },
  {
    id: 'bdbb055f-f117-43a8-ad58-096f985d6a7a',
    contentSha256: '3424f250ffde3b727b78c49c8170c60ed40530d9b9d7c271ddbd4f65aba5b377',
    expectedOutcome: 'source-replit',
  },
  {
    id: '06c5655a-ee1c-4658-8166-3927ca88e8b4',
    contentSha256: '5c6004e4954b745f5be9937f5a1bff39c682d1f236fe4d3fea63e4001b4cdb5d',
    expectedOutcome: 'source-replit',
  },
  {
    id: 'ca28d610-c46e-43af-91f8-03bcf4505d6e',
    contentSha256: '67f0c1243c7155a167601347a08840906c409038ae9de6405081902acb6644e9',
    expectedOutcome: 'source-replit',
  },
  {
    id: '7523ee23-c3ad-43c8-835e-88a20a58fd8d',
    contentSha256: 'da31b78b8992f32def76a4612b8970c0e6529309013d42d8f50ee3dd60e0a677',
    expectedOutcome: 'source-replit',
  },
  {
    id: 'cc82ef72-3b1a-4c00-81df-daca4ce36a9c',
    contentSha256: '47a3961452c8b9978e092b681b1f7842322b0643ea7ba6e0b666a72322f219e0',
    expectedOutcome: 'source-replit',
  },
  {
    id: '82592617-31a4-4f0c-bd20-5b514a4a9ea2',
    contentSha256: '25b7fcecede3ae07e6530694883c5a0dbcd0906e18da4ee1e8940124b2294082',
    expectedOutcome: 'source-replit',
  },
  {
    id: '642b8f5f-9f45-434f-8073-62adb9862449',
    contentSha256: '2aa0d8ac07749b7bb963c19dcb5ff30024e057758ca26ee8b0ade3aae9080cc6',
    expectedOutcome: 'source-replit',
  },
  {
    id: 'd1b3f466-789a-4b70-8890-f76e6b1cc711',
    contentSha256: '2f219dde38ffb583c3de1aa7f9ea86f877c42cf7fe414c2f1c4b8507a194c886',
    expectedOutcome: 'source-replit',
  },
];

export interface RawEvidenceTurn {
  speaker: 'David' | 'Luca Replit' | 'Luca' | 'Claude Code';
  text: string;
  source: 'replit' | 'claude-code' | null;
  captureId: string | null;
}

interface MemoryTurn {
  label: 'David' | 'LUCA [Replit]' | 'LUCA [Claude Code]';
  text: string;
}

export interface RowAudit {
  id: string;
  outcome: 'source-replit' | 'ambiguous';
  exactSequenceMatches: number;
  rawTurnCount: number;
  addTags: string[];
  addCaptureId: null;
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function parseRawEvidence(raw: string): RawEvidenceTurn[] {
  const turns: RawEvidenceTurn[] = [];
  const blockPattern = /---TURN-START---\n([\s\S]*?)\n---TURN-END---(?:\n|$)/g;
  for (const match of raw.matchAll(blockPattern)) {
    const block = match[1];
    const separator = block.indexOf('\n---\n');
    if (separator < 0) continue;
    const headers = block.slice(0, separator);
    const speaker = /^SPEAKER:\s*(David|Luca Replit|Luca|Claude Code)\s*$/im.exec(headers)?.[1];
    if (!speaker) continue;
    turns.push({
      speaker: speaker as RawEvidenceTurn['speaker'],
      text: block.slice(separator + 5),
      source: (/^SOURCE:\s*(replit|claude-code)\s*$/im.exec(headers)?.[1] as RawEvidenceTurn['source']) ?? null,
      captureId: /^CAPTURE-ID:\s*([A-Za-z0-9-]+)\s*$/im.exec(headers)?.[1] ?? null,
    });
  }
  return turns;
}

export function parseMemoryTurns(content: string): MemoryTurn[] {
  const labelPattern = /^\*\*(David|LUCA \[Replit\]|LUCA \[Claude Code\]):\*\* /gm;
  const labels = [...content.matchAll(labelPattern)];
  return labels.map((match, index) => ({
    label: match[1] as MemoryTurn['label'],
    text: content
      .slice(
        match.index + match[0].length,
        index + 1 < labels.length ? labels[index + 1].index : content.length,
      )
      .replace(/\n\n$/, ''),
  }));
}

function expectedRawSpeaker(label: MemoryTurn['label']): RawEvidenceTurn['speaker'] {
  if (label === 'David') return 'David';
  if (label === 'LUCA [Claude Code]') return 'Claude Code';
  return 'Luca Replit';
}

export function auditManifestRow(
  manifest: RepairManifestEntry,
  content: string,
  rawTurns: RawEvidenceTurn[],
): RowAudit {
  if (sha256(content) !== manifest.contentSha256) {
    throw new Error(`${manifest.id}: content hash differs from reviewed evidence`);
  }

  const memoryTurns = parseMemoryTurns(content);
  const sequences: RawEvidenceTurn[][] = [];
  for (let start = 0; start <= rawTurns.length - memoryTurns.length; start++) {
    const candidate = rawTurns.slice(start, start + memoryTurns.length);
    const exact = memoryTurns.every((turn, offset) =>
      candidate[offset].text === turn.text &&
      candidate[offset].speaker === expectedRawSpeaker(turn.label),
    );
    if (exact) sequences.push(candidate);
  }

  const sourceReplit =
    sequences.length === 1 &&
    sequences[0].some(turn => turn.speaker === 'Luca Replit') &&
    sequences[0].every(turn => turn.speaker === 'David' || turn.speaker === 'Luca Replit');
  const outcome = sourceReplit ? 'source-replit' : 'ambiguous';
  if (outcome !== manifest.expectedOutcome) {
    throw new Error(
      `${manifest.id}: evidence outcome changed (expected ${manifest.expectedOutcome}, found ${outcome})`,
    );
  }

  return {
    id: manifest.id,
    outcome,
    exactSequenceMatches: sequences.length,
    rawTurnCount: sourceReplit ? sequences[0].length : 0,
    addTags: sourceReplit ? ['canonical-conversation', 'source-replit'] : [],
    addCaptureId: null,
  };
}

async function main(): Promise<void> {
  const dbUrl = process.env.NEON_SHARED_DATABASE_URL;
  if (!dbUrl) throw new Error('NEON_SHARED_DATABASE_URL is not set');
  const apply = process.argv.includes('--apply');
  const sql = neon(dbUrl);
  const ids = PREINCIDENT_WATCHDOG_MANIFEST.map(entry => entry.id);
  const rows = await sql`
    SELECT id, content, tags
    FROM conversation_memories
    WHERE id = ANY(${ids}::text[])
    ORDER BY created_at ASC
  ` as Array<{ id: string; content: string; tags: string[] }>;
  if (rows.length !== PREINCIDENT_WATCHDOG_MANIFEST.length) {
    throw new Error(`expected ${PREINCIDENT_WATCHDOG_MANIFEST.length} manifest rows, found ${rows.length}`);
  }

  const rowById = new Map(rows.map(row => [row.id, row]));
  const rawTurns = parseRawEvidence(readFileSync(CHAT_CAPTURE_PATH, 'utf8'));
  const audits = PREINCIDENT_WATCHDOG_MANIFEST.map(entry => {
    const row = rowById.get(entry.id);
    if (!row) throw new Error(`${entry.id}: row missing`);
    if (!row.tags.includes('watchdog') || row.tags.some(tag => tag.startsWith('capture-id:'))) {
      throw new Error(`${entry.id}: row is outside the legacy watchdog cohort`);
    }
    return auditManifestRow(entry, row.content, rawTurns);
  });

  const repairable = audits.filter(audit => audit.outcome === 'source-replit');
  const ambiguous = audits.filter(audit => audit.outcome === 'ambiguous');
  if (repairable.length !== 9 || ambiguous.length !== 1) {
    throw new Error(`unexpected audit split: repairable=${repairable.length}, ambiguous=${ambiguous.length}`);
  }

  if (apply) {
    const { reembedConversationMemory } = await import('./reembed-memory');
    const repairIds = repairable.map(audit => audit.id);
    const updated = await sql`
      UPDATE conversation_memories
      SET tags = (
        SELECT ARRAY(
          SELECT DISTINCT tag
          FROM unnest(tags || ARRAY['canonical-conversation', 'source-replit']::text[]) AS tag
          ORDER BY tag
        )
      )
      WHERE id = ANY(${repairIds}::text[])
      RETURNING id
    ` as Array<{ id: string }>;
    if (updated.length !== repairIds.length) {
      throw new Error(`expected ${repairIds.length} updated rows, found ${updated.length}`);
    }
    for (const id of repairIds) await reembedConversationMemory(id);
  }

  console.log(JSON.stringify({
    mode: apply ? 'apply' : 'audit',
    totals: { audited: audits.length, repairable: repairable.length, ambiguous: ambiguous.length },
    rows: audits,
  }, null, 2));
}

const isEntryPoint =
  basename(process.argv[1] ?? '') === 'repair-preincident-watchdog-source-identity.ts';
if (isEntryPoint) {
  main().catch(error => {
    console.error(error);
    process.exit(1);
  });
}