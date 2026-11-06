import { ValidationError } from "./errors";

/**
 * Storage keys for user photos. Shared kernel: the media module mints them, the reports module checks them.
 * Layout: `public/<purpose>/<userId>/<id>.webp` — the owner is part of the key, so a user can only attach
 * photos they uploaded themselves.
 */
export type MediaPurpose = "report" | "update";

export const MEDIA_CONTENT_TYPE = "image/webp";
export const MEDIA_EXTENSION = "webp";
/** Photos are compressed on the phone, so a few hundred KB is typical; this is a hard ceiling. */
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
export const MAX_FILES_PER_REQUEST = 4;
/** Each photo also gets a small list thumbnail (~400 px). Typical size is 15-40 KB; this is the ceiling. */
export const MAX_THUMBNAIL_BYTES = 256 * 1024;

const SAFE_SEGMENT = /^[A-Za-z0-9_-]{1,64}$/;

export function mediaKey(userId: string, purpose: MediaPurpose, fileId: string): string {
  if (!SAFE_SEGMENT.test(userId) || !SAFE_SEGMENT.test(fileId)) throw new ValidationError("Invalid media owner");
  return `public/${purpose}/${userId}/${fileId}.${MEDIA_EXTENSION}`;
}

const THUMBNAIL_SUFFIX = "_t";

/** `public/report/<user>/<id>.webp` -> `public/report/<user>/<id>_t.webp`. Pure naming convention, so no extra column. */
export function thumbnailKey(key: string): string {
  return key.replace(new RegExp(`\\.${MEDIA_EXTENSION}$`), `${THUMBNAIL_SUFFIX}.${MEDIA_EXTENSION}`);
}

export function isThumbnailKey(key: string): boolean {
  return key.endsWith(`${THUMBNAIL_SUFFIX}.${MEDIA_EXTENSION}`);
}

export function isOwnedMediaKey(userId: string, key: string): boolean {
  if (isThumbnailKey(key)) return false; // thumbnails are derived, never attached directly
  const parts = key.split("/");
  return (
    parts.length === 4 &&
    parts[0] === "public" &&
    (parts[1] === "report" || parts[1] === "update") &&
    parts[2] === userId &&
    new RegExp(`^[A-Za-z0-9_-]{1,64}\\.${MEDIA_EXTENSION}$`).test(parts[3])
  );
}

/** Photos attached to a report or update must be ones this user uploaded. */
export function assertOwnedMedia(userId: string, keys: readonly string[]): void {
  if (!keys.every((key) => isOwnedMediaKey(userId, key))) {
    throw new ValidationError("One of the photos wasn't uploaded by you. Add it again.", { field: "photos" });
  }
}

/** Turns a storage key into the absolute URL clients load. Clients never build media URLs themselves. */
export type MediaUrl = (key: string) => string;

/**
 * `baseUrl` is where `public/…` keys are served from (`S3_PUBLIC_BASE_URL`). With no base configured (storage disabled) the key
 * is returned untouched, so no response ever points at a made-up host.
 */
export function mediaUrlFor(baseUrl: string | null | undefined): MediaUrl {
  const base = baseUrl?.replace(/\/+$/, "");
  return (key) => (base ? `${base}/${key.replace(/^\/+/, "")}` : key);
}
