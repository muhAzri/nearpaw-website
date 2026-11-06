import { HOUR_MS } from "@/backend/shared/application/clock";
import type { RateLimiter } from "@/backend/shared/application/rate-limiter";
import { RateLimitedError, UnauthorizedError } from "@/backend/shared/domain/errors";
import type { UserRepository } from "../domain/repositories";
import type { User } from "../domain/user";
import { AuthProviderError, type CredentialAuthProvider, type ProviderSession } from "./ports";
import { toProfile, type SessionDto } from "./session-dto";

/** How long the app is told to trust a refresh token before it asks the user to sign in again (the provider has the last word). */
export const REFRESH_TTL_SECONDS = 90 * 24 * 3600;

const SESSION_ENDED = "Your session has ended. Please sign in again.";

/** Shapes the auth provider's JWT pair into the response the app expects. */
export class SessionIssuer {
  /** `user` is null when no profile row exists yet; the app then keeps the profile it already has. */
  start(user: User | null, session: ProviderSession): SessionDto {
    return {
      token: session.accessToken,
      expiresInSeconds: session.expiresInSeconds,
      refreshToken: session.refreshToken,
      refreshExpiresInSeconds: REFRESH_TTL_SECONDS,
      role: "user",
      user: user ? toProfile(user) : undefined,
    };
  }
}

/**
 * Exchanges a refresh token for a new access + refresh pair. The auth provider owns rotation, reuse detection and
 * expiry, so nothing about sessions is kept in this process: a restart or another instance never ends a session.
 */
export class RefreshSession {
  constructor(
    private readonly issuer: SessionIssuer,
    private readonly provider: CredentialAuthProvider,
    private readonly users: UserRepository,
    private readonly limiter: RateLimiter,
  ) {}

  async execute(refreshToken: string): Promise<SessionDto> {
    // Legitimate clients refresh about once an hour; this only slows down a stuck client in a retry loop.
    if (!(await this.limiter.allow(`refresh:${refreshToken.slice(0, 16)}`, 30, HOUR_MS))) {
      throw new RateLimitedError("Too many requests. Please try again later.");
    }
    let session: ProviderSession;
    try {
      session = await this.provider.refresh(refreshToken);
    } catch (e) {
      if (e instanceof AuthProviderError && e.reason === "session_ended") throw new UnauthorizedError(SESSION_ENDED);
      if (e instanceof AuthProviderError && e.reason === "rate_limited") throw new RateLimitedError("Too many requests. Please try again later.");
      throw e;
    }
    const user = await this.users.findById(session.userId);
    if (user && (user.status === "deleted" || user.status === "banned")) {
      await this.provider.signOut(session.accessToken).catch(() => undefined);
      throw new UnauthorizedError(SESSION_ENDED);
    }
    return this.issuer.start(user, session);
  }
}

/** Sign-out: ends the provider session behind the access token. Unknown or expired tokens are ignored on purpose. */
export class EndSession {
  constructor(private readonly provider: CredentialAuthProvider) {}

  async execute(accessToken: string | null): Promise<void> {
    if (!accessToken) return;
    await this.provider.signOut(accessToken).catch(() => undefined);
  }
}
