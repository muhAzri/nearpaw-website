import { z } from "zod";

/** Mirrors the limits in `backend/shared/domain/media-key.ts` (a test keeps them in sync). */
export const MEDIA_CONTENT_TYPE = "image/webp";
export const MEDIA_MAX_BYTES = 2 * 1024 * 1024;
export const MEDIA_MAX_FILES = 4;
export const MEDIA_MAX_THUMBNAIL_BYTES = 256 * 1024;

/**
 * Ask for presigned upload URLs (one per photo). The app compresses each photo to WebP first, so it knows the
 * exact byte size; the URL is signed for that size and type, so S3 rejects anything else.
 */
export const CreateUploadUrlsSchema = z.object({
  purpose: z.enum(["report", "update"]),
  files: z
    .array(
      z.object({
        contentType: z.literal(MEDIA_CONTENT_TYPE),
        sizeBytes: z.number().int().min(1).max(MEDIA_MAX_BYTES),
        /** Optional small variant (WebP) for lists; sign a second URL for it. */
        thumbnailSizeBytes: z.number().int().min(1).max(MEDIA_MAX_THUMBNAIL_BYTES).optional(),
      }),
    )
    .min(1)
    .max(MEDIA_MAX_FILES),
});
export type CreateUploadUrlsInput = z.infer<typeof CreateUploadUrlsSchema>;
