interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export class AnalyticsCache {
  private static cache = new Map<string, CacheEntry<any>>();

  /**
   * Retrieves data from cache if it exists and has not expired.
   */
  static get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Stores data in cache with a specified Time-To-Live (TTL) in milliseconds.
   * Default TTL is 60 seconds.
   */
  static set<T>(key: string, data: T, ttlMs: number = 60000): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
    });
  }

  /**
   * Manually invalidates a cache key.
   */
  static invalidate(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Invalidates all cache entries.
   */
  static clear(): void {
    this.cache.clear();
  }
}
