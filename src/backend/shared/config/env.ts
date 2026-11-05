import "server-only";
import { z } from "zod";

/** `.env` files declare unset keys as `KEY=`, which arrives as an empty string. */
const blankAsUndefined = <T extends z.ZodType>(schema: T) => z.preprocess((v) => (v === "" ? undefined : v), schema);

const ServerEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  /** HMAC secret for session tokens (>= 32 chars). Required in production. */
  AUTH_SECRET: z.string().min(32).optional(),
  /** Supabase Auth (email + password). Both unset outside production = in-memory dev accounts. */
  NEXT_PUBLIC_SUPABASE_URL: blankAsUndefined(z.url().optional()),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: blankAsUndefined(z.string().min(1).optional()),
  /** Bootstrap admin. Admin login is disabled until all three are set. */
  ADMIN_EMAIL: blankAsUndefined(z.email().optional()),
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
