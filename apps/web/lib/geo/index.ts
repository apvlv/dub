/**
 * Geolocation module
 *
 * Provides IP geolocation services with support for both
 * Vercel Functions and self-hosted GeoLite2 database.
 *
 * Usage:
 * ```typescript
 * import { geolocation, ipAddress } from "@/lib/geo";
 *
 * // Get geolocation data
 * const geo = geolocation(req);
 * console.log(geo.country); // "US"
 *
 * // Get IP address
 * const ip = ipAddress(req);
 * console.log(ip); // "1.2.3.4"
 * ```
 *
 * Environment Variables:
 * - USE_LOCAL_GEO=true - Enable local GeoLite2 database
 * - GEOLITE2_PATH=/path/to/GeoLite2-City.mmdb - Path to database file
 */

export {
  geolocation,
  geolocationAsync,
  geolocationExtended,
  ipAddress,
  ipAddressOrFallback,
  isLocalGeoAvailable,
  lookupIpAddress,
} from "./client";

export { getIpAddress, getIpAddressOrFallback } from "./ip-address";

export type { ExtendedGeoData, GeoData, IpInfo } from "./types";
