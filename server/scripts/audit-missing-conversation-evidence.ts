#!/usr/bin/env npx tsx
/**
 * Read-only evidence audit.
 *
 * Usage:
 *   npx tsx server/scripts/audit-missing-conversation-evidence.ts <conversation-memory-id> \
 *     --archive-dir /tmp/reconciliation-download
 *
 * A local-only diagnostic may pass --skip-archive. Its report is explicitly
 * incomplete and can never produce a safe-to-tag conclusion.
 *
 * Download the protected archive first with:
 *   npx tsx scripts/reconciliation-history-object-storage.ts download /tmp/reconciliation-download
 */
import { neon } from '@neondatabase/serverless';

import { workspaceResolution } from '../services/workspace-root';
import {
  auditEvidenceDocuments,
  retainedCaptureDocuments,
  verifiedArchiveDocuments,
  type EvidenceDocument,
} from '../services/missing-conversation-evidence-audit';

async function main(): Promise<void> {
  const id = process.argv[2];
  if (!id || id.startsWith('--')) {
    throw new Error('usage: audit-missing-conversation-evidence.ts <conversation-memory-id> [--archive-dir <directory>]');
  }
  const archiveIndex = process.argv.indexOf('--archive-dir');
  const archiveDir = archiveIndex >= 0 ? process.argv[archiveIndex + 1] : undefined;
  const skipArchive = process.argv.includes('--skip-archive');
  if (archiveIndex >= 0 && !archiveDir) throw new Error('--archive-dir requires a directory');
  if (!archiveDir && !skipArchive) {
    throw new Error('full audit requires --archive-dir; use --skip-archive only for an explicitly incomplete local diagnostic');
  }
  if (archiveDir && skipArchive) throw new Error('--archive-dir and --skip-archive are mutually exclusive');
  const dbUrl = process.env.NEON_SHARED_DATABASE_URL;
  if (!dbUrl) throw new Error('NEON_SHARED_DATABASE_URL is not set');
  const sql = neon(dbUrl);

  const rows = await sql`
    SELECT id, content
    FROM conversation_memories
    WHERE id = ${id}
    LIMIT 1
  ` as Array<{ id: string; content: string }>;
  if (rows.length !== 1) throw new Error(`${id}: conversation_memory row not found`);

  const ledgerRows = await sql`
    SELECT id, payload_text, payload_sha256
    FROM context_lineage_events
    WHERE event_type = 'raw_window_source_observed'
      AND payload_text IS NOT NULL
    ORDER BY recorded_at ASC, id ASC
  ` as Array<{ id: string; payload_text: string; payload_sha256: string | null }>;
  const documents: EvidenceDocument[] = [
    ...retainedCaptureDocuments(workspaceResolution.root),
    ...ledgerRows.map(row => ({
      class: 'raw-window-ledger' as const,
      location: `context_lineage_events:${row.id}:payload_text`,
      content: row.payload_text,
      eventId: row.id,
      payloadSha256: row.payload_sha256,
    })),
  ];
  let archive;
  if (archiveDir) {
    const verified = verifiedArchiveDocuments(archiveDir);
    documents.push(...verified.documents);
    archive = verified.archive;
  }

  console.log(JSON.stringify(
    auditEvidenceDocuments(id, rows[0].content, documents, archive, !skipArchive),
    null,
    2,
  ));
}

if (process.argv[1]?.includes('audit-missing-conversation-evidence')) {
  main().catch(error => {
    console.error(JSON.stringify({
      schemaVersion: 1,
      error: error instanceof Error ? error.message : String(error),
    }));
    process.exitCode = 1;
  });
}