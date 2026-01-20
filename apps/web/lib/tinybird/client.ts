import { Tinybird } from "@chronark/zod-bird";
import { analytics, tb as clickhouseTb } from "../clickhouse/client";

// Environment check for local ClickHouse
const USE_LOCAL_CLICKHOUSE = process.env.USE_LOCAL_CLICKHOUSE === "true";

// Create the Tinybird client (for backwards compatibility and when not using local ClickHouse)
const tinybirdClient = new Tinybird({
  token: process.env.TINYBIRD_API_KEY as string,
  baseUrl: process.env.TINYBIRD_API_URL as string,
});

/**
 * Analytics client that supports both Tinybird and local ClickHouse
 *
 * Toggle using:
 * - USE_LOCAL_CLICKHOUSE=true - Use self-hosted ClickHouse
 * - USE_LOCAL_CLICKHOUSE=false (default) - Use Tinybird
 */
export const tb = USE_LOCAL_CLICKHOUSE ? clickhouseTb : tinybirdClient;

// Re-export the analytics client for new code
export { analytics };
