import { mediaUrlFor } from "@/backend/shared/domain/media-key";
import { systemClock, type Clock } from "@/backend/shared/application/clock";
import { serverEnv } from "@/backend/shared/config/env";
import type { RateLimiter } from "@/backend/shared/application/rate-limiter";
import type { Authenticator } from "@/backend/shared/presentation/auth";
import { MediaUploads, type ObjectEraser, type ObjectStorage, type UploadPolicy } from "./application/media.usecases";
import { S3ObjectStorage, UnconfiguredObjectStorage } from "./infrastructure/s3-object-storage";
import { MediaController } from "./presentation/media.controller";

/** S3 when a bucket is configured, otherwise a stub that answers 503. */
function storageFromEnv(): ObjectStorage & ObjectEraser {
  const env = serverEnv();
  if (!env.S3_BUCKET || !env.S3_REGION) return new UnconfiguredObjectStorage();
  const hasKeys = env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY;
  return new S3ObjectStorage({
    bucket: env.S3_BUCKET,
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT,
    forcePathStyle: env.S3_FORCE_PATH_STYLE === "true",
    credentials: hasKeys ? { accessKeyId: env.S3_ACCESS_KEY_ID!, secretAccessKey: env.S3_SECRET_ACCESS_KEY! } : undefined,
  });
}

export function createMediaModule(deps: { auth: Authenticator; policy: UploadPolicy; limiter: RateLimiter; storage?: ObjectStorage; clock?: Clock; mediaBaseUrl?: string }) {
  const storage = deps.storage ?? storageFromEnv();
  const uploads = new MediaUploads(storage, deps.policy, deps.limiter, deps.clock ?? systemClock, undefined, mediaUrlFor(deps.mediaBaseUrl));
  // Test doubles that only presign uploads can't delete; those callers get the "not configured" eraser.
  const eraser: ObjectEraser = "deleteObjects" in storage ? (storage as ObjectEraser) : new UnconfiguredObjectStorage();
  return { uploads, controller: new MediaController(deps.auth, uploads), eraser };
}
