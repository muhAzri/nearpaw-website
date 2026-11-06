import { AuthProviderError, type AuthFailure, type AuthIdentity, type CredentialAuthProvider, type ProviderSession } from "../application/ports";

interface GoTrueError {
  error_code?: string;
  code?: string | number;
  msg?: string;
  error?: string;
}

interface GoTrueUser {
  id?: string;
  email?: string;
  /** Empty when the address is already registered and email confirmation is on (Supabase hides the duplicate). */
  identities?: unknown[] | null;
  /** Set when the address is already confirmed (confirmation switched off, or the link was opened). */
  email_confirmed_at?: string | null;
  confirmed_at?: string | null;
}

/** GoTrue answers a refresh with one of these when the token is unknown, already used, expired or its session is gone. */
const SESSION_ENDED_CODES = new Set(["refresh_token_not_found", "refresh_token_already_used", "session_not_found", "session_expired", "invalid_grant", "user_not_found"]);

interface GoTrueSession {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  user?: GoTrueUser;
}

function toSession(json: unknown): ProviderSession {
  const s = json as GoTrueSession;
  if (!s.access_token || !s.refresh_token || !s.user?.id) throw new AuthProviderError("unavailable");
  return { userId: s.user.id, accessToken: s.access_token, refreshToken: s.refresh_token, expiresInSeconds: s.expires_in ?? 3600 };
}

/**
 * Supabase Auth (GoTrue) over its REST API, called with the publishable key only.
 * Email delivery, confirmation and reset links are handled by Supabase, so the SMTP provider,
 * email templates and redirect URLs are configured in the Supabase dashboard.
 */
export class SupabaseAuthProvider implements CredentialAuthProvider {
  private readonly base: string;

  constructor(
    url: string,
    private readonly publishableKey: string,
  ) {
    this.base = `${url.replace(/\/+$/, "")}/auth/v1`;
  }

  private async call(path: string, body: unknown, accessToken?: string): Promise<{ ok: boolean; status: number; json: unknown }> {
    let res: Response;
    try {
      res = await fetch(`${this.base}${path}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          apikey: this.publishableKey,
          ...(accessToken && { authorization: `Bearer ${accessToken}` }),
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
        cache: "no-store",
      });
    } catch {
      throw new AuthProviderError("unavailable");
    }
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, json };
  }

  private failure(status: number, json: unknown): AuthProviderError {
    const e = (json ?? {}) as GoTrueError;
    const code = e.error_code ?? (typeof e.code === "string" ? e.code : "");
    let reason: AuthFailure;
    if (code === "invalid_credentials" || code === "weak_password") reason = "invalid_credentials";
    else if (code === "email_not_confirmed") reason = "email_not_confirmed";
    else if (code === "user_already_exists" || code === "email_exists") reason = "already_registered";
    else if (status === 429 || code.includes("rate_limit")) reason = "rate_limited";
    else if (SESSION_ENDED_CODES.has(code)) reason = "session_ended";
    else reason = "unavailable";
    return new AuthProviderError(reason);
  }

  async signUp(email: string, password: string): Promise<AuthIdentity> {
    const res = await this.call("/signup", { email, password });
    if (!res.ok) throw this.failure(res.status, res.json);
    // With email confirmation off, Supabase answers /signup with a session (access_token) and a confirmed user.
    const payload = res.json as GoTrueUser & { user?: GoTrueUser; access_token?: string };
    const user = payload.user ?? payload;
    if (!user.id) throw new AuthProviderError("unavailable");
    if (Array.isArray(user.identities) && user.identities.length === 0) throw new AuthProviderError("already_registered");
    const emailConfirmed = Boolean(payload.access_token || user.email_confirmed_at || user.confirmed_at);
    return { id: user.id, email: user.email ?? email, emailConfirmed };
  }

  async signIn(email: string, password: string) {
    const res = await this.call("/token?grant_type=password", { email, password });
    if (!res.ok) throw this.failure(res.status, res.json);
    const user = (res.json as { user?: GoTrueUser }).user;
    if (!user?.id) throw new AuthProviderError("unavailable");
    const identity: AuthIdentity = { id: user.id, email: user.email ?? email, emailConfirmed: true };
    return { identity, session: toSession(res.json) };
  }

  async refresh(refreshToken: string): Promise<ProviderSession> {
    const res = await this.call("/token?grant_type=refresh_token", { refresh_token: refreshToken });
    if (!res.ok) {
      const failure = this.failure(res.status, res.json);
      // A 4xx we don't recognise still means this refresh token is no good; only 429 and 5xx are hiccups.
      if (failure.reason === "unavailable" && res.status >= 400 && res.status < 500 && res.status !== 429) throw new AuthProviderError("session_ended");
      throw failure;
    }
    return toSession(res.json);
  }

  async signOut(accessToken: string): Promise<void> {
    await this.call("/logout?scope=local", {}, accessToken);
  }

  async sendPasswordReset(email: string): Promise<void> {
    const res = await this.call("/recover", { email });
    if (!res.ok) throw this.failure(res.status, res.json);
  }

  async resendConfirmation(email: string): Promise<void> {
    const res = await this.call("/resend", { type: "signup", email });
    if (!res.ok) throw this.failure(res.status, res.json);
  }
}

/** Used in production when Supabase isn't configured: every call fails loudly instead of silently succeeding. */
export class UnconfiguredAuthProvider implements CredentialAuthProvider {
  private fail(): never {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are not configured");
  }
  signUp = async (): Promise<AuthIdentity> => this.fail();
  signIn = async (): Promise<never> => this.fail();
  refresh = async (): Promise<never> => this.fail();
  signOut = async (): Promise<void> => this.fail();
  sendPasswordReset = async (): Promise<void> => this.fail();
  resendConfirmation = async (): Promise<void> => this.fail();
}
