/**
 * Type definitions for configuration entries
 * These match the structure of Vercel Edge Config data
 */

import { BetaFeatures } from "../types";

/**
 * Configuration keys supported by the system
 */
export type ConfigKey =
  | "domains" // Blacklisted domains
  | "whitelistedDomains" // Domains that bypass blacklist
  | "terms" // Blacklisted domain terms (regex patterns)
  | "referrers" // Whitelisted referrer domains
  | "keys" // Blacklisted short link keys
  | "whitelist" // General whitelist
  | "emails" // Blacklisted email patterns
  | "reserved" // Reserved keys (alias for reservedUsernames)
  | "reservedUsernames" // Reserved usernames for Pro+ users
  | "partnersPortal" // Partners portal configuration
  | "betaFeatures"; // Beta feature flags

/**
 * Configuration value types mapped to keys
 */
export type ConfigValueType = {
  domains: string[];
  whitelistedDomains: string[];
  terms: string[];
  referrers: string[];
  keys: string[];
  whitelist: string[];
  emails: string[];
  reserved: string[];
  reservedUsernames: string[];
  partnersPortal: string[];
  betaFeatures: Record<BetaFeatures, string[]>;
};

/**
 * Default values for each configuration key
 */
export const CONFIG_DEFAULTS: ConfigValueType = {
  domains: [],
  whitelistedDomains: [],
  terms: [],
  referrers: [],
  keys: [],
  whitelist: [],
  emails: [],
  reserved: [],
  reservedUsernames: [],
  partnersPortal: [],
  betaFeatures: {
    noDubLink: [],
    analyticsSettingsSiteVisitTracking: [],
  },
};

/**
 * Interface for configuration client
 */
export interface ConfigClient {
  /**
   * Get a single configuration value
   */
  get<K extends ConfigKey>(key: K): Promise<ConfigValueType[K] | null>;

  /**
   * Get multiple configuration values
   */
  getAll<K extends ConfigKey>(
    keys: K[],
  ): Promise<{ [key in K]: ConfigValueType[key] }>;

  /**
   * Update a configuration value (add a new entry to the list)
   */
  update<K extends ConfigKey>(
    key: K,
    value: K extends "betaFeatures" ? never : string,
  ): Promise<void>;

  /**
   * Set a configuration value (replace entirely)
   */
  set<K extends ConfigKey>(key: K, value: ConfigValueType[K]): Promise<void>;

  /**
   * Remove a value from a configuration list
   */
  remove<K extends ConfigKey>(
    key: K,
    value: K extends "betaFeatures" ? never : string,
  ): Promise<void>;

  /**
   * Clear Redis cache for a key (or all keys if not specified)
   */
  clearCache(key?: ConfigKey): Promise<void>;
}
