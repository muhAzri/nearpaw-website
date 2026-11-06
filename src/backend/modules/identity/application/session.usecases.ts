import type { Clock } from "@/backend/shared/application/clock";
import { HOUR_MS } from "@/backend/shared/application/clock";
import type { RateLimiter } from "@/backend/shared/application/rate-limiter";
import { RateLimitedError, UnauthorizedError } from "@/backend/shared/domain/errors";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TTL_SECONDS,
  judgeRefreshToken,
} from "../domain/refresh-token";
import type { RefreshTokenRepository, UserRepository } from "../domain/repositories";
import type { User } from "../domain/user";
import type { RefreshTokenCodec, SessionRevoker, SessionStarter, TokenService } from "./ports";
import { toProfile, type SessionDto } from "./session-dto";

const SESSION_ENDED = "Your session has ended. Please sign in again.";

/** Issues access + refresh token pairs. */
export class SessionIssuer implements SessionStarter, SessionRevoker {
  constructor(
    private readonly tokens: TokenService,
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly codec: RefreshTokenCodec,
    private readonly clock: Clock,
    private readonly newId: () => string = () => crypto.randomUUID(),
  ) {}

  /** A new sign-in starts a new token family. */
  start(user: User): Promise<SessionDto> {
    const now = this.clock.now();
    return this.issueInFamily(user, this.newId(), now);
  }

  async issueInFamily(user: User, familyId: string, familyStartedAt: Date): Promise<SessionDto> {
    const now = this.clock.now();
    const { token: refreshToken, hash } = this.codec.generate();
    await this.refreshTokens.save({
      hash,
      userId: user.id,
      familyId,
      familyStartedAt,
      createdAt: now,
      expiresAt: new Date(now.getTime() + REFRESH_TTL_SECONDS * 1000),
      revokedAt: null,
      revokedReason: null,
    });
    return {
      token: this.tokens.issue({ id: user.id, role: "user" }, ACCESS_TOKEN_TTL_SECONDS),
      expiresInSeconds: ACCESS_TOKEN_TTL_SECONDS,
      refreshToken,
      refreshExpiresInSeconds: REFRESH_TTL_SECONDS,
      role: "user",
      user: toProfile(user),
    };
  }

  async revokeAll(userId: string): Promise<void> {
    await this.refreshTokens.revokeAllForUser(userId, "account_closed", this.clock.now());
  }
}

/** Exchanges a refresh token for a new access + refresh pair (rotation). */
export class RefreshSession {
  constructor(
    private readonly issuer: SessionIssuer,
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly users: UserRepository,
    private readonly codec: RefreshTokenCodec,
    private readonly limiter: RateLimiter,
    private readonly clock: Clock,
  ) {}

  async execute(rawToken: string): Promise<SessionDto> {
    const hash = this.codec.hash(rawToken);
    // Legitimate clients refresh about once an hour; this only slows down a stuck client in a retry loop.
    if (!this.limiter.allow(`refresh:${hash.slice(0, 16)}`, 30, HOUR_MS)) {
      throw new RateLimitedError("Too many requests. Please try again later.");
    }
    const token = await this.refreshTokens.findByHash(hash);
    if (!token) throw new UnauthorizedError(SESSION_ENDED);

    const now = this.clock.now();
    const verdict = judgeRefreshToken(token, now);
    if (verdict === "expired") throw new UnauthorizedError(SESSION_ENDED);
    if (verdict === "reuse") {
      // A token that was already used (or signed out) is being presented again: assume it leaked, end the family.
      await this.refreshTokens.revokeFamily(token.familyId, "reuse", now);
      throw new UnauthorizedError(SESSION_ENDED);
    }

    const user = await this.users.findById(token.userId);
    if (!user || user.status === "deleted" || user.status === "banned") {
      await this.refreshTokens.revokeFamily(token.familyId, "account_closed", now);
      throw new UnauthorizedError(SESSION_ENDED);
    }

    if (verdict === "valid") await this.refreshTokens.revoke(hash, "rotated", now);
    return this.issuer.issueInFamily(user, token.familyId, token.familyStartedAt);
  }
}

/** Sign-out: ends the whole token family of the presented refresh token. Unknown tokens are ignored on purpose. */
export class EndSession {
  constructor(
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly codec: RefreshTokenCodec,
    private readonly clock: Clock,
  ) {}

  async execute(rawToken: string): Promise<void> {
    const token = await this.refreshTokens.findByHash(this.codec.hash(rawToken));
    if (token) await this.refreshTokens.revokeFamily(token.familyId, "signed_out", this.clock.now());
  }
}
