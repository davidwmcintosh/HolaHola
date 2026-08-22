/**
 * Upload, retrieve, and replicate the protected Replit-history archive using
 * S3-compatible private object stores. The commands deliberately refuse to
 * replace an existing key with different content.
 *
 * Usage:
 *   npx tsx scripts/reconciliation-history-object-storage.ts upload <bundle> <manifest>
 *   npx tsx scripts/reconciliation-history-object-storage.ts download <directory>
 *   npx tsx scripts/reconciliation-history-object-storage.ts download-replica <directory>
 *   npx tsx scripts/reconciliation-history-object-storage.ts replicate
 */

import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdtemp, mkdir, open, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
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
const partSize = 32 * 1024 * 1024;

interface ArchiveStorageConfig {
  bucket: string;
  prefix: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string;
  accountLabel: string;
}

function fail(message: string): never {
  throw new Error(`[ReconciliationArchive] ${message}`);
}

function requiredEnv(
  env: NodeJS.ProcessEnv,
  key: string,
  label: string,
): string {
  const value = env[key];
  if (!value) fail(`${key} is required for ${label}`);
  return value;
}

export function normalizeReplicaRegion(region: string, endpoint?: string): string {
  const normalized = region.trim();
  if (!endpoint) return normalized;

  let hostname = "";
  try {
    hostname = new URL(endpoint).hostname.toLowerCase();
  } catch {
    return normalized;
  }

  // Cloudflare R2 exposes bucket locations as labels such as
  // "Eastern North America (ENAM)", while its S3 API expects "auto".
  if (hostname.endsWith(".r2.cloudflarestorage.com") && /\([A-Z0-9]+\)$/i.test(normalized)) {
    return "auto";
  }
  return normalized;
}

function primaryConfig(env: NodeJS.ProcessEnv = process.env): ArchiveStorageConfig {
  const bucket = env.RECONCILIATION_ARCHIVE_BUCKET ??
    env.AWS_S3_DESTINATION_BUCKET ??
    env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!bucket) {
    fail(
      "no primary archive bucket is configured; set RECONCILIATION_ARCHIVE_BUCKET, " +
      "AWS_S3_DESTINATION_BUCKET, or DEFAULT_OBJECT_STORAGE_BUCKET_ID",
    );
  }
  return {
    bucket,
    prefix: env.RECONCILIATION_ARCHIVE_PREFIX ??
      `history-archives/${ARCHIVE_ID}`,
    region: requiredEnv(env, "AWS_S3_REGION", "the primary archive"),
    accessKeyId: requiredEnv(env, "AWS_S3_ACCESS_KEY_ID", "the primary archive"),
    secretAccessKey: requiredEnv(env, "AWS_S3_SECRET_ACCESS_KEY", "the primary archive"),
    endpoint: env.AWS_S3_ENDPOINT,
    accountLabel: env.RECONCILIATION_ARCHIVE_ACCOUNT_LABEL ?? "primary-archive",
  };
}

function replicaConfig(env: NodeJS.ProcessEnv = process.env): ArchiveStorageConfig {
  return {
    bucket: requiredEnv(env, "RECONCILIATION_REPLICA_BUCKET", "the independent replica"),
    prefix: env.RECONCILIATION_REPLICA_PREFIX ??
      `history-archives/${ARCHIVE_ID}`,
    region: normalizeReplicaRegion(
      requiredEnv(env, "RECONCILIATION_REPLICA_REGION", "the independent replica"),
      env.RECONCILIATION_REPLICA_ENDPOINT,
    ),
    accessKeyId: requiredEnv(
      env,
      "RECONCILIATION_REPLICA_ACCESS_KEY_ID",
      "the independent replica",
    ),
    secretAccessKey: requiredEnv(
      env,
      "RECONCILIATION_REPLICA_SECRET_ACCESS_KEY",
      "the independent replica",
    ),
    endpoint: env.RECONCILIATION_REPLICA_ENDPOINT,
    accountLabel: env.RECONCILIATION_REPLICA_ACCOUNT_LABEL ?? "independent-replica",
  };
}

function createClient(config: ArchiveStorageConfig): S3Client {
  const clientConfig: ConstructorParameters<typeof S3Client>[0] = {
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  };
  if (config.endpoint) {
    clientConfig.endpoint = config.endpoint;
    clientConfig.forcePathStyle = true;
  }
  return new S3Client(clientConfig);
}

function objectKeys(config: ArchiveStorageConfig) {
  return {
    bundle: `${config.prefix}/${ARCHIVE_ID}.bundle`,
    manifest: `${config.prefix}/manifest.txt`,
    receipt: `${config.prefix}/replication-receipt.txt`,
  };
}

export function assertIndependentReplica(
  primary: ArchiveStorageConfig,
  replica: ArchiveStorageConfig,
): void {
  if (replica.accountLabel === primary.accountLabel) {
    fail("replica account label must identify a separately administered account");
  }
  if (replica.accessKeyId === primary.accessKeyId) {
    fail("replica must not reuse the primary archive access key");
  }
  if (
    replica.bucket === primary.bucket &&
    (replica.endpoint ?? "") === (primary.endpoint ?? "")
  ) {
    fail("replica must use a different bucket or endpoint from the primary archive");
  }
  if (replica.prefix !== primary.prefix) {
    fail(
      "replica prefix must match the primary archive prefix because the copied manifest " +
      "contains the primary bundle object key",
    );
  }
}

async function fileSha256(path: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

async function headOrUndefined(
  client: S3Client,
  config: ArchiveStorageConfig,
  key: string,
) {
  try {
    return await client.send(new HeadObjectCommand({
      Bucket: config.bucket,
      Key: key,
    }));
  } catch (error) {
    const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata
      ?.httpStatusCode;
    if (status === 404) return undefined;
    throw error;
  }
}

async function uploadImmutableFile(
  client: S3Client,
  config: ArchiveStorageConfig,
  path: string,
  key: string,
  contentType: string,
): Promise<void> {
  const file = await stat(path);
  const sha256 = await fileSha256(path);
  const existing = await headOrUndefined(client, config, key);
  if (existing) {
    const existingSha = existing.Metadata?.sha256;
    if (existing.ContentLength === file.size && existingSha === sha256) {
      console.log(`Archive object already present and checksum-matched: ${key}`);
      return;
    }
    fail(`refusing to replace existing archive object with different content: ${key}`);
  }

  const created = await client.send(new CreateMultipartUploadCommand({
    Bucket: config.bucket,
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
        Bucket: config.bucket,
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
      Bucket: config.bucket,
      Key: key,
      UploadId: created.UploadId,
      MultipartUpload: { Parts: parts },
    }));
  } catch (error) {
    await client.send(new AbortMultipartUploadCommand({
      Bucket: config.bucket,
      Key: key,
      UploadId: created.UploadId,
    })).catch(() => undefined);
    throw error;
  } finally {
    await handle.close();
  }

  const stored = await headOrUndefined(client, config, key);
  if (!stored || stored.ContentLength !== file.size || stored.Metadata?.sha256 !== sha256) {
    fail(`storage metadata verification failed for ${key}`);
  }
  console.log(`Uploaded immutable archive object: ${key} (${file.size} bytes)`);
}

async function downloadAndCheck(
  client: S3Client,
  config: ArchiveStorageConfig,
  key: string,
  destination: string,
  expectedSha?: string,
) {
  const response = await client.send(new GetObjectCommand({
    Bucket: config.bucket,
    Key: key,
  }));
  if (!response.Body) fail(`storage returned no body for ${key}`);
  const output = createWriteStream(destination);
  const hash = createHash("sha256");
  for await (const chunk of response.Body as AsyncIterable<Buffer>) {
    hash.update(chunk);
    if (!output.write(chunk)) {
      await new Promise<void>((resolve) => output.once("drain", resolve));
    }
  }
  output.end();
  await finished(output);
  const sha256 = hash.digest("hex");
  const stored = await headOrUndefined(client, config, key);
  const storedSha = stored?.Metadata?.sha256;
  if (
    !storedSha ||
    sha256 !== storedSha ||
    (expectedSha !== undefined && storedSha !== expectedSha)
  ) {
    fail(`downloaded checksum does not match stored archive metadata for ${key}`);
  }
  return {
    sha256,
    bytes: stored?.ContentLength ?? 0,
  };
}

async function upload(
  client: S3Client,
  config: ArchiveStorageConfig,
  bundlePath: string,
  manifestPath: string,
) {
  const keys = objectKeys(config);
  if (basename(bundlePath) !== `${ARCHIVE_ID}.bundle`) {
    fail(`bundle file must be named ${ARCHIVE_ID}.bundle`);
  }
  if (basename(manifestPath) !== "manifest.txt") fail("manifest file must be named manifest.txt");
  await uploadImmutableFile(client, config, bundlePath, keys.bundle, "application/vnd.git.bundle");
  await uploadImmutableFile(client, config, manifestPath, keys.manifest, "text/plain; charset=utf-8");
}

async function downloadArchive(
  client: S3Client,
  config: ArchiveStorageConfig,
  destinationDir: string,
) {
  const keys = objectKeys(config);
  await mkdir(destinationDir, { recursive: true });
  const manifestPath = join(destinationDir, "manifest.txt");
  const manifestCheck = await downloadAndCheck(client, config, keys.manifest, manifestPath);
  const manifest = await readFile(manifestPath, "utf8");
  const expectedKey = /^bundle_object_key=(.+)$/m.exec(manifest)?.[1];
  const expectedSha = /^bundle_sha256=(.+)$/m.exec(manifest)?.[1];
  if (expectedKey !== keys.bundle) fail("manifest bundle object key does not match this archive");
  if (!expectedSha) fail("manifest has no bundle_sha256");
  const bundleCheck = await downloadAndCheck(
    client,
    config,
    keys.bundle,
    join(destinationDir, `${ARCHIVE_ID}.bundle`),
    expectedSha,
  );
  console.log(`Downloaded and checksum-verified archive from ${config.accountLabel}: ${destinationDir}`);
  return {
    bundleSha256: bundleCheck.sha256,
    bundleBytes: bundleCheck.bytes,
    manifestSha256: manifestCheck.sha256,
    manifestBytes: manifestCheck.bytes,
  };
}

async function download(destinationDir: string) {
  const config = primaryConfig();
  await downloadArchive(createClient(config), config, destinationDir);
}

async function downloadReplica(destinationDir: string) {
  const config = replicaConfig();
  await downloadArchive(createClient(config), config, destinationDir);
}

export function receiptContent(
  primary: ArchiveStorageConfig,
  replica: ArchiveStorageConfig,
  checks: {
    bundleSha256: string;
    bundleBytes: number;
    manifestSha256: string;
    manifestBytes: number;
  },
): string {
  return [
    "HolaHola protected reconciliation history archive replica",
    `archive_id=${ARCHIVE_ID}`,
    "receipt_version=1",
    `source_account_label=${primary.accountLabel}`,
    `source_bucket=${primary.bucket}`,
    `source_prefix=${primary.prefix}`,
    `replica_account_label=${replica.accountLabel}`,
    `replica_bucket=${replica.bucket}`,
    `replica_prefix=${replica.prefix}`,
    `bundle_sha256=${checks.bundleSha256}`,
    `bundle_bytes=${checks.bundleBytes}`,
    `manifest_sha256=${checks.manifestSha256}`,
    `manifest_bytes=${checks.manifestBytes}`,
    "source_download=sha256-verified",
    "replica_download=sha256-verified",
    "credentials=not-recorded",
    "recovery_rule=never-force-push-or-overwrite-github-main",
    "",
  ].join("\n");
}

async function replicate() {
  const primary = primaryConfig();
  const replica = replicaConfig();
  assertIndependentReplica(primary, replica);

  const primaryClient = createClient(primary);
  const replicaClient = createClient(replica);
  const workDir = await mkdtemp(join(tmpdir(), "reconciliation-replica-"));

  try {
    const sourceDir = join(workDir, "source");
    const replicaDir = join(workDir, "replica");
    const sourceChecks = await downloadArchive(primaryClient, primary, sourceDir);
    const sourceBundlePath = join(sourceDir, `${ARCHIVE_ID}.bundle`);
    const sourceManifestPath = join(sourceDir, "manifest.txt");

    await upload(replicaClient, replica, sourceBundlePath, sourceManifestPath);

    const replicaChecks = await downloadArchive(replicaClient, replica, replicaDir);
    if (
      replicaChecks.bundleSha256 !== sourceChecks.bundleSha256 ||
      replicaChecks.bundleBytes !== sourceChecks.bundleBytes ||
      replicaChecks.manifestSha256 !== sourceChecks.manifestSha256 ||
      replicaChecks.manifestBytes !== sourceChecks.manifestBytes
    ) {
      fail("replica checksums or byte counts differ from the primary archive");
    }

    const receiptPath = join(workDir, "replication-receipt.txt");
    await writeFile(receiptPath, receiptContent(primary, replica, replicaChecks), "utf8");
    await uploadImmutableFile(
      replicaClient,
      replica,
      receiptPath,
      objectKeys(replica).receipt,
      "text/plain; charset=utf-8",
    );

    console.log("Independent archive replica complete and checksum-verified.");
    console.log(`  source:  ${primary.bucket}/${primary.prefix}`);
    console.log(`  replica: ${replica.bucket}/${replica.prefix}`);
    console.log(`  receipt: ${objectKeys(replica).receipt}`);
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

const [mode, ...args] = process.argv.slice(2);
if (basename(process.argv[1] ?? "") === "reconciliation-history-object-storage.ts") {
  if (mode === "upload" && args.length === 2) {
    const config = primaryConfig();
    await upload(createClient(config), config, args[0], args[1]);
  } else if (mode === "download" && args.length === 1) {
    await download(args[0]);
  } else if (mode === "download-replica" && args.length === 1) {
    await downloadReplica(args[0]);
  } else if (mode === "replicate" && args.length === 0) {
    await replicate();
  } else {
    console.error(
      "Usage: reconciliation-history-object-storage.ts upload <bundle> <manifest> | " +
      "download <directory> | download-replica <directory> | replicate",
    );
    process.exitCode = 2;
  }
}