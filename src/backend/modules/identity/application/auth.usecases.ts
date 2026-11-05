import type { Clock } from "@/backend/shared/application/clock";
import type { AuditRecorder } from "@/backend/shared/application/audit";
import type { RateLimiter } from "@/backend/shared/application/rate-limiter";
import { Email, maskEmail } from "@/backend/shared/domain/email";
import { ConflictError, ForbiddenError, RateLimitedError, UnauthorizedError, ValidationError } from "@/backend/shared/domain/errors";
import { SYSTEM_ACTOR } from "@/backend/shared/domain/principal";
import { afterFailure, isLocked } from "../domain/login-policy";
import { assertAcceptablePassword } from "../domain/password-policy";
import { DEFAULT_DISPLAY_NAME, type User } from "../domain/user";
import type { UserRepository } from "../domain/repositories";
import { AuthProviderError, type AdminDirectory, type CredentialAuthProvider, type LoginAttemptStore, type TokenService } from "./ports";

export const USER_TOKEN_TTL = 30 * 24 * 3600;
export const ADMIN_TOKEN_TTL = 8 * 3600;

export interface SessionDto {
  token: string;
  expiresInSeconds: number;
  role: "user" | "admin";
  user?: ReturnType<typeof toProfile>;
}

export const toProfile = (u: User) => ({
  id: u.id,
  displayName: u.displayName,
  signInMethod: "email" as const,
  email: u.email,
  status: u.status,
  createdAt: u.createdAt.toISOString(),
});

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

/** Sign in (S03). Credentials are checked by the auth provider; we then issue the app token. */
export class SignInWithPassword {
  constructor(
    private readonly users: UserRepository,
    private readonly provider: CredentialAuthProvider,
    private readonly attempts: LoginAttemptStore,
    private readonly tokens: TokenService,
    private readonly clock: Clock,
  ) {}

  async execute(input: { email: string; password: string }): Promise<SessionDto> {
    const email = Email.create(input.email).value;
    const key = `user:${email}`;
    const now = this.clock.now();
    if (isLocked(this.attempts.get(key), now.getTime())) {
      throw new RateLimitedError("Too many attempts. Try again in 15 minutes.");
    }

    let identity;
    try {
      identity = await this.provider.signIn(email, input.password);
    } catch (e) {
      if (e instanceof AuthProviderError) {
        if (e.reason === "email_not_confirmed") {
          throw new EmailNotVerifiedError("Confirm your email to sign in. Check your inbox.", { email: maskEmail(email) });
        }
        if (e.reason === "invalid_credentials") {
          this.attempts.set(key, afterFailure(this.attempts.get(key), now.getTime()));
          throw new UnauthorizedError("Wrong email or password. Try again.");
        }
        if (e.reason === "rate_limited") throw new RateLimitedError(GENERIC_RATE_LIMIT);
      }
      throw e;
    }
    this.attempts.clear(key);

    // The first successful sign-in creates our profile row, keyed by the auth account id.
    let user = await this.users.findById(identity.id);
    if (user?.status === "banned") throw new ForbiddenError("This account can't be used");
    if (user?.status === "deleted") throw new UnauthorizedError("Wrong email or password. Try again.");
    if (!user) {
      user = {
        id: identity.id,
        publicNumber: await this.users.nextPublicNumber(),
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
    return {
      token: this.tokens.issue({ id: user.id, role: "user" }, USER_TOKEN_TTL),
      expiresInSeconds: USER_TOKEN_TTL,
      role: "user",
      user: toProfile(user),
    };
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

export class AdminLogin {
  constructor(
    private readonly admins: AdminDirectory,
    private readonly attempts: LoginAttemptStore,
    private readonly tokens: TokenService,
    private readonly audit: AuditRecorder,
    private readonly clock: Clock,
  ) {}

  async execute(input: { email: string; password: string; code: string }): Promise<SessionDto> {
    const key = input.email.trim().toLowerCase();
    const now = this.clock.now();
    if (isLocked(this.attempts.get(key), now.getTime())) {
      throw new RateLimitedError("Too many attempts. Try again in 15 minutes.");
    }

    const account = this.admins.find(key);
    // Evaluate every factor so timing doesn't reveal which one was wrong.
    const passwordOk = account?.checkPassword(input.password) ?? false;
    const codeOk = account?.checkTotp(input.code, now) ?? false;
    if (!account || !passwordOk || !codeOk) {
      const next = afterFailure(this.attempts.get(key), now.getTime());
      this.attempts.set(key, next);
      if (next.lockedUntil) {
        await this.audit.record({ actor: SYSTEM_ACTOR, action: "admin.lockout", target: account?.id ?? "unknown" });
      }
      throw new UnauthorizedError("Wrong email, password or code. After 5 tries the account locks for 15 minutes.");
    }

    this.attempts.clear(key);
    await this.audit.record({ actor: { kind: "admin", id: account.id }, action: "admin.login", target: account.id });
    return {
      token: this.tokens.issue({ id: account.id, role: "admin" }, ADMIN_TOKEN_TTL),
      expiresInSeconds: ADMIN_TOKEN_TTL,
      role: "admin",
    };
  }
}
