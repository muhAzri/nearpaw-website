import "server-only";
import { z } from "zod";

const ServerEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  // Add server-only secrets here (e.g. SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) and validate them.
});

export type ServerEnv = z.infer<typeof ServerEnvSchema>;

let cached: ServerEnv | undefined;

/** Parsed lazily so `next build` doesn't require runtime secrets. */
export function serverEnv(): ServerEnv {
  if (!cached) {
    const parsed = ServerEnvSchema.safeParse(process.env);
    if (!parsed.success) {
      throw new Error(`Invalid server environment:\n${z.prettifyError(parsed.error)}`);
    }
    cached = parsed.data;
  }
  return cached;
}
