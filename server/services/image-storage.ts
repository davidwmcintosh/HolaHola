/**
 * Permanent Image Storage Service
 *
 * Downloads AI-generated image bytes (e.g. expiring DALL-E URLs) and uploads
 * them to Replit Object Storage, returning a permanent public URL.
 *
 * All subsequent students who trigger the same lesson visual get the stored
 * URL for free — zero regeneration cost.
 */

import { objectStorageClient } from '../replit_integrations/object_storage/objectStorage';

const BUCKET_ID = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID || '';

function getBucketName(): string {
  if (!BUCKET_ID) throw new Error('DEFAULT_OBJECT_STORAGE_BUCKET_ID not set');
  return BUCKET_ID;
}

/**
 * Upload a buffer to the public directory of the object storage bucket.
 * Returns a permanent public HTTPS URL.
 */
async function uploadPublicBuffer(
  objectPath: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  const bucket = objectStorageClient.bucket(getBucketName());
  const file = bucket.file(`public/${objectPath}`);
  await file.save(buffer, {
    contentType,
    metadata: { cacheControl: 'public, max-age=31536000' },
  });
  return `https://storage.googleapis.com/${getBucketName()}/public/${objectPath}`;
}

/**
 * Download an image from a URL and upload it to permanent object storage.
 *
 * @param sourceUrl  - The temporary URL to download from (e.g. DALL-E URL)
 * @param filename   - Destination filename inside the public/ai-images/ folder
 * @returns          - Permanent public URL, or the original URL on failure
 */
export async function archiveImageToPermanentStorage(
  sourceUrl: string,
  filename: string
): Promise<string> {
  if (!BUCKET_ID) {
    console.warn('[ImageStorage] Object storage not configured — returning source URL');
    return sourceUrl;
  }

  try {
    const response = await fetch(sourceUrl);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = response.headers.get('content-type') || 'image/png';
    const objectPath = `ai-images/${filename}`;

    const permanentUrl = await uploadPublicBuffer(objectPath, buffer, contentType);
    console.log(`[ImageStorage] Archived ${filename} → ${permanentUrl}`);
    return permanentUrl;
  } catch (err: any) {
    console.error(`[ImageStorage] Failed to archive ${filename}: ${err.message} — falling back to source URL`);
    return sourceUrl;
  }
}
