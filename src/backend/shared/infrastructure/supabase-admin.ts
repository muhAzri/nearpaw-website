import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { serverEnv } from "@/backend/shared/config/env";
import { singleton } from "./singleton";

/**
 * Server-side Supabase client using the secret key (bypasses RLS). Null when it isn't configured, in which case the
 * modules fall back to their in-memory repositories. Never import this from client code.
 */
export function supabaseAdmin(): SupabaseClient | null {
  const env = serverEnv();
  const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SECRET_KEY: key } = env;
  if (!url || !key) {
    if (env.NODE_ENV === "production") warnOnce();
    return null;
  }
  return singleton("supabase_admin", () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }));
}

function warnOnce() {
  singleton("supabase_admin_warned", () => {
    console.warn("[storage] SUPABASE_SECRET_KEY is not set: accounts and alert settings are kept in memory and lost on restart.");
    return true;
  });
}

/** Throws a readable error for a failed query; the presentation layer turns it into a 500. */
export function unwrap<T>(result: { data: T | null; error: { message: string } | null }, what: string): T {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  return result.data as T;
}

export function check(result: { error: { message: string } | null }, what: string): void {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
}
