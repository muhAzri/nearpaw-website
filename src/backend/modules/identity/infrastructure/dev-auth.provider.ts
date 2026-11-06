import { AuthProviderError, type AuthIdentity, type CredentialAuthProvider } from "../application/ports";

interface DevAccount {
  id: string;
  password: string;
  confirmed: boolean;
}

/**
 * Development and tests only: accounts live in memory so the flows work without a Supabase project.
 * With `autoConfirm` the account is usable immediately (there is no inbox to click); tests turn it off
 * and call `confirm` to act as the emailed link.
 */
export class DevAuthProvider implements CredentialAuthProvider {
  private readonly accounts = new Map<string, DevAccount>();
  readonly outbox: { kind: "confirm" | "reset"; email: string }[] = [];

  constructor(private readonly autoConfirm: boolean) {}

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

  async signIn(email: string, password: string): Promise<AuthIdentity> {
    const account = this.accounts.get(email);
    if (!account || account.password !== password) throw new AuthProviderError("invalid_credentials");
    if (!account.confirmed) throw new AuthProviderError("email_not_confirmed");
    return { id: account.id, email, emailConfirmed: true };
  }

  async sendPasswordReset(email: string) {
    if (this.accounts.has(email)) this.outbox.push({ kind: "reset", email });
  }

  async resendConfirmation(email: string) {
    const account = this.accounts.get(email);
    if (account && !account.confirmed) this.outbox.push({ kind: "confirm", email });
  }
}
