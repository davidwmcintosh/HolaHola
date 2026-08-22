/**
 * Upload and retrieve the protected Replit-history archive from the configured
 * S3-compatible private object store. The commands deliberately refuse to
 * replace an existing key with different content.
 *
 * Usage:
 *   npx tsx scripts/reconciliation-history-object-storage.ts upload <bundle> <manifest>
 *   npx tsx scripts/reconciliation-history-object-storage.ts download <directory>
 */

import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, open, readFile, stat } from "node:fs/promises";
import { basename, join } from "node:path";
import { finished } from "node:stream/promises";
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  GetObjectCommand,
  HeadObjectCommand,
  S3Client,
  UploadPartCommand,
} from "@aws-sdk/client-s3";

const ARCHIVE_ID = "reconciliation-2026-08-21";
const prefix = process.env.RECONCILIATION_ARCHIVE_PREFIX ??
  `history-archives/${ARCHIVE_ID}`;
const bundleKey = `${prefix}/${ARCHIVE_ID}.bundle`;
const manifestKey = `${prefix}/manifest.txt`;
const bucket = process.env.RECONCILIATION_ARCHIVE_BUCKET ??
  process.env.AWS_S3_DESTINATION_BUCKET ??
  process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
const partSize = 32 * 1024 * 1024;

function fail(message: string): never {
  throw new Error(`[ReconciliationArchive] ${message}`);
}

if (!bucket) fail("no archive bucket is configured");
if (!process.env.AWS_S3_ACCESS_KEY_ID || !process.env.AWS_S3_SECRET_ACCESS_KEY) {
  fail("AWS_S3_ACCESS_KEY_ID and AWS_S3_SECRET_ACCESS_KEY are required");
}
if (!process.env.AWS_S3_REGION) fail("AWS_S3_REGION is required");

const clientConfig: ConstructorParameters<typeof S3Client>[0] = {
  region: process.env.AWS_S3_REGION,
  credentials: {
    accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
  },
};
if (process.env.AWS_S3_ENDPOINT) {
  clientConfig.endpoint = process.env.AWS_S3_ENDPOINT;
  clientConfig.forcePathStyle = true;
}
const client = new S3Client(clientConfig);

async function fileSha256(path: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

async function headOrUndefined(key: string) {
  try {
    return await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  } catch (error) {
    const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata
      ?.httpStatusCode;
    if (status === 404) return undefined;
    throw error;
  }
}

async function uploadImmutableFile(
  path: string,
  key: string,
  contentType: string,
): Promise<void> {
  const file = await stat(path);
  const sha256 = await fileSha256(path);
  const existing = await headOrUndefined(key);
  if (existing) {
    const existingSha = existing.Metadata?.sha256;
    if (existing.ContentLength === file.size && existingSha === sha256) {
      console.log(`Archive object already present and checksum-matched: ${key}`);
      return;
    }
    fail(`refusing to replace existing archive object with different content: ${key}`);
  }

  const created = await client.send(new CreateMultipartUploadCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
    Metadata: {
      archiveid: ARCHIVE_ID,
      sha256,
    },
  }));
  if (!created.UploadId) fail(`storage did not provide an upload ID for ${key}`);

  const parts: Array<{ ETag?: string; PartNumber: number }> = [];
  const handle = await open(path, "r");
  try {
    let offset = 0;
    let partNumber = 1;
    while (offset < file.size) {
      const bytes = Math.min(partSize, file.size - offset);
      const buffer = Buffer.allocUnsafe(bytes);
      const { bytesRead } = await handle.read(buffer, 0, bytes, offset);
      if (bytesRead !== bytes) fail(`short read while preparing ${key}`);
      const part = await client.send(new UploadPartCommand({
        Bucket: bucket,
        Key: key,
        UploadId: created.UploadId,
        PartNumber: partNumber,
        Body: buffer,
      }));
      if (!part.ETag) fail(`storage did not return an ETag for ${key} part ${partNumber}`);
      parts.push({ ETag: part.ETag, PartNumber: partNumber });
      offset += bytes;
      partNumber += 1;
    }

    await client.send(new CompleteMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      UploadId: created.UploadId,
      MultipartUpload: { Parts: parts },
    }));
  } catch (error) {
    await client.send(new AbortMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      UploadId: created.UploadId,
    })).catch(() => undefined);
    throw error;
  } finally {
    await handle.close();
  }

  const stored = await headOrUndefined(key);
  if (!stored || stored.ContentLength !== file.size || stored.Metadata?.sha256 !== sha256) {
    fail(`storage metadata verification failed for ${key}`);
  }
  console.log(`Uploaded immutable archive object: ${key} (${file.size} bytes)`);
}

async function downloadAndCheck(key: string, destination: string, expectedSha?: string) {
  const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!response.Body) fail(`storage returned no body for ${key}`);
  const output = createWriteStream(destination);
  const hash = createHash("sha256");
  for await (const chunk of response.Body as AsyncIterable<Buffer>) {
    hash.update(chunk);
    if (!output.write(chunk)) await new Promise<void>((resolve) => output.once("drain", resolve));
  }
  output.end();
  await finished(output);
  const sha256 = hash.digest("hex");
  const stored = await headOrUndefined(key);
  const requiredSha = expectedSha ?? stored?.Metadata?.sha256;
  if (!requiredSha || sha256 !== requiredSha) {
    fail(`downloaded checksum does not match stored archive metadata for ${key}`);
  }
  return sha256;
}

async function upload(bundlePath: string, manifestPath: string) {
  if (basename(bundlePath) !== `${ARCHIVE_ID}.bundle`) {
    fail(`bundle file must be named ${ARCHIVE_ID}.bundle`);
  }
  if (basename(manifestPath) !== "manifest.txt") fail("manifest file must be named manifest.txt");
  await uploadImmutableFile(bundlePath, bundleKey, "application/vnd.git.bundle");
  await uploadImmutableFile(manifestPath, manifestKey, "text/plain; charset=utf-8");
}

async function download(destinationDir: string) {
  await mkdir(destinationDir, { recursive: true });
  const manifestPath = join(destinationDir, "manifest.txt");
  await downloadAndCheck(manifestKey, manifestPath);
  const manifest = await readFile(manifestPath, "utf8");
  const expectedKey = /^bundle_object_key=(.+)$/m.exec(manifest)?.[1];
  const expectedSha = /^bundle_sha256=(.+)$/m.exec(manifest)?.[1];
  if (expectedKey !== bundleKey) fail("manifest bundle object key does not match this archive");
  if (!expectedSha) fail("manifest has no bundle_sha256");
  await downloadAndCheck(bundleKey, join(destinationDir, `${ARCHIVE_ID}.bundle`), expectedSha);
  console.log(`Downloaded and checksum-verified archive: ${destinationDir}`);
}

const [mode, ...args] = process.argv.slice(2);
if (mode === "upload" && args.length === 2) {
  await upload(args[0], args[1]);
} else if (mode === "download" && args.length === 1) {
  await download(args[0]);
} else {
  console.error(
    "Usage: reconciliation-history-object-storage.ts upload <bundle> <manifest> | download <directory>",
  );
  process.exitCode = 2;
}