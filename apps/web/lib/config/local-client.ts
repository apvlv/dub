/**
 * Local configuration client using database as source of truth and Redis for caching
 *
 * This replaces Vercel Edge Config for self-hosted deployments.
 * Toggle with USE_LOCAL_CONFIG=true environment variable.
 *
 * Data flow:
 * 1. Read: Redis cache -> Database -> Default value
 * 2. Write: Database -> Invalidate Redis cache
 */

import { prisma } from "@dub/prisma";
import { redis } from "../upstash";
import {
  ConfigClient,
  ConfigKey,
  ConfigValueType,
  CONFIG_DEFAULTS,
} from "./types";

// Redis key prefix for config values
const REDIS_CONFIG_PREFIX = "config:";

// Cache TTL in seconds (5 minutes)
const CACHE_TTL = 300;

/**
 * Local configuration client implementation
 * Uses MySQL/Prisma as source of truth with Redis caching
 */
class LocalConfigClient implements ConfigClient {
  /**
   * Get a single configuration value
   */
  async get<K extends ConfigKey>(key: K): Promise<ConfigValueType[K] | null> {
    try {
      // Try Redis cache first
      const cached = await this.getFromCache(key);
      if (cached !== null) {
        return cached as ConfigValueType[K];
      }

      // Fall back to database
      const dbValue = await this.getFromDatabase(key);
      if (dbValue !== null) {
        // Cache the value
        await this.setCache(key, dbValue);
        return dbValue as ConfigValueType[K];
      }

      // Return default value
      return CONFIG_DEFAULTS[key] as ConfigValueType[K];
    } catch (error) {
      console.error(`[LocalConfig] Error getting config key "${key}":`, error);
      // Return default on error
      return CONFIG_DEFAULTS[key] as ConfigValueType[K];
    }
  }

  /**
   * Get multiple configuration values
   */
  async getAll<K extends ConfigKey>(
    keys: K[],
  ): Promise<{ [key in K]: ConfigValueType[key] }> {
    const result = {} as { [key in K]: ConfigValueType[key] };

    // Fetch all keys in parallel
    await Promise.all(
      keys.map(async (key) => {
        const value = await this.get(key);
        result[key] = value ?? (CONFIG_DEFAULTS[key] as ConfigValueType[K]);
      }),
    );

    return result;
  }

  /**
   * Update a configuration value (add a new entry to the list)
   */
  async update<K extends ConfigKey>(
    key: K,
    value: K extends "betaFeatures" ? never : string,
  ): Promise<void> {
    try {
      // Get existing data
      const existing = (await this.getFromDatabase(key)) as string[] | null;
      const existingArray = existing ?? [];

      // Add new value if not already present
      if (!existingArray.includes(value as string)) {
        const newValue = [...existingArray, value];

        // Update database
        await prisma.configEntry.upsert({
          where: { key },
          update: { value: newValue },
          create: { key, value: newValue },
        });

        // Invalidate cache
        await this.clearCache(key);
      }
    } catch (error) {
      console.error(
        `[LocalConfig] Error updating config key "${key}":`,
        error,
      );
      throw error;
    }
  }

  /**
   * Set a configuration value (replace entirely)
   */
  async set<K extends ConfigKey>(
    key: K,
    value: ConfigValueType[K],
  ): Promise<void> {
    try {
      // Update database
      await prisma.configEntry.upsert({
        where: { key },
        update: { value: value as any },
        create: { key, value: value as any },
      });

      // Invalidate cache
      await this.clearCache(key);
    } catch (error) {
      console.error(`[LocalConfig] Error setting config key "${key}":`, error);
      throw error;
    }
  }

  /**
   * Remove a value from a configuration list
   */
  async remove<K extends ConfigKey>(
    key: K,
    value: K extends "betaFeatures" ? never : string,
  ): Promise<void> {
    try {
      // Get existing data
      const existing = (await this.getFromDatabase(key)) as string[] | null;
      if (!existing) return;

      // Remove the value
      const newValue = existing.filter((v) => v !== value);

      // Update database
      await prisma.configEntry.upsert({
        where: { key },
        update: { value: newValue },
        create: { key, value: newValue },
      });

      // Invalidate cache
      await this.clearCache(key);
    } catch (error) {
      console.error(
        `[LocalConfig] Error removing from config key "${key}":`,
        error,
      );
      throw error;
    }
  }

  /**
   * Clear Redis cache for a key (or all config keys if not specified)
   */
  async clearCache(key?: ConfigKey): Promise<void> {
    try {
      if (key) {
        await redis.del(`${REDIS_CONFIG_PREFIX}${key}`);
      } else {
        // Clear all config keys
        const allKeys = Object.keys(CONFIG_DEFAULTS) as ConfigKey[];
        await Promise.all(
          allKeys.map((k) => redis.del(`${REDIS_CONFIG_PREFIX}${k}`)),
        );
      }
    } catch (error) {
      console.error(`[LocalConfig] Error clearing cache:`, error);
      // Don't throw - cache clearing is not critical
    }
  }

  /**
   * Get value from Redis cache
   */
  private async getFromCache<K extends ConfigKey>(
    key: K,
  ): Promise<ConfigValueType[K] | null> {
    try {
      const cached = await redis.get<ConfigValueType[K]>(
        `${REDIS_CONFIG_PREFIX}${key}`,
      );
      return cached;
    } catch (error) {
      console.error(
        `[LocalConfig] Error reading from cache for key "${key}":`,
        error,
      );
      return null;
    }
  }

  /**
   * Set value in Redis cache
   */
  private async setCache<K extends ConfigKey>(
    key: K,
    value: ConfigValueType[K],
  ): Promise<void> {
    try {
      await redis.set(`${REDIS_CONFIG_PREFIX}${key}`, value, { ex: CACHE_TTL });
    } catch (error) {
      console.error(
        `[LocalConfig] Error writing to cache for key "${key}":`,
        error,
      );
      // Don't throw - caching is not critical
    }
  }

  /**
   * Get value from database
   */
  private async getFromDatabase<K extends ConfigKey>(
    key: K,
  ): Promise<ConfigValueType[K] | null> {
    try {
      const entry = await prisma.configEntry.findUnique({
        where: { key },
      });

      if (!entry) return null;

      return entry.value as ConfigValueType[K];
    } catch (error) {
      console.error(
        `[LocalConfig] Error reading from database for key "${key}":`,
        error,
      );
      return null;
    }
  }
}

// Export singleton instance
export const localConfigClient = new LocalConfigClient();
