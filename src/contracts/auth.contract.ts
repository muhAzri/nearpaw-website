import { z } from "zod";

export const AppleSignInSchema = z.object({
  identityToken: z.string().min(1),
  /** Apple only sends the name on the very first sign-in. */
  displayName: z.string().trim().min(2).max(40).optional(),
});
export type AppleSignInInput = z.infer<typeof AppleSignInSchema>;

export const AdminLoginSchema = z.object({
  email: z.email(),
  password: z.string().min(1).max(256),
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code"),
});
export type AdminLoginInput = z.infer<typeof AdminLoginSchema>;

export const UpdateProfileSchema = z.object({
  displayName: z.string().trim().min(2).max(40),
});

export const DeleteAccountSchema = z.object({
  reports: z.enum(["keep_anonymous", "delete"]),
  confirm: z.literal(true),
});

export const UserActionSchema = z.object({
  action: z.enum(["warn", "suspend", "ban", "restore"]),
  reason: z.string().trim().min(3).max(500),
});

export const AdminUsersQuerySchema = z.object({
  q: z.string().trim().max(60).optional(),
  status: z.enum(["active", "restricted", "suspended", "banned", "deleted"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
