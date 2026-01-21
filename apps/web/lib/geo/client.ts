/**
 * Geolocation abstraction layer
 *
 * Supports two backends:
 * 1. Vercel Functions (default) - Uses @vercel/functions geolocation() and ipAddress()
 * 2. Local GeoLite2 - Uses MaxMind GeoLite2 database for self-hosted deployments
 *
 * Toggle with USE_LOCAL_GEO=true environment variable
 *
 * When USE_LOCAL_GEO=true, requires:
 * - GEOLITE2_PATH: Path to GeoLite2-City.mmdb database file
 * - @maxmind/geoip2-node package installed
 */

import { LOCALHOST_GEO_DATA, LOCALHOST_IP } from "@dub/utils";
import {
  geolocation as vercelGeolocation,
  ipAddress as vercelIpAddress,
} from "@vercel/functions";
import {
  geolocationExtendedLocal,
  geolocationLocal,
  ipAddressLocal,
  isGeoLite2Available,
  lookupIp,
} from "./local-client";
import { ExtendedGeoData, GeoData } from "./types";

// Environment check for local geo
const USE_LOCAL_GEO = process.env.USE_LOCAL_GEO === "true";

/**
 * Get geolocation data from a request
 *
 * @param req - The incoming request
 * @returns Geolocation data matching @vercel/functions format
 */
export function geolocation(req: Request): GeoData {
  if (USE_LOCAL_GEO) {
    // Local implementation is async but Vercel's is sync
    // For middleware compatibility, we need to return sync
    // The actual lookup is handled elsewhere for async contexts
    const ip = ipAddress(req);
    if (!ip || ip === LOCALHOST_IP) {
      return LOCALHOST_GEO_DATA;
    }
    // Return default data - actual geo is obtained via geolocationAsync
    return LOCALHOST_GEO_DATA;
  }

  // Vercel implementation
  if (process.env.VERCEL === "1") {
    return vercelGeolocation(req);
  }

  return LOCALHOST_GEO_DATA;
}

/**
 * Get geolocation data from a request (async version)
 * Use this in non-middleware contexts where async is allowed
 *
 * @param req - The incoming request
 * @returns Geolocation data
 */
export async function geolocationAsync(req: Request): Promise<GeoData> {
  if (USE_LOCAL_GEO) {
    return geolocationLocal(req);
  }

  // Vercel implementation
  if (process.env.VERCEL === "1") {
    return vercelGeolocation(req);
  }

  return LOCALHOST_GEO_DATA;
}

/**
 * Get extended geolocation data with continent (async)
 * Use this in contexts where you need continent information
 *
 * @param req - The incoming request
 * @returns Extended geolocation data with continent
 */
export async function geolocationExtended(
  req: Request,
): Promise<ExtendedGeoData> {
  if (USE_LOCAL_GEO) {
    return geolocationExtendedLocal(req);
  }

  // Vercel implementation - get continent from header
  if (process.env.VERCEL === "1") {
    const geo = vercelGeolocation(req);
    const headers =
      req.headers instanceof Headers ? req.headers : new Headers(req.headers);

    return {
      ...geo,
      continent: headers.get("x-vercel-ip-continent") || undefined,
    };
  }

  return {
    ...LOCALHOST_GEO_DATA,
    continent: LOCALHOST_GEO_DATA.continent || "NA",
  };
}

/**
 * Get the client IP address from a request
 *
 * @param req - The incoming request
 * @returns The IP address or null
 */
export function ipAddress(req: Request): string | null {
  if (USE_LOCAL_GEO) {
    return ipAddressLocal(req);
  }

  // Vercel implementation
  if (process.env.VERCEL === "1") {
    return vercelIpAddress(req);
  }

  return null;
}

/**
 * Get the client IP address with a fallback value
 *
 * @param req - The incoming request
 * @param fallback - Fallback IP address (default: LOCALHOST_IP)
 * @returns The IP address or fallback
 */
export function ipAddressOrFallback(
  req: Request,
  fallback: string = LOCALHOST_IP,
): string {
  return ipAddress(req) || fallback;
}

/**
 * Look up geolocation data for a specific IP address
 * Only available when USE_LOCAL_GEO=true
 *
 * @param ip - The IP address to look up
 * @returns Geolocation data or null
 */
export async function lookupIpAddress(
  ip: string,
): Promise<ExtendedGeoData | null> {
  if (USE_LOCAL_GEO) {
    return lookupIp(ip);
  }

  // Not supported in Vercel mode
  return null;
}

/**
 * Check if local geo is enabled and available
 *
 * @returns True if local geo is enabled and the database is available
 */
export async function isLocalGeoAvailable(): Promise<boolean> {
  if (!USE_LOCAL_GEO) {
    return false;
  }

  return isGeoLite2Available();
}

// Re-export types
export type { ExtendedGeoData, GeoData, IpInfo } from "./types";
