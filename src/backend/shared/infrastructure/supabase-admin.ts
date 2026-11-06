import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { serverEnv } from "@/backend/shared/config/env";
import { singleton } from "./singleton";

/**
 * Server-side Supabase client using the secret key (bypasses RLS). Supabase is the only place the API keeps data, so a
 * missing configuration is an error, never a silent fallback. Never import this from client code.
 */
export function supabaseAdmin(): SupabaseClient {
  const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SECRET_KEY: key } = serverEnv();
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required: the API stores its data in Supabase.");
  return singleton("supabase_admin", () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }));
}

/** Throws a readable error for a failed query; the presentation layer turns it into a 500. */
export function unwrap<T>(result: { data: T | null; error: { message: string } | null }, what: string): T {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  return result.data as T;
}

export function check(result: { error: { message: string } | null }, what: string): void {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
}
