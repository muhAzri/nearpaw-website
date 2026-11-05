import { ValidationError } from "@/backend/shared/domain/errors";

export const MIN_PASSWORD_LENGTH = 8;
/** Supabase Auth (bcrypt) ignores everything past 72 bytes. */
export const MAX_PASSWORD_LENGTH = 72;

const COMMON = new Set([
  "password1",
  "password12",
  "password123",
  "passw0rd",
  "qwerty123",
  "qwertyuiop1",
  "abc12345",
  "abcd1234",
  "12345678a",
  "a12345678",
  "iloveyou1",
  "welcome1",
  "welcome123",
  "admin123",
  "letmein123",
  "nearpaw123",
]);

/** "Use letters and numbers. Avoid common passwords." (S03b) */
export function assertAcceptablePassword(password: string, email: string): void {
  const fail = (message: string) => {
    throw new ValidationError(message, { field: "password" });
  };
  if (password.length < MIN_PASSWORD_LENGTH) fail(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
  if (password.length > MAX_PASSWORD_LENGTH) fail(`Use at most ${MAX_PASSWORD_LENGTH} characters.`);
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) fail("Use letters and numbers.");
  const lower = password.toLowerCase();
  const local = email.split("@")[0]?.toLowerCase() ?? "";
  if (COMMON.has(lower) || (local.length >= 4 && lower.includes(local))) fail("That password is too easy to guess. Choose another.");
}
