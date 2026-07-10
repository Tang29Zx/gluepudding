import { LRUCache } from "lru-cache";

export class PerUserMinuteLimiter {
  private readonly requests = new LRUCache<string, number[]>({
    max: 2048,
    ttl: 60_000,
  });

  constructor(private readonly limit: number) {}

  consume(userHash: string, now = Date.now()): boolean {
    const threshold = now - 60_000;
    const timestamps = (this.requests.get(userHash) ?? []).filter(
      (timestamp) => timestamp > threshold,
    );

    if (timestamps.length >= this.limit) {
      this.requests.set(userHash, timestamps);
      return false;
    }

    timestamps.push(now);
    this.requests.set(userHash, timestamps);
    return true;
  }
}
