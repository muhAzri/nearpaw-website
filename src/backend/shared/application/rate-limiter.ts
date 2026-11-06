export interface RateLimiter {
  /** true = allowed. Counts the attempt. */
  allow(key: string, limit: number, windowMs: number): Promise<boolean>;
  /** Housekeeping: forgets attempts older than `olderThan` (they no longer count toward any window). Returns how many. */
  purge(olderThan: Date): Promise<number>;
}
