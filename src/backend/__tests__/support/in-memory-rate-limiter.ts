import type { RateLimiter } from "@/backend/shared/application/rate-limiter";

export class InMemoryRateLimiter implements RateLimiter {
  private readonly hits = new Map<string, number[]>();

  async allow(key: string, limit: number, windowMs: number): Promise<boolean> {
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

  async purge(olderThan: Date): Promise<number> {
    let removed = 0;
    for (const [key, times] of this.hits) {
      const kept = times.filter((t) => t >= olderThan.getTime());
      removed += times.length - kept.length;
      if (kept.length) this.hits.set(key, kept);
      else this.hits.delete(key);
    }
    return removed;
  }
}
