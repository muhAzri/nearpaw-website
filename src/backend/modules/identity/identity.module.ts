import { systemClock, type Clock } from "@/backend/shared/application/clock";
import type { AuditRecorder } from "@/backend/shared/application/audit";
import type { RateLimiter } from "@/backend/shared/application/rate-limiter";
import { maskEmail } from "@/backend/shared/domain/email";
import { SYSTEM_ACTOR } from "@/backend/shared/domain/principal";
import { serverEnv } from "@/backend/shared/config/env";
import type { Authenticator } from "@/backend/shared/presentation/auth";
import { AccountService, UserAdmin, UserQueries } from "./application/account.usecases";
import { AdminLogin, PasswordAuthenticator, Register, RequestPasswordReset, ResendVerification, SignInWithPassword } from "./application/auth.usecases";
import { ProfileProvisioner } from "./application/profile-provisioner";
import { EndSession, RefreshSession, SessionIssuer } from "./application/session.usecases";
import type { AccessTokenVerifier, AccountDataCleaner, CredentialAuthProvider, LoginAttemptStore, UserActivityReader } from "./application/ports";
import type { BlockRepository, UserRepository } from "./domain/repositories";
import { JwtAccessTokenVerifier } from "./infrastructure/jwt-access-token.verifier";
import { SupabaseAuthProvider } from "./infrastructure/supabase-auth.provider";
import { IdentityController } from "./presentation/identity.controller";

/** Sign-in and token verification, both through Supabase Auth. */
export interface AuthBackend {
  credentials: CredentialAuthProvider;
  verifier: AccessTokenVerifier;
}

export function supabaseAuthFromEnv(): AuthBackend {
  const env = serverEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are required for sign-in.");
  return {
    credentials: new SupabaseAuthProvider(url, key),
    verifier: env.SUPABASE_JWT_SECRET ? JwtAccessTokenVerifier.forSupabaseSecret(url, env.SUPABASE_JWT_SECRET) : JwtAccessTokenVerifier.forSupabaseJwks(url),
  };
}

/**
 * Identity is built first: it provides the Authenticator every other module needs.
 * Collaborators that depend on later modules are supplied lazily via `late`.
 */
export function createIdentityModule(deps: {
  audit: AuditRecorder;
  repos: { users: UserRepository; blocks: BlockRepository; loginAttempts: LoginAttemptStore };
  limiter: RateLimiter;
  auth: AuthBackend;
  clock?: Clock;
}) {
  const env = serverEnv();
  const clock = deps.clock ?? systemClock;
  const { users, blocks, loginAttempts: attempts } = deps.repos;
  const { credentials, verifier } = deps.auth;
  const limiter = deps.limiter;
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
