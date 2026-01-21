import { IpInfo } from "./types";

/**
 * List of headers to check for client IP address (in order of preference)
 * These are commonly set by reverse proxies and load balancers
 */
const IP_HEADERS = [
  // Cloudflare
  "cf-connecting-ip",
  // Vercel
  "x-vercel-forwarded-for",
  "x-real-ip",
  // Standard proxy headers
  "x-forwarded-for",
  // Fastly
  "fastly-client-ip",
  // AWS ALB/ELB
  "x-client-ip",
  // Akamai
  "true-client-ip",
  // Nginx
  "x-nginx-proxy",
  // Generic
  "forwarded",
] as const;

/**
 * Check if an IP address is valid (IPv4 or IPv6)
 */
function isValidIp(ip: string): boolean {
  // Basic IPv4 validation
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  // Basic IPv6 validation (simplified)
  const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;

  if (ipv4Regex.test(ip)) {
    // Validate each octet is 0-255
    const octets = ip.split(".");
    return octets.every((octet) => {
      const num = parseInt(octet, 10);
      return num >= 0 && num <= 255;
    });
  }

  return ipv6Regex.test(ip);
}

/**
 * Parse the X-Forwarded-For header which may contain multiple IPs
 * Returns the first (client) IP from the chain
 */
function parseForwardedFor(value: string): string | null {
  // X-Forwarded-For format: client, proxy1, proxy2, ...
  const ips = value.split(",").map((ip) => ip.trim());

  for (const ip of ips) {
    // Skip empty values and IPv6 brackets
    const cleanIp = ip.replace(/^\[|\]$/g, "");
    if (cleanIp && isValidIp(cleanIp)) {
      return cleanIp;
    }
  }

  return null;
}

/**
 * Parse the RFC 7239 Forwarded header
 * Format: for=192.0.2.60;proto=http;by=203.0.113.43
 */
function parseForwardedHeader(value: string): string | null {
  const forMatch = value.match(/for=["']?([^;,\s"']+)/i);
  if (forMatch) {
    const ip = forMatch[1].replace(/^\[|\]$/g, "");
    if (isValidIp(ip)) {
      return ip;
    }
  }
  return null;
}

/**
 * Extract the client IP address from a request
 * Checks various headers set by reverse proxies
 *
 * @param req - The incoming request
 * @returns IP info with the extracted IP and source
 */
export function getIpAddress(req: Request): IpInfo {
  const headers =
    req.headers instanceof Headers ? req.headers : new Headers(req.headers);

  for (const headerName of IP_HEADERS) {
    const value = headers.get(headerName);

    if (!value) {
      continue;
    }

    let ip: string | null = null;

    if (headerName === "x-forwarded-for" || headerName === "x-vercel-forwarded-for") {
      ip = parseForwardedFor(value);
    } else if (headerName === "forwarded") {
      ip = parseForwardedHeader(value);
    } else {
      // Direct IP header
      const cleanIp = value.trim().replace(/^\[|\]$/g, "");
      if (isValidIp(cleanIp)) {
        ip = cleanIp;
      }
    }

    if (ip) {
      return { ip, source: headerName };
    }
  }

  return { ip: null, source: "none" };
}

/**
 * Extract the client IP address from a request, with fallback to localhost IP
 * This is a convenience wrapper that returns a non-null IP
 *
 * @param req - The incoming request
 * @param fallbackIp - IP to use if none found (default: "127.0.0.1")
 * @returns The extracted IP address or fallback
 */
export function getIpAddressOrFallback(
  req: Request,
  fallbackIp: string = "127.0.0.1",
): string {
  const { ip } = getIpAddress(req);
  return ip || fallbackIp;
}
