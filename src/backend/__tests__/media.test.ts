import { describe, expect, it } from "vitest";
import { MEDIA_CONTENT_TYPE, MEDIA_MAX_BYTES, MEDIA_MAX_FILES, MEDIA_MAX_THUMBNAIL_BYTES } from "@/contracts";
import { MediaUploads, UPLOAD_REQUESTS_PER_HOUR, type ObjectStorage } from "../modules/media/application/media.usecases";
import { S3ObjectStorage } from "../modules/media/infrastructure/s3-object-storage";
import { InMemoryRateLimiter } from "./support/in-memory-rate-limiter";
import { ForbiddenError, RateLimitedError, ServiceUnavailableError, ValidationError } from "@/backend/shared/domain/errors";
import { MAX_FILES_PER_REQUEST, MAX_THUMBNAIL_BYTES, MAX_UPLOAD_BYTES, isOwnedMediaKey, isThumbnailKey, mediaKey, mediaUrlFor, thumbnailKey } from "@/backend/shared/domain/media-key";

const user = { id: "u_maya42", role: "user" as const };
const now = new Date("2026-11-06T10:00:00Z");

const fakeStorage = (): ObjectStorage & { calls: unknown[] } => {
  const calls: unknown[] = [];
  return {
    calls,
    async presignUpload(input) {
      calls.push(input);
      return { url: `https://bucket.test/${input.key}?sig=1`, method: "PUT", headers: { "Content-Type": input.contentType } };
    },
  };
};

const build = (over: { allow?: boolean; storage?: ObjectStorage } = {}) => {
  let n = 0;
  return new MediaUploads(
    over.storage ?? fakeStorage(),
    { assertCanUpload: async () => { if (over.allow === false) throw new ForbiddenError("This account can't post right now"); } },
    new InMemoryRateLimiter(),
    { now: () => now },
    () => `id${++n}`,
    mediaUrlFor("https://files.example.test/"),
  );
};

const webp = (sizeBytes = 120_000) => ({ contentType: MEDIA_CONTENT_TYPE, sizeBytes });

describe("media keys", () => {
  it("namespaces keys by purpose and owner", () => {
    expect(mediaKey("u_maya42", "report", "abc123")).toBe("public/report/u_maya42/abc123.webp");
    expect(isOwnedMediaKey("u_maya42", "public/report/u_maya42/abc123.webp")).toBe(true);
    expect(isOwnedMediaKey("u_maya42", "public/update/u_maya42/abc123.webp")).toBe(true);
  });

  it("refuses someone else's keys, other formats and path tricks", () => {
    for (const key of [
      "public/report/u_other/abc123.webp",
      "public/report/u_maya42/abc123.jpg",
      "public/report/u_maya42/../u_other/abc.webp",
      "private/report/u_maya42/abc123.webp",
      "public/report/u_maya42/abc123.webp/extra",
      "public/misc/u_maya42/abc123.webp",
    ]) expect(isOwnedMediaKey("u_maya42", key), key).toBe(false);
  });

  it("derives the thumbnail key from the photo key and never accepts it as a photo", () => {
    const key = "public/report/u_maya42/abc123.webp";
    expect(thumbnailKey(key)).toBe("public/report/u_maya42/abc123_t.webp");
    expect(isThumbnailKey(thumbnailKey(key))).toBe(true);
    expect(isThumbnailKey(key)).toBe(false);
    expect(isOwnedMediaKey("u_maya42", thumbnailKey(key))).toBe(false);
  });

  it("rejects unsafe owner ids when minting keys", () => {
    expect(() => mediaKey("../evil", "report", "a")).toThrow(ValidationError);
  });

  it("keeps the shared contract limits in sync with the domain", () => {
    expect([MEDIA_MAX_BYTES, MEDIA_MAX_FILES, MEDIA_MAX_THUMBNAIL_BYTES]).toEqual([MAX_UPLOAD_BYTES, MAX_FILES_PER_REQUEST, MAX_THUMBNAIL_BYTES]);
  });
});

describe("MediaUploads", () => {
  it("returns one signed upload per file, keyed under the caller", async () => {
    const storage = fakeStorage();
    const { uploads } = await build({ storage }).createUploadUrls(user, { purpose: "report", files: [webp(), webp(200_000)] });
    expect(uploads.map((u) => u.key)).toEqual(["public/report/u_maya42/id1.webp", "public/report/u_maya42/id2.webp"]);
    expect(uploads[0]).toMatchObject({ method: "PUT", expiresAt: "2026-11-06T10:05:00.000Z" });
    // the signed size is the size the app declared
    expect(storage.calls[1]).toMatchObject({ contentLength: 200_000, contentType: "image/webp", expiresInSeconds: 300 });
  });

  it("signs a second URL for the thumbnail, sized as declared", async () => {
    const storage = fakeStorage();
    const { uploads } = await build({ storage }).createUploadUrls(user, { purpose: "report", files: [{ ...webp(150_000), thumbnailSizeBytes: 20_000 }, webp()] });
    expect(uploads[0].thumbnail).toMatchObject({ key: "public/report/u_maya42/id1_t.webp", method: "PUT" });
    expect(uploads[1]).not.toHaveProperty("thumbnail");
    expect(storage.calls).toHaveLength(3); // photo + thumbnail, then the second photo
    // files are presigned concurrently, so look the call up by key rather than by position
    expect((storage.calls as { key: string }[]).find((c) => c.key === "public/report/u_maya42/id1_t.webp")).toMatchObject({ contentLength: 20_000, contentType: "image/webp", expiresInSeconds: 300 });
  });

  it("returns the absolute URL each uploaded photo and thumbnail will be served from", async () => {
    const { uploads } = await build().createUploadUrls(user, { purpose: "report", files: [{ ...webp(), thumbnailSizeBytes: 20_000 }] });
    expect(uploads[0].url).toBe("https://files.example.test/public/report/u_maya42/id1.webp");
    expect(uploads[0].thumbnail?.url).toBe("https://files.example.test/public/report/u_maya42/id1_t.webp");
  });

  it("rejects an oversized thumbnail before signing anything", async () => {
    const storage = fakeStorage();
    await expect(build({ storage }).createUploadUrls(user, { purpose: "report", files: [{ ...webp(), thumbnailSizeBytes: MAX_THUMBNAIL_BYTES + 1 }] })).rejects.toThrow(ValidationError);
    expect(storage.calls).toHaveLength(0);
  });

  it("only accepts WebP within the size and count limits", async () => {
    const svc = build();
    await expect(svc.createUploadUrls(user, { purpose: "report", files: [{ contentType: "image/jpeg", sizeBytes: 1000 }] })).rejects.toThrow(ValidationError);
    await expect(svc.createUploadUrls(user, { purpose: "report", files: [webp(MAX_UPLOAD_BYTES + 1)] })).rejects.toThrow(ValidationError);
    await expect(svc.createUploadUrls(user, { purpose: "report", files: [webp(0)] })).rejects.toThrow(ValidationError);
    await expect(svc.createUploadUrls(user, { purpose: "report", files: [] })).rejects.toThrow(ValidationError);
    await expect(svc.createUploadUrls(user, { purpose: "report", files: Array(MAX_FILES_PER_REQUEST + 1).fill(webp()) })).rejects.toThrow(ValidationError);
  });

  it("blocks restricted accounts before signing anything", async () => {
    const storage = fakeStorage();
    await expect(build({ allow: false, storage }).createUploadUrls(user, { purpose: "report", files: [webp()] })).rejects.toThrow(ForbiddenError);
    expect(storage.calls).toHaveLength(0);
  });

  it("rate limits upload requests per user", async () => {
    const svc = build();
    for (let i = 0; i < UPLOAD_REQUESTS_PER_HOUR; i++) await svc.createUploadUrls(user, { purpose: "update", files: [webp()] });
    await expect(svc.createUploadUrls(user, { purpose: "update", files: [webp()] })).rejects.toThrow(RateLimitedError);
    // someone else is unaffected
    await expect(svc.createUploadUrls({ id: "u_budi", role: "user" }, { purpose: "update", files: [webp()] })).resolves.toBeDefined();
  });
});

describe("S3ObjectStorage", () => {
  it("signs content type, exact size and cache headers so S3 rejects anything else", async () => {
    const storage = new S3ObjectStorage({ bucket: "nearpaw-media", region: "ap-southeast-3", credentials: { accessKeyId: "AKIAEXAMPLE", secretAccessKey: "secretsecretsecretsecretsecretsecret00" } });
    const signed = await storage.presignUpload({ key: "public/report/u_maya42/id1.webp", contentType: "image/webp", contentLength: 123_456, expiresInSeconds: 300 });
    const url = new URL(signed.url);
    expect(url.hostname).toBe("nearpaw-media.s3.ap-southeast-3.amazonaws.com");
    expect(url.pathname).toBe("/public/report/u_maya42/id1.webp");
    expect(url.searchParams.get("X-Amz-Expires")).toBe("300");
    const signedHeaders = url.searchParams.get("X-Amz-SignedHeaders")!.split(";");
    expect(signedHeaders).toEqual(expect.arrayContaining(["content-length", "content-type", "cache-control", "host"]));
    expect(signed.method).toBe("PUT");
    expect(signed.headers).toEqual({ "Content-Type": "image/webp", "Cache-Control": "public, max-age=31536000, immutable" });
  });

  it("signs against a Cloudflare R2 endpoint (region auto, path-style, no checksum params)", async () => {
    const storage = new S3ObjectStorage({
      bucket: "nearpaw",
      region: "auto",
      endpoint: "https://acct123.r2.cloudflarestorage.com",
      forcePathStyle: true,
      credentials: { accessKeyId: "r2key", secretAccessKey: "r2secretr2secretr2secretr2secretr2secret" },
    });
    const { url: signed } = await storage.presignUpload({ key: "public/report/u_maya42/id1.webp", contentType: "image/webp", contentLength: 98_765, expiresInSeconds: 300 });
    const url = new URL(signed);
    expect(url.origin).toBe("https://acct123.r2.cloudflarestorage.com");
    expect(url.pathname).toBe("/nearpaw/public/report/u_maya42/id1.webp");
    expect(url.searchParams.get("X-Amz-Credential")).toContain("/auto/s3/aws4_request");
    // R2 rejects the SDK's default CRC32 checksum parameters on presigned PUTs
    expect([...url.searchParams.keys()].filter((k) => k.toLowerCase().includes("checksum"))).toEqual([]);
  });

  it("answers 503 instead of crashing when credentials are missing or rejected", async () => {
    const storage = new S3ObjectStorage({
      bucket: "nearpaw",
      region: "auto",
      endpoint: "https://acct123.r2.cloudflarestorage.com",
      credentials: async () => { throw new Error("Could not load credentials from any providers"); },
    });
    await expect(storage.presignUpload({ key: "public/report/u_maya42/id1.webp", contentType: "image/webp", contentLength: 1000, expiresInSeconds: 300 }))
      .rejects.toBeInstanceOf(ServiceUnavailableError);
  });
});

describe("mediaUrlFor", () => {
  it("builds absolute URLs from the configured base, ignoring stray slashes", () => {
    expect(mediaUrlFor("https://files.example.test/")("public/report/u/a.webp")).toBe("https://files.example.test/public/report/u/a.webp");
    expect(mediaUrlFor("https://files.example.test")("/public/report/u/a.webp")).toBe("https://files.example.test/public/report/u/a.webp");
  });
  it("leaves the key untouched when storage has no public base", () => {
    expect(mediaUrlFor(undefined)("public/report/u/a.webp")).toBe("public/report/u/a.webp");
  });
});
