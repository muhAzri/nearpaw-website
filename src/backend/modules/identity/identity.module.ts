import { systemClock, type Clock } from "@/backend/shared/application/clock";
import type { AuditRecorder } from "@/backend/shared/application/audit";
import { maskEmail } from "@/backend/shared/domain/email";
import { SYSTEM_ACTOR } from "@/backend/shared/domain/principal";
import { serverEnv } from "@/backend/shared/config/env";
import { sharedRateLimiter } from "@/backend/shared/infrastructure/rate-limiter";
import { singleton } from "@/backend/shared/infrastructure/singleton";
import { supabaseAdmin } from "@/backend/shared/infrastructure/supabase-admin";
import type { Authenticator } from "@/backend/shared/presentation/auth";
import { AccountService, UserAdmin, UserQueries } from "./application/account.usecases";
import { AdminLogin, PasswordAuthenticator, Register, RequestPasswordReset, ResendVerification, SignInWithPassword } from "./application/auth.usecases";
import { ProfileProvisioner } from "./application/profile-provisioner";
import { EndSession, RefreshSession, SessionIssuer } from "./application/session.usecases";
import type { AccessTokenVerifier, AccountDataCleaner, UserActivityReader } from "./application/ports";
import { DevAuthProvider } from "./infrastructure/dev-auth.provider";
import { InMemoryLoginAttempts } from "./infrastructure/in-memory-login-attempts";
import { JwtAccessTokenVerifier } from "./infrastructure/jwt-access-token.verifier";
import { SupabaseAuthProvider, UnconfiguredAuthProvider } from "./infrastructure/supabase-auth.provider";
import { InMemoryBlockRepository, InMemoryUserRepository } from "./infrastructure/in-memory.repositories";
import { SupabaseBlockRepository } from "./infrastructure/supabase-block.repository";
import { SupabaseUserRepository } from "./infrastructure/supabase-user.repository";
import { IdentityController } from "./presentation/identity.controller";

/**
 * Identity is built first: it provides the Authenticator every other module needs.
 * Collaborators that depend on later modules are supplied lazily via `late`.
 */
export function createIdentityModule(deps: { audit: AuditRecorder; clock?: Clock }) {
  const env = serverEnv();
  const clock = deps.clock ?? systemClock;

  // Accounts live in Postgres when the secret key is set, otherwise in memory (lost on restart).
  const db = supabaseAdmin();
  const users = db ? new SupabaseUserRepository(db) : singleton("users_repo", () => new InMemoryUserRepository());
  const blocks = db ? new SupabaseBlockRepository(db) : singleton("blocks_repo", () => new InMemoryBlockRepository());
  const attempts = singleton("login_attempts", () => new InMemoryLoginAttempts());
  // Supabase Auth when configured; an in-memory stand-in outside production so local work needs no project.
  const supabase = env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ? { url: env.NEXT_PUBLIC_SUPABASE_URL, key: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY } : null;
  const dev = !supabase && env.NODE_ENV !== "production" ? singleton("dev_auth", () => new DevAuthProvider(env.NODE_ENV !== "test")) : null;
  const credentials = supabase ? new SupabaseAuthProvider(supabase.url, supabase.key) : (dev ?? new UnconfiguredAuthProvider());
  const verifier: AccessTokenVerifier = supabase
    ? env.SUPABASE_JWT_SECRET
      ? JwtAccessTokenVerifier.forSupabaseSecret(supabase.url, env.SUPABASE_JWT_SECRET)
      : JwtAccessTokenVerifier.forSupabaseJwks(supabase.url)
    : (dev?.verifier ?? { verify: async () => null });
  const limiter = sharedRateLimiter();
  const profiles = new ProfileProvisioner(users, clock, env.ADMIN_EMAIL);
  const passwords = new PasswordAuthenticator(profiles, credentials, attempts, clock, async (scope, email) => {
    if (scope === "admin") await deps.audit.record({ actor: SYSTEM_ACTOR, action: "admin.lockout", target: maskEmail(email) });
  });

  const queries = new UserQueries(users, blocks, clock);
  const sessions = new SessionIssuer();

  /**
   * The JWT proves who is calling; the profile decides what they may do. A profile that doesn't exist yet is created
   * on the spot, so losing the profile store never rejects a valid token. Banned/deleted accounts lose access at once.
   */
  const authenticator: Authenticator = {
    async authenticate(token) {
      const who = await verifier.verify(token);
      if (!who) return null;
      let user = await users.findById(who.sub);
      if (!user && who.email) user = await profiles.ensure({ id: who.sub, email: who.email });
      if (!user || user.status === "deleted" || user.status === "banned") return null;
      // Admin access follows the database role, so removing it takes effect immediately.
      if (user.role === "admin" && user.status !== "active") return null;
      return { id: user.id, role: user.role === "admin" ? "admin" : "user" };
    },
  };

  /** Wire the collaborators that live in later modules, then build the controller. */
  function build(late: { cleaner: AccountDataCleaner; activity: UserActivityReader }) {
    return new IdentityController(
      authenticator,
      new Register(credentials, limiter),
      new SignInWithPassword(passwords, sessions),
      new RequestPasswordReset(credentials, limiter),
      new ResendVerification(credentials, limiter),
      new AdminLogin(passwords, deps.audit),
      new AccountService(users, blocks, late.cleaner, clock),
      new UserAdmin(users, blocks, late.activity, deps.audit),
      new RefreshSession(sessions, credentials, users, limiter),
      new EndSession(credentials),
    );
  }

  return { authenticator, queries, build };
}
