import Redis from "ioredis";

export interface CacheStats {
  driver: "redis" | "memory";
  isConnected: boolean;
  totalKeys?: number;
}

interface MemoryCacheEntry {
  value: string;
  expiresAt: number | null; // epoch ms, or null if indefinite
}

export class CacheService {
  private redisClient: Redis | null = null;
  private memoryStore: Map<string, MemoryCacheEntry> = new Map();
  private useMemoryFallback = false;
  private isConnected = false;
  private prefix = "spu:";

  constructor() {
    this.init();
  }

  private init() {
    const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";

    // Disable Redis in test environment if REDIS_TEST is not set, or allow connection
    try {
      this.redisClient = new Redis(redisUrl, {
        maxRetriesPerRequest: 1,
        retryStrategy: (times) => {
          if (times > 2) {
            this.useMemoryFallback = true;
            return null; // Stop retrying, switch to memory
          }
          return 500;
        },
        connectTimeout: 2000,
        lazyConnect: false,
      });

      this.redisClient.on("connect", () => {
        this.isConnected = true;
        this.useMemoryFallback = false;
      });

      this.redisClient.on("ready", () => {
        this.isConnected = true;
        this.useMemoryFallback = false;
      });

      this.redisClient.on("error", (_err) => {
        this.isConnected = false;
        this.useMemoryFallback = true;
      });

      this.redisClient.on("close", () => {
        this.isConnected = false;
        this.useMemoryFallback = true;
      });
    } catch (_err) {
      this.useMemoryFallback = true;
      this.isConnected = false;
    }
  }

  private formatKey(key: string): string {
    return key.startsWith(this.prefix) ? key : `${this.prefix}${key}`;
  }

  /**
   * Get parsed value from cache
   */
  async get<T = any>(key: string): Promise<T | null> {
    const fullKey = this.formatKey(key);

    if (this.redisClient && this.isConnected && !this.useMemoryFallback) {
      try {
        const raw = await this.redisClient.get(fullKey);
        if (!raw) return null;
        return JSON.parse(raw) as T;
      } catch (_err) {
        // Fallback to memory if Redis read fails
        return this.getFromMemory<T>(fullKey);
      }
    }

    return this.getFromMemory<T>(fullKey);
  }

  private getFromMemory<T>(fullKey: string): T | null {
    const entry = this.memoryStore.get(fullKey);
    if (!entry) return null;

    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.memoryStore.delete(fullKey);
      return null;
    }

    try {
      return JSON.parse(entry.value) as T;
    } catch {
      return null;
    }
  }

  /**
   * Set value in cache with optional TTL in seconds
   */
  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    const fullKey = this.formatKey(key);
    const serialized = JSON.stringify(value);

    // Save to memory store as well (for fast fallback)
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : null;
    this.memoryStore.set(fullKey, { value: serialized, expiresAt });

    if (this.redisClient && this.isConnected && !this.useMemoryFallback) {
      try {
        if (ttlSeconds && ttlSeconds > 0) {
          await this.redisClient.set(fullKey, serialized, "EX", ttlSeconds);
        } else {
          await this.redisClient.set(fullKey, serialized);
        }
      } catch (_err) {
        // Redis write failed, memory store already updated
      }
    }
  }

  /**
   * Delete key from cache
   */
  async del(key: string): Promise<void> {
    const fullKey = this.formatKey(key);
    this.memoryStore.delete(fullKey);

    if (this.redisClient && this.isConnected && !this.useMemoryFallback) {
      try {
        await this.redisClient.del(fullKey);
      } catch (_err) {
        // Ignored
      }
    }
  }

  /**
   * Delete keys matching wildcard pattern (e.g. 'price:*')
   */
  async delByPattern(pattern: string): Promise<void> {
    const searchPattern = this.formatKey(pattern);

    // Evict from memory store
    const regex = new RegExp(`^${searchPattern.replace(/\*/g, ".*")}$`);
    for (const k of this.memoryStore.keys()) {
      if (regex.test(k)) {
        this.memoryStore.delete(k);
      }
    }

    // Evict from Redis
    if (this.redisClient && this.isConnected && !this.useMemoryFallback) {
      try {
        const keys = await this.redisClient.keys(searchPattern);
        if (keys.length > 0) {
          await this.redisClient.del(...keys);
        }
      } catch (_err) {
        // Ignored
      }
    }
  }

  /**
   * Clear all cached keys under the prefix
   */
  async flush(): Promise<void> {
    this.memoryStore.clear();

    if (this.redisClient && this.isConnected && !this.useMemoryFallback) {
      try {
        const keys = await this.redisClient.keys(`${this.prefix}*`);
        if (keys.length > 0) {
          await this.redisClient.del(...keys);
        }
      } catch (_err) {
        // Ignored
      }
    }
  }

  /**
   * Ping cache service
   */
  async ping(): Promise<boolean> {
    if (this.redisClient && this.isConnected && !this.useMemoryFallback) {
      try {
        const res = await this.redisClient.ping();
        return res === "PONG";
      } catch {
        return true; // Memory fallback alive
      }
    }
    return true;
  }

  /**
   * Get current cache stats & driver
   */
  async getStats(): Promise<CacheStats> {
    if (this.redisClient && this.isConnected && !this.useMemoryFallback) {
      try {
        const keys = await this.redisClient.keys(`${this.prefix}*`);
        return {
          driver: "redis",
          isConnected: true,
          totalKeys: keys.length,
        };
      } catch {
        // fallback
      }
    }

    return {
      driver: "memory",
      isConnected: true,
      totalKeys: this.memoryStore.size,
    };
  }

  /**
   * Graceful disconnect
   */
  async disconnect(): Promise<void> {
    if (this.redisClient) {
      try {
        await this.redisClient.quit();
      } catch {
        // ignore
      }
      this.redisClient = null;
      this.isConnected = false;
    }
  }
}

export const cacheService = new CacheService();
