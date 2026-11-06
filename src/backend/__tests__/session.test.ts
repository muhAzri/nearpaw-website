import { beforeEach, describe, expect, it } from "vitest";
import { RateLimitedError, UnauthorizedError } from "@/backend/shared/domain/errors";
import { InMemoryRateLimiter } from "./support/in-memory-rate-limiter";
import { ProfileProvisioner } from "../modules/identity/application/profile-provisioner";
import { EndSession, RefreshSession, REFRESH_TTL_SECONDS, SessionIssuer } from "../modules/identity/application/session.usecases";
import type { User } from "../modules/identity/domain/user";
import { FAKE_ACCESS_TOKEN_TTL_SECONDS, FakeAuthProvider } from "./support/fake-auth-provider";
import { InMemoryUserRepository } from "./support/in-memory-identity";

const EMAIL = "rina.wijaya91@gmail.com";
const PASSWORD = "paws4life26";

let now: number;
let provider: FakeAuthProvider;
let users: InMemoryUserRepository;
let profiles: ProfileProvisioner;
let issuer: SessionIssuer;
let refresh: RefreshSession;
let signOut: EndSession;
const advance = (ms: number) => { now += ms; };

async function signIn() {
  const { identity, session } = await provider.signIn(EMAIL, PASSWORD);
  const user = await profiles.ensure(identity);
  return { user, dto: issuer.start(user, session) };
}

beforeEach(async () => {
  now = Date.parse("2026-11-06T10:00:00Z");
  const clock = { now: () => new Date(now) };
  provider = new FakeAuthProvider(true, clock.now);
  await provider.signUp(EMAIL, PASSWORD);
  users = new InMemoryUserRepository();
  profiles = new ProfileProvisioner(users, clock, undefined);
  issuer = new SessionIssuer();
  refresh = new RefreshSession(issuer, provider, users, new InMemoryRateLimiter());
  signOut = new EndSession(provider);
});

describe("starting a session", () => {
  it("hands out the provider's JWT access token and a refresh token", async () => {
    const { user, dto } = await signIn();
    expect(dto.expiresInSeconds).toBe(FAKE_ACCESS_TOKEN_TTL_SECONDS);
    expect(dto.refreshExpiresInSeconds).toBe(REFRESH_TTL_SECONDS);
    expect(dto.token.split(".")).toHaveLength(3);
    expect(await provider.verifier.verify(dto.token)).toEqual({ sub: user.id, email: EMAIL });
    expect(dto.user?.email).toBe(EMAIL);
  });

  it("access tokens really do expire after an hour", async () => {
    const { dto } = await signIn();
    advance(FAKE_ACCESS_TOKEN_TTL_SECONDS * 1000 + 1000);
    expect(await provider.verifier.verify(dto.token)).toBeNull();
  });

  it("rejects a token signed by someone else", async () => {
    const other = new FakeAuthProvider(true);
    await other.signUp(EMAIL, PASSWORD);
    const { session } = await other.signIn(EMAIL, PASSWORD);
    expect(await provider.verifier.verify(session.accessToken)).toBeNull();
    expect(await provider.verifier.verify("not.a.jwt")).toBeNull();
  });
});

describe("refreshing", () => {
  it("rotates: a new pair comes back and the old refresh token is spent", async () => {
    const { user, dto: first } = await signIn();
    advance(FAKE_ACCESS_TOKEN_TTL_SECONDS * 1000);
    const second = await refresh.execute(first.refreshToken!);
    expect(second.refreshToken).not.toBe(first.refreshToken);
    expect(await provider.verifier.verify(second.token)).toMatchObject({ sub: user.id });
    expect(second.user?.id).toBe(user.id);
    await expect(refresh.execute(first.refreshToken!)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("keeps working across many rotations", async () => {
    let { dto: session } = await signIn();
    for (let i = 0; i < 20; i++) {
      advance(FAKE_ACCESS_TOKEN_TTL_SECONDS * 1000);
      session = await refresh.execute(session.refreshToken!);
    }
    expect(await provider.verifier.verify(session.token)).not.toBeNull();
  });

  it("rejects unknown tokens with the friendly line", async () => {
    await expect(refresh.execute("x".repeat(30))).rejects.toThrow("Your session has ended. Please sign in again.");
  });

  it("keeps the session when the profile store was reset: no profile comes back, nothing is rejected", async () => {
    const { dto } = await signIn();
    users = new InMemoryUserRepository();
    refresh = new RefreshSession(issuer, provider, users, new InMemoryRateLimiter());
    const next = await refresh.execute(dto.refreshToken!);
    expect(next.token).toBeTruthy();
    expect(next.user).toBeUndefined();
  });
});

describe("account state", () => {
  it.each(["banned", "deleted"] as const)("a %s account can't refresh", async (status) => {
    const { user, dto } = await signIn();
    await users.save({ ...user, status } as User);
    await expect(refresh.execute(dto.refreshToken!)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("a restricted account can still refresh (it may browse)", async () => {
    const { user, dto } = await signIn();
    await users.save({ ...user, status: "restricted" } as User);
    expect((await refresh.execute(dto.refreshToken!)).user?.status).toBe("restricted");
  });
});

describe("profiles", () => {
  it("are created once, the first time an account is seen", async () => {
    const a = await profiles.ensure({ id: "u-1", email: EMAIL });
    const b = await profiles.ensure({ id: "u-1", email: EMAIL });
    expect(b.publicNumber).toBe(a.publicNumber);
    expect(a.role).toBe("user");
  });

  it("make the bootstrap admin email an admin", async () => {
    const boot = new ProfileProvisioner(users, { now: () => new Date(now) }, "Boss@NearPaw.test");
    expect((await boot.ensure({ id: "u-2", email: "boss@nearpaw.test" })).role).toBe("admin");
  });
});

describe("signing out", () => {
  it("makes the refresh token useless afterwards", async () => {
    const { dto } = await signIn();
    await signOut.execute(dto.token);
    await expect(refresh.execute(dto.refreshToken!)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("never fails, whatever it is given", async () => {
    await expect(signOut.execute(null)).resolves.toBeUndefined();
    await expect(signOut.execute("garbage")).resolves.toBeUndefined();
  });
});

describe("abuse limits", () => {
  it("throttles a client hammering the same token", async () => {
    let last: unknown;
    for (let i = 0; i < 35; i++) last = await refresh.execute("z".repeat(30)).catch((e) => e);
    expect(last).toBeInstanceOf(RateLimitedError);
  });
});
