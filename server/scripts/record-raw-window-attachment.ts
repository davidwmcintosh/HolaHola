/**
 * Retain a workspace-visible Replit-window attachment as byte-exact origin data.
 *
 * This intentionally does not OCR or infer dialogue. The binary source is stored
 * in raw_replit_capture_events, then the canonical episode receives a reference
 * block that identifies the exact workspace attachment and its digest.
 */
import { createHash } from 'crypto';
import { existsSync, readFileSync, realpathSync, statSync } from 'fs';
import { basename, relative, resolve, sep } from 'path';

import { closeDbConnections } from '../db';
import { appendRawWindowOriginToEpisodeDb } from '../services/agent-session-autosave';
import {
  linkRawReplitCaptureToProjection,
  persistRawReplitCapture,
} from '../services/raw-replit-capture';

const args = process.argv.slice(2);
const attachmentIndex = args.indexOf('--attachment');
const episodeIndex = args.indexOf('--episode');

function usage(message: string): never {
  console.error(`[record-raw-window-attachment] ERROR: ${message}`);
  console.error('Usage: npx tsx server/scripts/record-raw-window-attachment.ts --attachment <workspace-file> --episode <episode-file>');
  process.exit(1);
}

if (attachmentIndex === -1 || !args[attachmentIndex + 1]) usage('--attachment is required');
if (episodeIndex === -1 || !args[episodeIndex + 1]) usage('--episode is required');

const attachmentPath = resolve(args[attachmentIndex + 1]);
const episodeFilename = args[episodeIndex + 1];
if (!existsSync(attachmentPath)) usage(`attachment not found: ${attachmentPath}`);
const attachmentRoot = resolve(process.cwd(), 'attached_assets');
const pathWithinAttachmentRoot = relative(attachmentRoot, attachmentPath);
if (
  pathWithinAttachmentRoot === ''
  || pathWithinAttachmentRoot.startsWith('..')
  || pathWithinAttachmentRoot.includes('..' + sep)
) {
  usage('--attachment must be a file inside this workspace’s attached_assets directory');
}
const realAttachmentRoot = realpathSync(attachmentRoot);
const realAttachmentPath = realpathSync(attachmentPath);
const realPathWithinAttachmentRoot = relative(realAttachmentRoot, realAttachmentPath);
if (
  realPathWithinAttachmentRoot === ''
  || realPathWithinAttachmentRoot.startsWith('..')
  || realPathWithinAttachmentRoot.includes('..' + sep)
  || !statSync(realAttachmentPath).isFile()
) {
  usage('--attachment must resolve to a regular file inside this workspace’s attached_assets directory');
}

const bytes = readFileSync(attachmentPath);
const sha256 = createHash('sha256').update(bytes).digest('hex');
const name = basename(attachmentPath);
const byteCount = statSync(attachmentPath).size;
const marker = `<!-- raw-window-attachment-origin:${sha256} -->`;

const reference = [
  '**[RAW WINDOW — ATTACHMENT ORIGIN DATA]:**',
  '[CLASSIFICATION: UNKNOWN]',
  `[ATTACHMENT: ${name}]`,
  `[WORKSPACE PATH: ${attachmentPath}]`,
  `[ORIGIN SHA-256: ${sha256}]`,
  `[ORIGIN BYTES: ${byteCount}]`,
  '[NOTE: This byte-exact screenshot is retained as visible-window evidence. No OCR or speaker attribution has been inferred.]',
].join('\n');

try {
  const capture = await persistRawReplitCapture({
    sourceKey: `raw-window-attachment:${sha256}`,
    sourceRoute: 'record-raw-window-attachment',
    events: [{
      sequenceNumber: 1,
      eventType: 'raw-window-attachment',
      payloadText: reference,
      payloadBytes: bytes,
      idempotencyKey: 'attachment',
      metadata: {
        attachmentName: name,
        attachmentPath,
        contentType: name.toLowerCase().endsWith('.png') ? 'image/png' : 'application/octet-stream',
        sourceSha256: sha256,
        sourceBytes: byteCount,
      },
    }],
    metadata: { attachmentName: name, attachmentPath, sourceSha256: sha256 },
  });

  const projected = await appendRawWindowOriginToEpisodeDb(
    reference,
    episodeFilename,
    sha256,
    marker,
  );
  if (!projected) {
    throw new Error(`Raw attachment ${sha256} is durable but its Episode projection failed.`);
  }

  await linkRawReplitCaptureToProjection({
    capture,
    targetKind: 'episode-origin-attachment',
    targetKey: `${episodeFilename}:${sha256}`,
    disposition: 'origin-data',
    metadata: { attachmentName: name, attachmentPath, sourceSha256: sha256 },
  });

  console.log(`[record-raw-window-attachment] ✓ Attachment retained and projected: ${name}`);
  console.log(`  SHA-256: ${sha256}`);
  console.log(`  Bytes: ${byteCount}`);
  await closeDbConnections();
} catch (error) {
  await closeDbConnections();
  throw error;
}