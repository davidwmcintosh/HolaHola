import { Storage } from "@google-cloud/storage";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  CopyObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl as s3GetSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Response } from "express";
import { randomUUID } from "crypto";
import {
  ObjectAclPolicy,
  ObjectPermission,
  canAccessObject,
  getObjectAclPolicy,
  setObjectAclPolicy,
} from "./objectAcl";
import type { StorageFile } from "./storageFile";
import { GcsStorageFile } from "./gcsFile";
import { S3StorageFile } from "./s3File";

export type { StorageFile };

// ---------------------------------------------------------------------------
// Backend detection
// ---------------------------------------------------------------------------

/**
 * Returns true when AWS S3 (or an S3-compatible provider such as Cloudflare R2)
 * is fully configured.  S3 is preferred over GCS when both are set.
 *
 * Required env vars:
 *   AWS_S3_ACCESS_KEY_ID
 *   AWS_S3_SECRET_ACCESS_KEY
 *   AWS_S3_REGION
 *
 * Optional:
 *   AWS_S3_ENDPOINT   — custom endpoint for R2 / MinIO / other S3-compatible stores
 */
export function isS3Configured(): boolean {
  return !!(
    process.env.AWS_S3_ACCESS_KEY_ID &&
    process.env.AWS_S3_SECRET_ACCESS_KEY &&
    process.env.AWS_S3_REGION
  );
}

/**
 * Returns true when a GCS service-account JSON key is present.
 * When this is set the code bypasses the Replit sidecar and works on any host.
 */
function isStandardGcsConfigured(): boolean {
  return !!process.env.GOOGLE_CLOUD_STORAGE_CREDENTIALS;
}

export interface StorageProbeResult {
  ok: boolean;
  /** The bucket name that was probed (undefined when no bucket is configured). */
  bucket?: string;
  /** Error message when ok is false. */
  error?: string;
}
/**
 * Logs which storage backend is active.  Optionally runs a lightweight
 * PUT → HEAD → DELETE probe against a sentinel object so credential errors
 * are caught at boot rather than at first real upload.
 *
 * Returns a StorageProbeResult so callers (e.g. server/index.ts) can surface
 * failures in founder-visible dashboards without this module depending on
 * higher-level services.
 *
 * Call once from server/index.ts after the server starts listening.
 */
export async function logStorageBackend(): Promise<StorageProbeResult> {
  const tag = "[ObjectStorage]";

  // ── Determine backend label ──────────────────────────────────────────────
  let backendLabel: string;
  if (isS3Configured()) {
    const region = process.env.AWS_S3_REGION!;
    const endpoint = process.env.AWS_S3_ENDPOINT;
    backendLabel = endpoint
      ? `S3-compatible (${region} / ${endpoint})`
      : `S3 (${region})`;
  } else if (isStandardGcsConfigured()) {
    let projectHint = "";
    try {
      const creds = JSON.parse(process.env.GOOGLE_CLOUD_STORAGE_CREDENTIALS!);
      if (creds.project_id) projectHint = ` / ${creds.project_id}`;
    } catch { /* ignore */ }
    backendLabel = `GCS service-account${projectHint}`;
  } else {
    // The Replit GCS sidecar (port 1106) is retired.  Neither S3 nor a
    // GCS service-account key is configured — storage calls will fail.
    backendLabel = "UNCONFIGURED (no S3 credentials and no GCS service-account key)";
    console.error(
      `${tag} WARNING: No storage backend is configured. ` +
      "Set AWS_S3_ACCESS_KEY_ID / AWS_S3_SECRET_ACCESS_KEY / AWS_S3_REGION for R2, " +
      "or GOOGLE_CLOUD_STORAGE_CREDENTIALS for GCS. " +
      "The Replit GCS sidecar (port 1106) is retired.",
    );
  }

  console.log(`${tag} backend: ${backendLabel}`);

  // ── Lightweight credential probe ─────────────────────────────────────────
  // Only run when a bucket is known; skipped when no bucket env var is set.
  const probeBucket =
    process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID ||
    process.env.AWS_S3_BUCKET_NAME ||
    process.env.GCS_BUCKET_NAME;

  if (!probeBucket) {
    console.log(`${tag} no probe bucket configured — skipping credential check`);
    return { ok: true };
  }

  const sentinelKey = `__startup-probe-${Date.now()}.txt`;
  const sentinelData = Buffer.from("ok");

  try {
    if (isS3Configured()) {
      const s3 = getS3Client();
      // PUT
      await s3.send(new PutObjectCommand({
        Bucket: probeBucket,
        Key: sentinelKey,
        Body: sentinelData,
        ContentType: "text/plain",
      }));
      // HEAD
      await s3.send(new HeadObjectCommand({ Bucket: probeBucket, Key: sentinelKey }));
      // DELETE
      await s3.send(new DeleteObjectCommand({ Bucket: probeBucket, Key: sentinelKey }));
    } else {
      const gcs = getGcsClient();
      const file = gcs.bucket(probeBucket).file(sentinelKey);
      await file.save(sentinelData, { contentType: "text/plain" });
      await file.exists();
      await file.delete();
    }
    console.log(`${tag} credential probe OK (bucket: ${probeBucket})`);
    return { ok: true, bucket: probeBucket };
  } catch (err: any) {
    const errorMessage = err?.message ?? String(err);
    console.error(
      `${tag} credential probe FAILED (bucket: ${probeBucket}) — ` +
      `uploads will fail until this is resolved. Error: ${errorMessage}`,
    );
    return { ok: false, bucket: probeBucket, error: errorMessage };
  }
}

// ---------------------------------------------------------------------------
// Client factories (lazy-created singletons)
// ---------------------------------------------------------------------------

let _gcsClient: Storage | null = null;
function getGcsClient(): Storage {
  if (_gcsClient) return _gcsClient;

  const credentialsJson = process.env.GOOGLE_CLOUD_STORAGE_CREDENTIALS;
  if (!credentialsJson) {
    // The Replit GCS sidecar (port 1106) is retired.  Without an explicit
    // service-account key the GCS backend cannot authenticate.  In production
    // R2 (AWS_S3_*) is the active backend; isS3Configured() should be true
    // before this function is ever reached.
    throw new Error(
      "[ObjectStorage] GOOGLE_CLOUD_STORAGE_CREDENTIALS is not set and the " +
      "Replit GCS sidecar (port 1106) is retired. " +
      "Configure AWS_S3_* credentials to use the R2 backend instead.",
    );
  }

  const credentials = JSON.parse(credentialsJson);
  _gcsClient = new Storage({
    credentials,
    projectId:
      credentials.project_id ||
      process.env.GOOGLE_CLOUD_PROJECT_ID ||
      "",
  });
  return _gcsClient;
}

let _s3Client: S3Client | null = null;
function getS3Client(): S3Client {
  if (_s3Client) return _s3Client;
  const config: ConstructorParameters<typeof S3Client>[0] = {
    region: process.env.AWS_S3_REGION!,
    credentials: {
      accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY!,
    },
  };
  if (process.env.AWS_S3_ENDPOINT) {
    config.endpoint = process.env.AWS_S3_ENDPOINT;
    // Path-style URLs are required for R2 and most S3-compatible stores.
    config.forcePathStyle = true;
  }
  _s3Client = new S3Client(config);
  return _s3Client;
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

function parseObjectPath(path: string): {
  bucketName: string;
  objectName: string;
} {
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  const pathParts = path.split("/");
  if (pathParts.length < 3) {
    throw new Error("Invalid path: must contain at least a bucket name");
  }
  return {
    bucketName: pathParts[1],
    objectName: pathParts.slice(2).join("/"),
  };
}

/**
 * Runs a CopyObject probe at server startup to detect whether the S3/R2 bucket
 * supports in-place metadata updates (CopyObject to self).  When it does NOT,
 * every metadata write falls back to a full download+reupload — which is silent
 * but expensive.  Running this at boot surfaces the problem immediately in logs.
 *
 * - Only fires when S3 is configured.
 * - Derives the bucket from PRIVATE_OBJECT_DIR (format: /bucket-name/path/…).
 * - Logs WARN when CopyObject falls back; logs INFO on success.
 * - Never throws — a probe failure must not prevent the server from starting.
 */
export async function runCopyObjectProbeAtStartup(): Promise<void> {
  const tag = "[ObjectStorage:CopyProbe]";

  const privateDir = process.env.PRIVATE_OBJECT_DIR ?? "";
  if (!privateDir) {
    console.warn(`${tag} PRIVATE_OBJECT_DIR not set — skipping metadata probe`);
    return;
  }

  const parts = privateDir.replace(/^\//, "").split("/");
  const bucketName = parts[0];
  if (!bucketName) {
    console.warn(`${tag} Could not parse bucket from PRIVATE_OBJECT_DIR="${privateDir}" — skipping probe`);
    return;
  }

  const probeKey = `_health_probe/copy-object-probe-${Date.now()}.txt`;

  if (isS3Configured()) {
    // ── S3 / R2 branch ─────────────────────────────────────────────────────
    try {
      const s3 = getS3Client();

      // 1. Upload a tiny sentinel object.
      await s3.send(new PutObjectCommand({
        Bucket: bucketName,
        Key: probeKey,
        Body: Buffer.from("holahola-startup-probe"),
        ContentType: "text/plain",
        Metadata: { "x-probe-init": "true" },
      }));

      // 2. Attempt in-place CopyObject (metadata update).
      let copyObjectFailed = false;
      try {
        await s3.send(new CopyObjectCommand({
          Bucket: bucketName,
          CopySource: `${bucketName}/${probeKey}`,
          Key: probeKey,
          MetadataDirective: "REPLACE",
          ContentType: "text/plain",
          Metadata: { "x-probe-init": "true", "x-probe-updated": "true" },
        }));
      } catch (copyErr: any) {
        copyObjectFailed = true;
        console.warn(
          `${tag} WARN CopyObject failed for bucket "${bucketName}" (${copyErr?.message ?? copyErr}). ` +
          `Every setCustomMetadata call will fall back to download+reupload. ` +
          `Check bucket region, permissions, or use a bucket that supports same-object copy.`,
        );
      }

      if (!copyObjectFailed) {
        console.log(`${tag} CopyObject probe OK — in-place metadata updates are supported (bucket: ${bucketName})`);
      }
    } catch (err: any) {
      console.warn(
        `${tag} WARN probe error (bucket: ${bucketName}) — ${err?.message ?? err}. ` +
        `Storage uploads may fail until this is resolved.`,
      );
    } finally {
      // 3. Best-effort cleanup — never blocks startup.
      try {
        const s3 = getS3Client();
        await s3.send(new DeleteObjectCommand({ Bucket: bucketName, Key: probeKey }));
      } catch {
        // Cleanup failure is not a health-check failure.
      }
    }
  } else {
    await runGcsCopyProbeWithClient(getGcsClient(), bucketName, probeKey);
  }
}

/**
 * Extracted GCS probe body — accepts an injected Storage client so it can be
 * exercised in tests without real credentials or a real bucket.
 *
 * Exported for testing only; prefer runCopyObjectProbeAtStartup() at runtime.
 */
export async function runGcsCopyProbeWithClient(
  gcs: Storage,
  bucketName: string,
  probeKey?: string,
): Promise<void> {
  const tag = "[ObjectStorage:CopyProbe]";
  const key = probeKey ?? `_health_probe/copy-object-probe-${Date.now()}.txt`;

  // ── GCS branch ─────────────────────────────────────────────────────────
  // Verifies that the bucket's ACL / CMEK policy allows both writes and
  // metadata updates.  A misconfigured policy would otherwise only surface
  // when a real file is written, not at boot.
  try {
    const file = gcs.bucket(bucketName).file(key);

    // 1. Upload a tiny sentinel object.
    await file.save(Buffer.from("holahola-startup-probe"), {
      contentType: "text/plain",
      metadata: { "x-probe-init": "true" },
    });

    // 2. Attempt a metadata update — the operation most likely to fail under
    //    a restrictive CMEK policy or restrictive ACL.
    let setMetadataFailed = false;
    try {
      await file.setMetadata({ metadata: { "x-probe-init": "true", "x-probe-updated": "true" } });
    } catch (metaErr: any) {
      setMetadataFailed = true;
      console.warn(
        `${tag} WARN GCS setMetadata failed for bucket "${bucketName}" (${metaErr?.message ?? metaErr}). ` +
        `Metadata updates will fail at runtime. ` +
        `Check bucket IAM permissions (storage.objects.update) and any CMEK / ACL restrictions.`,
      );
    }

    if (!setMetadataFailed) {
      console.log(`${tag} GCS metadata probe OK — setMetadata supported (bucket: ${bucketName})`);
    }
  } catch (err: any) {
    console.warn(
      `${tag} WARN GCS probe error (bucket: ${bucketName}) — ${err?.message ?? err}. ` +
      `Storage uploads may fail until this is resolved.`,
    );
  } finally {
    // 3. Best-effort cleanup — never blocks startup.
    try {
      await gcs.bucket(bucketName).file(key).delete();
    } catch {
      // Cleanup failure is not a health-check failure.
    }
  }
}

// ---------------------------------------------------------------------------
// Backend-specific file factories (exported for external use)
// ---------------------------------------------------------------------------

export function makeGcsFile(bucketName: string, objectName: string): GcsStorageFile {
  const gcs = getGcsClient();
  const bucket = gcs.bucket(bucketName);
  return new GcsStorageFile(bucketName, objectName, bucket.file(objectName));
}

export function makeS3File(bucketName: string, objectName: string): S3StorageFile {
  return new S3StorageFile(bucketName, objectName, getS3Client());
}

export function makeStorageFile(bucketName: string, objectName: string): StorageFile {
  return isS3Configured()
    ? makeS3File(bucketName, objectName)
    : makeGcsFile(bucketName, objectName);
}

// ---------------------------------------------------------------------------
// Top-level storage helpers — use these instead of accessing the storage client directly
// ---------------------------------------------------------------------------

/**
 * Upload a Buffer to the given bucket/object path.
 * Works on both S3/R2 and GCS backends.
 */
export async function uploadBuffer(
  bucketName: string,
  objectName: string,
  data: Buffer,
  contentType: string,
  customMetadata?: Record<string, string>,
): Promise<void> {
  if (isS3Configured()) {
    const s3 = getS3Client();
    await s3.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: objectName,
        Body: data,
        ContentType: contentType,
        Metadata: customMetadata,
      }),
    );
    return;
  }
  // GCS path
  const gcs = getGcsClient();
  const file = gcs.bucket(bucketName).file(objectName);
  await file.save(data, {
    contentType,
    metadata: customMetadata ?? {},
  });
}

/**
 * Download an object as a Buffer.
 * Returns null if the object does not exist.
 * Works on both S3/R2 and GCS backends.
 */
export async function downloadBuffer(
  bucketName: string,
  objectName: string,
): Promise<{ buffer: Buffer; contentType: string } | null> {
  const file = makeStorageFile(bucketName, objectName);
  if (!(await file.exists())) return null;
  const meta = await file.getMetadata();
  const stream = file.createReadStream();
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    stream.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
    stream.on("end", resolve);
    stream.on("error", reject);
  });
  return {
    buffer: Buffer.concat(chunks),
    contentType: meta.contentType ?? "application/octet-stream",
  };
}

/**
 * List object names under a given prefix.
 * Works on both S3/R2 and GCS backends.
 * Returns full object keys (e.g. "public/ai-images/abc.jpg").
 */
export async function listObjects(
  bucketName: string,
  prefix: string,
): Promise<string[]> {
  if (isS3Configured()) {
    const s3 = getS3Client();
    const keys: string[] = [];
    let continuationToken: string | undefined;
    do {
      const resp = await s3.send(
        new ListObjectsV2Command({
          Bucket: bucketName,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        }),
      );
      for (const obj of resp.Contents ?? []) {
        if (obj.Key) keys.push(obj.Key);
      }
      continuationToken = resp.NextContinuationToken;
    } while (continuationToken);
    return keys;
  }
  // GCS path
  const gcs = getGcsClient();
  const [files] = await gcs.bucket(bucketName).getFiles({ prefix });
  return files.map((f) => f.name);
}

// ---------------------------------------------------------------------------
// Signed-URL generation
// ---------------------------------------------------------------------------

async function signObjectURL({
  bucketName,
  objectName,
  method,
  ttlSec,
}: {
  bucketName: string;
  objectName: string;
  method: "GET" | "PUT" | "DELETE" | "HEAD";
  ttlSec: number;
}): Promise<string> {
  // ── S3 / R2 path ──────────────────────────────────────────────────────────
  if (isS3Configured()) {
    const s3 = getS3Client();
    const commandMap = {
      PUT: new PutObjectCommand({ Bucket: bucketName, Key: objectName }),
      GET: new GetObjectCommand({ Bucket: bucketName, Key: objectName }),
      // DELETE and HEAD presigned URLs use GET command for simplicity
      DELETE: new GetObjectCommand({ Bucket: bucketName, Key: objectName }),
      HEAD: new GetObjectCommand({ Bucket: bucketName, Key: objectName }),
    };
    return s3GetSignedUrl(s3, commandMap[method] ?? commandMap.GET, {
      expiresIn: ttlSec,
    });
  }

  // ── Standard GCS credentials path ─────────────────────────────────────────
  if (isStandardGcsConfigured()) {
    const actionMap: Record<string, "read" | "write" | "delete"> = {
      GET: "read",
      PUT: "write",
      DELETE: "delete",
      HEAD: "read",
    };
    const gcs = getGcsClient();
    const file = gcs.bucket(bucketName).file(objectName);
    const [url] = await file.getSignedUrl({
      version: "v4",
      action: actionMap[method] ?? "read",
      expires: Date.now() + ttlSec * 1000,
    });
    return url;
  }

  // The Replit GCS sidecar (port 1106) that previously handled this path is
  // retired.  Neither S3 nor a GCS service-account key is configured —
  // signed URL generation cannot proceed.
  throw new Error(
    "Cannot generate a signed URL: no storage backend is configured. " +
    "Set AWS_S3_ACCESS_KEY_ID / AWS_S3_SECRET_ACCESS_KEY / AWS_S3_REGION for R2, " +
    "or GOOGLE_CLOUD_STORAGE_CREDENTIALS for GCS. " +
    "The Replit GCS sidecar (port 1106) is retired.",
  );
}

// ---------------------------------------------------------------------------
// ObjectStorageService
// ---------------------------------------------------------------------------

export class ObjectStorageService {
  constructor() {}

  /** Returns the active storage backend: "s3" | "gcs" */
  getBackend(): "s3" | "gcs" {
    return isS3Configured() ? "s3" : "gcs";
  }

  // Gets the public object search paths.
  getPublicObjectSearchPaths(): Array<string> {
    const pathsStr = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "";
    const paths = Array.from(
      new Set(
        pathsStr
          .split(",")
          .map((path) => path.trim())
          .filter((path) => path.length > 0),
      ),
    );
    if (paths.length === 0) {
      throw new Error(
        "PUBLIC_OBJECT_SEARCH_PATHS not set. Create a bucket and set " +
          "PUBLIC_OBJECT_SEARCH_PATHS env var (comma-separated paths).",
      );
    }
    return paths;
  }

  // Gets the private object directory.
  getPrivateObjectDir(): string {
    const dir = process.env.PRIVATE_OBJECT_DIR || "";
    if (!dir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not set. Create a bucket and set PRIVATE_OBJECT_DIR env var.",
      );
    }
    return dir;
  }

  // Search for a public object from the search paths.
  async searchPublicObject(filePath: string): Promise<StorageFile | null> {
    for (const searchPath of this.getPublicObjectSearchPaths()) {
      const fullPath = `${searchPath}/${filePath}`;
      const { bucketName, objectName } = parseObjectPath(fullPath);
      const file = makeStorageFile(bucketName, objectName);
      if (await file.exists()) {
        return file;
      }
    }
    return null;
  }

  // Downloads an object to the response.
  async downloadObject(
    file: StorageFile,
    res: Response,
    cacheTtlSec: number = 3600,
  ) {
    try {
      const metadata = await file.getMetadata();
      const aclPolicy = await getObjectAclPolicy(file);
      const isPublic = aclPolicy?.visibility === "public";

      res.set({
        "Content-Type": metadata.contentType || "application/octet-stream",
        ...(metadata.size != null
          ? { "Content-Length": String(metadata.size) }
          : {}),
        "Cache-Control": `${
          isPublic ? "public" : "private"
        }, max-age=${cacheTtlSec}`,
      });

      const stream = file.createReadStream();

      stream.on("error", (err) => {
        console.error("Stream error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Error streaming file" });
        }
      });

      stream.pipe(res);
    } catch (error) {
      console.error("Error downloading file:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error downloading file" });
      }
    }
  }

  // Gets the upload URL for an object entity.
  async getObjectEntityUploadURL(): Promise<string> {
    const privateObjectDir = this.getPrivateObjectDir();
    const objectId = randomUUID();
    const fullPath = `${privateObjectDir}/uploads/${objectId}`;
    const { bucketName, objectName } = parseObjectPath(fullPath);

    return signObjectURL({
      bucketName,
      objectName,
      method: "PUT",
      ttlSec: 900,
    });
  }

  // Gets the object entity file from the object path.
  async getObjectEntityFile(objectPath: string): Promise<StorageFile> {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }

    const parts = objectPath.slice(1).split("/");
    if (parts.length < 2) {
      throw new ObjectNotFoundError();
    }

    const entityId = parts.slice(1).join("/");
    let entityDir = this.getPrivateObjectDir();
    if (!entityDir.endsWith("/")) {
      entityDir = `${entityDir}/`;
    }
    const objectEntityPath = `${entityDir}${entityId}`;
    const { bucketName, objectName } = parseObjectPath(objectEntityPath);
    const file = makeStorageFile(bucketName, objectName);
    if (!(await file.exists())) {
      throw new ObjectNotFoundError();
    }
    return file;
  }

  normalizeObjectEntityPath(rawPath: string): string {
    // Handle S3 presigned URLs
    if (isS3Configured()) {
      try {
        const url = new URL(rawPath);
        // S3 URL format: https://<bucket>.s3.<region>.amazonaws.com/<key>
        // or path-style: https://s3.<region>.amazonaws.com/<bucket>/<key>
        // or R2: https://<account>.r2.cloudflarestorage.com/<bucket>/<key>
        const rawObjectPath = url.pathname;
        let entityDir = this.getPrivateObjectDir();
        if (!entityDir.endsWith("/")) entityDir = `${entityDir}/`;

        // Path-style: /<bucket>/<key...>
        const { objectName } = parseObjectPath(rawObjectPath);
        const entityDirKey = entityDir.replace(/^\/[^/]+\//, ""); // strip /bucket/
        if (objectName.startsWith(entityDirKey)) {
          const entityId = objectName.slice(entityDirKey.length);
          return `/objects/${entityId}`;
        }
        return rawObjectPath;
      } catch {
        return rawPath;
      }
    }

    // GCS URL normalization (original implementation)
    if (!rawPath.startsWith("https://storage.googleapis.com/")) {
      return rawPath;
    }
    const url = new URL(rawPath);
    const rawObjectPath = url.pathname;
    let objectEntityDir = this.getPrivateObjectDir();
    if (!objectEntityDir.endsWith("/")) {
      objectEntityDir = `${objectEntityDir}/`;
    }
    if (!rawObjectPath.startsWith(objectEntityDir)) {
      return rawObjectPath;
    }
    const entityId = rawObjectPath.slice(objectEntityDir.length);
    return `/objects/${entityId}`;
  }

  // Tries to set the ACL policy for the object entity and return the normalized path.
  async trySetObjectEntityAclPolicy(
    rawPath: string,
    aclPolicy: ObjectAclPolicy,
  ): Promise<string> {
    const normalizedPath = this.normalizeObjectEntityPath(rawPath);
    if (!normalizedPath.startsWith("/")) {
      return normalizedPath;
    }

    const objectFile = await this.getObjectEntityFile(normalizedPath);
    await setObjectAclPolicy(objectFile, aclPolicy);
    return normalizedPath;
  }

  // Checks if the user can access the object entity.
  async canAccessObjectEntity({
    userId,
    objectFile,
    requestedPermission,
  }: {
    userId?: string;
    objectFile: StorageFile;
    requestedPermission?: ObjectPermission;
  }): Promise<boolean> {
    return canAccessObject({
      userId,
      objectFile,
      requestedPermission: requestedPermission ?? ObjectPermission.READ,
    });
  }
}
