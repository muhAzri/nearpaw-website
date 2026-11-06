import { DeleteObjectCommand, PutObjectCommand, S3Client, type S3ClientConfig } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ServiceUnavailableError } from "@/backend/shared/domain/errors";
import type { ObjectEraser, ObjectStorage } from "../application/media.usecases";

/** Photos never change once uploaded (each gets a fresh key), so they can be cached for a year. */
export const MEDIA_CACHE_CONTROL = "public, max-age=31536000, immutable";

export interface S3StorageConfig {
  bucket: string;
  region: string;
  endpoint?: string;
  forcePathStyle?: boolean;
  /** Static keys, or a provider. Omit to use the AWS default credential chain. */
  credentials?: S3ClientConfig["credentials"];
}

/** Deletes run a few at a time: one DeleteObject per key keeps this working on R2 and MinIO without bulk-delete checksums. */
const DELETE_CONCURRENCY = 10;

export class S3ObjectStorage implements ObjectStorage, ObjectEraser {
  private readonly client: S3Client;

  constructor(private readonly config: S3StorageConfig) {
    this.client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle,
      credentials: config.credentials,
      // Presigned URLs must not carry SDK-added checksum params the phone can't compute.
      requestChecksumCalculation: "WHEN_REQUIRED",
    });
  }

  async presignUpload(input: { key: string; contentType: string; contentLength: number; expiresInSeconds: number }) {
    const command = new PutObjectCommand({
      Bucket: this.config.bucket,
      Key: input.key,
      ContentType: input.contentType,
      ContentLength: input.contentLength,
      CacheControl: MEDIA_CACHE_CONTROL,
    });
    try {
      // Signing these headers makes S3 reject an upload whose type, size or caching differs from what we approved.
      const url = await getSignedUrl(this.client, command, {
        expiresIn: input.expiresInSeconds,
        signableHeaders: new Set(["content-type", "content-length", "cache-control"]),
      });
      return {
        url,
        method: "PUT" as const,
        headers: { "Content-Type": input.contentType, "Cache-Control": MEDIA_CACHE_CONTROL },
      };
    } catch (error) {
      // Typically missing or invalid credentials. Never leak details to the app; the operator sees the cause in the log.
      console.error("[media] could not sign an upload URL", error);
      throw new ServiceUnavailableError("Photo uploads aren't available right now.");
    }
  }

  async deleteObjects(keys: readonly string[]): Promise<void> {
    for (let i = 0; i < keys.length; i += DELETE_CONCURRENCY) {
      await Promise.all(keys.slice(i, i + DELETE_CONCURRENCY).map((key) => this.client.send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key }))));
    }
  }
}

/** Used when no bucket is configured: the endpoint answers 503 instead of pretending to work. */
export class UnconfiguredObjectStorage implements ObjectStorage, ObjectEraser {
  async presignUpload(): Promise<never> {
    throw new ServiceUnavailableError("Photo uploads aren't available right now.");
  }
  /** Fails instead of "succeeding": the caller clears its references only after the files are really gone. */
  async deleteObjects(): Promise<never> {
    throw new ServiceUnavailableError("Photo storage isn't configured.");
  }
}
