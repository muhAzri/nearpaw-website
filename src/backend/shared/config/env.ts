import "server-only";
import { z } from "zod";

const ServerEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  /** HMAC secret for session tokens (>= 32 chars). Required in production. */
  AUTH_SECRET: z.string().min(32).optional(),
  /** Sign in with Apple: the app's bundle id / Services id (the `aud` of identity tokens). */
  APPLE_CLIENT_ID: z.string().min(1).optional(),
  /** Bootstrap admin. Admin login is disabled until all three are set. */
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(12).optional(),
  /** Base32 TOTP secret (RFC 6238) from the admin's authenticator app. */
  ADMIN_TOTP_SECRET: z.string().regex(/^[A-Z2-7]{16,}=*$/i).optional(),
  // Add further server-only secrets here (e.g. SUPABASE_SECRET_KEY) and validate them.
});

export type ServerEnv = z.infer<typeof ServerEnvSchema>;

/** Same fields, but production refuses to boot without the auth secret. */
const requireInProduction = (env: ServerEnv) => {
  if (env.NODE_ENV === "production" && !env.AUTH_SECRET) {
    throw new Error("AUTH_SECRET is required in production");
  }
  return env;
};

let cached: ServerEnv | undefined;

/** Parsed lazily so `next build` doesn't require runtime secrets. */
export function serverEnv(): ServerEnv {
  if (!cached) {
    const parsed = ServerEnvSchema.safeParse(process.env);
    if (!parsed.success) {
      throw new Error(`Invalid server environment:\n${z.prettifyError(parsed.error)}`);
    }
    cached = requireInProduction(parsed.data);
  }
  return cached;
}
