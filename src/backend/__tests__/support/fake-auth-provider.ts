import { SignJWT } from "jose";
import { AuthProviderError, type AuthIdentity, type CredentialAuthProvider, type ProviderSession } from "../../modules/identity/application/ports";
import { JwtAccessTokenVerifier } from "../../modules/identity/infrastructure/jwt-access-token.verifier";

const ISSUER = "nearpaw-test";
const AUDIENCE = "authenticated";
export const FAKE_ACCESS_TOKEN_TTL_SECONDS = 3600;

interface DevAccount {
  id: string;
  password: string;
  confirmed: boolean;
}

/**
 * Tests only: accounts live in memory so the flows run without a Supabase project.
 * With `autoConfirm` the account is usable immediately (there is no inbox to click); tests turn it off
 * and call `confirm` to act as the emailed link.
 */
export class FakeAuthProvider implements CredentialAuthProvider {
  private readonly accounts = new Map<string, DevAccount>();
  readonly outbox: { kind: "confirm" | "reset"; email: string }[] = [];
  /** Single-use refresh tokens, like the real provider's. Only lives as long as this process. */
  private readonly refreshTokens = new Map<string, { userId: string; email: string }>();
  private readonly secret: Uint8Array;
  /** Verifies the JWTs this provider signs, so the rest of the backend treats them like Supabase's. */
  readonly verifier: JwtAccessTokenVerifier;

  constructor(
    private readonly autoConfirm: boolean,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.secret = crypto.getRandomValues(new Uint8Array(32));
    this.verifier = new JwtAccessTokenVerifier(this.secret, { issuer: ISSUER, audience: AUDIENCE, algorithms: ["HS256"], now });
  }

  private async issue(userId: string, email: string): Promise<ProviderSession> {
    const iat = Math.floor(this.now().getTime() / 1000);
    const accessToken = await new SignJWT({ email })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(userId)
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt(iat)
      .setExpirationTime(iat + FAKE_ACCESS_TOKEN_TTL_SECONDS)
      .sign(this.secret);
    const refreshToken = `dev${crypto.randomUUID().replaceAll("-", "")}`;
    this.refreshTokens.set(refreshToken, { userId, email });
    return { userId, accessToken, refreshToken, expiresInSeconds: FAKE_ACCESS_TOKEN_TTL_SECONDS };
  }

  confirm(email: string) {
    const account = this.accounts.get(email);
    if (account) account.confirmed = true;
  }

  async signUp(email: string, password: string): Promise<AuthIdentity> {
    if (this.accounts.has(email)) throw new AuthProviderError("already_registered");
    const id = crypto.randomUUID();
    this.accounts.set(email, { id, password, confirmed: this.autoConfirm });
    if (!this.autoConfirm) this.outbox.push({ kind: "confirm", email });
    return { id, email, emailConfirmed: this.autoConfirm };
  }

  async signIn(email: string, password: string) {
    const account = this.accounts.get(email);
    if (!account || account.password !== password) throw new AuthProviderError("invalid_credentials");
    if (!account.confirmed) throw new AuthProviderError("email_not_confirmed");
    return { identity: { id: account.id, email, emailConfirmed: true }, session: await this.issue(account.id, email) };
  }

  async refresh(refreshToken: string): Promise<ProviderSession> {
    const entry = this.refreshTokens.get(refreshToken);
    if (!entry) throw new AuthProviderError("session_ended");
    this.refreshTokens.delete(refreshToken);
    return this.issue(entry.userId, entry.email);
  }

  async signOut(accessToken: string): Promise<void> {
    const who = await this.verifier.verify(accessToken);
    if (!who) return;
    for (const [token, entry] of this.refreshTokens) if (entry.userId === who.sub) this.refreshTokens.delete(token);
  }

  /** Mirrors `AccountRemover`: forgets the account and ends its sessions. */
  async remove(userId: string): Promise<void> {
    for (const [email, account] of this.accounts) if (account.id === userId) this.accounts.delete(email);
    for (const [token, entry] of this.refreshTokens) if (entry.userId === userId) this.refreshTokens.delete(token);
  }

  async sendPasswordReset(email: string) {
    if (this.accounts.has(email)) this.outbox.push({ kind: "reset", email });
  }

  async resendConfirmation(email: string) {
    const account = this.accounts.get(email);
    if (account && !account.confirmed) this.outbox.push({ kind: "confirm", email });
  }
}
