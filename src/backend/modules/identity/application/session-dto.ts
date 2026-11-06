import type { User } from "../domain/user";

export interface SessionDto {
  /** Short-lived access token (Bearer). */
  token: string;
  expiresInSeconds: number;
  /** Present for app users; admin sessions are short and have no refresh token. */
  refreshToken?: string;
  refreshExpiresInSeconds?: number;
  role: "user" | "admin";
  user?: ReturnType<typeof toProfile>;
}

export const toProfile = (u: User) => ({
  id: u.id,
  displayName: u.displayName,
  signInMethod: "email" as const,
  email: u.email,
  status: u.status,
  createdAt: u.createdAt.toISOString(),
});
