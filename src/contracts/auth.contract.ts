import { z } from "zod";

const EmailSchema = z.email().max(254);

/** Create account (S03b). The checkbox covers Terms, Privacy Policy and the minimum age. */
export const RegisterSchema = z.object({
  email: EmailSchema,
  password: z.string().min(8, "Use at least 8 characters").max(72),
  acceptedTerms: z.literal(true, { error: "Accept the Terms and Privacy Policy to continue" }),
});
export type RegisterInput = z.infer<typeof RegisterSchema>;

/** Sign in (S03). */
export const SignInSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1).max(72),
});
export type SignInInput = z.infer<typeof SignInSchema>;

/** Forgot password (S03c) and resend confirmation email (S03d). */
export const EmailOnlySchema = z.object({ email: EmailSchema });
export type EmailOnlyInput = z.infer<typeof EmailOnlySchema>;

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
