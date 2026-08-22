/**
 * StorageFile — backend-agnostic file abstraction
 *
 * Both the GCS and S3 backends implement this interface so the rest of the
 * object-storage service never touches a GCS-specific `File` object directly.
 */

export interface StorageFileMetadata {
  contentType?: string;
  /** Byte size — GCS returns a string, S3 returns a number */
  size?: number | string;
  /** Custom/user metadata stored alongside the object */
  customMetadata?: Record<string, string>;
}

export interface StorageFile {
  /** Object key / name within the bucket */
  readonly name: string;
  /** Bucket the object lives in */
  readonly bucketName: string;

  exists(): Promise<boolean>;
  getMetadata(): Promise<StorageFileMetadata>;
  /** Merge additional custom metadata onto the object */
  setCustomMetadata(meta: Record<string, string>): Promise<void>;
  createReadStream(): NodeJS.ReadableStream;
}
