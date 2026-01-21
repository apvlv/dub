import { ipAddressOrFallback } from "@/lib/geo";
import { hashStringSHA256 } from "@dub/utils";
import { userAgent } from "next/server";

/**
 * Combine IP + UA to create a unique identifier for the user (for deduplication)
 */
export async function getIdentityHash(req: Request) {
  const ip = ipAddressOrFallback(req);
  const ua = userAgent(req);
  return await hashStringSHA256(`${ip}-${ua.ua}`);
}
