/**
 * S3StorageFile — StorageFile implementation backed by an AWS S3 (or R2) object.
 */
import {
  S3Client,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  CopyObjectCommand,
} from "@aws-sdk/client-s3";
import { Readable } from "stream";
import type { StorageFile, StorageFileMetadata } from "./storageFile";

export class S3StorageFile implements StorageFile {
  constructor(
    public readonly bucketName: string,
    public readonly name: string,
    private readonly s3: S3Client,
  ) {}

  async exists(): Promise<boolean> {
    try {
      await this.s3.send(
        new HeadObjectCommand({ Bucket: this.bucketName, Key: this.name }),
      );
      return true;
    } catch (err: any) {
      if (
        err.name === "NotFound" ||
        err.name === "NoSuchKey" ||
        err.$metadata?.httpStatusCode === 404
      ) {
        return false;
      }
      throw err;
    }
  }

  async getMetadata(): Promise<StorageFileMetadata> {
    const head = await this.s3.send(
      new HeadObjectCommand({ Bucket: this.bucketName, Key: this.name }),
    );
    return {
      contentType: head.ContentType,
      size: head.ContentLength,
      customMetadata: head.Metadata ?? {},
    };
  }

  async setCustomMetadata(meta: Record<string, string>): Promise<void> {
    // S3 does not support partial metadata updates — we must re-copy the object
    // in-place (copy to itself) with the new metadata.  Merge with existing.
    const head = await this.s3.send(
      new HeadObjectCommand({ Bucket: this.bucketName, Key: this.name }),
    );
    const merged = { ...(head.Metadata ?? {}), ...meta };

    // Primary path: same-bucket server-side copy with MetadataDirective REPLACE.
    // This avoids downloading any bytes — S3 copies in-place at the storage layer.
    try {
      await this.s3.send(
        new CopyObjectCommand({
          Bucket: this.bucketName,
          CopySource: `${this.bucketName}/${this.name}`,
          Key: this.name,
          MetadataDirective: "REPLACE",
          ContentType: head.ContentType,
          Metadata: merged,
        }),
      );
      return;
    } catch (copyErr: any) {
      // CopyObject can fail for cross-region, cross-account, or R2 edge cases.
      // Fall through to the download-and-reupload path.
      console.warn(
        `S3: CopyObject failed for ${this.name} (${copyErr?.message}), falling back to download+reupload`,
      );
    }

    // Fallback: download the object and re-upload with merged metadata.
    const get = await this.s3.send(
      new GetObjectCommand({ Bucket: this.bucketName, Key: this.name }),
    );
    const body = get.Body;
    if (!body) throw new Error(`S3: empty body when re-uploading ${this.name}`);

    const chunks: Buffer[] = [];
    for await (const chunk of body as AsyncIterable<Uint8Array>) {
      chunks.push(Buffer.from(chunk));
    }
    const data = Buffer.concat(chunks);

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: this.name,
        Body: data,
        ContentType: head.ContentType,
        Metadata: merged,
      }),
    );
  }

  createReadStream(): NodeJS.ReadableStream {
    // Return a lazy Readable that fetches from S3 on first read.
    const s3 = this.s3;
    const bucket = this.bucketName;
    const key = this.name;

    const passthrough = new Readable({ read() {} });

    (async () => {
      try {
        const result = await s3.send(
          new GetObjectCommand({ Bucket: bucket, Key: key }),
        );
        if (!result.Body) {
          passthrough.destroy(new Error("Empty S3 response body"));
          return;
        }
        const body = result.Body as AsyncIterable<Uint8Array>;
        for await (const chunk of body) {
          passthrough.push(Buffer.from(chunk));
        }
        passthrough.push(null); // EOF
      } catch (err: any) {
        passthrough.destroy(err);
      }
    })();

    return passthrough;
  }
}
