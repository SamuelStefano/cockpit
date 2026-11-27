// Fixed-size sliding window: each key keeps the timestamps of its last hits.
export interface RateLimiter {
  hit(key: string): boolean;
}

export function createRateLimiter(limit: number, windowMs: number, now: () => number, maxKeys = 10_000): RateLimiter {
  const hits = new Map<string, number[]>();
  return {
    hit(key) {
      const t = now();
      const recent = (hits.get(key) ?? []).filter((x) => t - x < windowMs);
      if (recent.length >= limit) { hits.set(key, recent); return false; }
      recent.push(t);
      hits.delete(key);
      hits.set(key, recent);
      // A flood of distinct IPs must not grow memory without bound; the oldest key goes first.
      if (hits.size > maxKeys) hits.delete(hits.keys().next().value as string);
      return true;
    },
  };
}
