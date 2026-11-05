import { AuthProviderError, type AuthFailure, type AuthIdentity, type CredentialAuthProvider } from "../application/ports";

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

  private async call(path: string, body: unknown): Promise<{ ok: boolean; status: number; json: unknown }> {
    let res: Response;
    try {
      res = await fetch(`${this.base}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", apikey: this.publishableKey },
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
    else reason = "unavailable";
    return new AuthProviderError(reason);
  }

  async signUp(email: string, password: string): Promise<AuthIdentity> {
    const res = await this.call("/signup", { email, password });
    if (!res.ok) throw this.failure(res.status, res.json);
    const payload = res.json as GoTrueUser & { user?: GoTrueUser };
    const user = payload.user ?? payload;
    if (!user.id) throw new AuthProviderError("unavailable");
    if (Array.isArray(user.identities) && user.identities.length === 0) throw new AuthProviderError("already_registered");
    return { id: user.id, email: user.email ?? email };
  }

  async signIn(email: string, password: string): Promise<AuthIdentity> {
    const res = await this.call("/token?grant_type=password", { email, password });
    if (!res.ok) throw this.failure(res.status, res.json);
    const user = (res.json as { user?: GoTrueUser }).user;
    if (!user?.id) throw new AuthProviderError("unavailable");
    return { id: user.id, email: user.email ?? email };
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
  signIn = async (): Promise<AuthIdentity> => this.fail();
  sendPasswordReset = async (): Promise<void> => this.fail();
  resendConfirmation = async (): Promise<void> => this.fail();
}
