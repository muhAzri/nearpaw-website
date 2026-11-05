import type { Clock } from "@/backend/shared/application/clock";
import type { AuditRecorder } from "@/backend/shared/application/audit";
import { ForbiddenError, RateLimitedError, UnauthorizedError } from "@/backend/shared/domain/errors";
import { SYSTEM_ACTOR } from "@/backend/shared/domain/principal";
import { afterFailure, isLocked } from "../domain/login-policy";
import { DEFAULT_DISPLAY_NAME, validateDisplayName, type User } from "../domain/user";
import type { UserRepository } from "../domain/repositories";
import type { AdminDirectory, AppleIdentityVerifier, LoginAttemptStore, TokenService } from "./ports";

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
  signInMethod: "apple" as const,
  email: u.email,
  status: u.status,
  createdAt: u.createdAt.toISOString(),
});

export class SignInWithApple {
  constructor(
    private readonly users: UserRepository,
    private readonly apple: AppleIdentityVerifier,
    private readonly tokens: TokenService,
    private readonly clock: Clock,
  ) {}

  async execute(input: { identityToken: string; displayName?: string }): Promise<SessionDto> {
    let identity;
    try {
      identity = await this.apple.verify(input.identityToken);
    } catch {
      throw new UnauthorizedError("Couldn't sign in. Please try again.");
    }

    let user = await this.users.findByAppleSub(identity.sub);
    if (user?.status === "banned") throw new ForbiddenError("This account can't be used");
    if (!user) {
      user = {
        id: crypto.randomUUID(),
        publicNumber: await this.users.nextPublicNumber(),
        appleSub: identity.sub,
        displayName: input.displayName ? validateDisplayName(input.displayName) : DEFAULT_DISPLAY_NAME,
        email: identity.email,
        status: "active",
        warnings: 0,
        createdAt: this.clock.now(),
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
