import type { Principal } from "@/backend/shared/domain/principal";
import type { LoginState } from "../domain/login-policy";
import type { User } from "../domain/user";
import type { SessionDto } from "./session-dto";

export interface AuthIdentity {
  /** Id of the account in the auth provider; also the id of our `users` row. */
  readonly id: string;
  readonly email: string;
}

export type AuthFailure = "invalid_credentials" | "email_not_confirmed" | "already_registered" | "rate_limited" | "unavailable";

/** Thrown by an auth provider; the use cases translate it into domain errors. */
export class AuthProviderError extends Error {
  constructor(readonly reason: AuthFailure) {
    super(reason);
    this.name = "AuthProviderError";
  }
}

/** Email + password accounts, verification and recovery. Implemented on top of Supabase Auth. */
export interface CredentialAuthProvider {
  /** Creates the account and sends the confirmation email. Throws `already_registered` for a known address. */
  signUp(email: string, password: string): Promise<AuthIdentity>;
  /** Throws `invalid_credentials` or `email_not_confirmed`. */
  signIn(email: string, password: string): Promise<AuthIdentity>;
  sendPasswordReset(email: string): Promise<void>;
  resendConfirmation(email: string): Promise<void>;
}

export interface TokenService {
  issue(principal: Principal, ttlSeconds: number): string;
  verify(token: string): Principal | null;
}

export interface LoginAttemptStore {
  get(key: string): LoginState | undefined;
  set(key: string, state: LoginState): void;
  clear(key: string): void;
}

/** Implemented by the reports module (via the composition root). */
export interface UserActivityReader {
  activity(userId: string): Promise<{ reports: number; updates: number; flagsAgainst: number }>;
}

/** Cross-module cleanup performed when an account is deleted. */
export interface AccountDataCleaner {
  handleReports(userId: string, mode: "keep_anonymous" | "delete"): Promise<void>;
  removeAlertData(userId: string): Promise<void>;
}

/** Generates and hashes refresh tokens (random bytes + SHA-256; infrastructure because it needs a crypto library). */
export interface RefreshTokenCodec {
  generate(): { token: string; hash: string };
  hash(token: string): string;
}

/** Begins a session for a freshly authenticated user. */
export interface SessionStarter {
  start(user: User): Promise<SessionDto>;
}

/** Ends every session of an account (account deletion). */
export interface SessionRevoker {
  revokeAll(userId: string): Promise<void>;
}
