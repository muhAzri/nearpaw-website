export interface RateLimiter {
  /** true = allowed. Counts the attempt. */
  allow(key: string, limit: number, windowMs: number): boolean;
}
