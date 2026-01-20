import { Redis as UpstashRedis } from "@upstash/redis";
import IORedis from "ioredis";

// Environment check for local Redis
const USE_LOCAL_REDIS = process.env.USE_LOCAL_REDIS === "true";
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

/**
 * Redis abstraction interface that supports both Upstash REST API and standard Redis
 *
 * This provides a unified API for:
 * - Upstash Redis (REST-based, used in production with Vercel)
 * - Standard Redis (used in self-hosted Docker deployments)
 *
 * Toggle between them using:
 * - USE_LOCAL_REDIS=true - Use standard Redis (ioredis)
 * - USE_LOCAL_REDIS=false (default) - Use Upstash REST API
 */

// Type definitions for Redis operations
type SetOptions = {
  ex?: number; // Expiration in seconds
  px?: number; // Expiration in milliseconds
  nx?: boolean; // Only set if key doesn't exist
  xx?: boolean; // Only set if key exists
};

type ScanOptions = {
  match?: string;
  count?: number;
};

// Pipeline result type
type PipelineResult<T> = T;

/**
 * Local Redis wrapper using ioredis
 * Provides the same interface as Upstash Redis client
 */
class LocalRedisClient {
  // Expose client for direct access (needed by rate limiter)
  public readonly client: IORedis;
  private timeout?: number;

  constructor(url: string, timeout?: number) {
    this.client = new IORedis(url, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      lazyConnect: true,
      enableOfflineQueue: true,
    });
    this.timeout = timeout;

    // Handle connection errors gracefully
    this.client.on("error", (err) => {
      console.error("Redis connection error:", err.message);
    });
  }

  private async withTimeout<T>(promise: Promise<T>): Promise<T> {
    if (!this.timeout) return promise;

    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error("Redis operation timeout")), this.timeout)
      ),
    ]);
  }

  // Basic operations
  async get<T = string>(key: string): Promise<T | null> {
    const result = await this.withTimeout(this.client.get(key));
    if (result === null) return null;
    try {
      return JSON.parse(result) as T;
    } catch {
      return result as unknown as T;
    }
  }

  async set<T = string>(
    key: string,
    value: T,
    options?: SetOptions
  ): Promise<"OK" | null> {
    const stringValue = typeof value === "string" ? value : JSON.stringify(value);
    const args: (string | number)[] = [key, stringValue];

    if (options?.ex) {
      args.push("EX", options.ex);
    } else if (options?.px) {
      args.push("PX", options.px);
    }

    if (options?.nx) {
      args.push("NX");
    } else if (options?.xx) {
      args.push("XX");
    }

    const result = await this.withTimeout(
      (this.client as any).set(...args) as Promise<string | null>
    );
    return result as "OK" | null;
  }

  async del(...keys: string[]): Promise<number> {
    return this.withTimeout(this.client.del(...keys));
  }

  async exists(...keys: string[]): Promise<number> {
    return this.withTimeout(this.client.exists(...keys));
  }

  async expire(key: string, seconds: number): Promise<number> {
    return this.withTimeout(this.client.expire(key, seconds));
  }

  async getdel<T = string>(key: string): Promise<T | null> {
    const result = await this.withTimeout(this.client.getdel(key));
    if (result === null) return null;
    try {
      return JSON.parse(result) as T;
    } catch {
      return result as unknown as T;
    }
  }

  async incrby(key: string, increment: number): Promise<number> {
    return this.withTimeout(this.client.incrby(key, increment));
  }

  // Hash operations
  async hget<T = string>(key: string, field: string): Promise<T | null> {
    const result = await this.withTimeout(this.client.hget(key, field));
    if (result === null) return null;
    try {
      return JSON.parse(result) as T;
    } catch {
      return result as unknown as T;
    }
  }

  async hset(
    key: string,
    fieldOrObject: string | Record<string, any>,
    value?: any
  ): Promise<number> {
    if (typeof fieldOrObject === "string") {
      const stringValue =
        typeof value === "string" ? value : JSON.stringify(value);
      return this.withTimeout(this.client.hset(key, fieldOrObject, stringValue));
    } else {
      // Object form: hset(key, { field1: value1, field2: value2 })
      const entries = Object.entries(fieldOrObject).flatMap(([k, v]) => [
        k,
        typeof v === "string" ? v : JSON.stringify(v),
      ]);
      return this.withTimeout(this.client.hset(key, ...entries));
    }
  }

  async hgetall<T = Record<string, string>>(key: string): Promise<T | null> {
    const result = await this.withTimeout(this.client.hgetall(key));
    if (!result || Object.keys(result).length === 0) return null;

    // Try to parse each value as JSON
    const parsed: Record<string, any> = {};
    for (const [k, v] of Object.entries(result)) {
      try {
        parsed[k] = JSON.parse(v);
      } catch {
        parsed[k] = v;
      }
    }
    return parsed as T;
  }

  // List operations
  async lpush(key: string, ...values: any[]): Promise<number> {
    const stringValues = values.map((v) =>
      typeof v === "string" ? v : JSON.stringify(v)
    );
    return this.withTimeout(this.client.lpush(key, ...stringValues));
  }

  async rpush(key: string, ...values: any[]): Promise<number> {
    const stringValues = values.map((v) =>
      typeof v === "string" ? v : JSON.stringify(v)
    );
    return this.withTimeout(this.client.rpush(key, ...stringValues));
  }

  // Set operations
  async sadd(key: string, ...members: string[]): Promise<number> {
    return this.withTimeout(this.client.sadd(key, ...members));
  }

  async smembers(key: string): Promise<string[]> {
    return this.withTimeout(this.client.smembers(key));
  }

  async sismember(key: string, member: string): Promise<number> {
    return this.withTimeout(this.client.sismember(key, member));
  }

  // Sorted set operations
  async zincrby(key: string, increment: number, member: string): Promise<string> {
    const result = await this.withTimeout(
      this.client.zincrby(key, increment, member)
    );
    return result;
  }

  // Stream operations
  async xadd(
    key: string,
    id: string,
    fields: Record<string, any>
  ): Promise<string | null> {
    const args: (string | number)[] = [];
    for (const [field, value] of Object.entries(fields)) {
      args.push(field, typeof value === "string" ? value : JSON.stringify(value));
    }
    return this.withTimeout(this.client.xadd(key, id, ...args));
  }

  async xdel(key: string, ids: string[]): Promise<number> {
    return this.withTimeout(this.client.xdel(key, ...ids));
  }

  async xrange(
    key: string,
    start: string,
    end: string,
    count?: number
  ): Promise<Record<string, Record<string, string>>> {
    const args: (string | number)[] = [key, start, end];
    if (count !== undefined) {
      args.push("COUNT", count);
    }
    const result = await this.withTimeout(
      this.client.xrange(...(args as [string, string, string]))
    );

    // Convert array format to object format to match Upstash
    const converted: Record<string, Record<string, string>> = {};
    for (const [id, fields] of result) {
      const fieldObj: Record<string, string> = {};
      for (let i = 0; i < fields.length; i += 2) {
        fieldObj[fields[i]] = fields[i + 1];
      }
      converted[id] = fieldObj;
    }
    return converted;
  }

  async xrevrange(
    key: string,
    end: string,
    start: string,
    count?: number
  ): Promise<Record<string, Record<string, string>>> {
    const args: (string | number)[] = [key, end, start];
    if (count !== undefined) {
      args.push("COUNT", count);
    }
    const result = await this.withTimeout(
      this.client.xrevrange(...(args as [string, string, string]))
    );

    // Convert array format to object format to match Upstash
    const converted: Record<string, Record<string, string>> = {};
    for (const [id, fields] of result) {
      const fieldObj: Record<string, string> = {};
      for (let i = 0; i < fields.length; i += 2) {
        fieldObj[fields[i]] = fields[i + 1];
      }
      converted[id] = fieldObj;
    }
    return converted;
  }

  // Multi-key operations
  async mget<T = any>(...keys: (string | string[])[]): Promise<(T | null)[]> {
    const flatKeys = keys.flat();
    const results = await this.withTimeout(this.client.mget(...flatKeys));
    return results.map((r) => {
      if (r === null) return null;
      try {
        return JSON.parse(r) as T;
      } catch {
        return r as unknown as T;
      }
    });
  }

  // Scan operation
  async scan(
    cursor: number,
    options?: ScanOptions
  ): Promise<[string, string[]]> {
    const args: (string | number)[] = [cursor];
    if (options?.match) {
      args.push("MATCH", options.match);
    }
    if (options?.count) {
      args.push("COUNT", options.count);
    }
    const [newCursor, keys] = await this.withTimeout(
      this.client.scan(...(args as [number]))
    );
    return [newCursor, keys];
  }

  // Pipeline support
  pipeline(): LocalRedisPipeline {
    return new LocalRedisPipeline(this.client.pipeline());
  }

  // Close connection (for cleanup)
  async quit(): Promise<void> {
    await this.client.quit();
  }
}

/**
 * Pipeline wrapper for ioredis
 */
class LocalRedisPipeline {
  private pipeline: ReturnType<IORedis["pipeline"]>;

  constructor(pipeline: ReturnType<IORedis["pipeline"]>) {
    this.pipeline = pipeline;
  }

  get(key: string): this {
    this.pipeline.get(key);
    return this;
  }

  set(key: string, value: any, options?: SetOptions): this {
    const stringValue = typeof value === "string" ? value : JSON.stringify(value);
    if (options?.ex) {
      this.pipeline.set(key, stringValue, "EX", options.ex);
    } else if (options?.px) {
      this.pipeline.set(key, stringValue, "PX", options.px);
    } else {
      this.pipeline.set(key, stringValue);
    }
    return this;
  }

  del(key: string): this {
    this.pipeline.del(key);
    return this;
  }

  hset(key: string, field: string, value: any): this {
    const stringValue = typeof value === "string" ? value : JSON.stringify(value);
    this.pipeline.hset(key, field, stringValue);
    return this;
  }

  sadd(key: string, member: string): this {
    this.pipeline.sadd(key, member);
    return this;
  }

  async exec<T = any>(): Promise<PipelineResult<T>[]> {
    const results = await this.pipeline.exec();
    if (!results) return [];

    return results.map(([err, result]) => {
      if (err) throw err;
      if (result === null) return null;
      if (typeof result === "string") {
        try {
          return JSON.parse(result);
        } catch {
          return result;
        }
      }
      return result;
    }) as PipelineResult<T>[];
  }
}

// Create the appropriate Redis client based on environment
let redis: UpstashRedis | LocalRedisClient;
let redisWithTimeout: UpstashRedis | LocalRedisClient;

if (USE_LOCAL_REDIS) {
  // Use standard Redis with ioredis
  redis = new LocalRedisClient(REDIS_URL);
  redisWithTimeout = new LocalRedisClient(REDIS_URL, 1000);

  console.log("[Redis] Using local Redis at", REDIS_URL);
} else {
  // Use Upstash Redis REST API
  redis = new UpstashRedis({
    url: process.env.UPSTASH_REDIS_REST_URL || "",
    token: process.env.UPSTASH_REDIS_REST_TOKEN || "",
  });

  redisWithTimeout = new UpstashRedis({
    url: process.env.UPSTASH_REDIS_REST_URL || "",
    token: process.env.UPSTASH_REDIS_REST_TOKEN || "",
    signal: () => AbortSignal.timeout(1000),
  });
}

export { redis, redisWithTimeout };
export type { SetOptions, ScanOptions };
