import { systemClock, type Clock } from "@/backend/shared/application/clock";
import type { AuditRecorder } from "@/backend/shared/application/audit";
import { serverEnv } from "@/backend/shared/config/env";
import { sharedRateLimiter } from "@/backend/shared/infrastructure/rate-limiter";
import { singleton } from "@/backend/shared/infrastructure/singleton";
import type { Authenticator } from "@/backend/shared/presentation/auth";
import { AccountService, UserAdmin, UserQueries } from "./application/account.usecases";
import { AdminLogin, Register, RequestPasswordReset, ResendVerification, SignInWithPassword } from "./application/auth.usecases";
import type { AccountDataCleaner, UserActivityReader } from "./application/ports";
import { DevAuthProvider } from "./infrastructure/dev-auth.provider";
import { EnvAdminDirectory, InMemoryLoginAttempts } from "./infrastructure/env-admin.directory";
import { HmacTokenService } from "./infrastructure/hmac-token.service";
import { SupabaseAuthProvider, UnconfiguredAuthProvider } from "./infrastructure/supabase-auth.provider";
import { InMemoryBlockRepository, InMemoryUserRepository } from "./infrastructure/in-memory.repositories";
import { IdentityController } from "./presentation/identity.controller";

/**
 * Identity is built first: it provides the Authenticator every other module needs.
 * Collaborators that depend on later modules are supplied lazily via `late`.
 */
export function createIdentityModule(deps: { audit: AuditRecorder; clock?: Clock }) {
  const env = serverEnv();
  const clock = deps.clock ?? systemClock;

  const users = singleton("users_repo", () => new InMemoryUserRepository());
  const blocks = singleton("blocks_repo", () => new InMemoryBlockRepository());
  const attempts = singleton("login_attempts", () => new InMemoryLoginAttempts());
  const tokens = singleton("token_service", () =>
    env.AUTH_SECRET ? new HmacTokenService(env.AUTH_SECRET) : HmacTokenService.withEphemeralSecret(),
  );
  // Supabase Auth when configured; an in-memory stand-in outside production so local work needs no project.
  const credentials =
    env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
      ? new SupabaseAuthProvider(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
      : env.NODE_ENV === "production"
        ? new UnconfiguredAuthProvider()
        : singleton("dev_auth", () => new DevAuthProvider(env.NODE_ENV !== "test"));
  const limiter = sharedRateLimiter();
  const admins = new EnvAdminDirectory({
    email: env.ADMIN_EMAIL,
    password: env.ADMIN_PASSWORD,
    totpSecret: env.ADMIN_TOTP_SECRET,
  });

  const queries = new UserQueries(users, blocks, clock);

  /** Banned/deleted accounts lose access immediately, even with an unexpired token. */
  const authenticator: Authenticator = {
    async authenticate(token) {
      const principal = tokens.verify(token);
      if (!principal) return null;
      if (principal.role === "user") {
        const user = await users.findById(principal.id);
        if (!user || user.status === "deleted" || user.status === "banned") return null;
      }
      return principal;
    },
  };

  /** Wire the collaborators that live in later modules, then build the controller. */
  function build(late: { cleaner: AccountDataCleaner; activity: UserActivityReader }) {
    return new IdentityController(
      authenticator,
      new Register(credentials, limiter),
      new SignInWithPassword(users, credentials, attempts, tokens, clock),
      new RequestPasswordReset(credentials, limiter),
      new ResendVerification(credentials, limiter),
      new AdminLogin(admins, attempts, tokens, deps.audit, clock),
      new AccountService(users, blocks, late.cleaner, clock),
      new UserAdmin(users, blocks, late.activity, deps.audit),
    );
  }

  return { authenticator, queries, build };
}
