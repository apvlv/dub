/**
 * Configuration module
 *
 * Provides a unified interface for feature flags and blacklists.
 * Supports both Vercel Edge Config (production) and local database/Redis (self-hosted).
 *
 * Environment Variables:
 * - USE_LOCAL_CONFIG=true - Use database + Redis (self-hosted deployments)
 * - USE_LOCAL_CONFIG=false (default) - Use Vercel Edge Config
 *
 * Usage:
 * ```typescript
 * import { configClient } from "@/lib/config";
 *
 * // Get a single value
 * const blacklistedDomains = await configClient.get("domains");
 *
 * // Get multiple values
 * const { domains, terms } = await configClient.getAll(["domains", "terms"]);
 *
 * // Update a value (add to list)
 * await configClient.update("domains", "example.com");
 *
 * // Set a value (replace entirely)
 * await configClient.set("domains", ["example.com", "test.com"]);
 *
 * // Remove a value
 * await configClient.remove("domains", "example.com");
 *
 * // Clear cache
 * await configClient.clearCache("domains");
 * ```
 */

export { configClient, localConfigClient } from "./client";
export * from "./types";
