import { beforeEach, describe, expect, it } from "vitest";
import { UnauthorizedError, RateLimitedError } from "@/backend/shared/domain/errors";
import { InMemoryRateLimiter } from "@/backend/shared/infrastructure/rate-limiter";
import { EndSession, RefreshSession, SessionIssuer } from "../modules/identity/application/session.usecases";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_FAMILY_MAX_AGE_SECONDS,
  REFRESH_TTL_SECONDS,
  ROTATION_LEEWAY_SECONDS,
  judgeRefreshToken,
  type RefreshToken,
} from "../modules/identity/domain/refresh-token";
import type { User } from "../modules/identity/domain/user";
import { HmacTokenService } from "../modules/identity/infrastructure/hmac-token.service";
import { InMemoryRefreshTokenRepository } from "../modules/identity/infrastructure/in-memory-refresh-tokens";
import { InMemoryUserRepository } from "../modules/identity/infrastructure/in-memory.repositories";
import { CryptoRefreshTokenCodec } from "../modules/identity/infrastructure/refresh-token-codec";

const DAY = 24 * 3600 * 1000;

const person = (over: Partial<User> = {}): User => ({
  id: "11111111-1111-4111-8111-111111111111",
  publicNumber: 4821,
  role: "user",
  displayName: "Community member",
  email: "rina.wijaya91@gmail.com",
  status: "active",
  warnings: 0,
  createdAt: new Date("2026-11-01T00:00:00Z"),
  deletedAt: null,
  tombstoneId: null,
  ...over,
});

let now: number;
let users: InMemoryUserRepository;
let repo: InMemoryRefreshTokenRepository;
let tokens: HmacTokenService;
let issuer: SessionIssuer;
let refresh: RefreshSession;
let signOut: EndSession;
const codec = new CryptoRefreshTokenCodec();
const advance = (ms: number) => { now += ms; };

beforeEach(async () => {
  now = Date.parse("2026-11-06T10:00:00Z");
  const clock = { now: () => new Date(now) };
  users = new InMemoryUserRepository();
  await users.save(person());
  repo = new InMemoryRefreshTokenRepository();
  tokens = new HmacTokenService("s".repeat(48), () => now);
  let n = 0;
  issuer = new SessionIssuer(tokens, repo, codec, clock, () => `family-${++n}`);
  refresh = new RefreshSession(issuer, repo, users, codec, new InMemoryRateLimiter(), clock);
  signOut = new EndSession(repo, codec, clock);
});

describe("starting a session", () => {
  it("issues a one-hour access token and a 90-day refresh token", async () => {
    const s = await issuer.start(person());
    expect(s.expiresInSeconds).toBe(ACCESS_TOKEN_TTL_SECONDS);
    expect(s.refreshExpiresInSeconds).toBe(REFRESH_TTL_SECONDS);
    expect(s.refreshToken).toMatch(/^rt_[A-Za-z0-9_-]{43}$/);
    expect(tokens.verify(s.token)).toEqual({ id: person().id, role: "user" });
    expect(s.user?.email).toBe("rina.wijaya91@gmail.com");
  });

  it("stores only a hash of the refresh token", async () => {
    const s = await issuer.start(person());
    expect(await repo.findByHash(s.refreshToken!)).toBeNull(); // the raw token is not a key
    expect(await repo.findByHash(codec.hash(s.refreshToken!))).toMatchObject({ userId: person().id, familyId: "family-1", revokedAt: null });
  });

  it("access tokens really do expire after an hour", async () => {
    const s = await issuer.start(person());
    advance(ACCESS_TOKEN_TTL_SECONDS * 1000 + 1000);
    expect(tokens.verify(s.token)).toBeNull();
  });
});

describe("refreshing", () => {
  it("rotates: a new pair comes back and the old refresh token is spent", async () => {
    const first = await issuer.start(person());
    advance(ACCESS_TOKEN_TTL_SECONDS * 1000);
    const second = await refresh.execute(first.refreshToken!);
    expect(second.refreshToken).not.toBe(first.refreshToken);
    expect(tokens.verify(second.token)).toEqual({ id: person().id, role: "user" });
    expect(second.user?.id).toBe(person().id);
    expect((await repo.findByHash(codec.hash(first.refreshToken!)))?.revokedReason).toBe("rotated");
    // the rotated token stays in the same family
    expect((await repo.findByHash(codec.hash(second.refreshToken!)))?.familyId).toBe("family-1");
  });

  it("keeps working across many rotations", async () => {
    let session = await issuer.start(person());
    for (let i = 0; i < 20; i++) {
      advance(ACCESS_TOKEN_TTL_SECONDS * 1000);
      session = await refresh.execute(session.refreshToken!);
    }
    expect(tokens.verify(session.token)).not.toBeNull();
  });

  it("rejects unknown tokens", async () => {
    await expect(refresh.execute("rt_" + "x".repeat(43))).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("rejects an expired refresh token", async () => {
    const s = await issuer.start(person());
    advance((REFRESH_TTL_SECONDS + 1) * 1000);
    await expect(refresh.execute(s.refreshToken!)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("a session can't be renewed forever: the family has an absolute age cap", async () => {
    let session = await issuer.start(person());
    // refresh every 60 days (inside each token's 90-day life) until the 180-day cap is passed
    for (let day = 60; day <= 120; day += 60) { advance(60 * DAY); session = await refresh.execute(session.refreshToken!); }
    advance(61 * DAY); // 181 days after sign-in
    await expect(refresh.execute(session.refreshToken!)).rejects.toBeInstanceOf(UnauthorizedError);
  });
});

describe("reuse detection", () => {
  it("presenting a spent token after the leeway ends the whole session", async () => {
    const first = await issuer.start(person());
    const second = await refresh.execute(first.refreshToken!);
    advance((ROTATION_LEEWAY_SECONDS + 1) * 1000);
    await expect(refresh.execute(first.refreshToken!)).rejects.toBeInstanceOf(UnauthorizedError); // the thief (or a replay)
    // ...and the legitimate holder of the newest token is signed out too, since the family can't be trusted any more
    await expect(refresh.execute(second.refreshToken!)).rejects.toBeInstanceOf(UnauthorizedError);
    expect((await repo.findByHash(codec.hash(second.refreshToken!)))?.revokedReason).toBe("reuse");
  });

  it("a retry inside the leeway succeeds (the first response was lost) and does not end the session", async () => {
    const first = await issuer.start(person());
    await refresh.execute(first.refreshToken!); // response never reached the phone
    advance(5_000);
    const retry = await refresh.execute(first.refreshToken!);
    expect(tokens.verify(retry.token)).not.toBeNull();
    advance(ACCESS_TOKEN_TTL_SECONDS * 1000);
    await expect(refresh.execute(retry.refreshToken!)).resolves.toBeDefined(); // family is intact
  });
});

describe("account state", () => {
  it.each(["banned", "deleted"] as const)("a %s account can't refresh and its session is ended", async (status) => {
    const s = await issuer.start(person());
    await users.save(person({ status }));
    await expect(refresh.execute(s.refreshToken!)).rejects.toBeInstanceOf(UnauthorizedError);
    expect((await repo.findByHash(codec.hash(s.refreshToken!)))?.revokedReason).toBe("account_closed");
  });

  it("a restricted account can still refresh (it may browse)", async () => {
    const s = await issuer.start(person());
    await users.save(person({ status: "restricted" }));
    const next = await refresh.execute(s.refreshToken!);
    expect(next.user?.status).toBe("restricted");
  });

  it("deleting an account revokes every token it has", async () => {
    const a = await issuer.start(person());
    const b = await issuer.start(person()); // a second device
    await issuer.revokeAll(person().id);
    await expect(refresh.execute(a.refreshToken!)).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(refresh.execute(b.refreshToken!)).rejects.toBeInstanceOf(UnauthorizedError);
  });
});

describe("signing out", () => {
  it("ends the whole family, so the refresh token is useless afterwards", async () => {
    const s = await issuer.start(person());
    const rotated = await refresh.execute(s.refreshToken!);
    await signOut.execute(rotated.refreshToken!);
    await expect(refresh.execute(rotated.refreshToken!)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("only ends that device: another sign-in keeps working", async () => {
    const phone = await issuer.start(person());
    const tablet = await issuer.start(person());
    await signOut.execute(phone.refreshToken!);
    await expect(refresh.execute(tablet.refreshToken!)).resolves.toBeDefined();
  });

  it("never reveals whether a token existed", async () => {
    await expect(signOut.execute("rt_" + "y".repeat(43))).resolves.toBeUndefined();
  });
});

describe("abuse limits", () => {
  it("throttles a client hammering the same token", async () => {
    const s = await issuer.start(person());
    let last: unknown;
    for (let i = 0; i < 35; i++) last = await refresh.execute(s.refreshToken!).catch((e) => e);
    expect(last).toBeInstanceOf(RateLimitedError);
  });
});

describe("judgeRefreshToken", () => {
  const base: RefreshToken = {
    hash: "h", userId: "u", familyId: "f", familyStartedAt: new Date(0), createdAt: new Date(0),
    expiresAt: new Date(10 * DAY), revokedAt: null, revokedReason: null,
  };
  it("covers each verdict", () => {
    expect(judgeRefreshToken(base, new Date(1 * DAY))).toBe("valid");
    expect(judgeRefreshToken(base, new Date(11 * DAY))).toBe("expired");
    expect(judgeRefreshToken({ ...base, expiresAt: new Date(400 * DAY) }, new Date((REFRESH_FAMILY_MAX_AGE_SECONDS + 1) * 1000))).toBe("expired");
    const rotated = { ...base, revokedAt: new Date(1 * DAY), revokedReason: "rotated" as const };
    expect(judgeRefreshToken(rotated, new Date(1 * DAY + 10_000))).toBe("retry_within_leeway");
    expect(judgeRefreshToken(rotated, new Date(1 * DAY + 60_000))).toBe("reuse");
    expect(judgeRefreshToken({ ...base, revokedAt: new Date(1 * DAY), revokedReason: "signed_out" }, new Date(1 * DAY + 1_000))).toBe("reuse");
  });
});
