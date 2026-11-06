import type { LoginState } from "../domain/login-policy";

export interface AuthIdentity {
  /** Id of the account in the auth provider; also the id of our `users` row. */
  readonly id: string;
  readonly email: string;
  /** True when the account is usable straight away (email confirmation is switched off in the auth provider). */
  readonly emailConfirmed: boolean;
}

export type AuthFailure = "invalid_credentials" | "email_not_confirmed" | "already_registered" | "rate_limited" | "session_ended" | "unavailable";

/** Thrown by an auth provider; the use cases translate it into domain errors. */
export class AuthProviderError extends Error {
  constructor(readonly reason: AuthFailure) {
    super(reason);
    this.name = "AuthProviderError";
  }
}

/** The JWT pair the auth provider issued. The access token is sent to the app as is; nothing is stored on our side. */
export interface ProviderSession {
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
}

/** Email + password accounts, verification, recovery and sessions. Implemented on top of Supabase Auth. */
export interface CredentialAuthProvider {
  /** Creates the account, and sends the confirmation email unless the provider doesn't require one. Throws `already_registered` for a known address. */
  signUp(email: string, password: string): Promise<AuthIdentity>;
  /** Throws `invalid_credentials` or `email_not_confirmed`. */
  signIn(email: string, password: string): Promise<{ identity: AuthIdentity; session: ProviderSession }>;
  /** Rotates the refresh token. Throws `session_ended` when the provider no longer accepts it, `unavailable` on a hiccup. */
  refresh(refreshToken: string): Promise<ProviderSession>;
  /** Ends the session behind `accessToken`. Best effort. */
  signOut(accessToken: string): Promise<void>;
  sendPasswordReset(email: string): Promise<void>;
  resendConfirmation(email: string): Promise<void>;
}

/** Who an access token belongs to. `email` is what lets us create the profile the first time we see an account. */
export interface VerifiedToken {
  readonly sub: string;
  readonly email?: string;
}

/** Checks the signature, issuer, audience and expiry of an access token (a standard JWT). */
export interface AccessTokenVerifier {
  verify(token: string): Promise<VerifiedToken | null>;
}

export interface LoginAttemptStore {
  get(key: string): Promise<LoginState | undefined>;
  set(key: string, state: LoginState): Promise<void>;
  clear(key: string): Promise<void>;
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
