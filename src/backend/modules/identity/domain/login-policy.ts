export const MAX_FAILED_LOGINS = 5;
export const LOCKOUT_MS = 15 * 60_000;

export interface LoginState {
  failures: number;
  lockedUntil: number | null;
}

export const isLocked = (s: LoginState | undefined, nowMs: number) => !!s?.lockedUntil && s.lockedUntil > nowMs;

export function afterFailure(s: LoginState | undefined, nowMs: number): LoginState {
  const failures = (s && !(s.lockedUntil && s.lockedUntil <= nowMs) ? s.failures : 0) + 1;
  return failures >= MAX_FAILED_LOGINS ? { failures: 0, lockedUntil: nowMs + LOCKOUT_MS } : { failures, lockedUntil: null };
}
