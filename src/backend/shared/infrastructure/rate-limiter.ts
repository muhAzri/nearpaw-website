import type { SupabaseClient } from "@supabase/supabase-js";
import type { RateLimiter } from "../application/rate-limiter";
import { unwrap } from "./supabase-admin";

/** Counters live in Postgres (see `rate_limit_hit`), so every API instance shares them. */
export class SupabaseRateLimiter implements RateLimiter {
  constructor(private readonly db: SupabaseClient) {}

  async allow(key: string, limit: number, windowMs: number): Promise<boolean> {
    const result = await this.db.rpc("rate_limit_hit", { p_key: key, p_max_hits: limit, p_window_seconds: Math.ceil(windowMs / 1000) });
    return unwrap(result, "rateLimit.hit") === true;
  }
}
