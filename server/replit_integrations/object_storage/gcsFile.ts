/**
 * GcsStorageFile — StorageFile implementation backed by a Google Cloud Storage File.
 */
import { File } from "@google-cloud/storage";
import type { StorageFile, StorageFileMetadata } from "./storageFile";

export class GcsStorageFile implements StorageFile {
  constructor(
    public readonly bucketName: string,
    public readonly name: string,
    private readonly gcsFile: File,
  ) {}

  async exists(): Promise<boolean> {
    const [result] = await this.gcsFile.exists();
    return result;
  }

  async getMetadata(): Promise<StorageFileMetadata> {
    const [meta] = await this.gcsFile.getMetadata();
    return {
      contentType: meta.contentType as string | undefined,
      size: meta.size as string | undefined,
      customMetadata: (meta.metadata as Record<string, string>) ?? {},
    };
  }

  async setCustomMetadata(meta: Record<string, string>): Promise<void> {
    await this.gcsFile.setMetadata({ metadata: meta });
  }

  createReadStream(): NodeJS.ReadableStream {
    return this.gcsFile.createReadStream();
  }

  /** Expose the raw GCS file for callers that still need it (e.g. signed URLs). */
  get raw(): File {
    return this.gcsFile;
  }
}
