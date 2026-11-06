import "server-only";
import { z } from "zod";

/** `.env` files declare unset keys as `KEY=`, which arrives as an empty string. */
const blankAsUndefined = <T extends z.ZodType>(schema: T) => z.preprocess((v) => (v === "" ? undefined : v), schema);

const ServerEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  /** Supabase Auth (email + password). Both unset outside production = in-memory dev accounts. */
  NEXT_PUBLIC_SUPABASE_URL: blankAsUndefined(z.url().optional()),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: blankAsUndefined(z.string().min(1).optional()),
  /** Only for Supabase projects still on the legacy shared JWT secret. Leave unset to verify tokens against the project's JWKS. */
  SUPABASE_JWT_SECRET: blankAsUndefined(z.string().min(16).optional()),
  /** Bootstrap admin. Admin login is disabled until all three are set. */
  ADMIN_EMAIL: blankAsUndefined(z.email().optional()),
  /**
   * Photo storage (S3 or any S3-compatible service). The app uploads straight to the bucket through presigned URLs.
   * `S3_BUCKET` + `S3_REGION` enable uploads; credentials come from S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY
   * or, when both are unset, from the AWS default credential chain (IAM role, env, profile).
   */
  S3_BUCKET: blankAsUndefined(z.string().min(3).optional()),
  S3_REGION: blankAsUndefined(z.string().min(2).optional()),
  S3_ACCESS_KEY_ID: blankAsUndefined(z.string().min(1).optional()),
  S3_SECRET_ACCESS_KEY: blankAsUndefined(z.string().min(1).optional()),
  /** Custom endpoint for MinIO / R2 / LocalStack. */
  S3_ENDPOINT: blankAsUndefined(z.url().optional()),
  S3_FORCE_PATH_STYLE: blankAsUndefined(z.enum(["true", "false"]).optional()),
  /** Where `public/…` keys are served from (CloudFront or the bucket's public URL). Sent to the app in `/config`. */
  S3_PUBLIC_BASE_URL: blankAsUndefined(z.url().optional()),
  /**
   * Push notifications through Firebase Cloud Messaging (HTTP v1). Paste the service account JSON (Firebase console >
   * Project settings > Service accounts > Generate new private key), raw or base64-encoded. Unset = pushes are skipped.
   */
  FIREBASE_SERVICE_ACCOUNT_JSON: blankAsUndefined(z.string().min(2).optional()),
  /** Optional: defaults to the `project_id` inside the service account JSON. */
  FIREBASE_PROJECT_ID: blankAsUndefined(z.string().min(2).optional()),
  // Add further server-only secrets here (e.g. SUPABASE_SECRET_KEY) and validate them.
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
