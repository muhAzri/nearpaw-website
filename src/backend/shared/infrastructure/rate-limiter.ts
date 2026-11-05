import type { RateLimiter } from "../application/rate-limiter";
import { singleton } from "./singleton";


export class InMemoryRateLimiter implements RateLimiter {
  private readonly hits = new Map<string, number[]>();

  allow(key: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= limit) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }
}

export const sharedRateLimiter = () => singleton("rate_limiter", () => new InMemoryRateLimiter());
