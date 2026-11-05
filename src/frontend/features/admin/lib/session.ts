import { useSyncExternalStore } from "react";

/**
 * Admin session = the bearer token from `/admin/auth/login`, kept in sessionStorage for the length of the tab
 * (the backend token itself expires after 8 hours). Exposed as an external store so every screen reacts the
 * moment the session ends, whatever caused it.
 */
const KEY = "nearpaw.admin-session";
const listeners = new Set<() => void>();
let endedByExpiry = false;

interface Stored {
  token: string;
  expiresAt: number;
}

function read(): Stored | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as Stored;
    if (typeof stored.token !== "string" || typeof stored.expiresAt !== "number") return null;
    if (stored.expiresAt <= Date.now()) {
      window.sessionStorage.removeItem(KEY);
      endedByExpiry = true;
      return null;
    }
    return stored;
  } catch {
    return null;
  }
}

const emit = () => listeners.forEach((l) => l());

export const getAdminToken = (): string | null => read()?.token ?? null;

export function saveAdminSession(token: string, expiresInSeconds: number) {
  endedByExpiry = false;
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify({ token, expiresAt: Date.now() + expiresInSeconds * 1000 }));
  } catch {
    // Storage blocked: the caller still navigates, but the next request will bounce back to sign-in.
  }
  emit();
}

/** `expired` = the server said 401 (or the clock ran out), as opposed to the person signing out. */
export function clearAdminSession(reason?: "expired") {
  endedByExpiry = reason === "expired";
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
  emit();
}

export const sessionEndedByExpiry = () => endedByExpiry;

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

/** `undefined` while rendering on the server / before hydration, `null` = signed out, string = signed in. */
export function useAdminToken(): string | null | undefined {
  return useSyncExternalStore<string | null | undefined>(subscribe, getAdminToken, () => undefined);
}

/** Only follow same-site admin paths after sign-in. */
export function safeNextPath(next: string | null): string {
  return next && next.startsWith("/admin") && !next.startsWith("//") && !next.startsWith("/admin/login") ? next : "/admin";
}
