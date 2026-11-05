import { ValidationError } from "@/backend/shared/domain/errors";
import type { Role } from "@/backend/shared/domain/principal";

export type UserStatus = "active" | "restricted" | "suspended" | "banned" | "deleted";
export type UserAction = "warn" | "suspend" | "ban" | "restore";

export interface User {
  readonly id: string;
  /** Pseudonymous number shown as "Community member #4821". */
  readonly publicNumber: number;
  /** Admins sign in to the console with the same Supabase account; the role is set in the database. */
  readonly role: Role;
  readonly displayName: string;
  readonly email: string | null;
  readonly status: UserStatus;
  readonly warnings: number;
  readonly createdAt: Date;
  readonly deletedAt: Date | null;
  readonly tombstoneId: string | null;
}

export const DEFAULT_DISPLAY_NAME = "Community member";

export const userLabel = (u: User) =>
  u.status === "deleted" ? `Deleted user · tombstone ${u.tombstoneId}` : `Community #${u.publicNumber}`;

/** Only fully active accounts may post reports, updates or flags. */
export const canContribute = (status: UserStatus) => status === "active";

export function applyAction(user: User, action: UserAction): User {
  if (user.status === "deleted") throw new ValidationError("Deleted users cannot be moderated");
  if (user.role === "admin") throw new ValidationError("Admin accounts cannot be moderated here");
  switch (action) {
    case "warn":
      return { ...user, warnings: user.warnings + 1 };
    case "suspend":
      return { ...user, status: "suspended" };
    case "ban":
      return { ...user, status: "banned" };
    case "restore":
      return { ...user, status: "active" };
  }
}

/** Account deletion erases personal data and keeps only a tombstone. */
export function anonymize(user: User, now: Date): User {
  return {
    ...user,
    role: "user",
    email: null,
    displayName: "Deleted user",
    status: "deleted",
    deletedAt: now,
    tombstoneId: `d-${user.id.slice(0, 4)}`,
  };
}

export function validateDisplayName(raw: string): string {
  const name = raw.trim();
  if (name.length < 2 || name.length > 40 || /[@\d]{5,}/.test(name)) {
    throw new ValidationError("Display name must be 2-40 characters and must not contain contact details");
  }
  return name;
}
