import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, open, rename, rm, stat } from "node:fs/promises";
import { dirname } from "node:path";
import { finished } from "node:stream/promises";
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

export const MAINTENANCE_ARCHIVE_ID = "publish-recovery-2026-08-24";
export const MAINTENANCE_ARCHIVE_PREFIX = `.private/maintenance-archives/${MAINTENANCE_ARCHIVE_ID}`;

export interface MaintenanceArchiveAsset {
  sourcePath: string;
  objectKey: string;
  bytes: number;
  sha256: string;
  contentType: string;
}

export interface MaintenanceArchiveManifest {
  format: "holahola-maintenance-archive";
  version: 1;
  archiveId: string;
  objectPrefix: string;
  assets: MaintenanceArchiveAsset[];
}

interface MaintenanceArchiveConfig {
  bucket: string;
  prefix: string;
  client: S3Client;
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`[MaintenanceArchive] ${name} is required.`);
  return value;
}

export function getMaintenanceArchiveConfig(): MaintenanceArchiveConfig {
  const bucket =
    process.env.AWS_S3_DESTINATION_BUCKET?.trim() ||
    process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID?.trim();
  if (!bucket) {
    throw new Error(
      "[MaintenanceArchive] Set AWS_S3_DESTINATION_BUCKET or DEFAULT_OBJECT_STORAGE_BUCKET_ID.",
    );
  }

  // Cloudflare R2 uses the S3-compatible "auto" region. Replit's existing
  // destination credentials do not require a separate AWS_S3_REGION secret.
  const region = process.env.AWS_S3_REGION?.trim() || "auto";
  const endpoint = process.env.AWS_S3_ENDPOINT?.trim();
  const clientConfig: ConstructorParameters<typeof S3Client>[0] = {
    region,
    credentials: {
      accessKeyId: requiredEnv("AWS_S3_ACCESS_KEY_ID"),
      secretAccessKey: requiredEnv("AWS_S3_SECRET_ACCESS_KEY"),
    },
  };
  if (endpoint) {
    clientConfig.endpoint = endpoint;
    clientConfig.forcePathStyle = true;
  }

  return {
    bucket,
    prefix: process.env.MAINTENANCE_ARCHIVE_PREFIX?.trim() || MAINTENANCE_ARCHIVE_PREFIX,
    client: new S3Client(clientConfig),
  };
}

export function archiveObjectKey(sourcePath: string, prefix = MAINTENANCE_ARCHIVE_PREFIX): string {
  const normalized = sourcePath.replaceAll("\\", "/").replace(/^\/+/, "");
  if (!normalized || normalized.startsWith("../") || normalized.includes("/../")) {
    throw new Error(`[MaintenanceArchive] Refusing unsafe source path: ${sourcePath}`);
  }
  return `${prefix}/${normalized}`;
}

export function contentTypeForArchivePath(sourcePath: string): string {
  const lower = sourcePath.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".zip")) return "application/zip";
  if (lower.endsWith(".json")) return "application/json";
  return "application/octet-stream";
}

export async function sha256File(path: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

async function headObject(config: MaintenanceArchiveConfig, key: string) {
  try {
    return await config.client.send(new HeadObjectCommand({
      Bucket: config.bucket,
      Key: key,
    }));
  } catch (error) {
    const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (status === 404) return undefined;
    throw error;
  }
}

export async function uploadImmutableArchiveFile(
  localPath: string,
  asset: MaintenanceArchiveAsset,
): Promise<void> {
  const config = getMaintenanceArchiveConfig();
  const localStat = await stat(localPath);
  if (localStat.size !== asset.bytes) {
    throw new Error(`[MaintenanceArchive] Size changed during archive: ${asset.sourcePath}`);
  }
  const actualSha256 = await sha256File(localPath);
  if (actualSha256 !== asset.sha256) {
    throw new Error(`[MaintenanceArchive] Checksum changed during archive: ${asset.sourcePath}`);
  }

  const existing = await headObject(config, asset.objectKey);
  if (existing) {
    if (
      existing.ContentLength === asset.bytes &&
      existing.Metadata?.sha256 === asset.sha256 &&
      existing.Metadata?.sourcepath === asset.sourcePath
    ) {
      return;
    }
    throw new Error(
      `[MaintenanceArchive] Refusing to replace existing object with different bytes: ${asset.objectKey}`,
    );
  }

  await config.client.send(new PutObjectCommand({
    Bucket: config.bucket,
    Key: asset.objectKey,
    Body: createReadStream(localPath),
    ContentType: asset.contentType,
    Metadata: {
      archiveid: MAINTENANCE_ARCHIVE_ID,
      sha256: asset.sha256,
      sourcepath: asset.sourcePath,
    },
  }));

  const stored = await headObject(config, asset.objectKey);
  if (
    !stored ||
    stored.ContentLength !== asset.bytes ||
    stored.Metadata?.sha256 !== asset.sha256 ||
    stored.Metadata?.sourcepath !== asset.sourcePath
  ) {
    throw new Error(`[MaintenanceArchive] Remote metadata verification failed: ${asset.objectKey}`);
  }
}

export async function downloadAndVerifyArchiveFile(
  asset: MaintenanceArchiveAsset,
  destination: string,
): Promise<void> {
  const config = getMaintenanceArchiveConfig();
  const response = await config.client.send(new GetObjectCommand({
    Bucket: config.bucket,
    Key: asset.objectKey,
  }));
  if (!response.Body) {
    throw new Error(`[MaintenanceArchive] Object has no body: ${asset.objectKey}`);
  }

  await mkdir(dirname(destination), { recursive: true });
  const temporary = `${destination}.archive-${process.pid}.tmp`;
  const output = createWriteStream(temporary, { flags: "wx" });
  const hash = createHash("sha256");
  let bytes = 0;
  try {
    for await (const chunk of response.Body as AsyncIterable<Buffer>) {
      const buffer = Buffer.from(chunk);
      bytes += buffer.length;
      hash.update(buffer);
      if (!output.write(buffer)) {
        await new Promise<void>((resolve) => output.once("drain", resolve));
      }
    }
    output.end();
    await finished(output);
    const actualSha256 = hash.digest("hex");
    if (bytes !== asset.bytes || actualSha256 !== asset.sha256) {
      throw new Error(`[MaintenanceArchive] Download checksum verification failed: ${asset.objectKey}`);
    }
    await rename(temporary, destination);
  } catch (error) {
    output.destroy();
    await rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }
}

export async function readVerifiedArchiveMetadata(asset: MaintenanceArchiveAsset): Promise<void> {
  const config = getMaintenanceArchiveConfig();
  const stored = await headObject(config, asset.objectKey);
  if (
    !stored ||
    stored.ContentLength !== asset.bytes ||
    stored.Metadata?.sha256 !== asset.sha256 ||
    stored.Metadata?.sourcepath !== asset.sourcePath
  ) {
    throw new Error(`[MaintenanceArchive] Stored archive metadata is invalid: ${asset.objectKey}`);
  }
}