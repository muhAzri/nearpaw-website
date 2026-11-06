import type { Clock } from "@/backend/shared/application/clock";
import { HOUR_MS } from "@/backend/shared/application/clock";
import type { RateLimiter } from "@/backend/shared/application/rate-limiter";
import { RateLimitedError, ValidationError } from "@/backend/shared/domain/errors";
import {
  MAX_FILES_PER_REQUEST,
  MAX_THUMBNAIL_BYTES,
  MAX_UPLOAD_BYTES,
  MEDIA_CONTENT_TYPE,
  mediaKey,
  thumbnailKey,
  type MediaPurpose,
} from "@/backend/shared/domain/media-key";
import type { Principal } from "@/backend/shared/domain/principal";

/** Port: whatever can hand out time-limited upload URLs (S3, R2, MinIO…). */
export interface ObjectStorage {
  presignUpload(input: {
    key: string;
    contentType: string;
    contentLength: number;
    expiresInSeconds: number;
  }): Promise<{
    url: string;
    method: "PUT";
    /** Headers the uploader MUST send exactly as given — they are part of the signature. */
    headers: Record<string, string>;
  }>;
}

/** Port: may this user upload right now (not restricted/suspended)? */
export interface UploadPolicy {
  assertCanUpload(userId: string): Promise<void>;
}

export const UPLOAD_URL_TTL_SECONDS = 300;
export const UPLOAD_REQUESTS_PER_HOUR = 20;

/** One signed upload: the photo, and (when the app declared one) its thumbnail. */
export interface SignedUpload {
  key: string;
  uploadUrl: string;
  method: "PUT";
  headers: Record<string, string>;
  expiresAt: string;
  thumbnail?: { key: string; uploadUrl: string; method: "PUT"; headers: Record<string, string>; expiresAt: string };
}

export interface UploadRequest {
  purpose: MediaPurpose;
  files: { contentType: string; sizeBytes: number; thumbnailSizeBytes?: number }[];
}

export class MediaUploads {
  constructor(
    private readonly storage: ObjectStorage,
    private readonly policy: UploadPolicy,
    private readonly limiter: RateLimiter,
    private readonly clock: Clock,
    private readonly newId: () => string = () => crypto.randomUUID().replaceAll("-", ""),
  ) {}

  async createUploadUrls(user: Principal, request: UploadRequest): Promise<{ uploads: SignedUpload[] }> {
    if (request.files.length < 1 || request.files.length > MAX_FILES_PER_REQUEST) {
      throw new ValidationError(`Add between 1 and ${MAX_FILES_PER_REQUEST} photos`);
    }
    for (const file of request.files) {
      if (file.contentType !== MEDIA_CONTENT_TYPE) throw new ValidationError("Photos must be WebP", { field: "contentType" });
      if (!Number.isInteger(file.sizeBytes) || file.sizeBytes < 1 || file.sizeBytes > MAX_UPLOAD_BYTES) {
        throw new ValidationError(`Each photo must be under ${Math.floor(MAX_UPLOAD_BYTES / 1024 / 1024)} MB`, { field: "sizeBytes" });
      }
    }
    for (const file of request.files) {
      const t = file.thumbnailSizeBytes;
      if (t !== undefined && (!Number.isInteger(t) || t < 1 || t > MAX_THUMBNAIL_BYTES)) {
        throw new ValidationError(`Each thumbnail must be under ${Math.floor(MAX_THUMBNAIL_BYTES / 1024)} KB`, { field: "thumbnailSizeBytes" });
      }
    }
    await this.policy.assertCanUpload(user.id);
    if (!(await this.limiter.allow(`upload:${user.id}`, UPLOAD_REQUESTS_PER_HOUR, HOUR_MS))) {
      throw new RateLimitedError("You've reached the hourly photo upload limit. Please try again later.");
    }

    const expiresAt = new Date(this.clock.now().getTime() + UPLOAD_URL_TTL_SECONDS * 1000).toISOString();
    const uploads = await Promise.all(
      request.files.map(async (file): Promise<SignedUpload> => {
        const key = mediaKey(user.id, request.purpose, this.newId());
        const signed = await this.storage.presignUpload({
          key,
          contentType: file.contentType,
          contentLength: file.sizeBytes,
          expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
        });
        const upload = { key, uploadUrl: signed.url, method: signed.method, headers: signed.headers, expiresAt };
        if (file.thumbnailSizeBytes === undefined) return upload;
        const thumb = await this.storage.presignUpload({
          key: thumbnailKey(key),
          contentType: file.contentType,
          contentLength: file.thumbnailSizeBytes,
          expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
        });
        return { ...upload, thumbnail: { key: thumbnailKey(key), uploadUrl: thumb.url, method: thumb.method, headers: thumb.headers, expiresAt } };
      }),
    );
    return { uploads };
  }
}
