import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ServiceUnavailableError } from "@/backend/shared/domain/errors";
import type { ObjectStorage } from "../application/media.usecases";

/** Photos never change once uploaded (each gets a fresh key), so they can be cached for a year. */
export const MEDIA_CACHE_CONTROL = "public, max-age=31536000, immutable";

export interface S3StorageConfig {
  bucket: string;
  region: string;
  endpoint?: string;
  forcePathStyle?: boolean;
  credentials?: { accessKeyId: string; secretAccessKey: string };
}

export class S3ObjectStorage implements ObjectStorage {
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
  }
}

/** Used when no bucket is configured: the endpoint answers 503 instead of pretending to work. */
export class UnconfiguredObjectStorage implements ObjectStorage {
  async presignUpload(): Promise<never> {
    throw new ServiceUnavailableError("Photo uploads aren't available right now.");
  }
}
