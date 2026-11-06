import type { Clock } from "@/backend/shared/application/clock";
import type { AuditRecorder } from "@/backend/shared/application/audit";
import type { RateLimiter } from "@/backend/shared/application/rate-limiter";
import { Email, maskEmail } from "@/backend/shared/domain/email";
import { ConflictError, ForbiddenError, RateLimitedError, UnauthorizedError, ValidationError } from "@/backend/shared/domain/errors";
import { afterFailure, isLocked } from "../domain/login-policy";
import { assertAcceptablePassword } from "../domain/password-policy";
import { DEFAULT_DISPLAY_NAME, type User } from "../domain/user";
import type { UserRepository } from "../domain/repositories";
import { AuthProviderError, type CredentialAuthProvider, type LoginAttemptStore, type SessionStarter, type TokenService } from "./ports";
import { toProfile, type SessionDto } from "./session-dto";

export const ADMIN_TOKEN_TTL = 8 * 3600;

export { toProfile, type SessionDto };

/** Same wording whether or not the address exists, so the endpoints can't be used to probe for accounts. */
const GENERIC_RATE_LIMIT = "Too many requests. Please try again later.";

export class EmailNotVerifiedError extends ForbiddenError {
  readonly code = "EMAIL_NOT_VERIFIED";
}

const HOUR_MS = 3_600_000;

/** Create account (S03b). The account only becomes usable once the emailed link is opened (S03d). */
export class Register {
  constructor(
    private readonly provider: CredentialAuthProvider,
    private readonly limiter: RateLimiter,
  ) {}

  async execute(input: { email: string; password: string }) {
    const email = Email.create(input.email).value;
    assertAcceptablePassword(input.password, email);
    if (!this.limiter.allow(`register:${email}`, 5, HOUR_MS)) throw new RateLimitedError(GENERIC_RATE_LIMIT);
    try {
      await this.provider.signUp(email, input.password);
    } catch (e) {
      if (e instanceof AuthProviderError) {
        if (e.reason === "already_registered") throw new ConflictError("This email is already registered. Sign in instead.");
        if (e.reason === "rate_limited") throw new RateLimitedError(GENERIC_RATE_LIMIT);
        if (e.reason === "invalid_credentials") throw new ValidationError("That password is too easy to guess. Choose another.", { field: "password" });
      }
      throw e;
    }
    return { status: "verification_required" as const, email: maskEmail(email) };
  }
}

type Scope = "user" | "admin";

/**
 * Checks email + password with the auth provider (with lockout), then loads our profile row,
 * creating it on the first successful sign-in. Shared by the app and the admin console.
 */
export class PasswordAuthenticator {
  constructor(
    private readonly users: UserRepository,
    private readonly provider: CredentialAuthProvider,
    private readonly attempts: LoginAttemptStore,
    private readonly clock: Clock,
    /** The account with this email becomes an admin when its profile is first created. */
    private readonly bootstrapAdminEmail: string | undefined,
    private readonly onLockout: (scope: Scope, email: string) => Promise<void>,
  ) {}

  async authenticate(scope: Scope, rawEmail: string, password: string): Promise<User> {
    const email = Email.create(rawEmail).value;
    const key = `${scope}:${email}`;
    const now = this.clock.now();
    if (isLocked(this.attempts.get(key), now.getTime())) {
      throw new RateLimitedError("Too many attempts. Try again in 15 minutes.");
    }

    let identity;
    try {
      identity = await this.provider.signIn(email, password);
    } catch (e) {
      if (e instanceof AuthProviderError) {
        if (e.reason === "email_not_confirmed") {
          throw new EmailNotVerifiedError("Confirm your email to sign in. Check your inbox.", { email: maskEmail(email) });
        }
        if (e.reason === "invalid_credentials") {
          const next = afterFailure(this.attempts.get(key), now.getTime());
          this.attempts.set(key, next);
          if (next.lockedUntil) await this.onLockout(scope, email);
          throw new UnauthorizedError(
            scope === "admin"
              ? "Wrong email or password. After 5 tries the account locks for 15 minutes."
              : "Wrong email or password. Try again.",
          );
        }
        if (e.reason === "rate_limited") throw new RateLimitedError(GENERIC_RATE_LIMIT);
      }
      throw e;
    }
    this.attempts.clear(key);

    let user = await this.users.findById(identity.id);
    if (user?.status === "banned") throw new ForbiddenError("This account can't be used");
    if (user?.status === "deleted") throw new UnauthorizedError("Wrong email or password. Try again.");
    if (!user) {
      user = {
        id: identity.id,
        publicNumber: await this.users.nextPublicNumber(),
        role: this.bootstrapAdminEmail?.toLowerCase() === email ? "admin" : "user",
        displayName: DEFAULT_DISPLAY_NAME,
        email: identity.email,
        status: "active",
        warnings: 0,
        createdAt: now,
        deletedAt: null,
        tombstoneId: null,
      };
      await this.users.save(user);
    }
    return user;
  }
}

/** Sign in (S03). Starts a session: a short-lived access token plus a refresh token. */
export class SignInWithPassword {
  constructor(
    private readonly authenticator: PasswordAuthenticator,
    private readonly sessions: SessionStarter,
  ) {}

  async execute(input: { email: string; password: string }): Promise<SessionDto> {
    return this.sessions.start(await this.authenticator.authenticate("user", input.email, input.password));
  }
}

/** Forgot password (S03c). Always succeeds from the caller's point of view. */
export class RequestPasswordReset {
  constructor(
    private readonly provider: CredentialAuthProvider,
    private readonly limiter: RateLimiter,
  ) {}

  async execute(input: { email: string }) {
    const email = Email.create(input.email).value;
    if (!this.limiter.allow(`reset:${email}`, 3, HOUR_MS)) throw new RateLimitedError(GENERIC_RATE_LIMIT);
    try {
      await this.provider.sendPasswordReset(email);
    } catch (e) {
      if (!(e instanceof AuthProviderError) || e.reason === "unavailable") throw e;
    }
    return { sent: true as const };
  }
}

/** "Resend email" on the verify screen (S03d). */
export class ResendVerification {
  constructor(
    private readonly provider: CredentialAuthProvider,
    private readonly limiter: RateLimiter,
  ) {}

  async execute(input: { email: string }) {
    const email = Email.create(input.email).value;
    // The app shows a 30 second countdown; the server enforces a slightly looser limit.
    if (!this.limiter.allow(`resend:${email}`, 5, HOUR_MS)) throw new RateLimitedError(GENERIC_RATE_LIMIT);
    try {
      await this.provider.resendConfirmation(email);
    } catch (e) {
      if (!(e instanceof AuthProviderError) || e.reason === "unavailable") throw e;
    }
    return { sent: true as const };
  }
}

/** Admin console sign in: the same Supabase account as the app, but the profile must have the admin role. */
export class AdminLogin {
  constructor(
    private readonly authenticator: PasswordAuthenticator,
    private readonly tokens: TokenService,
    private readonly audit: AuditRecorder,
  ) {}

  async execute(input: { email: string; password: string }): Promise<SessionDto> {
    const user = await this.authenticator.authenticate("admin", input.email, input.password);
    if (user.role !== "admin" || user.status !== "active") {
      throw new ForbiddenError("This account doesn't have admin access.");
    }
    await this.audit.record({ actor: { kind: "admin", id: user.id }, action: "admin.login", target: user.id });
    return {
      token: this.tokens.issue({ id: user.id, role: "admin" }, ADMIN_TOKEN_TTL),
      expiresInSeconds: ADMIN_TOKEN_TTL,
      role: "admin",
    };
  }
}
