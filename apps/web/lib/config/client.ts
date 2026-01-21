/**
 * Configuration client abstraction
 *
 * Supports both Vercel Edge Config and local database/Redis configuration.
 * Toggle between them using:
 * - USE_LOCAL_CONFIG=true - Use database + Redis (self-hosted)
 * - USE_LOCAL_CONFIG=false (default) - Use Vercel Edge Config
 *
 * For self-hosted deployments, set USE_LOCAL_CONFIG=true to bypass
 * Vercel Edge Config and use database as source of truth with Redis caching.
 */

import { get, getAll } from "@vercel/edge-config";
import { localConfigClient } from "./local-client";
import {
  ConfigClient,
  ConfigKey,
  ConfigValueType,
  CONFIG_DEFAULTS,
} from "./types";

// Environment check for local config
const USE_LOCAL_CONFIG = process.env.USE_LOCAL_CONFIG === "true";

/**
 * Vercel Edge Config client wrapper
 * Provides the same interface as local config client
 */
class EdgeConfigClient implements ConfigClient {
  async get<K extends ConfigKey>(key: K): Promise<ConfigValueType[K] | null> {
    try {
      const value = await get(key);
      return (value as ConfigValueType[K]) ?? null;
    } catch (error) {
      console.error(
        `[EdgeConfig] Error getting config key "${key}":`,
        error,
      );
      return null;
    }
  }

  async getAll<K extends ConfigKey>(
    keys: K[],
  ): Promise<{ [key in K]: ConfigValueType[key] }> {
    try {
      const values = await getAll(keys);
      return values as { [key in K]: ConfigValueType[key] };
    } catch (error) {
      console.error(`[EdgeConfig] Error getting config keys:`, error);
      // Return defaults on error
      const result = {} as { [key in K]: ConfigValueType[key] };
      keys.forEach((key) => {
        result[key] = CONFIG_DEFAULTS[key] as ConfigValueType[K];
      });
      return result;
    }
  }

  async update<K extends ConfigKey>(
    key: K,
    value: K extends "betaFeatures" ? never : string,
  ): Promise<void> {
    // Edge Config updates go through Vercel API
    // This is handled by the update.ts file using the existing updateConfig function
    throw new Error(
      "Edge Config updates should use the updateConfig function from edge-config/update.ts",
    );
  }

  async set<K extends ConfigKey>(
    _key: K,
    _value: ConfigValueType[K],
  ): Promise<void> {
    throw new Error(
      "Edge Config set should use the Vercel API directly",
    );
  }

  async remove<K extends ConfigKey>(
    _key: K,
    _value: K extends "betaFeatures" ? never : string,
  ): Promise<void> {
    throw new Error(
      "Edge Config remove should use the Vercel API directly",
    );
  }

  async clearCache(_key?: ConfigKey): Promise<void> {
    // Edge Config has its own caching, no-op here
  }
}

// Create the appropriate client based on environment
let configClient: ConfigClient;

if (USE_LOCAL_CONFIG) {
  configClient = localConfigClient;
  console.log("[Config] Using local database/Redis configuration");
} else {
  configClient = new EdgeConfigClient();
}

export { configClient };
export { localConfigClient } from "./local-client";
export * from "./types";
