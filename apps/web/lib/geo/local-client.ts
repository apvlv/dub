import { LOCALHOST_GEO_DATA, LOCALHOST_IP } from "@dub/utils";
import { getIpAddress, getIpAddressOrFallback } from "./ip-address";
import { ExtendedGeoData, GeoData } from "./types";

// Lazy-loaded MaxMind reader (only loaded when needed)
let maxmindReader: any = null;
let maxmindLoadPromise: Promise<any> | null = null;
let maxmindLoadError: Error | null = null;

/**
 * Map of GeoName continent IDs to two-letter continent codes
 */
const CONTINENT_CODE_MAP: Record<number, string> = {
  6255146: "AF", // Africa
  6255147: "AS", // Asia
  6255148: "EU", // Europe
  6255149: "NA", // North America
  6255150: "SA", // South America
  6255151: "OC", // Oceania
  6255152: "AN", // Antarctica
};

/**
 * Load the MaxMind GeoLite2 database
 * Uses lazy loading to avoid startup overhead
 */
async function loadMaxmindReader(): Promise<any> {
  // If we already have a reader, return it
  if (maxmindReader) {
    return maxmindReader;
  }

  // If we previously failed to load, throw that error
  if (maxmindLoadError) {
    throw maxmindLoadError;
  }

  // If we're already loading, wait for that
  if (maxmindLoadPromise) {
    return maxmindLoadPromise;
  }

  // Start loading
  maxmindLoadPromise = (async () => {
    try {
      const dbPath = process.env.GEOLITE2_PATH;

      if (!dbPath) {
        throw new Error(
          "GEOLITE2_PATH environment variable is not set. " +
            "Please set it to the path of your GeoLite2-City.mmdb file.",
        );
      }

      // Dynamic import to avoid bundling issues
      const { Reader } = await import("@maxmind/geoip2-node");
      maxmindReader = await Reader.open(dbPath);
      return maxmindReader;
    } catch (error) {
      maxmindLoadError = error as Error;
      maxmindLoadPromise = null;
      throw error;
    }
  })();

  return maxmindLoadPromise;
}

/**
 * Look up geolocation data for an IP address using MaxMind GeoLite2
 *
 * @param ip - The IP address to look up
 * @returns Geolocation data or null if lookup fails
 */
export async function lookupIp(ip: string): Promise<ExtendedGeoData | null> {
  // Skip localhost/private IP lookups
  if (isPrivateIp(ip)) {
    return null;
  }

  try {
    const reader = await loadMaxmindReader();
    const response = reader.city(ip);

    return {
      country: response.country?.isoCode,
      region: response.subdivisions?.[0]?.isoCode,
      city: response.city?.names?.en,
      latitude: response.location?.latitude?.toString(),
      longitude: response.location?.longitude?.toString(),
      continent: response.continent?.geonameId
        ? CONTINENT_CODE_MAP[response.continent.geonameId]
        : undefined,
    };
  } catch (error) {
    // Log but don't throw - geolocation failures shouldn't break the app
    console.warn(`GeoLite2 lookup failed for IP ${ip}:`, error);
    return null;
  }
}

/**
 * Check if an IP address is private/local
 */
function isPrivateIp(ip: string): boolean {
  // IPv4 private ranges
  if (
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    ip.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./) ||
    ip.startsWith("127.") ||
    ip === "localhost"
  ) {
    return true;
  }

  // IPv6 private/local
  if (ip.startsWith("::1") || ip.startsWith("fe80:") || ip.startsWith("fc") || ip.startsWith("fd")) {
    return true;
  }

  return false;
}

/**
 * Get geolocation data from a request using local GeoLite2 database
 * Falls back to localhost data if lookup fails
 *
 * @param req - The incoming request
 * @returns Geolocation data
 */
export async function geolocationLocal(req: Request): Promise<GeoData> {
  const ip = getIpAddressOrFallback(req, LOCALHOST_IP);

  // For development/localhost, return default data
  if (isPrivateIp(ip)) {
    return LOCALHOST_GEO_DATA;
  }

  const geoData = await lookupIp(ip);

  if (geoData) {
    return geoData;
  }

  // Fallback to localhost data if lookup fails
  return LOCALHOST_GEO_DATA;
}

/**
 * Get IP address from a request using local header detection
 *
 * @param req - The incoming request
 * @returns The IP address or null
 */
export function ipAddressLocal(req: Request): string | null {
  const { ip } = getIpAddress(req);
  return ip;
}

/**
 * Get extended geolocation data including continent from a request
 *
 * @param req - The incoming request
 * @returns Extended geolocation data with continent
 */
export async function geolocationExtendedLocal(
  req: Request,
): Promise<ExtendedGeoData> {
  const ip = getIpAddressOrFallback(req, LOCALHOST_IP);

  // For development/localhost, return default data
  if (isPrivateIp(ip)) {
    return {
      ...LOCALHOST_GEO_DATA,
      continent: LOCALHOST_GEO_DATA.continent || "NA",
    };
  }

  const geoData = await lookupIp(ip);

  if (geoData) {
    return geoData;
  }

  // Fallback to localhost data if lookup fails
  return {
    ...LOCALHOST_GEO_DATA,
    continent: LOCALHOST_GEO_DATA.continent || "NA",
  };
}

/**
 * Check if GeoLite2 database is configured and available
 *
 * @returns True if the database is available
 */
export async function isGeoLite2Available(): Promise<boolean> {
  if (!process.env.GEOLITE2_PATH) {
    return false;
  }

  try {
    await loadMaxmindReader();
    return true;
  } catch {
    return false;
  }
}
