/**
 * Geolocation data returned from IP lookup
 * Matches the structure of @vercel/functions geolocation()
 */
export interface GeoData {
  /** Two-letter country code (ISO 3166-1 alpha-2) */
  country?: string;
  /** Region/state code */
  region?: string;
  /** City name */
  city?: string;
  /** Latitude as string */
  latitude?: string;
  /** Longitude as string */
  longitude?: string;
}

/**
 * Extended geolocation data with continent
 * Used for click tracking and analytics
 */
export interface ExtendedGeoData extends GeoData {
  /** Two-letter continent code (AF, AN, AS, EU, NA, OC, SA) */
  continent?: string;
}

/**
 * Response from IP address extraction
 */
export interface IpInfo {
  /** Extracted IP address */
  ip: string | null;
  /** Source header or method used to extract IP */
  source: string;
}
