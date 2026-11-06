/**
 * Refresh tokens: opaque, long-lived, single-use credentials that renew the short-lived access token.
 * Every sign-in starts a *family*; each refresh rotates the token inside its family. Presenting a token that was
 * already rotated (outside a short leeway) means it leaked, so the whole family is revoked.
 */
export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
export const REFRESH_TTL_SECONDS = 90 * 24 * 3600;
/** A family can't be extended forever: after this the user signs in again. */
export const REFRESH_FAMILY_MAX_AGE_SECONDS = 180 * 24 * 3600;
/** A refresh whose response was lost may be retried with the same token for a moment. */
export const ROTATION_LEEWAY_SECONDS = 30;

export type RevokedReason = "rotated" | "signed_out" | "reuse" | "account_closed";

export interface RefreshToken {
  /** SHA-256 of the token. The token itself is never stored. */
  readonly hash: string;
  readonly userId: string;
  readonly familyId: string;
  readonly familyStartedAt: Date;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly revokedAt: Date | null;
  readonly revokedReason: RevokedReason | null;
}

export type RefreshVerdict = "valid" | "retry_within_leeway" | "reuse" | "expired";

export function judgeRefreshToken(token: RefreshToken, now: Date): RefreshVerdict {
  if (token.expiresAt.getTime() <= now.getTime()) return "expired";
  if (token.familyStartedAt.getTime() + REFRESH_FAMILY_MAX_AGE_SECONDS * 1000 <= now.getTime()) return "expired";
  if (!token.revokedAt) return "valid";
  const withinLeeway = now.getTime() - token.revokedAt.getTime() <= ROTATION_LEEWAY_SECONDS * 1000;
  return token.revokedReason === "rotated" && withinLeeway ? "retry_within_leeway" : "reuse";
}
