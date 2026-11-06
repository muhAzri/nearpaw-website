import type { SupabaseClient } from "@supabase/supabase-js";
import { check, unwrap } from "@/backend/shared/infrastructure/supabase-admin";
import type { LoginState } from "../domain/login-policy";
import type { LoginAttemptStore } from "../application/ports";

/** `login_attempts` table through the secret key, so lockouts hold across instances and restarts. */
export class SupabaseLoginAttempts implements LoginAttemptStore {
  constructor(private readonly db: SupabaseClient) {}

  async get(key: string): Promise<LoginState | undefined> {
    const row = unwrap(await this.db.from("login_attempts").select("failures, locked_until").eq("key", key).maybeSingle<{ failures: number; locked_until: string | null }>(), "loginAttempts.get");
    return row ? { failures: row.failures, lockedUntil: row.locked_until ? new Date(row.locked_until).getTime() : null } : undefined;
  }

  async set(key: string, s: LoginState) {
    check(
      await this.db.from("login_attempts").upsert({ key, failures: s.failures, locked_until: s.lockedUntil ? new Date(s.lockedUntil).toISOString() : null }, { onConflict: "key" }),
      "loginAttempts.set",
    );
  }

  async clear(key: string) {
    check(await this.db.from("login_attempts").delete().eq("key", key), "loginAttempts.clear");
  }
}
