import { Ratelimit as UpstashRatelimit } from "@upstash/ratelimit";
import { redis } from "./redis";

// Environment check for local Redis
const USE_LOCAL_REDIS = process.env.USE_LOCAL_REDIS === "true";

/**
 * Rate limiting result interface
 */
interface RatelimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  pending: Promise<unknown>;
}

/**
 * Local rate limiter implementation using sliding window algorithm
 * Compatible with Upstash Ratelimit API
 */
class LocalRatelimit {
  private windowSize: number; // in milliseconds
  private maxRequests: number;
  private prefix: string;

  constructor(options: {
    windowMs: number;
    maxRequests: number;
    prefix?: string;
  }) {
    this.windowSize = options.windowMs;
    this.maxRequests = options.maxRequests;
    this.prefix = options.prefix || "ratelimit";
  }

  /**
   * Sliding window rate limiting implementation
   * Uses Redis sorted sets to track request timestamps
   */
  async limit(identifier: string): Promise<RatelimitResult> {
    const now = Date.now();
    const windowStart = now - this.windowSize;
    const key = `${this.prefix}:${identifier}`;

    try {
      // Use a Lua script for atomic operations (simulated with multiple commands)
      // In production, this should ideally be a Lua script for atomicity

      // Remove expired entries
      await (redis as any).client?.zremrangebyscore?.(key, 0, windowStart) ||
        // Fallback for local client - use direct command
        this.removeExpiredEntries(key, windowStart);

      // Count current requests in window
      const count = await this.countRequests(key, windowStart, now);

      if (count >= this.maxRequests) {
        // Rate limited
        const oldestTimestamp = await this.getOldestTimestamp(key);
        const reset = oldestTimestamp
          ? Math.ceil((oldestTimestamp + this.windowSize) / 1000)
          : Math.ceil((now + this.windowSize) / 1000);

        return {
          success: false,
          limit: this.maxRequests,
          remaining: 0,
          reset,
          pending: Promise.resolve(),
        };
      }

      // Add new request
      await this.addRequest(key, now);

      // Set expiry on the key to auto-cleanup
      await (redis as any).expire?.(key, Math.ceil(this.windowSize / 1000) + 1);

      return {
        success: true,
        limit: this.maxRequests,
        remaining: this.maxRequests - count - 1,
        reset: Math.ceil((now + this.windowSize) / 1000),
        pending: Promise.resolve(),
      };
    } catch (error) {
      console.error("Rate limit error:", error);
      // On error, allow the request (fail open)
      return {
        success: true,
        limit: this.maxRequests,
        remaining: this.maxRequests,
        reset: Math.ceil((now + this.windowSize) / 1000),
        pending: Promise.resolve(),
      };
    }
  }

  private async removeExpiredEntries(
    key: string,
    windowStart: number
  ): Promise<void> {
    // Using ZREMRANGEBYSCORE via raw command
    // This removes all entries with score less than windowStart
    const client = (redis as any).client;
    if (client?.zremrangebyscore) {
      await client.zremrangebyscore(key, 0, windowStart);
    }
  }

  private async countRequests(
    key: string,
    windowStart: number,
    now: number
  ): Promise<number> {
    // Count entries in the time window using ZCOUNT
    const client = (redis as any).client;
    if (client?.zcount) {
      return await client.zcount(key, windowStart, now);
    }
    return 0;
  }

  private async getOldestTimestamp(key: string): Promise<number | null> {
    // Get the oldest entry in the sorted set
    const client = (redis as any).client;
    if (client?.zrange) {
      const result = await client.zrange(key, 0, 0, "WITHSCORES");
      if (result && result.length >= 2) {
        return parseInt(result[1], 10);
      }
    }
    return null;
  }

  private async addRequest(key: string, timestamp: number): Promise<void> {
    // Add a new entry with timestamp as both score and member (to ensure uniqueness)
    const client = (redis as any).client;
    const member = `${timestamp}:${Math.random().toString(36).slice(2, 11)}`;
    if (client?.zadd) {
      await client.zadd(key, timestamp, member);
    }
  }
}

/**
 * Enhanced local rate limiter with direct ioredis access
 * Uses the same sliding window algorithm as Upstash
 */
class LocalRatelimitWithRedis {
  private windowMs: number;
  private maxRequests: number;
  private prefix: string;
  private timeout: number;

  constructor(options: {
    windowMs: number;
    maxRequests: number;
    prefix?: string;
    timeout?: number;
  }) {
    this.windowMs = options.windowMs;
    this.maxRequests = options.maxRequests;
    this.prefix = options.prefix || "dub";
    this.timeout = options.timeout || 1000;
  }

  async limit(identifier: string): Promise<RatelimitResult> {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const key = `${this.prefix}:${identifier}`;

    // Create timeout promise
    const timeoutPromise = new Promise<RatelimitResult>((_, reject) =>
      setTimeout(() => reject(new Error("Rate limit timeout")), this.timeout)
    );

    try {
      const result = await Promise.race([
        this.performRateLimit(key, now, windowStart),
        timeoutPromise,
      ]);
      return result;
    } catch (error) {
      // On timeout or error, allow the request (fail open)
      console.error("Rate limit error:", error);
      return {
        success: true,
        limit: this.maxRequests,
        remaining: this.maxRequests,
        reset: Math.ceil((now + this.windowMs) / 1000),
        pending: Promise.resolve(),
      };
    }
  }

  private async performRateLimit(
    key: string,
    now: number,
    windowStart: number
  ): Promise<RatelimitResult> {
    // Access the underlying ioredis client
    const localRedis = redis as any;
    const client = localRedis.client;

    if (!client) {
      // Fallback if client is not accessible
      return {
        success: true,
        limit: this.maxRequests,
        remaining: this.maxRequests,
        reset: Math.ceil((now + this.windowMs) / 1000),
        pending: Promise.resolve(),
      };
    }

    // Lua script for atomic sliding window rate limiting
    const luaScript = `
      local key = KEYS[1]
      local now = tonumber(ARGV[1])
      local window_start = tonumber(ARGV[2])
      local max_requests = tonumber(ARGV[3])
      local window_ms = tonumber(ARGV[4])

      -- Remove expired entries
      redis.call('ZREMRANGEBYSCORE', key, 0, window_start)

      -- Count current requests
      local count = redis.call('ZCARD', key)

      if count >= max_requests then
        -- Get reset time from oldest entry
        local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
        local reset_time = now + window_ms
        if oldest and #oldest >= 2 then
          reset_time = tonumber(oldest[2]) + window_ms
        end
        return {0, max_requests, 0, reset_time}
      end

      -- Add new request with unique member
      local member = now .. ':' .. math.random(1000000000)
      redis.call('ZADD', key, now, member)

      -- Set expiry
      redis.call('PEXPIRE', key, window_ms + 1000)

      local remaining = max_requests - count - 1
      local reset_time = now + window_ms

      return {1, max_requests, remaining, reset_time}
    `;

    try {
      const result = await client.eval(
        luaScript,
        1,
        key,
        now,
        windowStart,
        this.maxRequests,
        this.windowMs
      );

      const [success, limit, remaining, resetMs] = result as number[];

      return {
        success: success === 1,
        limit,
        remaining: Math.max(0, remaining),
        reset: Math.ceil(resetMs / 1000),
        pending: Promise.resolve(),
      };
    } catch (error) {
      // If Lua script fails, fall back to basic counting
      console.error("Lua script error, falling back to basic rate limiting:", error);
      return this.fallbackRateLimit(key, now, windowStart, client);
    }
  }

  private async fallbackRateLimit(
    key: string,
    now: number,
    windowStart: number,
    client: any
  ): Promise<RatelimitResult> {
    try {
      // Remove expired entries
      await client.zremrangebyscore(key, 0, windowStart);

      // Count current requests
      const count = await client.zcard(key);

      if (count >= this.maxRequests) {
        return {
          success: false,
          limit: this.maxRequests,
          remaining: 0,
          reset: Math.ceil((now + this.windowMs) / 1000),
          pending: Promise.resolve(),
        };
      }

      // Add new request
      const member = `${now}:${Math.random().toString(36).slice(2, 11)}`;
      await client.zadd(key, now, member);
      await client.pexpire(key, this.windowMs + 1000);

      return {
        success: true,
        limit: this.maxRequests,
        remaining: this.maxRequests - count - 1,
        reset: Math.ceil((now + this.windowMs) / 1000),
        pending: Promise.resolve(),
      };
    } catch (error) {
      // On any error, allow the request
      return {
        success: true,
        limit: this.maxRequests,
        remaining: this.maxRequests,
        reset: Math.ceil((now + this.windowMs) / 1000),
        pending: Promise.resolve(),
      };
    }
  }
}

/**
 * Parse duration string to milliseconds
 * Supports: "10 s", "5 m", "1 h", "1 d", "100 ms"
 */
export function parseDuration(
  duration: `${number} ms` | `${number} s` | `${number} m` | `${number} h` | `${number} d`
): number {
  const match = duration.match(/^(\d+)\s*(ms|s|m|h|d)$/);
  if (!match) throw new Error(`Invalid duration format: ${duration}`);

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case "ms":
      return value;
    case "s":
      return value * 1000;
    case "m":
      return value * 60 * 1000;
    case "h":
      return value * 60 * 60 * 1000;
    case "d":
      return value * 24 * 60 * 60 * 1000;
    default:
      throw new Error(`Invalid duration unit: ${unit}`);
  }
}

/**
 * Create a rate limiter that works with both Upstash and local Redis
 *
 * @param requests - Maximum number of requests allowed in the window
 * @param seconds - Duration string (e.g., "10 s", "1 m", "1 h")
 * @returns Rate limiter instance with limit() method
 *
 * @example
 * const limiter = ratelimit(10, "10 s"); // 10 requests per 10 seconds
 * const result = await limiter.limit("user:123");
 * if (!result.success) {
 *   // Rate limited
 * }
 */
export const ratelimit = (
  requests: number = 10,
  seconds:
    | `${number} ms`
    | `${number} s`
    | `${number} m`
    | `${number} h`
    | `${number} d` = "10 s"
) => {
  if (USE_LOCAL_REDIS) {
    // Use local rate limiter with ioredis
    const windowMs = parseDuration(seconds);
    return new LocalRatelimitWithRedis({
      windowMs,
      maxRequests: requests,
      prefix: "dub",
      timeout: 1000,
    });
  }

  // Use Upstash rate limiter
  return new UpstashRatelimit({
    redis: redis as any,
    limiter: UpstashRatelimit.slidingWindow(requests, seconds),
    analytics: true,
    prefix: "dub",
    timeout: 1000,
  });
};

// Export types for consumers
export type { RatelimitResult };
