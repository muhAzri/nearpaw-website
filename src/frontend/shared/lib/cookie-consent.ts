/**
 * Cookie / analytics consent, kept in localStorage. Analytics must only load when consent is "accepted".
 * Exposed as an external store so the banner and the footer's "Cookie settings" stay in sync.
 */
export type CookieConsent = "accepted" | "rejected";

const KEY = "nearpaw.cookie-consent";
const listeners = new Set<() => void>();
let reopened = false;

function emit() {
  listeners.forEach((l) => l());
}

export function getCookieConsent(): CookieConsent | null {
  try {
    const value = window.localStorage.getItem(KEY);
    return value === "accepted" || value === "rejected" ? value : null;
  } catch {
    return null;
  }
}

export function setCookieConsent(value: CookieConsent) {
  try {
    window.localStorage.setItem(KEY, value);
  } catch {
    // Storage blocked: the choice only lasts for this page view.
  }
  reopened = false;
  emit();
}

export function openCookieSettings() {
  reopened = true;
  emit();
}

export function subscribeCookieConsent(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

/** The banner shows until a choice is made, or when "Cookie settings" is used. */
export const cookieBannerVisible = () => reopened || getCookieConsent() === null;
