import type { Principal } from "@/backend/shared/domain/principal";
import type { LoginState } from "../domain/login-policy";

export interface AppleIdentityVerifier {
  verify(identityToken: string): Promise<{ sub: string; email: string | null }>;
}

export interface TokenService {
  issue(principal: Principal, ttlSeconds: number): string;
  verify(token: string): Principal | null;
}

export interface AdminAccount {
  readonly id: string;
  checkPassword(password: string): boolean;
  checkTotp(code: string, now: Date): boolean;
}

/** null when admin login is not configured or the email is unknown. */
export interface AdminDirectory {
  find(email: string): AdminAccount | null;
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
